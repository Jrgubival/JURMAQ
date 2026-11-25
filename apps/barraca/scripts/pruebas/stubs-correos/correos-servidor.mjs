// Lectura simulada de plantillas publicadas para las pruebas de correos.ts.
// globalThis.__PLANTILLAS_PUBLICADAS__: { [clave]: { campo: texto } } (vacío = D1 vacía = respaldo del código).
import { resolverTextos } from "../../../src/lib/correos-cliente/render.ts";
export async function textosCorreo(clave, variables) {
  const publicado = globalThis.__PLANTILLAS_PUBLICADAS__?.[clave] ?? null;
  if (globalThis.__PLANTILLAS_FALLA__) throw new Error("falla simulada");
  return resolverTextos(clave, publicado, variables);
}
