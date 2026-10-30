/**
 * Fechas legales de la tienda, en un solo lugar.
 *
 * PRECIO_WEB: los precios web son una prueba con fecha (Términos 5.3). La ley
 * (art. 35, Ley 19.496) pide informar la duración donde se ve el precio: la
 * ficha, el checkout y el pie la muestran. Formato 'AAAA-MM-DD'. Con `hasta`
 * en null no se muestra nada: hay que llenarla ANTES de publicar.
 *
 * VERSION_TERMINOS: la versión de los Términos que se guarda en cada pedido,
 * para poder acreditar qué aceptó el comprador (art. 12 A). Debe calzar con
 * la "Versión" escrita en src/content/legal/terminos.md.
 */
export const PRECIO_WEB: { desde: string | null; hasta: string | null } = {
  desde: null, // TODO(Jorge): fecha de publicación
  hasta: null, // TODO(Jorge): fecha de término de la prueba
};

export const VERSION_TERMINOS: string | null = null; // TODO(Jorge): ej. '2026-11'

/** "30 de noviembre de 2026", o null si no hay fecha. */
export function fechaLarga(iso: string | null): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12)).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Santiago' });
}

export const precioWebHasta = (): string | null => fechaLarga(PRECIO_WEB.hasta);
