import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { klapCancel, klapPreauth } from '@/lib/klap-client';
import { logContratoEvent } from '@/lib/contratos-audit';
import { sendGarantiaRenovadaEmail } from '@jurmaq/shared/mail/templates/cliente-garantia-renovada';
import { sendGarantiaFalloRenovacionEmail } from '@jurmaq/shared/mail/templates/cliente-garantia-fallo-renovacion';
import { env } from '@jurmaq/shared/env';

/**
 * POST /api/cron/klap-renew-holds
 *
 * Renovación silenciosa de holds próximos a vencer.
 *
 * Logic:
 *   1. SELECT holds donde renovacion_proxima_at <= now() AND estado='active'.
 *   2. Para cada uno:
 *      a. klapCancel del hold viejo.
 *      b. klapPreauth con el token guardado (off-session) por el mismo monto.
 *      c. Si OK: marca viejo como 'renewed' + crea nuevo registro 'active'.
 *      d. Si FALLA: marca viejo como 'renewal_failed', notifica admin + cliente.
 *   3. Si falla 3 veces seguidas (renovaciones_count >= 3 sin éxito posterior):
 *      marca como 'renewal_failed_terminal' — admin debe actuar.
 *
 * Auth: header x-cron-secret contra env CRON_SECRET.
 * Schedule sugerido: cada hora (más resilient con MCC variables de Klap).
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH_SIZE = 50;
const RENEW_WINDOW_DAYS = 30;

function isAuthorized(request: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  return provided === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const ahoraIso = new Date().toISOString();
  const { data: pendientes, error: selErr } = await supabaseAdmin
    .from('klap_holds')
    .select('id, contrato_id, klap_card_id, hold_actual_id, hold_inicial_id, monto, renovaciones_count')
    .eq('estado', 'active')
    .lte('renovacion_proxima_at', ahoraIso)
    .limit(BATCH_SIZE);

  if (selErr) {
    console.error('[klap-renew-cron-select-fail]', selErr);
    return NextResponse.json({ error: 'Error buscando holds' }, { status: 500 });
  }

  if (!pendientes || pendientes.length === 0) {
    return NextResponse.json({ processed: 0, renewed: 0, failed: 0, ran_at: ahoraIso });
  }

  let renewed = 0;
  let failed = 0;
  const detalles: Array<{ contrato_id: number; status: string; error?: string }> = [];

  for (const hold of pendientes) {
    const cid = hold.contrato_id as number;
    try {
      // Cargar card guardada.
      const { data: card } = await supabaseAdmin
        .from('klap_cards')
        .select('network_token, token_requestor_id, card_brand, card_last4, card_exp_month, card_exp_year, activa')
        .eq('id', hold.klap_card_id as string)
        .maybeSingle();
      if (!card || !card.activa) {
        await supabaseAdmin
          .from('klap_holds')
          .update({ estado: 'renewal_failed', notas: 'Card no encontrada o inactiva' })
          .eq('id', hold.id as string);
        await logContratoEvent(null, cid, 'deposit_hold_renewal_failed', { reason: 'card_inactive' });
        failed++;
        detalles.push({ contrato_id: cid, status: 'failed', error: 'card_inactive' });
        continue;
      }

      const monto = Number(hold.monto);

      // 1. Cancel viejo (best-effort).
      const cancelRes = await klapCancel({
        consumer_transaction_id: crypto.randomUUID(),
        consumer_original_transaction_id: hold.hold_actual_id as string,
        amount: { value: monto, currency_code: 'CLP' },
      });
      // Si cancel falla, igual seguimos: el hold vencerá solo, queremos crear
      // el nuevo de todas formas.
      if (!cancelRes.ok) {
        console.warn('[klap-renew-cancel-fail]', cancelRes.error);
      }

      // 2. Crear nuevo preauth.
      const newConsumerTx = crypto.randomUUID();
      const newRes = await klapPreauth({
        consumer_transaction_id: newConsumerTx,
        amount: { value: monto, currency_code: 'CLP' },
        network_token: {
          network_token: card.network_token as string,
          token_requestor_id: card.token_requestor_id as string,
          card_brand: card.card_brand as 'VISA' | 'MASTERCARD' | 'AMEX',
          card_last4: card.card_last4 as string,
          card_exp_month: card.card_exp_month as number,
          card_exp_year: card.card_exp_year as number,
        },
        merchant_meta: { renovacion: 'true', contrato_id: String(cid) },
      });

      if (!newRes.ok || !newRes.data) {
        await supabaseAdmin
          .from('klap_holds')
          .update({
            estado: 'renewal_failed',
            notas: `Renew failed: ${newRes.error || 'unknown'}`,
          })
          .eq('id', hold.id as string);
        await logContratoEvent(null, cid, 'deposit_hold_renewal_failed', {
          reason: newRes.error || 'unknown',
        });
        await supabaseAdmin.from('klap_eventos').insert({
          evento_tipo: 'deposit_hold_renewal_failed',
          contrato_id: cid,
          hold_id: hold.id as string,
          raw_response: newRes.raw ?? null,
          origen: 'cron',
        });
        // Email cliente "actualiza tarjeta" (best-effort).
        {
          const { data: full } = await supabaseAdmin
            .from('contratos')
            .select('numero, arrendatario_email, arrendatario_nombre, arrendatario_razon_social')
            .eq('id', cid)
            .single();
          if (full?.arrendatario_email) {
            void sendGarantiaFalloRenovacionEmail(full.arrendatario_email as string, {
              arrendatarioNombre: String(full.arrendatario_nombre || full.arrendatario_razon_social || ''),
              numeroContrato: String(full.numero || cid),
              monto,
              cardBrand: card.card_brand as string,
              cardLast4: card.card_last4 as string,
            }).catch((e) => console.warn('[garantia-fallo-renovacion-mail-fail]', e));
          }
        }
        failed++;
        detalles.push({ contrato_id: cid, status: 'failed', error: newRes.error || 'unknown' });
        continue;
      }

      // 3. Marcar viejo como renewed + insertar nuevo registro.
      await supabaseAdmin
        .from('klap_holds')
        .update({ estado: 'renewed' })
        .eq('id', hold.id as string);

      const expiraAt = newRes.data.hold_expires_at || new Date(Date.now() + RENEW_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const renovacionProxAt = new Date(new Date(expiraAt).getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

      const { data: nuevoHold } = await supabaseAdmin
        .from('klap_holds')
        .insert({
          contrato_id: cid,
          klap_card_id: hold.klap_card_id as string,
          hold_actual_id: newRes.data.trx_id,
          hold_inicial_id: hold.hold_inicial_id as string,
          monto,
          estado: 'active',
          autorizado_at: new Date().toISOString(),
          expira_at: expiraAt,
          renovaciones_count: (hold.renovaciones_count as number) + 1,
          renovacion_proxima_at: renovacionProxAt,
        })
        .select('id')
        .single();

      if (nuevoHold) {
        await supabaseAdmin
          .from('contratos')
          .update({ hold_klap_id: nuevoHold.id })
          .eq('id', cid);
      }

      await supabaseAdmin.from('klap_eventos').insert({
        evento_tipo: 'deposit_hold_renewed',
        contrato_id: cid,
        hold_id: nuevoHold?.id ?? null,
        klap_transaction_id: newRes.data.trx_id,
        raw_response: newRes.raw ?? null,
        origen: 'cron',
      });
      await logContratoEvent(null, cid, 'deposit_hold_renewed', {
        nuevo_hold_id: nuevoHold?.id ?? null,
        renovaciones_count: (hold.renovaciones_count as number) + 1,
      });

      // Email cliente "garantía renovada" (best-effort).
      {
        const { data: full } = await supabaseAdmin
          .from('contratos')
          .select('numero, arrendatario_email, arrendatario_nombre, arrendatario_razon_social')
          .eq('id', cid)
          .single();
        if (full?.arrendatario_email) {
          void sendGarantiaRenovadaEmail(full.arrendatario_email as string, {
            arrendatarioNombre: String(full.arrendatario_nombre || full.arrendatario_razon_social || ''),
            numeroContrato: String(full.numero || cid),
            monto,
            cardBrand: card.card_brand as string,
            cardLast4: card.card_last4 as string,
            validoHasta: new Date(expiraAt).toLocaleDateString('es-CL'),
          }).catch((e) => console.warn('[garantia-renovada-mail-fail]', e));
        }
      }

      renewed++;
      detalles.push({ contrato_id: cid, status: 'renewed' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[klap-renew-loop-fail]', cid, msg);
      failed++;
      detalles.push({ contrato_id: cid, status: 'error', error: msg });
    }
  }

  return NextResponse.json({
    processed: pendientes.length,
    renewed,
    failed,
    detalles,
    ran_at: ahoraIso,
  });
}
