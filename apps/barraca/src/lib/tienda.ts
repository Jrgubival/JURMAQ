import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { getActiveCategoryDiscountMap } from '@/lib/promotions';
import { resolvePrice } from '@/lib/pricing';
import { motivoNoComprable, unidadesDisponibles } from '@/lib/stock';
import { logSafeError } from '@jurmaq/shared/logging';
import type { TamanoEnvio } from '@/lib/despacho/tarifas';

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
  /** Tamaño y medidas para el courier (null = sin datos: sólo retiro o camión). */
  envio: MedidasEnvio | null;
  stock: number;
  problema: string | null;
}

export interface MedidasEnvio {
  tamano: TamanoEnvio | null;
  largoCm: number | null;
  anchoCm: number | null;
  altoCm: number | null;
}

export const MAX_LINEAS = 60;

const TAMANOS = new Set(['chico', 'mediano', 'grande']);
const medida = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/**
 * Tamaño de envío y medidas de cada producto. Va en una consulta aparte y
 * tolera que las columnas aún no existan (migración sin aplicar): en ese caso
 * ningún producto tiene datos y nada sale por courier (fail-closed).
 */
async function medidasEnvio(ids: number[]): Promise<Map<number, MedidasEnvio>> {
  const db = supabaseAdmin as unknown as SupabaseClient; // columnas aún fuera de db-types
  try {
    const { data, error } = await db
      .from('barraca_productos')
      .select('id, tamano_envio, largo_cm, ancho_cm, alto_cm')
      .in('id', ids);
    if (error) throw error;
    return new Map(
      ((data ?? []) as Array<Record<string, unknown>>).map((r) => [
        r.id as number,
        {
          tamano: TAMANOS.has(r.tamano_envio as string) ? (r.tamano_envio as TamanoEnvio) : null,
          largoCm: medida(r.largo_cm),
          anchoCm: medida(r.ancho_cm),
          altoCm: medida(r.alto_cm),
        },
      ]),
    );
  } catch (error) {
    logSafeError('tienda-medidas-envio-error', { error: String(error) });
    return new Map();
  }
}

export async function revisarLineas(lineas: LineaPedido[]): Promise<LineaRevisada[]> {
  // Una línea por producto (si llegan repetidas se suman).
  const porId = new Map<number, number>();
  for (const l of lineas.slice(0, MAX_LINEAS)) {
    porId.set(l.productoId, (porId.get(l.productoId) ?? 0) + l.cantidad);
  }
  const ids = [...porId.keys()];
  if (ids.length === 0) return [];

  const [{ data, error }, promoMap, medidas] = await Promise.all([
    supabaseAdmin
      .from('barraca_productos')
      .select('id, codigo, nombre, slug, precio, precio_original, en_oferta, solo_cotizar, stock, unidad, imagen, medida, categoria_id, peso, activo')
      .in('id', ids),
    getActiveCategoryDiscountMap(),
    medidasEnvio(ids),
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
      envio: medidas.get(id) ?? null,
      stock,
      problema,
    });
  }
  return out;
}
