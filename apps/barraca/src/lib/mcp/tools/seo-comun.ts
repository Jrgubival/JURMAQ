/**
 * Piezas comunes de las herramientas de SEO, relacionados, guías y marcas: dependencias (reales o de prueba)
 * y traducción de errores de negocio a mensajes seguros para Claude.
 */
import type { DepsSeo } from "../../seo-editable/deps.ts";
import type { CtxSeo, Salida } from "../../seo-editable/servicio.ts";
import { ErrorGestion } from "../../gestion-precios/precios-masivos.ts";
import { ErrorHerramienta, type ContextoHerramienta, type SalidaHerramienta } from "./registro.ts";

let depsDePrueba: DepsSeo | null = null;

/** Solo para pruebas: reemplaza las dependencias reales por falsas. Con null vuelve a las reales. */
export function fijarDepsSeo(d: DepsSeo | null): void {
  depsDePrueba = d;
}

export async function obtenerDepsSeo(): Promise<DepsSeo> {
  if (depsDePrueba) return depsDePrueba;
  // Import dinámico: el módulo real usa "server-only" y no se carga fuera del servidor.
  const m = await import("../../seo-editable/deps-reales.ts");
  return m.depsSeoReales();
}

export const aCtxSeo = (ctx: ContextoHerramienta): CtxSeo => ctx;

/** Ejecuta un servicio y traduce sus errores de negocio a mensajes seguros. */
export async function ejecutarSeo(fn: () => Promise<Salida>): Promise<SalidaHerramienta> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErrorGestion) throw new ErrorHerramienta(e.message);
    throw e;
  }
}
