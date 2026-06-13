import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { transporter } from '@jurmaq/shared/mail/transport';
import { env } from '@jurmaq/shared/env';
import { safeSecretEquals } from '@jurmaq/shared/crypto/secret';

/**
 * POST /api/cron/carrito-recovery
 *
 * Recupera carritos abandonados. Envía hasta 3 emails escalonados:
 *   - recovery 1: 1h después de la última actividad (sin descuento, "te olvidaste algo")
 *   - recovery 2: 24h después (social proof, "otros también compraron esto")
 *   - recovery 3: 72h después (cupón generado +10% como último incentivo)
 *
 * Cuando el cliente completa la compra, otra parte del código marca
 * converted_at — esto los excluye del flujo.
 *
 * Auth: header x-cron-secret. Schedule sugerido: cada 30 min.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH = 25;

function isAuthorized(request: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  return safeSecretEquals(provided, secret);
}

interface Carrito {
  id: string;
  email: string;
  items: Array<{ nombre?: string; cantidad?: number; precio?: number }>;
  total: number;
  recovery_count: number;
  last_activity: string;
}

// Vercel Cron invoca con GET; aceptamos ambos métodos. La autenticación real
// es vía CRON_SECRET en isAuthorized(), no por el método HTTP.
export const GET = (request: NextRequest) => POST(request);

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const ahora = Date.now();
  const limites = [
    { count: 0, minMin: 60, maxMin: 24 * 60 },         // 1h - 24h → recovery 1
    { count: 1, minMin: 24 * 60, maxMin: 72 * 60 },     // 24h - 72h → recovery 2
    { count: 2, minMin: 72 * 60, maxMin: 7 * 24 * 60 }, // 72h - 7d → recovery 3
  ];

  let totalSent = 0;
  const sent: Array<{ id: string; email_masked: string; recovery: number }> = [];

  for (const cfg of limites) {
    const desde = new Date(ahora - cfg.maxMin * 60 * 1000).toISOString();
    const hasta = new Date(ahora - cfg.minMin * 60 * 1000).toISOString();

    const { data: items } = await supabaseAdmin
      .from('barraca_carrito_abandonado')
      .select('id, email, items, total, recovery_count, last_activity')
      .eq('recovery_count', cfg.count)
      .is('converted_at', null)
      .gte('last_activity', desde)
      .lte('last_activity', hasta)
      .not('email', 'eq', '')
      .limit(BATCH);

    for (const c of (items as Carrito[]) ?? []) {
      try {
        const recoveryNum = cfg.count + 1;
        const html = renderRecoveryEmail(c, recoveryNum);
        const subject =
          recoveryNum === 1
            ? '¿Olvidaste algo en tu carrito?'
            : recoveryNum === 2
              ? `Tus productos siguen esperándote — JURMAQ Barraca`
              : `Última oportunidad: 10% de descuento en tu carrito`;

        let cuponGenerado: string | null = null;

        // Recovery 3: generar cupón único para este carrito.
        if (recoveryNum === 3) {
          cuponGenerado = `RECOVERY-${c.id.slice(0, 8).toUpperCase()}`;
          await supabaseAdmin.from('barraca_cupones').insert({
            codigo: cuponGenerado,
            descripcion: `Recovery automatico carrito ${c.id.slice(0, 8)}`,
            tipo: 'porcentaje',
            valor: 10,
            monto_minimo_compra: 0,
            max_usos_total: 1,
            max_usos_por_usuario: 1,
            valido_hasta: new Date(ahora + 7 * 24 * 60 * 60 * 1000).toISOString(),
            activo: true,
          }).then(() => undefined, (err) => {
            console.warn('[carrito-recovery-cupon-fail]', err);
          });
        }

        await transporter.sendMail({
          to: c.email,
          subject,
          html,
          skipAdminBcc: true,
        });

        await supabaseAdmin
          .from('barraca_carrito_abandonado')
          .update({
            recovery_count: recoveryNum,
            recovery_last_at: new Date().toISOString(),
            cupon_generado: cuponGenerado,
          })
          .eq('id', c.id);

        totalSent++;
        sent.push({
          id: c.id,
          email_masked: c.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
          recovery: recoveryNum,
        });
      } catch (err) {
        console.error('[carrito-recovery-send-fail]', c.id, err);
      }
    }
  }

  return NextResponse.json({
    processed: totalSent,
    detalles: sent,
    ran_at: new Date().toISOString(),
  });
}

function renderRecoveryEmail(c: Carrito, recoveryNum: number): string {
  const itemsHtml = (c.items || [])
    .slice(0, 5)
    .map(
      (i) =>
        `<li>${i.nombre ?? 'Producto'} × ${i.cantidad ?? 1} · $${(i.precio ?? 0).toLocaleString('es-CL')}</li>`,
    )
    .join('');

  const carritoUrl = `${env.NEXT_PUBLIC_BARRACA_URL || 'https://barraca.jurmaq.cl'}/carrito`;

  const intro =
    recoveryNum === 1
      ? '¿Te olvidaste de algo? Tu carrito en JURMAQ Barraca te está esperando:'
      : recoveryNum === 2
        ? 'Tus productos siguen disponibles, pero el stock se mueve rápido. Vuelve y completa tu compra:'
        : 'Última oportunidad — usa el código <strong>10% OFF</strong> que generamos automáticamente para tu carrito.';

  const cupon =
    recoveryNum === 3
      ? `<p style="background:#fef3c7;padding:12px;border-radius:8px;text-align:center;font-size:14px"><strong>Código de descuento exclusivo:</strong> automático al volver a tu carrito.</p>`
      : '';

  return `<!doctype html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:24px auto;color:#0c1d3a;padding:0 16px">
<h2 style="margin:0 0 12px 0">${recoveryNum === 1 ? 'Tu carrito te espera' : recoveryNum === 2 ? 'No pierdas tus productos' : '¡10% de descuento para tu carrito!'}</h2>
<p>${intro}</p>
<ul style="background:#f5f5f5;padding:12px 24px;border-radius:8px;font-size:14px">${itemsHtml}</ul>
<p style="font-size:16px"><strong>Total: $${c.total.toLocaleString('es-CL')}</strong></p>
${cupon}
<p style="margin:24px 0"><a href="${carritoUrl}" style="display:inline-block;padding:12px 24px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Volver a mi carrito</a></p>
<hr style="border:0;border-top:1px solid #e5e5e5;margin:32px 0 16px"/>
<p style="font-size:11px;color:#999">Si ya completaste tu compra, ignora este mensaje. JURMAQ Barraca.</p>
</body></html>`;
}
