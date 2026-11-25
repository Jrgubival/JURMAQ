/**
 * Dependencias del servicio de SEO, relacionados y guías: las de la gestión (tienda, categorías,
 * aprobaciones, refresco de fichas) más refrescar rutas y leer los datos del local. Los servicios
 * las reciben por parámetro: las herramientas usan las reales (deps-reales.ts) y las pruebas pasan falsas.
 */
import type { DepsGestion } from "../gestion-precios/deps.ts";
import type { LocalParaMeta } from "./defecto.ts";

export interface DepsSeo extends DepsGestion {
  /** Regenera esas rutas de la tienda y olvida la caché de lectura. Nunca debe lanzar. */
  revalidarRutas(rutas: string[]): Promise<void>;
  /** Datos del local para los textos de nosotros, contacto y dónde estamos. Nunca debe lanzar. */
  local(): Promise<LocalParaMeta>;
}
