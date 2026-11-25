/**
 * Acceso a los datos de la tienda que usan las herramientas de gestión
 * (productos, categorías, zonas de despacho). Es una interfaz para que la
 * lógica se pruebe sin Supabase; la implementación real está en
 * repo-supabase.ts. Todo cálculo de dinero ocurre fuera de aquí (modelo.ts).
 */
import type { FichaProducto } from "./modelo.ts";

/** Campos de una ficha que las herramientas pueden escribir. */
export type CamposFicha = Partial<
  Pick<
    FichaProducto,
    | "nombre" | "descripcion" | "precio" | "precio_original" | "en_oferta" | "oferta_fin" | "combo_cantidad" | "combo_precio"
    | "stock" | "activo" | "imagen" | "categoria_id" | "costo"
  >
>;

export interface FiltroBusqueda {
  texto?: string;
  codigo?: string;
  categoriaIds?: number[];
  estado: "activo" | "inactivo" | "todos";
  sinFoto?: boolean;
  sinStock?: boolean;
  soloOferta?: boolean;
  pagina: number;
  porPagina: number;
}

export interface CategoriaFila {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string | null;
  orden: number | null;
  padre_id: number | null;
  activa: boolean;
}

export interface ZonaFila {
  id: string;
  nombre: string;
  comuna: string;
  costo: number;
  gratis_desde: number | null;
  activo: boolean;
  orden: number;
}

export interface NuevaFicha {
  codigo: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  precio: number;
  precio_original: number | null;
  en_oferta: boolean;
  costo: number | null;
  stock: number;
  categoria_id: number | null;
  imagen: string | null;
  activo: boolean;
}

export interface RepoProductos {
  fichasPorCodigos(codigos: string[]): Promise<FichaProducto[]>;
  fichasPorIds(ids: number[]): Promise<FichaProducto[]>;
  /** Fichas activas (o todas) de esas categorías. Tope duro de filas para no volcar la tienda entera. */
  fichasPorCategorias(categoriaIds: number[], opciones: { soloActivas: boolean; tope: number }): Promise<FichaProducto[]>;
  /** Todas las fichas activas con sus costos (para márgenes), paginadas internamente. */
  fichasActivas(opciones: { categoriaIds?: number[]; tope: number }): Promise<FichaProducto[]>;
  buscar(f: FiltroBusqueda): Promise<{ filas: FichaProducto[]; total: number }>;
  /**
   * Escribe `campos` en una ficha. Con `esperado`, solo si precio y precio_original siguen como se vieron
   * (protege de pisar un cambio hecho en el intertanto). Devuelve false si no escribió.
   */
  actualizar(id: number, campos: CamposFicha, esperado?: { precio?: number; precio_original?: number | null }): Promise<boolean>;
  insertar(fila: NuevaFicha): Promise<{ ok: true; ficha: FichaProducto } | { ok: false; motivo: "codigo_repetido" | "slug_repetido" | "error" }>;
  existeSlug(slug: string): Promise<boolean>;
  /** Cuántas fichas activas hay por categoría. */
  conteoPorCategoria(): Promise<Map<number, number>>;
}

export interface RepoCategorias {
  listar(opciones: { incluirInactivas: boolean }): Promise<CategoriaFila[]>;
  porIds(ids: number[]): Promise<CategoriaFila[]>;
  insertar(fila: { nombre: string; slug: string; descripcion: string | null; orden: number; padre_id: number | null }): Promise<CategoriaFila | null>;
  actualizar(id: number, campos: Partial<Pick<CategoriaFila, "nombre" | "orden" | "activa" | "descripcion">>): Promise<boolean>;
  existeSlug(slug: string): Promise<boolean>;
}

export interface RepoZonas {
  listar(): Promise<ZonaFila[]>;
  actualizar(id: string, campos: Partial<Pick<ZonaFila, "costo" | "gratis_desde" | "activo">>, por: string | null): Promise<boolean>;
}
