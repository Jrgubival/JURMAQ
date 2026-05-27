import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { sendSms, isValidChileanPhone } from '@jurmaq/shared/sms';
import { env } from '@jurmaq/shared/env';

/**
 * POST /api/cron/sms-recovery
 *
 * Tier 4 D7: SMS de recovery de carrito abandonado @ 15 min.
 *
 * Complementa el flow de email (1h/24h/72h) alcanzando al cliente más
 * rápido (mayoría tiene notif WhatsApp/SMS activa pero email saturado).
 *
 * Trigger: carrito con
 *   - telefono NOT NULL
 *   - sms_recovery_sent_at IS NULL
 *   - converted_at IS NULL
 *   - last_activity entre 15 y 30 min atrás (ventana de 15 min para
 *     captar carritos aunque el cron se ejecute con ligero delay)
 *
 * Solo enviamos 1 SMS por carrito (sin escalonamiento — el email
 * recovery ya lo hace en 3 pasos posteriores).
 *
 * Auth: header x-cron-secret. Schedule sugerido: cada 5 min.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH = 30;

function isAuthorized(request: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  return provided === secret;
}

interface CarritoAbandonadoSms {
  id: string;
  telefono: string;
  email: string | null;
  total: number;
  items: unknown;
  last_activity: string;
}

const SHORT_URL = (env.NEXT_PUBLIC_BARRACA_URL || 'https://barraca.jurmaq.cl').replace(
  /\/$/,
  '',
);

function buildSmsMessage(total: number, itemsCount: number): string {
  const totalFmt = `$${Math.round(total).toLocaleString('es-CL')}`;
  // Máximo 160 chars para evitar split a multi-part SMS.
  // "JURMAQ Barraca: dejaste 3 items por $45.000. Vuelve y termina tu compra: https://barraca.jurmaq.cl/carrito" (~108 chars)
  return `JURMAQ Barraca: dejaste ${itemsCount} item${itemsCount !== 1 ? 's' : ''} por ${totalFmt}. Vuelve y termina tu compra: ${SHORT_URL}/carrito`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const now = Date.now();
  const ventanaInicio = new Date(now - 30 * 60 * 1000).toISOString(); // 30 min atrás
  const ventanaFin = new Date(now - 15 * 60 * 1000).toISOString(); // 15 min atrás

  const stats = { sent: 0, skipped: 0, failed: 0, invalid_phone: 0 };

  const { data: candidatos } = await supabaseAdmin
    .from('barraca_carrito_abandonado')
    .select('id, telefono, email, total, items, last_activity')
    .not('telefono', 'is', null)
    .is('sms_recovery_sent_at', null)
    .is('converted_at', null)
    .gte('last_activity', ventanaInicio)
    .lte('last_activity', ventanaFin)
    .limit(BATCH);

  for (const c of (candidatos ?? []) as CarritoAbandonadoSms[]) {
    // Valida teléfono.
    if (!isValidChileanPhone(c.telefono)) {
      stats.invalid_phone++;
      // Marca como enviado para no reintentar números basura.
      await supabaseAdmin
        .from('barraca_carrito_abandonado')
        .update({ sms_recovery_sent_at: new Date().toISOString() })
        .eq('id', c.id);
      continue;
    }

    const itemsArr = Array.isArray(c.items)
      ? (c.items as unknown[])
      : typeof c.items === 'string'
      ? (() => {
          try {
            return JSON.parse(c.items as string);
          } catch {
            return [];
          }
        })()
      : [];
    const itemsCount = Array.isArray(itemsArr) ? itemsArr.length : 0;
    if (itemsCount === 0 || c.total <= 0) {
      stats.skipped++;
      continue;
    }

    const message = buildSmsMessage(Number(c.total), itemsCount);
    const result = await sendSms({ to: c.telefono, message });

    if (result.skipped) {
      // Twilio no configurado — abortar el batch entero, no tiene sentido continuar.
      return NextResponse.json({
        ok: true,
        skipped_reason: 'twilio_not_configured',
        ...stats,
      });
    }
    if (!result.ok) {
      stats.failed++;
      console.error('[sms-recovery-fail]', {
        carrito_id: c.id,
        error: result.error,
      });
      continue;
    }

    await supabaseAdmin
      .from('barraca_carrito_abandonado')
      .update({ sms_recovery_sent_at: new Date().toISOString() })
      .eq('id', c.id);

    stats.sent++;
  }

  return NextResponse.json({ ok: true, ...stats });
}
