import 'server-only';
import { revalidarFichasDePedido } from '@/lib/revalidar';
import { env } from '@jurmaq/shared/env';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { pedidos, esProduccion, type ResultadoPago } from '@/lib/pedidos';
import { correoAvisoBarraca, correoConfirmacionComprador } from '@/lib/pedidos/correos';
import { mercadoPago } from './mercadopago';
import { pagoSimulado } from './simulado';
import { webpay, webpayConfigurado } from './webpay';
import type { EstadoPagoPasarela, PasarelaPago } from './tipos';

export type { PasarelaPago } from './tipos';

/** Pasarela de "Pagar en línea" según PAGO_PASARELA (por defecto, Webpay Plus). */
export function pasarelaActiva(): PasarelaPago {
  if (env.PAGO_PASARELA === 'simulado') {
    if (esProduccion()) throw new Error('PAGO_PASARELA=simulado no está permitido en producción');
    return pagoSimulado;
  }
  if (env.PAGO_PASARELA === 'mercadopago') return mercadoPago;
  return webpay;
}

/** ¿Se puede ofrecer "Pagar en línea"? (hay credenciales o es la simulada). */
export function pagoEnLineaDisponible(): boolean {
  if (env.PAGO_PASARELA === 'simulado') return !esProduccion();
  if (env.PAGO_PASARELA === 'mercadopago') return !!env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  return webpayConfigurado();
}

/** Origen público de la tienda, para armar URLs de retorno y notificación. */
export function origenTienda(requestUrl?: string): string {
  if (process.env.NODE_ENV !== 'production' && requestUrl) return new URL(requestUrl).origin;
  return (env.NEXT_PUBLIC_BARRACA_URL || 'https://barraca.jurmaq.cl').replace(/\/$/, '');
}

/**
 * Aplica al pedido lo que informó la pasarela (ya consultado a la pasarela,
 * nunca tomado de la URL). Idempotente: se puede llamar desde el webhook y
 * desde la página de retorno para el mismo pago.
 */
export async function aplicarEstadoPago(
  estado: EstadoPagoPasarela,
  pasarela: string,
): Promise<ResultadoPago | 'pendiente' | 'rechazado'> {
  const store = pedidos();
  if (estado.estado === 'aprobado') {
    const r = await store.marcarPagado(estado.numero, estado.monto, estado.pagoId, pasarela);
    if (r === 'pagado') {
      logSafe('pedido-pagado', { numero: estado.numero, pasarela });
      const p = await store.porNumero(estado.numero);
      if (p) await Promise.all([correoConfirmacionComprador(p), correoAvisoBarraca(p, 'pagado'), revalidarFichasDePedido(p.items)]);
    } else if (r === 'monto_distinto') {
      logSafeError('pedido-monto-distinto', { numero: estado.numero, monto: estado.monto, pago: estado.pagoId });
    }
    return r;
  }
  if (estado.estado === 'rechazado') {
    await store.marcarRechazado(estado.numero, estado.pagoId);
    return 'rechazado';
  }
  return 'pendiente';
}
