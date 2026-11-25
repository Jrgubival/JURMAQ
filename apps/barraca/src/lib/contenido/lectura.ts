import "server-only";
/**
 * Lectura del contenido para páginas y rutas de la tienda (servidor). Toma la
 * D1 de gestión vía OpenNext y cae al respaldo en código ante cualquier falla.
 * La lógica está en lector.ts (probada con D1 simulada).
 */
import { obtenerGestionDb } from "../gestion/d1.ts";
import { crearLector } from "./lector.ts";
import { vistaLocal, type VistaLocal } from "./derivados.ts";
import type { ClaveContenido, ValoresContenido } from "./tipos.ts";

const lector = crearLector({
  obtenerDb: obtenerGestionDb,
  alFallar: (motivo) => {
    if (motivo !== "sin_db") console.warn(`[contenido] D1 no respondió (${motivo}): la tienda usa el respaldo en código.`);
  },
});

export function leerContenido<K extends ClaveContenido>(clave: K): Promise<ValoresContenido[K]> {
  return lector.leer(clave);
}

export function leerContenidoConOrigen<K extends ClaveContenido>(clave: K) {
  return lector.leerConOrigen(clave);
}

/** Datos del local con todo lo derivado (horario en texto, enlaces). La fuente única de la tienda. */
export async function leerLocal(): Promise<VistaLocal> {
  return vistaLocal(await lector.leer("datos_local"));
}

export function invalidarLecturaContenido(): void {
  lector.invalidar();
}
