/**
 * Ayudas del modo de aprobación `avisar` para quien NO pasa por `exigirAprobacion` (gestion-precios/aprobacion.ts), que
 * ya lo maneja por dentro. Todo se decide con el modo y el correo de Jorge de AHORA (nunca se guarda en caché).
 *
 * Regla común: el modo `avisar` solo actúa si hay un correo de Jorge válido en BARRACA_APROBADOR_EMAIL, distinto del de
 * quien pide. Si no, se comporta como `exigir` (que bloquea sin ese correo).
 */
import type { D1Like } from "../gestion/index.ts";
import {
  consumirAprobacion, crearAprobacionAutomatica, devolverAprobacion, mismoCorreo, motivosAvisables,
  type DatosSolicitud,
} from "./aprobaciones.ts";
import { correoAprobadorDeEntorno } from "./aviso-operacion.ts";
import { leerModoAprobacion } from "./modo-aprobacion.ts";

/** ¿Este cambio se puede aplicar avisando (en vez de esperar el OK de Jorge)? */
export function avisoPosible(usuarioEmail: string | null | undefined, motivos: DatosSolicitud["motivos"]): boolean {
  if (leerModoAprobacion() !== "avisar" || !motivosAvisables(motivos)) return false;
  if (!String(usuarioEmail ?? "").trim()) return false;
  const para = correoAprobadorDeEntorno();
  return !!para && !mismoCorreo(para, usuarioEmail);
}

export interface AprobacionAvisar {
  id: string;
  /** Gasta la aprobación y deja registrado el aviso a Jorge (lo envía el servidor MCP al terminar la llamada). */
  gastar(): Promise<boolean>;
  /** El cambio no se aplicó: devuelve la aprobación y cancela el aviso. */
  devolver(): Promise<boolean>;
}

/**
 * Para flujos que YA son de dos pasos (previsualizar → confirmar): en modo `avisar`, el paso de confirmar aplica sin pedir
 * el OK de Jorge. Devuelve null si no corresponde (modo `exigir`, sin correo de Jorge válido, tope por hora): quien llama
 * sigue su flujo normal de aprobación. Con valor: llama `gastar()` ANTES de aplicar y `devolver()` si no se aplicó.
 */
export async function aprobarEnModoAvisar(db: D1Like, d: DatosSolicitud, ahora: number = Date.now()): Promise<AprobacionAvisar | null> {
  if (!avisoPosible(d.usuario.email, d.motivos)) return null;
  const auto = await crearAprobacionAutomatica(db, d, ahora);
  if (!auto) return null;
  const llave = { usuarioId: d.usuario.id, huellaActual: d.huella };
  return {
    id: auto.id,
    gastar: () => consumirAprobacion(db, auto.id, llave, ahora),
    devolver: () => devolverAprobacion(db, auto.id, llave, ahora),
  };
}
