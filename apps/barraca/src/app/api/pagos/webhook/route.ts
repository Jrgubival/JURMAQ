import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

/**
 * Verify MercadoPago webhook signature.
 * See: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks#bookmark_secret_key
 *
 * Header format: x-signature: ts=1704908010,v1=abc123...
 * Signed template: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * Algorithm: HMAC-SHA256 with webhook secret, hex-encoded.
 */
function verifyMercadoPagoSignature(request: NextRequest, dataId: string | number | undefined): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  // FAIL CLOSED: if the secret isn't configured, refuse the webhook entirely.
  // Previously we returned true here ("don't throw in prod"), but that was a
  // critical hole — without the secret set, anyone could POST to this
  // endpoint with a fake `payment.approved` notification and our backend
  // would mark a cotización as paid. Better to break legitimate webhooks
  // (loudly, in logs and by returning 503) than to silently accept forgeries.
  if (!secret) {
    console.error('[WEBHOOK] MERCADOPAGO_WEBHOOK_SECRET not configured — rejecting all webhooks until set');
    return false;
  }
  if (!dataId) return false;

  const xSignature = request.headers.get('x-signature') || '';
  const xRequestId = request.headers.get('x-request-id') || '';
  if (!xSignature || !xRequestId) return false;

  // Parse "ts=...,v1=..."
  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => p.split('=').map((s) => s.trim()))
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  // Reject stale signatures (older than 5 minutes)
  const tsNum = parseInt(ts, 10);
  if (isNaN(tsNum)) return false;
  const ageSec = Math.abs(Date.now() / 1000 - tsNum);
  if (ageSec > 300) {
    console.warn('[WEBHOOK] signature too old:', ageSec, 's');
    return false;
  }

  const template = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(template).digest('hex');

  // timingSafeEqual requires equal-length buffers. v1 y expected son hex
  // strings; los decodificamos a bytes binarios antes de comparar (32 bytes
  // SHA-256 vs 64 chars UTF-8 era confuso aunque equivalente).
  try {
    if (!/^[a-f0-9]+$/i.test(v1) || v1.length !== expected.length) return false;
    const a = Buffer.from(v1, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Audit M3: rate-limit defensivo. MercadoPago real envía pocos events/min,
    // pero un atacante puede spam unsigned POSTs para forzar JSON parse + sig check.
    // 100/min/IP es generoso para legit pero corta abuso.
    const ip = getClientIp(request);
    const limiter = rateLimit(`mp-webhook:${ip}`, { maxAttempts: 100, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json({ error: 'rate limited' }, { status: 429 });
    }

    const body = await request.json();

    // MercadoPago IPN notification
    const { type, data } = body;

    if (type === 'payment') {
      const paymentId = data?.id;
      if (!paymentId) {
        return NextResponse.json({ status: 'ignored' });
      }

      // Verify signature before doing any work
      if (!verifyMercadoPagoSignature(request, paymentId)) {
        console.warn('[WEBHOOK] invalid signature for payment', paymentId);
        return NextResponse.json({ error: 'Firma invalida' }, { status: 401 });
      }

      // Fetch payment details from MercadoPago
      const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!MP_ACCESS_TOKEN) {
        console.error('MERCADOPAGO_ACCESS_TOKEN no configurado');
        return NextResponse.json({ error: 'Configuracion incompleta' }, { status: 500 });
      }

      const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        },
      });

      if (!paymentRes.ok) {
        console.error('Error al consultar pago en MercadoPago:', await paymentRes.text());
        return NextResponse.json({ error: 'Error consultando pago' }, { status: 500 });
      }

      const payment = await paymentRes.json();
      const externalReference: string | undefined = payment.external_reference; // numero de cotizacion
      const status: string = payment.status;
      const transactionAmount: number | undefined = payment.transaction_amount;
      const paymentIdStr = String(paymentId);

      // --- IDEMPOTENCIA por (payment_id, status): MercadoPago re-entrega
      // notificaciones del MISMO payment_id a medida que el pago transiciona
      // (pending → in_process → approved). Cada (payment_id, status) distinto
      // es un evento que SI debemos procesar. Solo retries identicos del
      // mismo (payment_id, status) son duplicados a ignorar.
      const { error: idempErr, data: insertedRows } = await supabaseAdmin
        .from('pagos_eventos')
        .insert({
          payment_id: paymentIdStr,
          status,
          external_reference: externalReference ?? null,
          transaction_amount: transactionAmount ?? null,
          cotizacion_numero: externalReference ?? null,
          raw: payment,
        })
        .select('payment_id');
      if (idempErr) {
        // 23505 = unique_violation -> ESTA transicion (payment_id+status) ya
        // se proceso antes. Devolver ok idempotente.
        if (idempErr.code === '23505') {
          return NextResponse.json({ status: 'already_processed', paymentId: paymentIdStr, status_dup: status });
        }
        // PGRST205 = tabla no existe (falta migracion)
        if (idempErr.code === 'PGRST205' || /pagos_eventos/.test(idempErr.message || '')) {
          console.error('[WEBHOOK] tabla pagos_eventos no existe. Ejecuta migrate-pagos-eventos.sql');
          return NextResponse.json(
            { error: 'Falta migracion pagos_eventos' },
            { status: 503 }
          );
        }
        throw idempErr;
      }
      if (!insertedRows || insertedRows.length === 0) {
        return NextResponse.json({ status: 'already_processed', paymentId: paymentIdStr });
      }

      // --- Estados terminales: si la cotizacion ya esta pagada/cancelada/entregada,
      // ignorar el webhook (puede ser tardio y no queremos retroceder estado).
      if (!externalReference) {
        return NextResponse.json({ status: 'no_external_reference' });
      }

      const { data: cotizacion, error: cotError } = await supabaseAdmin
        .from('barraca_cotizaciones')
        .select('id, estado, total')
        .eq('numero', externalReference)
        .maybeSingle();
      if (cotError || !cotizacion) {
        console.warn('[WEBHOOK] cotizacion no encontrada para externalReference', externalReference);
        return NextResponse.json({ status: 'cotizacion_not_found' });
      }
      const TERMINAL_ESTADOS = new Set(['pagada', 'cancelada', 'entregada', 'anulada']);
      if (TERMINAL_ESTADOS.has(cotizacion.estado)) {
        return NextResponse.json({ status: 'cotizacion_terminal', estado: cotizacion.estado });
      }

      // --- Validar monto pagado coincide con total de la cotizacion (tolerancia ±1 CLP).
      // Sin esto un atacante podria pagar $1 con MP y marcar la cotizacion como pagada.
      if (status === 'approved') {
        const cotTotal = Number(cotizacion.total) || 0;
        const pagado = Number(transactionAmount) || 0;
        if (Math.abs(cotTotal - pagado) > 1) {
          console.error('[WEBHOOK] monto pagado no coincide', {
            cotizacion: cotizacion.id,
            esperado: cotTotal,
            recibido: pagado,
            payment_id: paymentIdStr,
          });
          // Marcamos como discrepancia para revision manual; NO marcamos pagada.
          await supabaseAdmin
            .from('barraca_cotizaciones')
            .update({ estado: 'pago_discrepancia' })
            .eq('id', cotizacion.id)
            .in('estado', Array.from(['aprobada', 'pendiente', 'pago_pendiente']));
          return NextResponse.json({ status: 'amount_mismatch' }, { status: 200 });
        }
      }

      // --- Aplicar transicion de estado solo desde estados no terminales.
      let newEstado: string | null = null;
      if (status === 'approved') newEstado = 'pagada';
      else if (status === 'pending' || status === 'in_process') newEstado = 'pago_pendiente';
      else if (status === 'rejected' || status === 'cancelled') newEstado = 'pago_rechazado';

      if (newEstado) {
        await supabaseAdmin
          .from('barraca_cotizaciones')
          .update({ estado: newEstado })
          .eq('id', cotizacion.id)
          .not('estado', 'in', `(${Array.from(TERMINAL_ESTADOS).map((s) => `"${s}"`).join(',')})`);
      }

      return NextResponse.json({ status: 'ok', estado: newEstado });
    }

    // Other notification types (merchant_order, etc.)
    return NextResponse.json({ status: 'ignored' });
  } catch (error) {
    console.error('Error en webhook de pagos:', error);
    return NextResponse.json(
      { error: 'Error procesando webhook' },
      { status: 500 }
    );
  }
}
