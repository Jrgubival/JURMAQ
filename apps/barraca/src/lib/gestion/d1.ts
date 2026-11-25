import { GestionNoDisponibleError, esGestionNoDisponible, type D1Like } from "./tipos.ts";

/**
 * Acceso a la base D1 de gestión (binding GESTION_DB, wrangler.jsonc) vía el
 * contexto de Cloudflare de OpenNext. Fuera de Workers (next dev, build,
 * pruebas) no hay contexto: se devuelve null / se lanza GestionNoDisponibleError.
 */

type ContextoCf = { env?: Record<string, unknown> };

async function leerContexto(): Promise<ContextoCf | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    try {
      return getCloudflareContext() as unknown as ContextoCf;
    } catch {
      // Fuera de una petición (p. ej. generación estática): modo asíncrono.
      return (await getCloudflareContext({ async: true })) as unknown as ContextoCf;
    }
  } catch {
    return null;
  }
}

function pareceD1(x: unknown): x is D1Like {
  return !!x && typeof (x as D1Like).prepare === "function" && typeof (x as D1Like).batch === "function";
}

/** La D1 de gestión, o null si no hay binding. Nunca lanza. */
export async function obtenerGestionDb(): Promise<D1Like | null> {
  const ctx = await leerContexto();
  const db = ctx?.env?.GESTION_DB;
  return pareceD1(db) ? db : null;
}

/** La D1 de gestión o GestionNoDisponibleError. */
export async function requerirGestionDb(): Promise<D1Like> {
  const db = await obtenerGestionDb();
  if (!db) throw new GestionNoDisponibleError("Falta el binding GESTION_DB.");
  return db;
}

/** Errores de D1 que significan "la base no está lista" (no existe, sin tablas, sin red). */
const PATRON_NO_LISTA = /no such table|no such database|database not found|Network connection lost/i;

/**
 * Ejecuta `fn` con la D1 de gestión. Si la base no está (sin binding, sin
 * crear o sin migrar) lanza GestionNoDisponibleError con un mensaje genérico;
 * cualquier otro error se propaga igual.
 *
 *   try { await usarGestion((db) => registrarLote(db, ...)); }
 *   catch (e) { if (esGestionNoDisponible(e)) return respuestaNoDisponible(); throw e; }
 */
export async function usarGestion<T>(fn: (db: D1Like) => Promise<T>): Promise<T> {
  const db = await requerirGestionDb();
  try {
    return await fn(db);
  } catch (e) {
    if (esGestionNoDisponible(e)) throw e;
    const mensaje = e instanceof Error ? e.message : "";
    if (PATRON_NO_LISTA.test(mensaje)) throw new GestionNoDisponibleError(undefined, { cause: e });
    throw e;
  }
}
