import 'server-only';
import { env } from '@jurmaq/shared/env';
import { esProduccion } from '@/lib/pedidos';
import { courierEnviame } from './enviame';
import { courierSimulado } from './simulado';
import type { Courier } from './tipos';
import { COURIER_HABILITADO } from '../tarifas';

export type { Courier, Bulto, Paquete, CotizacionCourier, EnvioEmitido } from './tipos';

/**
 * Courier activo según COURIER, o null si no hay (entonces sólo se despacha
 * en camión propio). Apagado del todo con COURIER_HABILITADO. Fail-closed: el simulado nunca corre en producción y
 * Envíame sin llave no se ofrece.
 */
export function courierActivo(): Courier | null {
  if (!COURIER_HABILITADO) return null;
  if (env.COURIER === 'simulado') return esProduccion() ? null : courierSimulado;
  if (env.COURIER === 'enviame') return env.ENVIAME_API_KEY?.trim() ? courierEnviame : null;
  return null;
}

export function courierPorId(id: string | null | undefined): Courier | null {
  const c = courierActivo();
  return c && c.id === id ? c : null;
}
