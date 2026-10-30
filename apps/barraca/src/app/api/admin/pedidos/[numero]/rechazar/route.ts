import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { z, parseBody } from '@jurmaq/shared/validation';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { pedidos, PATRON_NUMERO, MOTIVOS_RECHAZO, type MotivoRechazo, type Pedido } from '@/lib/pedidos';
import { correoRechazoComprador } from '@/lib/pedidos/correos';
import { reembolsarWebpay } from '@/lib/pagos/webpay';

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

const pagadoConWebpay = (p: Pedido) => p.pasarela === 'webpay' && !!p.pagado_at && !!p.pasarela_referencia;

/**
 * Anula el pago en Webpay una sola vez: toma el candado del reembolso antes
 * de llamar a Transbank, así dos clics (o un reintento) no reembolsan dos veces
 * ni pisan un "hecho". Devuelve null si otro proceso ya lo tomó.
 */
async function devolverWebpay(p: Pedido): Promise<boolean | null> {
  const store = pedidos();
  const ahora = () => new Date().toISOString();
  if (!(await store.tomarReembolso(p.numero, { estado: 'en_curso', medio: 'webpay', monto: p.total, fecha: ahora() }))) return null;
  try {
    const r = await reembolsarWebpay(p.pasarela_referencia!, p.total);
    await store.guardarReembolso(p.numero, {
      estado: r.ok ? 'hecho' : 'error', medio: 'webpay', monto: p.total, tipo: r.tipo, autorizacion: r.autorizacion, fecha: ahora(),
    });
    logSafe('admin-pedido-reembolso', { numero: p.numero, ok: r.ok, tipo: r.tipo });
    return r.ok;
  } catch (error) {
    logSafeError('admin-pedido-reembolso-error', { numero: p.numero, error: String(error) });
    await store.guardarReembolso(p.numero, { estado: 'error', medio: 'webpay', monto: p.total, fecha: ahora() });
    return false;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  const session = await requirePermission('barraca_cotizaciones', 'update');
  if (!session) return forbiddenResponse();

  const { numero } = await params;
  if (!PATRON_NUMERO.test(numero)) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  const parsed = parseBody(schema, await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  try {
    const store = pedidos();
    const pedido = await store.porNumero(numero);
    if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

    if (parsed.data.accion === 'reembolsar') {
      if (pedido.estado !== 'rechazado' || !pagadoConWebpay(pedido) || pedido.reembolso?.estado === 'hecho') {
        return NextResponse.json({ error: 'Este pedido no tiene un reembolso de Webpay pendiente' }, { status: 409 });
      }
      const ok = await devolverWebpay(pedido);
      if (ok === null) return NextResponse.json({ error: 'La devolución ya está en curso o hecha' }, { status: 409 });
      return NextResponse.json({ ok, reembolso: ok ? 'hecho' : 'error' }, { status: ok ? 200 : 502 });
    }

    const r = await store.cerrar(numero, 'rechazado', parsed.data.motivo, parsed.data.nota || null);
    if (r !== 'ok') {
      return NextResponse.json({ error: 'Este pedido ya salió o está cerrado: no se puede rechazar' }, { status: 409 });
    }
    // Se relee después de cerrar: el pago pudo confirmarse justo antes.
    const cerrado = (await store.porNumero(numero)) ?? pedido;
    let reembolso: 'hecho' | 'error' | 'transferencia' | null = null;
    if (cerrado.pagado_at) {
      if (pagadoConWebpay(cerrado)) {
        reembolso = (await devolverWebpay(cerrado)) ? 'hecho' : 'error';
      } else {
        await store.guardarReembolso(numero, { estado: 'pendiente', medio: 'transferencia', monto: cerrado.total, fecha: new Date().toISOString() });
        reembolso = 'transferencia';
      }
    }
    const actualizado = await store.porNumero(numero);
    if (actualizado) await correoRechazoComprador(actualizado);
    logSafe('admin-pedido-rechazado', { numero, motivo: parsed.data.motivo, reembolso, por: session.user?.id ?? null });
    return NextResponse.json({ ok: true, reembolso });
  } catch (error) {
    logSafeError('admin-pedido-rechazar-error', { numero, error: String(error) });
    return NextResponse.json({ error: 'No se pudo rechazar el pedido' }, { status: 500 });
  }
}
