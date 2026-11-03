import 'server-only';
import { revalidatePath } from 'next/cache';
import { supabasePublic } from '@jurmaq/shared/supabase';
import { logSafeError } from '@jurmaq/shared/logging';

/**
 * Las fichas (24 h) y las categorías (1 h) salen de caché. Cualquier ruta que
 * cambie precios, stock, ofertas, imágenes o productos debe invalidarlas, o el
 * cambio tarda hasta un día en verse. Invalidar marca las páginas como viejas;
 * cada una se regenera recién cuando alguien la vuelve a pedir.
 */
export function revalidarCatalogo(): void {
  revalidatePath('/producto/[slug]', 'page');
  revalidatePath('/categorias/[slug]', 'page');
  revalidatePath('/categorias');
  revalidatePath('/');
  revalidatePath('/feeds/google-merchant.xml');
}

/**
 * Sólo las fichas de esos productos, más los listados que muestran su stock.
 * Para cambios de uno o pocos productos (stock de una venta, ajuste de stock
 * en el admin): `revalidarCatalogo` marca viejas las ~2.000 fichas y los bots
 * las vuelven a generar todas, que fue lo que agotó la CPU del plan Hobby de
 * Vercel en nov-2026. Nunca lanza: un fallo acá no puede romper una venta.
 */
export async function revalidarFichas(productoIds: number[]): Promise<void> {
  const ids = [...new Set(productoIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return;
  try {
    const { data, error } = await supabasePublic.from('barraca_productos').select('slug').in('id', ids);
    if (error) throw error;
    for (const { slug } of (data ?? []) as { slug: string | null }[]) {
      if (slug) revalidatePath(`/producto/${slug}`);
    }
    revalidatePath('/categorias/[slug]', 'page');
    revalidatePath('/');
    revalidatePath('/feeds/google-merchant.xml');
  } catch (error) {
    logSafeError('revalidar-fichas-error', { error: String(error) });
  }
}

/** Las fichas de los productos de un pedido (su stock cambió). */
export function revalidarFichasDePedido(items: { productoId: number }[] | null | undefined): Promise<void> {
  return revalidarFichas((items ?? []).map((i) => i.productoId));
}

/** Envuelve un route handler: si responde 2xx, invalida el catálogo. */
export function conRevalidacion<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    const res = await handler(...args);
    if (res.ok) revalidarCatalogo();
    return res;
  };
}
