/**
 * TOPE DURO (ambos modos de aprobación, no se aprueba): ningún texto editable por MCP puede traer datos bancarios ni
 * enlaces de pago. Los datos de la cuenta de la barraca y los pagos los arma solo el código de la tienda.
 *
 * No rechaza la prosa que nombra «Webpay», «transferencia» o «banco», ni lo que los Términos ya traen desde antes (su número
 * de cuenta): rechaza AGREGAR o CAMBIAR lo que sirve para cobrar o pagar de verdad:
 *  - un número de cuenta junto a las palabras que lo anuncian («cuenta corriente 12345678», «N° de cuenta: …»), o un IBAN;
 *  - un enlace (https o dominio suelto) a una pasarela de pagos o a un sitio de cobro, salvo jurmaq.cl y sus subdominios.
 * Función pura: sin Next ni D1.
 */

const CUENTA = /(?:cuenta\s+(?:corriente|vista|rut|de\s+ahorros?|bancaria)|n[°º.]?\s*de\s+cuenta|n[úu]mero\s+de\s+cuenta|\bcta\.?(?:\s*(?:cte|corriente|vista))?)[^.\n]{0,40}?\d[\d.\- ]{5,}/i;
const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/;
const DOMINIO = /(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?(?:[/?#][^\s"'<>)]*)?/gi;
const PASARELAS = /webpay|transbank|mercadopago|mercadolibre|flow\.cl|khipu|paypal|stripe|pagofacil|getnet|onepay|fintoc|kushki|payku|multicaja|servipag|webpay|(?:^|[.-])pagos?(?:[.-]|$)|(?:^|[.-])pay(?:ment)?s?(?:[.-]|$)|checkout/i;
const PROPIO = /(?:^|\.)jurmaq\.cl$/i;

/** Cada dato de pago que trae el texto, normalizado (número de cuenta solo con dígitos, enlaces por su dominio). */
export function datosDePagoEn(texto: unknown): string[] {
  const t = typeof texto === "string" ? texto : JSON.stringify(texto ?? "");
  const out = new Set<string>();
  const c = CUENTA.exec(t);
  if (c) out.add(`cuenta:${(c[0].match(/\d/g) ?? []).join("")}`);
  const g = IBAN.exec(t);
  if (g) out.add(`iban:${g[0]}`);
  for (const m of t.matchAll(DOMINIO)) {
    const host = m[1].toLowerCase();
    if (!PROPIO.test(host) && PASARELAS.test(host)) out.add(`enlace:${host}`);
  }
  return [...out];
}

export function contieneDatosDePago(texto: unknown): boolean {
  return datosDePagoEn(texto).length > 0;
}

/**
 * ¿El texto nuevo AGREGA o CAMBIA un dato de pago respecto del vigente? Lo que ya estaba (p. ej. el número de cuenta que
 * los Términos traen desde antes) se puede dejar; agregar uno nuevo o cambiar el número no.
 */
export function agregaDatosDePago(antes: unknown, despues: unknown): boolean {
  const previos = new Set(datosDePagoEn(antes));
  return datosDePagoEn(despues).some((d) => !previos.has(d));
}

export const MENSAJE_DATOS_DE_PAGO =
  "El texto trae datos bancarios o un enlace de pago, y eso no se puede publicar por aquí ni con el OK de Jorge: los pagos y la cuenta de la barraca los arma solo el código de la tienda.";
