import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { verifyKlapWebhookSignature } from '@/lib/klap-client';

/**
 * POST /api/webhooks/klap
 *
 * Webhook receiver para eventos de Klap (hold expired, capture refunded,
 * charge declined, token updated, chargeback, etc.).
 *
 * Verificación:
 *   1. Header X-Klap-Signature con HMAC-SHA256 + 5min skew.
 *   2. Idempotency: webhook_id en klap_webhook_log (PRIMARY KEY).
 *   3. Si re-entrega: retorna 200 already_processed.
 *
 * Procesamiento por evento_tipo:
 *   - preauth.expired      → marca klap_holds.estado='expired'
 *   - capture.refunded     → registra en klap_eventos
 *   - charge.declined      → notifica admin (audit + log)
 *   - chargeback.opened    → marca contrato como dispute (futuro)
 *   - token.updated        → actualiza klap_cards.network_token
 *
 * Sin secret configurado → 403 fail-closed (mismo patrón que MercadoPago).
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

interface WebhookBody {
  webhook_id?: string;
  evento_tipo?: string;
  data?: {
    trx_id?: string;
    hold_id?: string;
    contrato_id?: number;
    network_token?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export async function POST(request: NextRequest) {
  // 1. Read body (raw, para HMAC).
  const raw = await request.text();
  const signatureHeader = request.headers.get('x-klap-signature');

  // 2. Verify signature (fail-closed).
  if (!verifyKlapWebhookSignature(raw, signatureHeader)) {
    console.warn('[klap-webhook] signature invalid');
    return NextResponse.json({ error: 'Firma inválida' }, { status: 403 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const webhookId = body.webhook_id;
  const eventoTipo = body.evento_tipo;
  if (!webhookId || !eventoTipo) {
    return NextResponse.json({ error: 'webhook_id y evento_tipo requeridos' }, { status: 400 });
  }

  // 3. Idempotencia ATÓMICA: el INSERT contra el PK webhook_id es la barrera.
  // Evita el TOCTOU de SELECT-then-INSERT: ante re-entregas concurrentes del
  // mismo webhook_id, solo una gana el INSERT; las demás reciben 23505 y salen
  // como ya procesadas, sin volver a ejecutar el efecto del evento.
  const { error: idempErr } = await supabaseAdmin
    .from('klap_webhook_log')
    .insert({
      webhook_id: webhookId,
      evento_tipo: eventoTipo,
      payload: body,
      signature_valid: true,
      result: 'processing',
    })
    .select('webhook_id');
  if (idempErr) {
    // 23505 = unique_violation → este webhook_id ya fue (o está siendo) procesado.
    if (idempErr.code === '23505') {
      return NextResponse.json({ ok: true, already_processed: true });
    }
    console.error('[klap-webhook-idemp]', idempErr);
    return NextResponse.json({ error: 'No se pudo registrar el webhook' }, { status: 503 });
  }

  let resultText: string;
  try {
    switch (eventoTipo) {
      case 'preauth.expired': {
        const trx = body.data?.trx_id;
        if (trx) {
          await supabaseAdmin
            .from('klap_holds')
            .update({ estado: 'expired' })
            .eq('hold_actual_id', trx)
            .in('estado', ['active', 'renewed']);
        }
        resultText = 'hold_expired';
        break;
      }
      case 'capture.refunded': {
        await supabaseAdmin.from('klap_eventos').insert({
          evento_tipo: 'capture_refunded',
          klap_transaction_id: body.data?.trx_id ?? null,
          raw_response: body,
          origen: 'webhook',
        });
        resultText = 'capture_refunded_logged';
        break;
      }
      case 'charge.declined': {
        await supabaseAdmin.from('klap_eventos').insert({
          evento_tipo: 'late_charge_declined',
          klap_transaction_id: body.data?.trx_id ?? null,
          raw_response: body,
          origen: 'webhook',
        });
        resultText = 'charge_declined_logged';
        break;
      }
      case 'chargeback.opened': {
        await supabaseAdmin.from('klap_eventos').insert({
          evento_tipo: 'chargeback_opened',
          klap_transaction_id: body.data?.trx_id ?? null,
          raw_response: body,
          origen: 'webhook',
        });
        resultText = 'chargeback_logged';
        break;
      }
      case 'token.updated': {
        const oldTok = body.data?.old_token;
        const newTok = body.data?.network_token;
        if (typeof oldTok === 'string' && typeof newTok === 'string') {
          await supabaseAdmin
            .from('klap_cards')
            .update({ network_token: newTok })
            .eq('network_token', oldTok);
        }
        resultText = 'token_rotated';
        break;
      }
      default:
        resultText = `unhandled:${eventoTipo}`;
    }
  } catch (err) {
    resultText = `error: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[klap-webhook-process-fail]', resultText);
  }

  await supabaseAdmin
    .from('klap_webhook_log')
    .update({ result: resultText })
    .eq('webhook_id', webhookId);

  return NextResponse.json({ ok: true, result: resultText });
}
