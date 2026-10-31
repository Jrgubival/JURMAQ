import { NextRequest, NextResponse } from 'next/server';
import { sendReplenishmentEmail } from '@jurmaq/shared/mail/templates/replenishment';
import { env } from '@jurmaq/shared/env';
import { safeSecretEquals } from '@jurmaq/shared/crypto/secret';
import { logSafeError } from '@jurmaq/shared/logging';
import { estaDeBaja, urlBaja } from '@/lib/baja-correos';
import { pedidos } from '@/lib/pedidos';
import { correoPedirOpinion } from '@/lib/pedidos/correos';
import { vencerTransferencias } from '@/lib/pedidos/vencimiento';

/**
 * POST /api/cron/post-purchase — una vez al día (vercel.json, 09:00).
 *
 * Pedir opinión (oct-2026, tienda sin cuentas): a los pedidos de la tienda
 * (`barraca_pedidos`) en estado 'entregado' hace 2 a 30 días (updated_at) se
 * les manda UNA vez el correo con el enlace /opinar/<numero>/<token>.
 *   - Una sola vez por pedido: `opinion_solicitada_at` se marca ANTES de
 *     enviar, con un update condicional (dos corridas a la vez no duplican).
 *   - Respeta la baja de correos (estaDeBaja, fail-closed).
 *   - No depende de acepta_ofertas: es sobre su propia compra, no publicidad.
 *   - Pedidos entregados hace más de 30 días (p. ej. al aplicar la migración)
 *     no reciben nada.
 * Las cotizaciones pagadas ya no reciben este correo: el formulario de
 * opinión para clientes con cuenta se eliminó junto con las cuentas.
 *
 * Auth: header x-cron-secret o Authorization: Bearer (CRON_SECRET).
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH = 50;
const DIA = 24 * 3600 * 1000;

function isAuthorized(request: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  return safeSecretEquals(provided, secret);
}

// Vercel Cron invoca con GET; aceptamos ambos métodos. La autenticación real
// es vía CRON_SECRET en isAuthorized(), no por el método HTTP.
export const GET = (request: NextRequest) => POST(request);

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const ahora = Date.now();
  const stats = { review_requests_sent: 0, skipped_baja: 0, errors: 0, transferencias_vencidas: 0 };

  // Pedidos por transferencia sin pagar a las 48 h: se anulan y vuelve el stock (Términos 8.3).
  try {
    const v = await vencerTransferencias();
    stats.transferencias_vencidas = v.vencidos;
    stats.errors += v.errores;
  } catch (error) {
    logSafeError('post-purchase-vencer', { error: String(error) });
    stats.errors++;
  }

  let candidatos;
  try {
    candidatos = await pedidos().paraPedirOpinion({
      desde: new Date(ahora - 30 * DIA).toISOString(),
      hasta: new Date(ahora - 2 * DIA).toISOString(),
      limite: BATCH,
    });
  } catch (error) {
    // Fail-closed: sin la columna opinion_solicitada_at (migración sin
    // aplicar) no se manda nada.
    logSafeError('post-purchase-listar', { error: String(error) });
    return NextResponse.json({ ok: false, ...stats, errors: 1 }, { status: 500 });
  }

  for (const p of candidatos) {
    try {
      // La baja se revisa antes de marcar: si la consulta falla (fail-closed
      // = "de baja") el pedido no queda marcado y se reintenta otro día.
      if (await estaDeBaja(p.email)) {
        stats.skipped_baja++;
        continue;
      }
      const tomado = await pedidos().marcarOpinionSolicitada(p.numero);
      if (!tomado) continue;
      if (await correoPedirOpinion(p, urlBaja(p.email))) stats.review_requests_sent++;
      else {
        // No salió: se desmarca para reintentarlo en la próxima pasada.
        await pedidos().desmarcarOpinionSolicitada(p.numero);
        stats.errors++;
      }
    } catch (error) {
      logSafeError('post-purchase-opinion', { numero: p.numero, error: String(error) });
      stats.errors++;
    }
  }

  // ---- Replenishment: APAGADO ----
  // El recordatorio de reposición es publicidad: según la Política de
  // Privacidad (sección 4) sólo se envía con consentimiento (acepta_ofertas)
  // y respetando la baja (lib/baja-correos.ts). sendReplenishmentEmail se conserva.
  void sendReplenishmentEmail;

  return NextResponse.json({ ok: true, ...stats });
}
