import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { isValidOrigin, escapeLikePattern } from '@jurmaq/shared/sanitize';
import { getClientIp, rateLimit } from '@jurmaq/shared/rate-limit';
import { klapPreauth } from '@/lib/klap-client';
import { mockNetworkToken } from '@/lib/klap-mock';
import { logContratoEvent } from '@/lib/contratos-audit';
import { sendGarantiaAutorizadaEmail } from '@jurmaq/shared/mail/templates/cliente-garantia-autorizada';
import { env } from '@jurmaq/shared/env';

/**
 * POST /api/public/contratos/entrega/[token]/preauth
 *
 * Cliente autoriza el hold de garantía. En modo mock (Fase A) el body acepta
 * sólo `brand`, y generamos un network_token sintético. En modo producción
 * el body trae el `network_token` (obtenido del SDK Klap embebido en el
 * navegador del cliente).
 *
 * Body modo mock:    { brand: 'VISA' | 'MASTERCARD' | 'AMEX' }
 * Body modo prod:    { network_token, token_requestor_id, card_brand, card_last4, card_exp_month, card_exp_year }
 *
 * Side effects:
 *   - Crea klap_cards (o reusa si ya existe para este cliente).
 *   - klapPreauth → klap_holds.
 *   - Update contratos.estado = 'vigente', fecha_entrega_real, hold_klap_id.
 *   - Audit en klap_eventos + contratos_audit_log.
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

const HOLD_TTL_DAYS_DEFAULT = 30;

interface Body {
  brand?: 'VISA' | 'MASTERCARD' | 'AMEX';
  network_token?: string;
  token_requestor_id?: string;
  card_brand?: 'VISA' | 'MASTERCARD' | 'AMEX';
  card_last4?: string;
  card_exp_month?: number;
  card_exp_year?: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  const { token } = await params;
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rl = rateLimit(`entrega-preauth:${ip}:${token.slice(0, 16)}`, { maxAttempts: 5, windowSeconds: 300 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera unos minutos.' }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;

  // Cargar contrato.
  const { data: contrato } = await supabaseAdmin
    .from('contratos')
    .select(
      'id, numero, estado, garantia_metodo, garantia_monto, arrendatario_email, entrega_token_expira_at',
    )
    .eq('entrega_token', token)
    .maybeSingle();
  if (!contrato) {
    return NextResponse.json({ error: 'Token no encontrado' }, { status: 404 });
  }
  if (contrato.garantia_metodo !== 'klap_hold') {
    return NextResponse.json({ error: 'Este contrato no usa garantía Klap' }, { status: 409 });
  }
  if (contrato.entrega_token_expira_at && new Date(contrato.entrega_token_expira_at as string) < new Date()) {
    return NextResponse.json({ error: 'El link de autorización venció' }, { status: 410 });
  }

  const monto = Number(contrato.garantia_monto) || 0;
  if (monto <= 0) {
    return NextResponse.json({ error: 'Monto de garantía inválido' }, { status: 400 });
  }

  // Guarda de estado/idempotencia: evita un SEGUNDO hold real sobre la tarjeta
  // del cliente si reenvía el formulario o reabre el link de entrega aún vigente.
  // (Lo ideal a futuro es un índice único parcial en klap_holds por contrato_id
  // con estado='active'; esta verificación cubre el caso de reenvío.)
  if (contrato.estado === 'vigente') {
    return NextResponse.json(
      { error: 'La entrega de este contrato ya fue autorizada.' },
      { status: 409 },
    );
  }
  const { data: holdsActivos } = await supabaseAdmin
    .from('klap_holds')
    .select('id')
    .eq('contrato_id', contrato.id)
    .eq('estado', 'active')
    .limit(1);
  if (holdsActivos && holdsActivos.length > 0) {
    return NextResponse.json(
      { error: 'Ya existe una autorización de garantía activa para este contrato.' },
      { status: 409 },
    );
  }

  // Resolver cliente_id (vía email del contrato).
  const arrendatarioEmail = (contrato.arrendatario_email as string | null)?.toLowerCase() || '';
  if (!arrendatarioEmail) {
    return NextResponse.json({ error: 'Contrato sin email de arrendatario' }, { status: 400 });
  }
  const { data: cliente } = await supabaseAdmin
    .from('clientes')
    .select('id')
    .ilike('email', escapeLikePattern(arrendatarioEmail))
    .maybeSingle();
  if (!cliente) {
    return NextResponse.json(
      { error: 'No encontramos tu cliente en el sistema. Contáctanos.' },
      { status: 404 },
    );
  }

  // Resolver network_token (mock vs producción).
  const tokenData =
    typeof body.network_token === 'string' && body.network_token.length > 0
      ? {
          network_token: body.network_token,
          token_requestor_id: body.token_requestor_id || 'unknown',
          card_brand: body.card_brand || 'VISA',
          card_last4: body.card_last4 || '0000',
          card_exp_month: body.card_exp_month || 12,
          card_exp_year: body.card_exp_year || 2028,
        }
      : mockNetworkToken(body.brand || 'VISA');

  // ¿Ya existe esta tarjeta para este cliente? Reusar.
  let klapCardId: string;
  const { data: existing } = await supabaseAdmin
    .from('klap_cards')
    .select('id, activa')
    .eq('cliente_id', cliente.id)
    .eq('network_token', tokenData.network_token)
    .maybeSingle();
  if (existing) {
    klapCardId = existing.id as string;
    if (!existing.activa) {
      await supabaseAdmin
        .from('klap_cards')
        .update({ activa: true })
        .eq('id', klapCardId);
    }
  } else {
    const { data: newCard, error: cardErr } = await supabaseAdmin
      .from('klap_cards')
      .insert({
        cliente_id: cliente.id,
        network_token: tokenData.network_token,
        token_requestor_id: tokenData.token_requestor_id,
        card_brand: tokenData.card_brand,
        card_last4: tokenData.card_last4,
        card_exp_month: tokenData.card_exp_month,
        card_exp_year: tokenData.card_exp_year,
        is_default: true,
        activa: true,
        created_via: 'portal',
      })
      .select('id')
      .single();
    if (cardErr || !newCard) {
      console.error('[entrega-preauth-card-insert-fail]', cardErr);
      return NextResponse.json({ error: 'No se pudo registrar la tarjeta' }, { status: 500 });
    }
    klapCardId = newCard.id;
  }

  // Llamar a Klap (mock o real).
  const consumerTx = crypto.randomUUID();
  const preauthRes = await klapPreauth({
    consumer_transaction_id: consumerTx,
    amount: { value: monto, currency_code: 'CLP' },
    network_token: tokenData,
    merchant_meta: { contrato_id: String(contrato.id) },
  });

  if (!preauthRes.ok || !preauthRes.data) {
    await supabaseAdmin.from('klap_eventos').insert({
      evento_tipo: 'preauth_failed',
      contrato_id: contrato.id,
      raw_response: preauthRes.raw ?? null,
      origen: 'api',
    });
    return NextResponse.json(
      { error: 'Tu banco rechazó la autorización', detalle: preauthRes.error },
      { status: 502 },
    );
  }

  const expiraAt = preauthRes.data.hold_expires_at || new Date(Date.now() + HOLD_TTL_DAYS_DEFAULT * 24 * 60 * 60 * 1000).toISOString();
  const renovacionProxAt = new Date(new Date(expiraAt).getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: newHold, error: holdErr } = await supabaseAdmin
    .from('klap_holds')
    .insert({
      contrato_id: contrato.id,
      klap_card_id: klapCardId,
      hold_actual_id: preauthRes.data.trx_id,
      hold_inicial_id: preauthRes.data.trx_id,
      monto,
      estado: 'active',
      autorizado_at: new Date().toISOString(),
      expira_at: expiraAt,
      renovaciones_count: 0,
      renovacion_proxima_at: renovacionProxAt,
    })
    .select('id')
    .single();

  if (holdErr || !newHold) {
    console.error('[entrega-preauth-hold-insert-fail]', holdErr);
    return NextResponse.json({ error: 'No se pudo registrar el hold' }, { status: 500 });
  }

  await supabaseAdmin
    .from('contratos')
    .update({
      estado: 'vigente',
      fecha_entrega_real: new Date().toISOString(),
      hold_klap_id: newHold.id,
    })
    .eq('id', contrato.id);

  await supabaseAdmin.from('klap_eventos').insert({
    evento_tipo: 'preauth_created',
    contrato_id: contrato.id,
    hold_id: newHold.id,
    klap_transaction_id: preauthRes.data.trx_id,
    request_id: consumerTx,
    raw_response: preauthRes.raw ?? null,
    origen: env.KLAP_ENABLED ? 'api' : 'mock',
  });
  await logContratoEvent(request, contrato.id, 'delivery_card_authorized', {
    monto,
    klap_card_last4: tokenData.card_last4,
    klap_card_brand: tokenData.card_brand,
    hold_id: newHold.id,
  });

  // Email de confirmación al cliente (best-effort).
  if (arrendatarioEmail) {
    void sendGarantiaAutorizadaEmail(arrendatarioEmail, {
      arrendatarioNombre: '',
      numeroContrato: String(contrato.numero || contrato.id),
      monto,
      cardBrand: tokenData.card_brand,
      cardLast4: tokenData.card_last4,
    }).catch((e) => console.warn('[garantia-autorizada-mail-fail]', e));
  }

  return NextResponse.json({
    ok: true,
    hold_id: newHold.id,
    monto,
    expira_at: expiraAt,
    last4: tokenData.card_last4,
    brand: tokenData.card_brand,
  });
}
