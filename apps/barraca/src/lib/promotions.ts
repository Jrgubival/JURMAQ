import 'server-only';
import { supabaseAdmin } from "@jurmaq/shared/supabase";

export interface Promocion {
  id: number;
  titulo: string;
  descripcion: string | null;
  descuento_porcentaje: number;
  categoria_id: number;
  imagen: string | null;
  activa: boolean;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  created_at: string;
  barraca_categorias?: {
    nombre: string;
    slug: string;
  };
}

export interface ProductoPromocionado {
  id: number;
  codigo: string;
  nombre: string;
  slug: string;
  precio: number;
  stock: number;
  unidad: string | null;
  imagen: string | null;
  medida: string | null;
  categoria_id: number;
  precio_original_calculado: number;
  precio_con_descuento: number;
  descuento: number;
  promo_titulo: string;
}

/**
 * Get daily promotions using a deterministic seed based on today's date (Chile time UTC-4).
 * Same date always returns the same promotions, enabling caching.
 */
export async function getDailyPromotions(count: number = 4): Promise<Promocion[]> {
  const { data: promos } = await supabaseAdmin
    .from('barraca_promociones')
    .select('*, barraca_categorias(nombre, slug)')
    .eq('activa', true);

  if (!promos || promos.length === 0) return [];

  // Use Chile date (UTC-4) as seed for deterministic selection
  const now = new Date();
  const chileOffset = -4 * 60; // UTC-4 in minutes
  const chileTime = new Date(now.getTime() + (chileOffset + now.getTimezoneOffset()) * 60000);
  const seed = chileTime.getFullYear() * 10000 + (chileTime.getMonth() + 1) * 100 + chileTime.getDate();

  // Deterministic seeded shuffle
  const shuffled = [...promos].sort((a, b) => {
    const hashA = ((seed * 31 + a.id * 17) % 1000) / 1000;
    const hashB = ((seed * 31 + b.id * 17) % 1000) / 1000;
    return hashA - hashB;
  });

  return shuffled.slice(0, count) as Promocion[];
}

/**
 * Get products from a promotion's category (INCLUDING subcategories) with virtual discount.
 * Does NOT modify the database - discount is calculated on-the-fly.
 */
export async function getPromotedProducts(
  promocion: Promocion,
  limit: number = 8
): Promise<ProductoPromocionado[]> {
  // Get subcategories of the promo's category to include their products too
  const { data: subCats } = await supabaseAdmin
    .from('barraca_categorias')
    .select('id')
    .eq('padre_id', promocion.categoria_id)
    .eq('activa', true);

  const catIds = [promocion.categoria_id, ...(subCats || []).map((s: any) => s.id)];

  // Query products from parent AND subcategories
  const { data: products } = await supabaseAdmin
    .from('barraca_productos')
    .select('*')
    .in('categoria_id', catIds)
    .eq('activo', true)
    .gt('precio', 0)
    .order('precio', { ascending: false })
    .limit(limit);

  return (products || []).map((p: any) => ({
    ...p,
    precio_original_calculado: p.precio,
    precio_con_descuento: Math.round(p.precio * (1 - promocion.descuento_porcentaje / 100)),
    descuento: promocion.descuento_porcentaje,
    promo_titulo: promocion.titulo,
  }));
}

/**
 * Returns a map { categoria_id → descuento_porcentaje } of every category
 * that currently has an active promo, including subcategories that inherit
 * the discount from their parent (cascade).
 *
 * This is the SINGLE SOURCE OF TRUTH for "is this category on offer right
 * now" — used by both the product detail page and the listing helper below.
 *
 * Why not use `getDailyPromotions(4)`? Because that function returns only the
 * 4 promos featured in today's hero rotation, not all the active ones. An
 * admin who marks a promo as `activa=true` expects the discount to apply to
 * every product in that category EVERY day, not only days when the promo
 * happens to be in the daily-seeded top 4.
 */
export async function getActiveCategoryDiscountMap(): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  const { data: activePromos } = await supabaseAdmin
    .from('barraca_promociones')
    .select('id, categoria_id, descuento_porcentaje, activa')
    .eq('activa', true);

  if (!activePromos || activePromos.length === 0) return map;

  for (const promo of activePromos) {
    map.set(promo.categoria_id, promo.descuento_porcentaje);
  }

  // Cascade promo to subcategories of each promo'd category.
  const promoCatIds = Array.from(map.keys());
  const { data: subCats } = await supabaseAdmin
    .from('barraca_categorias')
    .select('id, padre_id')
    .in('padre_id', promoCatIds);

  for (const sub of subCats || []) {
    const parentDiscount = map.get(sub.padre_id);
    if (parentDiscount && !map.has(sub.id)) {
      map.set(sub.id, parentDiscount);
    }
  }

  return map;
}

/**
 * Enriches a list of products with the daily-promotion discount when their
 * category matches an active daily promo.
 *
 * The barraca has TWO offer systems:
 *  1. Sticky offers per product:  `en_oferta=true` + `precio_original` set on
 *     the row directly (toggled via /api/barraca/productos/bulk-price).
 *  2. Active category promos: a row in `barraca_promociones` with a category
 *     and a discount percentage. Applies to every product whose category
 *     (or parent category) matches.
 *
 * Without this helper, listing pages only saw system #1, so a product in a
 * promo'd category appeared at full price in the grid but at the discounted
 * price on the detail page — confusing and a price-mismatch waiting to
 * happen.
 *
 * The discount is mapped into the same shape ProductCard already renders:
 *    en_oferta       = true
 *    precio          = original (struck-through)
 *    precio_original = discounted (highlighted)
 *
 * Sticky offers (system #1) take precedence.
 */
export async function applyDailyPromosToProducts<
  T extends { id: number; categoria_id: number | null; precio: number; en_oferta?: boolean; precio_original?: number | null }
>(productos: T[]): Promise<T[]> {
  if (!productos || productos.length === 0) return productos;

  const promoByCatId = await getActiveCategoryDiscountMap();
  if (promoByCatId.size === 0) return productos;

  return productos.map((p) => {
    if (p.en_oferta) return p; // sticky offer wins
    const catId = p.categoria_id;
    if (catId == null) return p;
    const discountPct = promoByCatId.get(catId);
    if (!discountPct || discountPct <= 0) return p;
    if (p.precio <= 0) return p;
    const discounted = Math.round(p.precio * (1 - discountPct / 100));
    if (discounted >= p.precio) return p;
    return {
      ...p,
      en_oferta: true,
      precio_original: discounted,
    };
  });
}
