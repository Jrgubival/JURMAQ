import 'server-only';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { getActiveCategoryDiscountMap } from '@/lib/promotions';
import { resolvePrice } from '@/lib/pricing';
import { motivoNoComprable, unidadesDisponibles } from '@/lib/stock';

/**
 * Precio y stock VIGENTES de una lista de productos, leídos de la base.
 *
 * Es la única fuente de los montos que se cobran: el carrito del navegador
 * sólo guarda una foto para dibujarse rápido. El precio sale de la misma regla
 * que muestran las fichas (resolvePrice: oferta real > promoción de categoría >
 * precio normal), así que lo que el cliente ve es lo que paga.
 */

export interface LineaPedido {
  productoId: number;
  cantidad: number;
}

export interface LineaRevisada {
  productoId: number;
  codigo: string | null;
  cantidad: number;
  nombre: string;
  precio: number;
  imagen: string | null;
  slug: string | null;
  medida: string | null;
  unidad: string | null;
  categoriaId: number | null;
  /** Kilos por unidad; null si no está cargado en la base. */
  peso: number | null;
  stock: number;
  problema: string | null;
}

export const MAX_LINEAS = 60;

export async function revisarLineas(lineas: LineaPedido[]): Promise<LineaRevisada[]> {
  // Una línea por producto (si llegan repetidas se suman).
  const porId = new Map<number, number>();
  for (const l of lineas.slice(0, MAX_LINEAS)) {
    porId.set(l.productoId, (porId.get(l.productoId) ?? 0) + l.cantidad);
  }
  const ids = [...porId.keys()];
  if (ids.length === 0) return [];

  const [{ data, error }, promoMap] = await Promise.all([
    supabaseAdmin
      .from('barraca_productos')
      .select('id, codigo, nombre, slug, precio, precio_original, en_oferta, solo_cotizar, stock, unidad, imagen, medida, categoria_id, peso, activo')
      .in('id', ids),
    getActiveCategoryDiscountMap(),
  ]);
  if (error) throw error;

  const productos = new Map((data || []).map((p) => [p.id, p]));
  const out: LineaRevisada[] = [];
  for (const id of ids) {
    const p = productos.get(id);
    if (!p) continue; // borrado de la base: se cae del carrito
    const promo = p.categoria_id != null ? promoMap.get(p.categoria_id) ?? null : null;
    const precio = resolvePrice(
      {
        precio: p.precio,
        precio_original: p.precio_original,
        en_oferta: p.en_oferta ?? undefined,
        solo_cotizar: p.solo_cotizar ?? undefined,
      },
      promo,
    ).precioFinal;
    const stock = unidadesDisponibles(p.stock);
    const problema = motivoNoComprable({ precio, stock, solo_cotizar: p.solo_cotizar, activo: p.activo });
    const pedida = porId.get(id) ?? 1;
    out.push({
      productoId: id,
      codigo: p.codigo,
      // Nunca más de lo que hay. Sin stock la línea queda con lo pedido y el
      // problema marcado, para que el cliente vea por qué no puede pagar.
      cantidad: stock > 0 ? Math.min(pedida, stock) : pedida,
      nombre: p.nombre,
      precio: Math.round(precio),
      imagen: p.imagen,
      slug: p.slug,
      medida: p.medida,
      unidad: p.unidad,
      categoriaId: p.categoria_id,
      peso: Number.isFinite(p.peso) && (p.peso as number) > 0 ? (p.peso as number) : null,
      stock,
      problema,
    });
  }
  return out;
}
