/**
 * Detección de «desvío» en textos libres de la tienda: teléfonos, correos o enlaces a
 * otros sitios que un cambio AGREGA y que mandarían al cliente a hablar o pagar fuera
 * de la tienda. Pura (sin Next ni Supabase): se prueba directo con node --test.
 *
 * Regla: un cambio de texto necesita la aprobación de Jorge si agrega algo de esto que
 * no estaba ya en el contenido vigente:
 *  - una secuencia de dígitos que parezca teléfono (7 o más dígitos, con o sin separadores);
 *  - un correo;
 *  - un enlace (https, o un dominio suelto como «wa.me/…») hacia un sitio que no sea
 *    jurmaq.cl ni uno de los dominios que el contenido vigente ya traía.
 * Se revisan todos los textos del contenido, menos los campos de imagen (esos ya solo
 * admiten nuestros propios archivos).
 */

const DOMINIO_PROPIO = "jurmaq.cl";
/** Campos que solo guardan imágenes nuestras (validadas aparte). */
const CAMPOS_IGNORADOS = new Set(["imagen", "imagenDesktop", "imagenMovil", "id", "desde", "hasta"]);
const MAX_HOJAS = 5000;
const MAX_LARGO_TEXTO = 400_000;

const TLD_SUELTOS = [
  "cl", "com", "net", "org", "io", "me", "ly", "co", "app", "dev", "link", "shop", "store", "xyz", "info", "biz", "site",
  "online", "top", "tk", "ws", "gl", "to", "cc", "us", "ar", "pe", "es", "mx", "br", "ru", "cn", "click", "page", "live",
  "tv", "gg", "sh", "vip", "club", "pro", "icu", "cfd", "sbs", "lat", "eu", "uk", "de", "fr", "it", "in", "id", "ve", "bo", "uy",
];

const RE_CORREO = /[a-z0-9._%+'-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const RE_URL = /\bhttps?:\/\/[^\s<>"'`)\]]+/gi;
const RE_DOMINIO_SUELTO = new RegExp(`(?<![@\\w.-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${TLD_SUELTOS.join("|")}))(?![\\w-])(?:[/:?#][^\\s<>"'\`)\\]]*)?`, "gi");
// Dígitos con separadores típicos de un teléfono (espacio, punto, guion, paréntesis).
const RE_TELEFONO = /\+?\d[\d\s(). ‐-―·-]{5,}\d/g;
// Fechas y horas (2026-12-01T09:00, 25-11-2026, 09:00): no son teléfonos.
const RE_FECHAS_Y_HORAS = /\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}:\d{2}(?::\d{2})?/g;

export interface HuellaDeEnlaces {
  telefonos: Set<string>;
  correos: Set<string>;
  hosts: Set<string>;
}

/** Todos los textos del valor (cada hoja de texto con el nombre de su campo). */
function textosDe(valor: unknown): string[] {
  const out: string[] = [];
  const rec = (v: unknown, clave: string, prof: number) => {
    if (out.length >= MAX_HOJAS || prof > 8) return;
    if (typeof v === "string") {
      if (!CAMPOS_IGNORADOS.has(clave)) out.push(v.length > MAX_LARGO_TEXTO ? v.slice(0, MAX_LARGO_TEXTO) : v);
    } else if (Array.isArray(v)) {
      for (const x of v) rec(x, clave, prof + 1);
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) rec(x, k, prof + 1);
    }
  };
  rec(valor, "", 0);
  return out;
}

/** Quita caracteres invisibles y unifica variantes (dígitos de ancho completo, etc.). */
function normalizar(s: string): string {
  return s.normalize("NFKC").replace(/[­​-‏⁠﻿]/g, "");
}

function hostDe(crudo: string): string | null {
  const sinPuntuacion = crudo.replace(/[.,;:!?]+$/, "");
  const conEsquema = /^https?:\/\//i.test(sinPuntuacion) ? sinPuntuacion : `https://${sinPuntuacion}`;
  try {
    const h = new URL(conEsquema).hostname.toLowerCase().replace(/\.$/, "");
    return h || null;
  } catch {
    // URL inválida: se toma lo que haya entre el esquema y el primer «/», sin datos de usuario.
    const m = /^(?:https?:\/\/)?([^/?#\s]+)/i.exec(sinPuntuacion);
    return m ? m[1].split("@").pop()!.split(":")[0].toLowerCase() : null;
  }
}

export function extraerEnlaces(valor: unknown): HuellaDeEnlaces {
  const telefonos = new Set<string>();
  const correos = new Set<string>();
  const hosts = new Set<string>();
  for (const bruto of textosDe(valor)) {
    const t = normalizar(bruto);
    for (const m of t.matchAll(RE_CORREO)) correos.add(m[0].toLowerCase());
    // Los correos no cuentan como dominio suelto: se quitan antes de buscar enlaces.
    const sinCorreos = t.replace(RE_CORREO, " ");
    for (const m of sinCorreos.matchAll(RE_URL)) {
      const h = hostDe(m[0]);
      if (h) hosts.add(h);
    }
    const sinUrls = sinCorreos.replace(RE_URL, " ");
    for (const m of sinUrls.matchAll(RE_DOMINIO_SUELTO)) {
      const h = hostDe(m[0]);
      if (h) hosts.add(h);
    }
    const sinFechas = t.replace(RE_FECHAS_Y_HORAS, " ");
    for (const m of sinFechas.matchAll(RE_TELEFONO)) {
      const pegado = m[0];
      const antes = sinFechas.slice(Math.max(0, (m.index ?? 0) - 1), m.index ?? 0);
      if (antes === "$") continue; // precios
      const digitos = pegado.replace(/\D/g, "");
      // Con o sin el +56 es el mismo número: se compara por los últimos 9 dígitos.
      if (digitos.length >= 7) telefonos.add(digitos.length > 9 ? digitos.slice(-9) : digitos);
    }
  }
  return { telefonos, correos, hosts };
}

const esPropio = (h: string) => h === DOMINIO_PROPIO || h.endsWith(`.${DOMINIO_PROPIO}`);

/** ¿Es el mismo dominio, con o sin «www.»? */
const sinWww = (h: string) => h.replace(/^www\./, "");

export interface DesvioDetectado {
  telefonos: string[];
  correos: string[];
  hosts: string[];
}

/** Qué agrega `nuevo` (frente a `actual`) que pueda desviar al cliente. Vacío = nada. */
export function desvioAgregado(actual: unknown, nuevo: unknown): DesvioDetectado {
  const antes = extraerEnlaces(actual);
  const ahora = extraerEnlaces(nuevo);
  const hostsAntes = new Set([...antes.hosts].map(sinWww));
  return {
    telefonos: [...ahora.telefonos].filter((t) => !antes.telefonos.has(t)),
    correos: [...ahora.correos].filter((c) => !antes.correos.has(c)),
    hosts: [...ahora.hosts].filter((h) => !esPropio(h) && !hostsAntes.has(sinWww(h))),
  };
}

export function agregaDesvio(actual: unknown, nuevo: unknown): boolean {
  const d = desvioAgregado(actual, nuevo);
  return d.telefonos.length > 0 || d.correos.length > 0 || d.hosts.length > 0;
}
