/**
 * La promesa comercial de la barraca, en un solo lugar.
 *
 * Antes la promesa llevaba un plazo de respuesta, escrito de varias formas
 * distintas y repartido por la barra superior, el pie, el slider, las landings
 * de ciudad, los metadatos y los correos. El dueño la cambió: sin plazo y con
 * condiciones.
 *
 * Reglas de uso:
 * - La frase completa va en pantalla con asterisco (PROMESA_CON_ASTERISCO) y
 *   con NOTA_PROMESA visible en el mismo bloque (texto chico y gris).
 * - Donde no cabe la frase (barra superior, etiqueta de botón, píldora) va
 *   PROMESA_CORTA, "Te mejoramos el precio", sin asterisco (pedido del dueño,
 *   oct-2026).
 * - Tienda en línea (oct-2026): la franja roja de arriba es FRANJA_TIENDA.
 * - En metadatos, títulos y JSON-LD (sin espacio para notas al pie) va PROMESA
 *   (o PROMESA_CORTA_META en títulos), sin asterisco.
 * - Nunca se le agrega un plazo ni una promesa de rapidez.
 */

/** La frase, sin asterisco: para metadatos, títulos y JSON-LD. */
export const PROMESA = "Tráenos tu cotización y te mejoramos el precio";

/** La frase con asterisco, para mostrar en pantalla junto a NOTA_PROMESA. */
export const PROMESA_CON_ASTERISCO = `${PROMESA}*`;

/** Forma corta para espacios chicos (barra superior, botones, píldoras). Sin plazo ni asterisco. */
export const PROMESA_CORTA = "Te mejoramos el precio";

/** Forma corta sin asterisco, para títulos de metadatos. */
export const PROMESA_CORTA_META = "Te mejoramos el precio";

/** La nota al pie de la promesa. Va visible, en texto chico y gris. */
export const NOTA_PROMESA =
  "*Sujeto a validación de cotización, disponibilidad, condiciones comerciales y precio mínimo autorizado por JURMAQ.";

/** Las condiciones como frase suelta (sin asterisco), para textos corridos y JSON-LD. */
export const CONDICIONES_PROMESA =
  "Sujeto a validación de cotización, disponibilidad, condiciones comerciales y precio mínimo autorizado por JURMAQ.";

/**
 * Franja roja fija arriba en todas las páginas. Antes decía que los precios
 * eran de lista y que el descuento se pedía; con la tienda en línea (oct-2026)
 * el precio publicado es el que se paga, así que la franja cuenta cómo
 * comprar. Mismo largo aproximado que la anterior: cabe en una línea desde
 * 320 px con el cálculo de tamaño de BarracaShell.
 */
export const FRANJA_TIENDA = "Compra en línea · Retiro en Molina o despacho a coordinar";
