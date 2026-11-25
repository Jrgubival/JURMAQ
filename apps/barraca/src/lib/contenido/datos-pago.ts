/**
 * TOPE DURO (ambos modos de aprobación, no se aprueba): ningún texto editable por MCP puede traer datos bancarios ni
 * enlaces de pago. Los datos de la cuenta de la barraca y los pagos los arma solo el código de la tienda.
 *
 * No rechaza la prosa que nombra «Webpay», «transferencia» o «banco», ni lo que los Términos ya traen desde antes (su número
 * de cuenta): rechaza AGREGAR o CAMBIAR lo que sirve para cobrar o pagar de verdad:
 *  - un número de cuenta junto a las palabras que lo anuncian («cuenta corriente 12345678», «N° de cuenta: …»), un IBAN,
 *    un RUT con dígito verificador junto a palabras de banco o pago (el RUT suelto del local es dato normal), o un NÚMERO LARGO
 *    (10 dígitos o más, con separadores variados: «1234 - 5678 - 9012») que tenga cerca palabras de cuenta, banco, transferencia, RUT
 *    o titular, o que sea una tarjeta (13 a 19 dígitos que pasan Luhn); un código de fabricante o un SKU de 10 dígitos SIN ese contexto pasa;
 *    se dejan pasar los teléfonos chilenos (+56 9 1234 5678, 9 dígitos) y los códigos de barras (EAN) que se anuncian como tales;
 *  - un enlace (https o dominio suelto) a una pasarela de pagos o a un sitio de cobro (también por la ruta: /pagar, /pay,
 *    /checkout…), salvo jurmaq.cl y sus subdominios;
 *  - un enlace acortado (bit.ly, tinyurl, t.co…): esconde el destino, así que no se puede saber a dónde lleva;
 *  - un enlace de WhatsApp (wa.me, api.whatsapp.com) hacia un número: solo vale si ese mismo enlace ya estaba antes.
 * El texto se normaliza antes de mirarlo (Unicode NFKC: dígitos y letras de ancho completo valen como los normales; se
 * quitan los caracteres invisibles) y se mira también su versión con %XX decodificado.
 * Función pura: sin Next ni D1.
 */

const CUENTA = /(?:cuenta\s+(?:corriente|vista|rut|de\s+ahorros?|bancaria)|n[°º.]?\s*de\s+cuenta|n[úu]mero\s+de\s+cuenta|\bcta\.?(?:\s*(?:cte|corriente|vista))?)[^.\n]{0,40}?\d[\d.\- ]{5,}/i;
const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/;
const RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}\s?-\s?[\dkK]\b/g;
const CONTEXTO_BANCARIO = /banco|cuenta|\bcta\b|transfier|transferir|dep[óo]sit|abon[ae]|giro|vista|corriente|ahorro|bancari|pagar\s+a|pago\s+a|destinatari/i;
/**
 * Una corrida de 10 o más dígitos con separadores variados entre ellos (hasta 3 caracteres de espacio, punto, guion, raya o
 * barra): «1234 5678 9012», «1234 - 5678 - 9012», «1234  5678», «1.234.567.890», «12-34-56…».
 */
const CORRIDA = /\d(?:[\s.\-‐-―−_/]{0,3}\d){9,}/g;
/**
 * Contexto que anuncia una cuenta o un pago, alrededor de un número largo. Un número largo SIN este contexto (código de
 * fabricante, lote, SKU) no se bloquea; una tarjeta (13 a 19 dígitos que pasan Luhn) sí, con o sin contexto.
 */
