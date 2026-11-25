/**
 * Implementación real de los repositorios con Supabase (service role, solo servidor).
 * Las tablas no están todas en db-types, por eso el cliente va sin tipos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@jurmaq/shared/supabase";
import { escapeOrFilter } from "@jurmaq/shared/sanitize";
import type { FichaProducto } from "./modelo.ts";
import type { CamposFicha, CategoriaFila, FiltroBusqueda, NuevaFicha, RepoCategorias, RepoProductos, RepoZonas, ZonaFila } from "./repo.ts";

const db = supabaseAdmin as unknown as SupabaseClient;

const COL_BASE = "id, codigo, nombre, slug, descripcion, precio, precio_original, en_oferta, oferta_fin, costo, stock, activo, categoria_id, imagen, solo_cotizar";
const COL_CON_COMBO = `${COL_BASE}, combo_cantidad, combo_precio`;
const TABLA = "barraca_productos";
const PAGINA = 1000;

// Si la migración de combos no está aplicada, se sigue sin esas dos columnas.
let usarCombos = true;

type Fila = Record<string, unknown>;
type Respuesta = { data: unknown; error: { message?: string; code?: string } | null; count?: number | null };

async function leer(construir: (columnas: string) => PromiseLike<Respuesta>): Promise<{ filas: Fila[]; count: number | null }> {
  let r = await construir(usarCombos ? COL_CON_COMBO : COL_BASE);
  if (r.error && usarCombos && /combo_/.test(String(r.error.message))) {
    usarCombos = false;
    r = await construir(COL_BASE);
  }
  if (r.error) throw new Error("Consulta de productos falló");
  return { filas: (r.data ?? []) as Fila[], count: r.count ?? null };
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export function aFicha(f: Fila): FichaProducto {
  return {
    id: Number(f.id),
    codigo: typeof f.codigo === "string" ? f.codigo : null,
    nombre: String(f.nombre ?? ""),
    slug: String(f.slug ?? ""),
    descripcion: typeof f.descripcion === "string" ? f.descripcion : null,
    precio: Number(f.precio ?? 0),
    precio_original: num(f.precio_original),
    en_oferta: !!f.en_oferta,
    oferta_fin: typeof f.oferta_fin === "string" ? f.oferta_fin : null,
    combo_cantidad: num(f.combo_cantidad),
    combo_precio: num(f.combo_precio),
    costo: num(f.costo),
    stock: num(f.stock),
    activo: f.activo !== false,
    categoria_id: num(f.categoria_id),
    imagen: typeof f.imagen === "string" && f.imagen ? f.imagen : null,
    solo_cotizar: f.solo_cotizar === null || f.solo_cotizar === undefined ? null : !!f.solo_cotizar,
  };
}

function trozos<T>(lista: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n));
  return out;
}

export const repoProductosSupabase: RepoProductos = {
  async fichasPorCodigos(codigos) {
    const unicos = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];
    const out: FichaProducto[] = [];
    for (const lote of trozos(unicos, 100)) {
      const { filas } = await leer((c) => db.from(TABLA).select(c).in("codigo", lote).order("id").range(0, PAGINA - 1));
      out.push(...filas.map(aFicha));
    }
    return out;
  },

  async fichasPorIds(ids) {
    const unicos = [...new Set(ids.filter((i) => Number.isInteger(i) && i > 0))];
    const out: FichaProducto[] = [];
    for (const lote of trozos(unicos, 150)) {
      const { filas } = await leer((c) => db.from(TABLA).select(c).in("id", lote).order("id").range(0, PAGINA - 1));
      out.push(...filas.map(aFicha));
    }
    return out;
  },

  async fichasPorCategorias(categoriaIds, { soloActivas, tope }) {
    if (categoriaIds.length === 0) return [];
    const out: FichaProducto[] = [];
    for (let desde = 0; out.length < tope; desde += PAGINA) {
      const { filas } = await leer((c) => {
        let q = db.from(TABLA).select(c).in("categoria_id", categoriaIds).order("id").range(desde, desde + PAGINA - 1);
        if (soloActivas) q = q.eq("activo", true);
        return q;
      });
      out.push(...filas.map(aFicha));
      if (filas.length < PAGINA) break;
    }
    return out.slice(0, tope);
  },

  async fichasActivas({ categoriaIds, tope }) {
    const out: FichaProducto[] = [];
    for (let desde = 0; out.length < tope; desde += PAGINA) {
      const { filas } = await leer((c) => {
        let q = db.from(TABLA).select(c).eq("activo", true).order("id").range(desde, desde + PAGINA - 1);
        if (categoriaIds && categoriaIds.length > 0) q = q.in("categoria_id", categoriaIds);
        return q;
      });
      out.push(...filas.map(aFicha));
      if (filas.length < PAGINA) break;
    }
    return out.slice(0, tope);
  },

  async buscar(f: FiltroBusqueda) {
    const { filas, count } = await leer((c) => {
      let q = db.from(TABLA).select(c, { count: "exact" });
      if (f.estado === "activo") q = q.eq("activo", true);
      if (f.estado === "inactivo") q = q.eq("activo", false);
      if (f.codigo) q = q.eq("codigo", f.codigo);
      if (f.texto) {
        const s = escapeOrFilter(f.texto);
        q = q.or(`nombre.ilike.%${s}%,codigo.ilike.%${s}%`);
      }
      if (f.categoriaIds && f.categoriaIds.length > 0) q = q.in("categoria_id", f.categoriaIds);
      if (f.sinFoto) q = q.or("imagen.is.null,imagen.eq.");
      if (f.sinStock) q = q.or("stock.is.null,stock.lte.0");
      if (f.soloOferta) q = q.eq("en_oferta", true);
      const desde = (f.pagina - 1) * f.porPagina;
      return q.order("nombre").order("id").range(desde, desde + f.porPagina - 1);
    });
    return { filas: filas.map(aFicha), total: count ?? filas.length };
  },

  async actualizar(id, campos: CamposFicha, esperado) {
    let q = db.from(TABLA).update(campos).eq("id", id);
    if (esperado) {
      if ("precio" in esperado && esperado.precio !== undefined) q = q.eq("precio", esperado.precio);
      if ("precio_original" in esperado) q = esperado.precio_original === null || esperado.precio_original === undefined ? q.is("precio_original", null) : q.eq("precio_original", esperado.precio_original);
    }
    const { data, error } = await q.select("id");
    if (error) throw new Error("Escritura de producto falló");
    return Array.isArray(data) && data.length > 0;
  },

  async insertar(fila: NuevaFicha) {
    const { data, error } = await db.from(TABLA).insert({ ...fila, solo_cotizar: false }).select(usarCombos ? (COL_CON_COMBO as string) : (COL_BASE as string)).single();
    if (error) {
      if ((error as { code?: string }).code === "23505") return { ok: false, motivo: /slug/i.test(error.message ?? "") ? "slug_repetido" : "codigo_repetido" };
      return { ok: false, motivo: "error" };
    }
    return { ok: true, ficha: aFicha(data as unknown as Fila) };
  },

  async existeSlug(slug) {
    const { count, error } = await db.from(TABLA).select("id", { count: "exact", head: true }).eq("slug", slug);
    if (error) throw new Error("Consulta de slug falló");
    return (count ?? 0) > 0;
  },

  async conteoPorCategoria() {
    const mapa = new Map<number, number>();
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await db.from(TABLA).select("categoria_id").eq("activo", true).order("id").range(desde, desde + PAGINA - 1);
      if (error) throw new Error("Conteo de categorías falló");
      const filas = (data ?? []) as Array<{ categoria_id: number | null }>;
      for (const f of filas) if (f.categoria_id !== null) mapa.set(f.categoria_id, (mapa.get(f.categoria_id) ?? 0) + 1);
      if (filas.length < PAGINA) break;
    }
    return mapa;
  },
};

const COL_CAT = "id, nombre, slug, descripcion, orden, padre_id, activa";
const aCategoria = (f: Fila): CategoriaFila => ({
  id: Number(f.id), nombre: String(f.nombre ?? ""), slug: String(f.slug ?? ""),
  descripcion: typeof f.descripcion === "string" ? f.descripcion : null, orden: num(f.orden), padre_id: num(f.padre_id), activa: f.activa !== false,
});

export const repoCategoriasSupabase: RepoCategorias = {
  async listar({ incluirInactivas }) {
    let q = db.from("barraca_categorias").select(COL_CAT).order("orden").order("nombre").range(0, 999);
    if (!incluirInactivas) q = q.eq("activa", true);
    const { data, error } = await q;
    if (error) throw new Error("Consulta de categorías falló");
    return ((data ?? []) as Fila[]).map(aCategoria);
  },
  async porIds(ids) {
    if (ids.length === 0) return [];
    const { data, error } = await db.from("barraca_categorias").select(COL_CAT).in("id", ids);
    if (error) throw new Error("Consulta de categorías falló");
    return ((data ?? []) as Fila[]).map(aCategoria);
  },
  async insertar(fila) {
    const { data, error } = await db.from("barraca_categorias").insert({ ...fila, activa: true }).select(COL_CAT).single();
    if (error) return null;
    return aCategoria(data as Fila);
  },
  async actualizar(id, campos) {
    const { data, error } = await db.from("barraca_categorias").update(campos).eq("id", id).select("id");
    if (error) throw new Error("Escritura de categoría falló");
    return Array.isArray(data) && data.length > 0;
  },
  async existeSlug(slug) {
    const { count, error } = await db.from("barraca_categorias").select("id", { count: "exact", head: true }).eq("slug", slug);
    if (error) throw new Error("Consulta de slug falló");
    return (count ?? 0) > 0;
  },
};

const COL_ZONA = "id, nombre, comuna, costo, gratis_desde, activo, orden";
export const repoZonasSupabase: RepoZonas = {
  async listar() {
    const { data, error } = await db.from("barraca_zonas_despacho").select(COL_ZONA).order("orden").order("nombre");
    if (error) throw new Error("Consulta de zonas falló");
    return ((data ?? []) as Fila[]).map((f): ZonaFila => ({
      id: String(f.id), nombre: String(f.nombre ?? ""), comuna: String(f.comuna ?? ""), costo: Number(f.costo ?? 0),
      gratis_desde: num(f.gratis_desde), activo: f.activo !== false, orden: Number(f.orden ?? 0),
    }));
  },
  async actualizar(id, campos, por) {
    const { data, error } = await db
      .from("barraca_zonas_despacho")
      .update({ ...campos, updated_by: por, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    if (error) throw new Error("Escritura de zona falló");
    return Array.isArray(data) && data.length > 0;
  },
};

