import "server-only";
/**
 * Textos de correos al cliente para el envío (servidor). Lee la plantilla publicada de D1 con el lector
 * seguro y arma los textos; ante cualquier falla devuelve los del código. Nunca lanza.
 * La lógica está en lector.ts y render.ts (puras, con pruebas).
 */
import { obtenerGestionDb } from "../gestion/d1.ts";
import { crearLectorCorreos } from "./lector.ts";
import type { ClaveCorreo, VariablesCorreo } from "./plantillas.ts";
import { resolverTextos, type TextosCorreo } from "./render.ts";

/** Al compilar y en `next dev` no se toca D1 (igual que el contenido editable): ahí salen los textos del código. */
function sinLecturaDeD1(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build" || process.env.NODE_ENV === "development";
}

const lector = crearLectorCorreos({
  obtenerDb: async () => (sinLecturaDeD1() ? null : obtenerGestionDb()),
  alFallar: (motivo) => {
    if (motivo !== "sin_db") console.warn(`[correos-cliente] D1 no respondió (${motivo}): los correos salen con el texto del código.`);
  },
});

export async function textosCorreo(clave: ClaveCorreo, variables: VariablesCorreo): Promise<TextosCorreo> {
  try {
    return resolverTextos(clave, await lector.publicado(clave), variables);
  } catch {
    return resolverTextos(clave, null, variables);
  }
}

/** Después de publicar en la misma isla: olvida la caché para que se vea al tiro. */
export function invalidarLecturaCorreos(): void {
  lector.invalidar();
}
