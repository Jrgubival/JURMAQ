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

const CUENTA = /(?:cuenta\s+(?:corriente|vista|rut|de\s+ahorros?|bancaria)|n[°º.]?\s*de\s+cuenta|n[úu]mero\s+de\s+cuenta|\bcta\.?(?:\s*(?:cte|corriente|vista))?)[^.\n]{0,40}?\d[\d.\- ]{5,}/gi;
const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g;
const RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}\s?-\s?[\dkK]\b/g;
const CONTEXTO_BANCARIO = /banco|cuenta|\bcta\b|transfier|transferir|dep[óo]sit|abon[ae]|giro|vista|corriente|ahorro|bancari|pagar\s+a|pago\s+a|destinatari/i;
/**
 * Una corrida de 10 o más dígitos con separadores variados entre ellos (hasta 3 caracteres de espacio, sin saltos de línea: un número al final de una línea no se une al de la siguiente; punto, guion, raya o
 * barra): «1234 5678 9012», «1234 - 5678 - 9012», «1234  5678», «1.234.567.890», «12-34-56…».
 */
const CORRIDA = /\d(?:[ \t\u00a0.\-‐-―−_/]{0,3}\d){9,}/g;
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

/** Palabras que NO nombran un banco aunque vayan después de «banco» («el banco o emisor», «el banco que…»). */
const NO_ES_BANCO = new Set([
  "o", "a", "y", "e", "u", "de", "del", "la", "el", "al", "en", "es", "se", "su", "tu", "no", "si", "un", "ya", "ha", "lo", "le", "me", "mi", "te",
  "que", "para", "con", "por", "desde", "donde", "cuando", "sin", "como", "segun", "esta", "este", "esos", "esas", "emisor", "emisores", "central",
  "cliente", "tuyo", "correspondiente", "respectivo", "elegido", "indicado", "mismo", "misma", "tarjeta", "titular", "pagador", "comprador", "destino",
  "origen", "cuenta", "informado", "sera", "seria", "tambien", "cobra", "cobre", "abona", "abone", "devuelve", "aprueba", "rechaza", "autoriza",
  "antes", "luego", "elige", "eliges", "emitio", "emitió", "depende", "rechace", "acepte", "acepta", "que", "pueda", "puede", "tenga", "tiene", "dice",
]);
const BANCO_GENERICO = /banco\s*(?:del?\s+)?([a-záéíóúñ0-9]{2,})/gi;
const BANCO_ALIAS = /\b(santander|scotiabank|itau|itaú|bci|tenpo|coopeuch|tapp|mach|mercado\s*pago|cuenta\s*rut)\b/gi;
const TITULAR_ETIQUETA = /\btitular\s*:\s*([^\n]{2,90})/gi;
const A_NOMBRE_DE = /\ba\s+nombre\s+de\s+([^\n]{2,90})/gi;
const CORREO = /[a-z0-9._%+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi;
const CONTEXTO_CORREO = /pag|transfer|comprobante|cuenta|banco|cobr|dep[óo]sit|abon|factura|boleta|titular/i;

const sinTildes = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "");
/** «bancoestado», «del estado», «Estado» → «estado»; «Banco de Chile» → «chile». */
function canonBanco(palabra: string): string {
  return sinTildes(palabra.toLowerCase()).replace(/^banco/, "").replace(/[^a-z0-9]/g, "");
}
/** Nombre de titular (de «Titular: …» o «a nombre de …»): solo si empieza con mayúscula; corta en coma, paréntesis o «RUT». */
function canonTitular(valor: string): string | null {
  if (!/^[A-ZÁÉÍÓÚÑ0-9]/.test(valor)) return null;
  const corte = valor.split(/[,;(]|\s+r\.?u\.?t\b|\.\s/i)[0];
  const c = sinTildes(corte).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length >= 3 ? c : null;
}

/** Lo que `datosDePagoEn` no mira porque en prosa común es normal: banco, titular y correos ajenos de pago. Solo para comparar antes/después. */
function ampliadoEnTexto(t: string, out: string[]): void {
  let resto = t.replace(/\bbanco\s*:\s*/gi, "banco ");
  resto = resto.replace(BANCO_GENERICO, (todo, palabra: string) => {
    const c = canonBanco(palabra);
    if (c.length >= 2 && !NO_ES_BANCO.has(sinTildes(palabra.toLowerCase())) && !NO_ES_BANCO.has(c)) out.push(`banco:${c}`);
    return " ".repeat(todo.length);
  });
  for (const m of resto.matchAll(BANCO_ALIAS)) out.push(`banco:${canonBanco(m[1])}`);
  for (const re of [TITULAR_ETIQUETA, A_NOMBRE_DE]) {
    for (const m of t.matchAll(re)) {
      const c = canonTitular(m[1]);
      if (c) out.push(`titular:${c}`);
    }
  }
  for (const m of t.matchAll(CORREO)) {
    if (PROPIO.test(m[1])) continue;
    const i = m.index ?? 0;
    if (CONTEXTO_CORREO.test(t.slice(Math.max(0, i - 100), i + m[0].length + 100))) out.push(`correo:${m[0].toLowerCase()}`);
  }
}

function enTexto(t: string, out: string[]): void {
  // TODAS las coincidencias, no solo la primera: una segunda cuenta más abajo en el texto también cuenta.
  for (const c of t.matchAll(CUENTA)) out.push(`cuenta:${(c[0].match(/\d/g) ?? []).join("")}`);
  for (const g of t.matchAll(IBAN)) out.push(`iban:${g[0]}`);
  // Un RUT suelto es dato público normal del local (sale en los Términos): solo cuenta si va junto a palabras de banco o pago.
  for (const m of t.matchAll(RUT)) {
    const i = m.index ?? 0;
    const alrededor = t.slice(Math.max(0, i - 80), i + m[0].length + 80);
    if (CONTEXTO_BANCARIO.test(alrededor)) out.push(`rut:${m[0].replace(/[^0-9kK]/g, "").toUpperCase()}`);
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
    if (CONTEXTO_CUENTA.test(alrededor) || (digitos.length >= 13 && digitos.length <= 19 && luhn(digitos))) out.push(`numero:${digitos}`);
  }
  for (const m of t.matchAll(DOMINIO)) {
    const explicito = /^https?:\/\//i.test(m[0]) || /^www\./i.test(m[1]);
    const host = m[1].toLowerCase().replace(/^www\./, "");
    if (!explicito && !SUFIJOS.has(host.slice(host.lastIndexOf(".") + 1))) continue;
    const resto = (m[2] ?? "").toLowerCase();
    if (PROPIO.test(host)) continue;
    if (ACORTADORES.has(host)) { out.push(`enlace:${host}`); continue; }
    if (WHATSAPP.has(host)) {
      const num = /(?:^\/|phone=|\/)(\d{7,15})/.exec(resto)?.[1];
      out.push(`whatsapp:${host}${num ? `/${num}` : resto.split(/[?#]/)[0]}`);
      continue;
    }
    if (PASARELAS.test(host) || RUTA_DE_PAGO.test(resto)) out.push(`enlace:${host}`);
  }
}

function recoger(texto: unknown, ampliado: boolean): Map<string, number> {
  const crudo = typeof texto === "string" ? texto : JSON.stringify(texto ?? "");
  // Un texto que llega ya como JSON trae los saltos de línea y las comillas escapados: se deshace para mirar el texto real.
  const t = normalizar(crudo).replace(/\\[nrt]/g, "\n").replace(/\\"/g, '"');
  const d = decodificado(t);
  const cuenta = (x: string) => {
    const lista: string[] = [];
    enTexto(x, lista);
    if (ampliado) ampliadoEnTexto(x, lista);
    const m = new Map<string, number>();
    for (const k of lista) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const m = cuenta(t);
  // La versión con %XX decodificado se suma por MÁXIMO (no por suma): un «%20» suelto no debe duplicar lo que ya estaba.
  if (d !== t) for (const [k, n] of cuenta(d)) m.set(k, Math.max(m.get(k) ?? 0, n));
  return m;
}

/** Cada dato de pago que trae el texto, normalizado (cuenta o número solo con dígitos, enlaces por su dominio). */
export function datosDePagoEn(texto: unknown): string[] {
  return [...recoger(texto, false).keys()];
}

export function contieneDatosDePago(texto: unknown): boolean {
  return datosDePagoEn(texto).length > 0;
}

/**
 * ¿El texto nuevo AGREGA o CAMBIA un dato de pago respecto del vigente? Se comparan TODAS las coincidencias de ambos textos como
 * multiconjuntos: cuentas, IBAN, RUT, números largos, enlaces, banco, titular y correos ajenos junto a palabras de pago. Lo que ya
 * estaba y sigue igual (p. ej. los datos de la cuenta que los Términos traen desde antes) se puede dejar; un dato de más (aunque
 * sea repetido), uno distinto o uno que reemplaza a otro se rechaza. Quitar uno es libre.
 */
export function agregaDatosDePago(antes: unknown, despues: unknown): boolean {
  const previos = recoger(antes, true);
  for (const [k, n] of recoger(despues, true)) if (n > (previos.get(k) ?? 0)) return true;
  return false;
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
