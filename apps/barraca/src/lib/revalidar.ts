import 'server-only';
import { revalidatePath } from 'next/cache';

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
