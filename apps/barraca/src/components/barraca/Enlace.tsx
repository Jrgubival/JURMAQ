import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * <Link> de Next sin prefetch por defecto.
 *
 * Cada <Link> visible precarga su destino con un request propio. En una
 * página de la barraca hay 40-60 (tarjetas, menú de categorías, fila de
 * categorías, 12 comunas en el pie), así que cada visita —y cada bot que
 * ejecuta JavaScript— generaba decenas de requests extra contra Vercel. En
 * los logs de oct-2026 las 12 páginas /en/[ciudad], enlazadas desde el pie
 * de todas las páginas, eran la ruta más pedida del sitio.
 *
 * Las páginas de destino salen de la CDN, así que sin prefetch la navegación
 * sigue siendo rápida. Si un enlace puntual lo justifica, se pasa
 * prefetch={true} explícito.
 */
export default function Enlace({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
