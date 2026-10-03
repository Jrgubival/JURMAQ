import 'server-only';
import { cache } from 'react';
import { supabasePublic } from '@jurmaq/shared/supabase';
import { applyDailyPromosToProducts } from '@/lib/promotions';

/**
 * Consulta de la grilla de una categoría, compartida por la página
 * (/categorias/[slug], estática) y por /api/catalogo (filtros en el navegador).
 *
 * Antes la página leía searchParams en el servidor, y eso la volvía dinámica:
 * cada visita, cada bot y cada `?page=N` ejecutaba una función y ~8 consultas
 * a Supabase. En los logs de oct-2026 era la ruta que más funciones gastaba.
 * Ahora la página se sirve desde caché con la página 1 y el orden por nombre,
 * y los filtros piden esta misma consulta a /api/catalogo, que la CDN guarda
 * 10 minutos por combinación.
 */

export const POR_PAGINA = 16;

export const ORDENES = ['nombre', 'precio_asc', 'precio_desc', 'stock_desc'] as const;
export type Orden = (typeof ORDENES)[number];

export const FILTROS_STOCK = ['all', 'instock', 'outofstock'] as const;
export type FiltroStock = (typeof FILTROS_STOCK)[number];

export interface ParametrosCatalogo {
  page: number;
  sort: Orden;
  stock: FiltroStock;
  min?: number;
  max?: number;
}

export interface ProductoCatalogo {
  id: number;
  codigo: string | null;
  nombre: string;
  slug: string;
  precio: number;
  precio_original: number | null;
  en_oferta: boolean | null;
  solo_cotizar: boolean | null;
  stock: number | null;
  unidad: string | null;
  imagen: string | null;
  medida: string | null;
  categoria_id: number | null;
}

export const PARAMETROS_POR_DEFECTO: ParametrosCatalogo = { page: 1, sort: 'nombre', stock: 'all' };

const COLUMNAS =
  'id, codigo, nombre, slug, precio, precio_original, en_oferta, solo_cotizar, stock, unidad, imagen, medida, categoria_id';

/** Categoría activa + ids de sus subcategorías. Deduplicada por request con cache(). */
export const categoriaPorSlug = cache(async (slug: string) => {
  const { data: categoria } = await supabasePublic
    .from('barraca_categorias')
    .select('id, nombre, slug, imagen, padre_id')
    .eq('slug', slug)
    .eq('activa', true)
    .maybeSingle();
  if (!categoria) return null;

  const { data: subcats } = await supabasePublic
    .from('barraca_categorias')
    .select('id, nombre, slug')
    .eq('padre_id', categoria.id)
    .eq('activa', true)
    .order('nombre');

  const lista = subcats ?? [];
  return { categoria, subcats: lista, catIds: [categoria.id, ...lista.map((s) => s.id)] };
});

export async function productosDeCategoria(
  catIds: number[],
  p: ParametrosCatalogo,
): Promise<{ productos: ProductoCatalogo[]; total: number }> {
  let conteo = supabasePublic
    .from('barraca_productos')
    .select('id', { count: 'exact', head: true })
    .eq('activo', true)
    .in('categoria_id', catIds);
  let consulta = supabasePublic
    .from('barraca_productos')
    .select(COLUMNAS)
    .eq('activo', true)
    .in('categoria_id', catIds);

  if (p.min !== undefined) {
    conteo = conteo.gte('precio', p.min);
    consulta = consulta.gte('precio', p.min);
  }
  if (p.max !== undefined) {
    conteo = conteo.lte('precio', p.max);
    consulta = consulta.lte('precio', p.max);
  }
  if (p.stock === 'instock') {
    conteo = conteo.gt('stock', 0);
    consulta = consulta.gt('stock', 0);
  } else if (p.stock === 'outofstock') {
    conteo = conteo.eq('stock', 0);
    consulta = consulta.eq('stock', 0);
  }

  if (p.sort === 'precio_asc') consulta = consulta.order('precio', { ascending: true });
  else if (p.sort === 'precio_desc') consulta = consulta.order('precio', { ascending: false });
  else if (p.sort === 'stock_desc') consulta = consulta.order('stock', { ascending: false });
  else consulta = consulta.order('nombre');
  // Desempate estable: sin esto, dos productos con el mismo precio pueden
  // cambiar de página entre una consulta y otra.
  consulta = consulta.order('id');

  const desde = (p.page - 1) * POR_PAGINA;
  const [{ count }, { data }] = await Promise.all([
    conteo,
    consulta.range(desde, desde + POR_PAGINA - 1),
  ]);

  const productos = await applyDailyPromosToProducts((data ?? []) as ProductoCatalogo[]);
  return { productos, total: count ?? 0 };
}

/**
 * Lee y valida los filtros de una query string. Todo valor raro cae al
 * default en vez de llegar a la consulta: este parser lo usa un endpoint
 * público.
 */
export function leerParametros(q: URLSearchParams): ParametrosCatalogo {
  const page = Number.parseInt(q.get('page') ?? '1', 10);
  const sort = q.get('sort') as Orden | null;
  const stock = q.get('stock') as FiltroStock | null;
  const num = (v: string | null) => {
    if (v === null || v.trim() === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 1_000_000_000 ? Math.round(n) : undefined;
  };
  return {
    page: Number.isInteger(page) && page >= 1 && page <= 500 ? page : 1,
    sort: sort && (ORDENES as readonly string[]).includes(sort) ? sort : 'nombre',
    stock: stock && (FILTROS_STOCK as readonly string[]).includes(stock) ? stock : 'all',
    min: num(q.get('min')),
    max: num(q.get('max')),
  };
}
