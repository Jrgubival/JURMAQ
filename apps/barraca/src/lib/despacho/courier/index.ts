import 'server-only';
import { env } from '@jurmaq/shared/env';
import { esProduccion } from '@/lib/pedidos';
import { courierBluex } from './bluex';
import { courierSimulado } from './simulado';
import type { Courier } from './tipos';

export type { Courier, Bulto, CotizacionCourier, EnvioEmitido } from './tipos';

/**
 * Courier activo según COURIER, o null si no hay (entonces sólo se despacha
 * en camión propio). Fail-closed: el simulado nunca corre en producción y
 * Blue Express sin llave no se ofrece.
 */
export function courierActivo(): Courier | null {
  if (env.COURIER === 'simulado') return esProduccion() ? null : courierSimulado;
  if (env.COURIER === 'bluex') return env.BLUEX_API_KEY?.trim() ? courierBluex : null;
  return null;
}

export function courierPorId(id: string | null | undefined): Courier | null {
  const c = courierActivo();
  return c && c.id === id ? c : null;
}