const CONTEXTO_CUENTA = /banco|\bcuentas?\b|\bcta\b|transfier|transferir|transferencia|dep[óo]sit|abon[ae]|\brut\b|titular|bancari|destinatari|pagar\s+a|pago\s+a|tarjeta|\bcvv\b/i;
const ANUNCIA_BARRAS = /(?:\bean\b|\bgtin\b|\bupc\b|\bsku\b|c[óo]d(?:igo|\.)?\s+(?:de\s+)?barras?|barcode)[^.\n]{0,25}$/i;
const DOMINIO = /(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?([/?#][^\s"'<>)]*)?/gi;
/**
 * Un «dominio» sin https:// ni www solo cuenta si termina en un sufijo de internet real: «contado.Pago» o «kilo.Pagos» son
 * dos palabras pegadas por un punto sin espacio, no un enlace. Con https:// o www. se mira siempre.
 */
const SUFIJOS = new Set([
  "cl", "com", "net", "org", "io", "co", "app", "me", "ly", "link", "info", "biz", "store", "shop", "online", "site", "xyz", "dev", "page",
  "ar", "pe", "es", "us", "uk", "de", "br", "mx", "cc", "tv", "to", "gl", "ee", "ai", "fm", "gg", "pro", "tech", "top", "club", "live", "cloud",
  "edu", "gov", "eu", "fr", "it", "ec", "bo", "py", "uy", "ve", "pa", "cr", "gt", "do", "pt", "nl", "ca", "au", "jp", "cn", "in", "ru", "ws", "su",
]);
const PASARELAS = /webpay|transbank|mercadopago|mercadolibre|flow\.cl|khipu|paypal|stripe|pagofacil|getnet|onepay|fintoc|kushki|payku|multicaja|servipag|(?:^|[.-])pagos?(?:[.-]|$)|(?:^|[.-])pay(?:ment)?s?(?:[.-]|$)|checkout/i;
/** Rutas y parámetros que anuncian un cobro, en cualquier sitio ajeno. */
const RUTA_DE_PAGO = /(?:^|[/?#&=_.-])(?:pag(?:o|os|ar|a)|pay|payment|payments|checkout|cobro|cobrar|cobranza|transferir|donat(?:e|ion)|invoice)(?:[/?#&=_.-]|$)/i;
const PROPIO = /(?:^|\.)jurmaq\.cl$/i;
const ACORTADORES = new Set([
  "bit.ly", "bitly.com", "tinyurl.com", "t.co", "goo.gl", "is.gd", "v.gd", "ow.ly", "cutt.ly", "cutt.us", "rb.gy", "rebrand.ly", "short.io",
  "shorturl.at", "tiny.cc", "buff.ly", "lnkd.in", "bl.ink", "s.id", "t.ly", "x.co", "adf.ly", "bc.vc", "qr.ae", "u.to", "clck.ru", "shrtco.de",
  "wa.link", "lin.ee", "fb.me", "ig.me", "t.me", "tr.ee", "ur.ly", "l.ead.me", "1url.com", "link.tree", "linktr.ee", "beacons.ai",
]);
const WHATSAPP = new Set(["wa.me", "api.whatsapp.com", "web.whatsapp.com", "chat.whatsapp.com", "whatsapp.com"]);

/** NFKC (ancho completo → normal), sin caracteres invisibles ni de control de dirección, con los puntos «raros» como punto. */
function normalizar(t: string): string {
  return t
    .normalize("NFKC")
    .replace(/[​-‏⁠⁡⁢⁣⁤﻿­͏؜᠎‪-‮⁦-⁩]/g, "")
    .replace(/[。｡․﹒]/g, ".");
}

function decodificado(t: string): string {
  try { return decodeURIComponent(t.replace(/%(?![0-9a-f]{2})/gi, "%25")); } catch { return t; }
}

function luhn(d: string): boolean {
  let suma = 0;
  for (let i = 0; i < d.length; i++) {
    let n = d.charCodeAt(d.length - 1 - i) - 48;
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    suma += n;
  }
  return suma % 10 === 0;
}

const esTelefono = (d: string) => /^(?:56)?[2-9]\d{8}$/.test(d);
const FECHA_AMD = /\b(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])\b/g;
const FECHA_DMA = /\b(?:0?[1-9]|[12]\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.](?:19|20)?\d{2}\b/g;
const HORA = /\b\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\b/g;

function enTexto(t: string, out: Set<string>): void {
  const c = CUENTA.exec(t);
  if (c) out.add(`cuenta:${(c[0].match(/\d/g) ?? []).join("")}`);
  const g = IBAN.exec(t);
  if (g) out.add(`iban:${g[0]}`);
  // Un RUT suelto es dato público normal del local (sale en los Términos): solo cuenta si va junto a palabras de banco o pago.
  for (const m of t.matchAll(RUT)) {
    const i = m.index ?? 0;
    const alrededor = t.slice(Math.max(0, i - 80), i + m[0].length + 80);
    if (CONTEXTO_BANCARIO.test(alrededor)) out.add(`rut:${m[0].replace(/[^0-9kK]/g, "").toUpperCase()}`);
  }
  // Las fechas y horas («25-11-2026 15:00») no son números largos: se quitan antes de buscar.
  const sinFechas = t.replace(FECHA_AMD, " ").replace(FECHA_DMA, " ").replace(HORA, " ");
  for (const m of sinFechas.matchAll(CORRIDA)) {
    const digitos = m[0].replace(/\D/g, "");
    if (esTelefono(digitos)) continue;
    const i = m.index ?? 0;
    const antes = sinFechas.slice(Math.max(0, i - 40), i);
    if (ANUNCIA_BARRAS.test(antes)) continue;
    const alrededor = sinFechas.slice(Math.max(0, i - 60), i + m[0].length + 60);
    if (CONTEXTO_CUENTA.test(alrededor) || (digitos.length >= 13 && digitos.length <= 19 && luhn(digitos))) out.add(`numero:${digitos}`);
  }
  for (const m of t.matchAll(DOMINIO)) {
    const explicito = /^https?:\/\//i.test(m[0]) || /^www\./i.test(m[1]);
    const host = m[1].toLowerCase().replace(/^www\./, "");
    if (!explicito && !SUFIJOS.has(host.slice(host.lastIndexOf(".") + 1))) continue;
    const resto = (m[2] ?? "").toLowerCase();
    if (PROPIO.test(host)) continue;
    if (ACORTADORES.has(host)) { out.add(`enlace:${host}`); continue; }
    if (WHATSAPP.has(host)) {
      const num = /(?:^\/|phone=|\/)(\d{7,15})/.exec(resto)?.[1];
      out.add(`whatsapp:${host}${num ? `/${num}` : resto.split(/[?#]/)[0]}`);
      continue;
    }
    if (PASARELAS.test(host) || RUTA_DE_PAGO.test(resto)) out.add(`enlace:${host}`);
  }
}

/** Cada dato de pago que trae el texto, normalizado (cuenta o número solo con dígitos, enlaces por su dominio). */
export function datosDePagoEn(texto: unknown): string[] {
  const crudo = typeof texto === "string" ? texto : JSON.stringify(texto ?? "");
  const t = normalizar(crudo);
  const out = new Set<string>();
  enTexto(t, out);
  const d = decodificado(t);
  if (d !== t) enTexto(d, out);
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

/**
 * Para nombres, descripciones y otros textos libres que se publican (productos, categorías, cupones…): no tienen texto
 * «anterior» que se pueda dejar, así que cualquier dato de pago los rechaza. Devuelve el mensaje, o null si está limpio.
 * (Si se EDITA un texto que ya traía uno, igual se rechaza el guardado: hay que quitarlo.)
 */
export function errorDatosDePagoEnTextos(...textos: unknown[]): string | null {
  for (const t of textos) if (typeof t === "string" && t && contieneDatosDePago(t)) return MENSAJE_DATOS_DE_PAGO;
  return null;
}
