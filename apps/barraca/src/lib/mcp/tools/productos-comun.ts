/**
 * Piezas comunes de las herramientas de productos, precios, ofertas y despacho:
 * dependencias (reales o de prueba), traducción de errores y el deshacer genérico.
 */
import type { CtxGestion, DepsGestion } from "../../gestion-precios/deps.ts";
import { ErrorGestion, type Salida } from "../../gestion-precios/precios-masivos.ts";
import { revertirEntradas } from "../../gestion-precios/revertir.ts";
import { ErrorHerramienta, type ContextoHerramienta, type Revertidor, type SalidaHerramienta } from "./registro.ts";

let depsDePrueba: DepsGestion | null = null;

/** Solo para pruebas: reemplaza las dependencias reales por falsas. Con null vuelve a las reales. */
export function fijarDepsGestion(d: DepsGestion | null): void {
  depsDePrueba = d;
}

export async function obtenerDeps(): Promise<DepsGestion> {
  if (depsDePrueba) return depsDePrueba;
  // Import dinámico: el módulo real usa "server-only" y no se carga fuera del servidor.
  const m = await import("../../gestion-precios/deps-reales.ts");
  return m.depsReales();
}

/** Lo que los servicios necesitan del contexto de la llamada. */
export const aCtxGestion = (ctx: ContextoHerramienta): CtxGestion => ctx;

/** Ejecuta un servicio y traduce sus errores de negocio a mensajes seguros para Claude. */
export async function ejecutarServicio(fn: () => Promise<Salida>): Promise<SalidaHerramienta> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErrorGestion) throw new ErrorHerramienta(e.message);
    throw e;
  }
}

/** Deshacer genérico para productos, categorías y zonas: no pisa lo que alguien cambió después. */
export const revertidorGeneral: Revertidor = async ({ db, usuario, ahora, entradas }) => revertirEntradas(await obtenerDeps(), { db, usuario, ahora }, entradas);
