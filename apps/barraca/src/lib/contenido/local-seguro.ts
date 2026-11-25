import 'server-only';
import { leerLocal } from './lectura';
import { datosLocalRespaldo } from './local-respaldo';
import { vistaLocal, type VistaLocal } from './derivados';

/**
 * Datos del local para flujos que no pueden caerse (correos de pedido,
 * cotización de despacho, cron): la fuente única y, si la lectura falla por
 * cualquier motivo, el respaldo en código.
 */
export async function leerLocalSeguro(): Promise<VistaLocal> {
  try {
    return await leerLocal();
  } catch {
    return vistaLocal(datosLocalRespaldo());
  }
}
