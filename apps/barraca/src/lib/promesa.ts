/**
 * La promesa comercial de la barraca, en un solo lugar.
 *
 * Antes la promesa llevaba un plazo de respuesta, escrito de varias formas
 * distintas y repartido por la barra superior, el pie, el slider, las landings
 * de ciudad, los metadatos y los correos. El dueño la cambió: sin plazo y con
 * condiciones.
 *
 * Reglas de uso:
 * - En pantalla va SIEMPRE con asterisco (PROMESA_CON_ASTERISCO) y con
 *   NOTA_PROMESA visible en el mismo bloque (texto chico y gris).
 * - Donde no cabe la frase (barra superior, etiqueta de botón, píldora) se usa
 *   PROMESA_CORTA, y NOTA_PROMESA tiene que estar en la misma página: la del
 *   pie cuenta.
 * - En metadatos, títulos y JSON-LD (sin espacio para notas al pie) va PROMESA
 *   (o PROMESA_CORTA_META en títulos), sin asterisco.
 * - Nunca se le agrega un plazo ni una promesa de rapidez.
 */

/** La frase, sin asterisco: para metadatos, títulos y JSON-LD. */
export const PROMESA = "Tráenos tu cotización y te mejoramos el precio";

/** La frase con asterisco, para mostrar en pantalla junto a NOTA_PROMESA. */
export const PROMESA_CON_ASTERISCO = `${PROMESA}*`;

/** Forma corta para espacios chicos (barra superior, botones, píldoras). */
export const PROMESA_CORTA = "Te mejoramos el precio*";

/** Forma corta sin asterisco, para títulos de metadatos. */
export const PROMESA_CORTA_META = "Te mejoramos el precio";

/** La nota al pie de la promesa. Va visible, en texto chico y gris. */
export const NOTA_PROMESA =
  "*Sujeto a validación de cotización, disponibilidad, condiciones comerciales y precio mínimo autorizado por JURMAQ.";

/** Las condiciones como frase suelta (sin asterisco), para textos corridos y JSON-LD. */
export const CONDICIONES_PROMESA =
  "Sujeto a validación de cotización, disponibilidad, condiciones comerciales y precio mínimo autorizado por JURMAQ.";
