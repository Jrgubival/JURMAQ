import 'server-only';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { reembolsarWebpay } from '@/lib/pagos/webpay';
import { pedidos, type MotivoRechazo, type Pedido } from './index';
import { correoRechazoComprador } from './correos';

/**
 * "No aprobar" un pedido (Términos 8.4) y devolver lo pagado. Lo usa el panel
 * (api/admin/pedidos/[numero]/rechazar), que ya validó permiso y datos.
 */

export const pagadoConWebpay = (p: Pedido) => p.pasarela === 'webpay' && !!p.pagado_at && !!p.pasarela_referencia;

/**
 * Anula el pago en Webpay una sola vez: toma el candado del reembolso antes
 * de llamar a Transbank, así dos clics (o un reintento) no reembolsan dos veces
 * ni pisan un "hecho". Devuelve null si otro proceso ya lo tomó.
 */
export async function devolverWebpay(p: Pedido): Promise<boolean | null> {
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

export type ResultadoRechazo =
  | { ok: true; reembolso: 'hecho' | 'error' | 'transferencia' | null }
  | { ok: false; status: number; error: string };

export async function rechazarPedido(numero: string, motivo: MotivoRechazo, nota: string | null): Promise<ResultadoRechazo> {
  const store = pedidos();
  const pedido = await store.porNumero(numero);
  if (!pedido) return { ok: false, status: 404, error: 'Pedido no encontrado' };
  const r = await store.cerrar(numero, 'rechazado', motivo, nota);
  if (r !== 'ok') return { ok: false, status: 409, error: 'Este pedido ya salió o está cerrado: no se puede rechazar' };
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
  return { ok: true, reembolso };
}

export async function reintentarDevolucion(numero: string): Promise<{ ok: boolean | null; status: number; error?: string }> {
  const pedido = await pedidos().porNumero(numero);
  if (!pedido) return { ok: false, status: 404, error: 'Pedido no encontrado' };
  if (!['rechazado', 'cancelado'].includes(pedido.estado) || !pagadoConWebpay(pedido) || pedido.reembolso?.estado === 'hecho') {
    return { ok: false, status: 409, error: 'Este pedido no tiene un reembolso de Webpay pendiente' };
  }
  const ok = await devolverWebpay(pedido);
  if (ok === null) return { ok: null, status: 409, error: 'La devolución ya está en curso o hecha' };
  return { ok, status: ok ? 200 : 502 };
}
