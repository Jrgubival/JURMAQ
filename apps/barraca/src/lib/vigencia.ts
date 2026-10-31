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
  desde: '2026-10-31',
  hasta: '2026-12-01', // Jorge, 30-10-2026: prueba de un mes, inclusive
};

export const VERSION_TERMINOS: string | null = '1.2';

/** "30 de noviembre de 2026", o null si no hay fecha. */
export function fechaLarga(iso: string | null): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12)).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Santiago' });
}

export const precioWebHasta = (): string | null => fechaLarga(PRECIO_WEB.hasta);

/** "01-12" para la etiqueta corta junto al precio. */
export function precioWebHastaCorto(): string | null {
  const h = PRECIO_WEB.hasta;
  return h && /^\d{4}-\d{2}-\d{2}$/.test(h) ? `${h.slice(8, 10)}-${h.slice(5, 7)}` : null;
}

/** "01-12-2026" para las frases completas. */
export function precioWebHastaNumerico(): string | null {
  const h = PRECIO_WEB.hasta;
  return h && /^\d{4}-\d{2}-\d{2}$/.test(h) ? `${h.slice(8, 10)}-${h.slice(5, 7)}-${h.slice(0, 4)}` : null;
}
