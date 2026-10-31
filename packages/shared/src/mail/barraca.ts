import 'server-only';
import { env } from '@jurmaq/shared/env';

/**
 * Destino de los avisos internos de la tienda barraca (pedido nuevo, pedido
 * pagado, cotización nueva, contraoferta aceptada/rechazada).
 *
 * BARRACA_AVISOS_EMAIL es la casilla definitiva. Mientras no esté definida se
 * mantiene el destino anterior para no perder avisos de pedidos.
 */
export function avisosBarraca(): string {
  return env.BARRACA_AVISOS_EMAIL || env.BARRACA_PEDIDOS_EMAIL || env.ADMIN_EMAIL || 'contacto@jurmaq.cl';
}
