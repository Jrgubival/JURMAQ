/**
 * Dependencias que usan los servicios de gestión (productos, precios, ofertas,
 * despacho): acceso a datos, pedir aprobación y refrescar la tienda. Los
 * servicios las reciben por parámetro; las herramientas MCP y el cron usan las
 * reales (deps-reales.ts) y las pruebas pasan falsas.
 */
import type { D1Like, UsuarioGestion } from "../gestion/index.ts";
import type { DepsAprobacionGestion } from "./aprobacion.ts";
import type { RepoCategorias, RepoProductos, RepoZonas } from "./repo.ts";

export interface DepsGestion {
  productos: RepoProductos;
  categorias: RepoCategorias;
  zonas: RepoZonas;
  aprobacion: DepsAprobacionGestion;
  /** Refresca las fichas afectadas en la tienda (pocas: solo ellas; muchas: el catálogo). Nunca debe lanzar. */
  revalidar(productoIds: number[]): Promise<void>;
  /** Invalida la caché de tarifas de despacho. Nunca debe lanzar. */
  zonasCambiadas(): Promise<void>;
}

/** Lo que un servicio necesita del contexto de una llamada (lo trae `ContextoHerramienta`). */
export interface CtxGestion {
  db: D1Like;
  usuario: UsuarioGestion;
  ahora: number;
  loteId: string;
  auditar(cambios: Array<{ entidad: string; entidadId: string | number; antes?: unknown; despues?: unknown; herramienta?: string }>): Promise<void>;
}
