import 'server-only';
import { env } from '@jurmaq/shared/env';

/**
 * Destino de los avisos internos de la tienda barraca (pedido nuevo, pedido
 * pagado, cotización nueva, contraoferta aceptada/rechazada).
 *
 * Jorge (31-10-2026): contacto@jurmaq.cl. BARRACA_AVISOS_EMAIL sólo sirve para
 * cambiarla sin tocar el código; no se usan ADMIN_EMAIL ni otras casillas
 * generales para no mandar avisos de la barraca a otra parte.
 */
export const AVISOS_BARRACA_POR_DEFECTO = 'contacto@jurmaq.cl';

export function avisosBarraca(): string {
  return env.BARRACA_AVISOS_EMAIL?.trim() || AVISOS_BARRACA_POR_DEFECTO;
}
