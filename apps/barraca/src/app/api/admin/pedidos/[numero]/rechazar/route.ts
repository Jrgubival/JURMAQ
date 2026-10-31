import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { z, parseBody } from '@jurmaq/shared/validation';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { PATRON_NUMERO, MOTIVOS_RECHAZO, type MotivoRechazo } from '@/lib/pedidos';
import { rechazarPedido, reintentarDevolucion } from '@/lib/pedidos/rechazo';

/**
 * POST /api/admin/pedidos/[numero]/rechazar — la barraca no aprueba un pedido
 * por una causa objetiva de la lista cerrada (Términos 8.4).
 *
 *   { accion: 'rechazar', motivo, nota? } → estado 'rechazado', devuelve el
 *     stock, si se pagó con Webpay anula el pago por la API (refund) y avisa
 *     al comprador por correo que se le devuelve el 100%.
 *   { accion: 'reembolsar' } → reintenta la anulación en Webpay de un pedido
 *     ya rechazado cuyo reembolso falló.
 *
 * El panel pide confirmación antes de llamar. Montos siempre del pedido guardado.
 */
const motivos = Object.keys(MOTIVOS_RECHAZO) as [MotivoRechazo, ...MotivoRechazo[]];
const schema = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('rechazar'), motivo: z.enum(motivos), nota: z.string().trim().max(500).optional() }),
  z.object({ accion: z.literal('reembolsar') }),
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  const session = await requirePermission('barraca_cotizaciones', 'update');
  if (!session) return forbiddenResponse();

  const { numero } = await params;
  if (!PATRON_NUMERO.test(numero)) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  const parsed = parseBody(schema, await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  try {
    if (parsed.data.accion === 'reembolsar') {
      const r = await reintentarDevolucion(numero);
      if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
      return NextResponse.json({ ok: r.ok, reembolso: r.ok ? 'hecho' : 'error' }, { status: r.status });
    }
    const r = await rechazarPedido(numero, parsed.data.motivo, parsed.data.nota || null);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    logSafe('admin-pedido-rechazado', { numero, motivo: parsed.data.motivo, reembolso: r.reembolso, por: session.user?.id ?? null });
    return NextResponse.json({ ok: true, reembolso: r.reembolso });
  } catch (error) {
    logSafeError('admin-pedido-rechazar-error', { numero, error: String(error) });
    return NextResponse.json({ error: 'No se pudo rechazar el pedido' }, { status: 500 });
  }
}
