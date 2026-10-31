/**
 * Páginas con un enlace personal en la URL (token del pedido o de la
 * opinión): no se miden con Google Analytics ni el píxel de Meta, para que
 * la URL con el token no salga del sitio.
 */
export function esRutaPrivada(pathname: string | null | undefined): boolean {
  return !!pathname && /^\/(opinar|pedido|pago)(\/|$)/.test(pathname);
}
