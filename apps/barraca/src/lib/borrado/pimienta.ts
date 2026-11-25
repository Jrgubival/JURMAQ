/**
 * Lectura del secreto `BORRADO_REF_PEPPER` (secreto del worker, `wrangler secret put BORRADO_REF_PEPPER`; mínimo 32
 * caracteres al azar). Sirve para firmar (HMAC) la referencia de la persona en la herramienta de borrar datos personales.
 * Es SECRETO NUEVO: hay que ponerlo antes de publicar; sin él `borrar_datos_persona` queda bloqueada con un mensaje claro.
 * Nunca se escribe en código, historial, avisos ni respuestas. Un solo lugar de lectura.
 */
import { PIMIENTA_MIN } from "./personas.ts";

export function leerPimientaBorrado(): string | null {
  try {
    const v = typeof process !== "undefined" ? process.env.BORRADO_REF_PEPPER : undefined;
    const t = (v ?? "").trim();
    return t.length >= PIMIENTA_MIN ? t : null;
  } catch {
    return null;
  }
}
