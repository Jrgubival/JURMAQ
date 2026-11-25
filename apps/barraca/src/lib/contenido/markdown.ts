/**
 * Saneamiento de texto editable. Funciones PURAS, sin dependencias.
 *
 * Política (la usa todo lo que se guarda en D1 y también el render, por si
 * algo llegara sin sanear):
 *   - Nada de HTML: las etiquetas se descartan (con su contenido si son
 *     script, style, iframe, object, embed, noscript, template).
 *   - Enlaces [texto](url) solo si la url es https:// o una ruta interna
 *     ("/ruta", "#ancla"). Cualquier otra cosa (javascript:, data:, vbscript:,
 *     mailto:, http:, //host, entidades HTML, espacios, saltos) deja solo el texto.
 *   - Imágenes markdown ![alt](url): se descartan (queda el alt). Las imágenes
 *     de los campos (popup, slides) se validan con `esUrlImagenPermitida`.
 *   - Sin caracteres de control, sin marcas bidireccionales ni de ancho cero.
 *   - Tamaños máximos. Idempotente: sanear(sanear(x)) === sanear(x).
 */

export const MAX_CHARS_DOCUMENTO = 200_000;
export const MAX_CHARS_TEXTO_CORTO = 300;
export const MAX_CHARS_TEXTO_MEDIO = 1_500;
export const MAX_LARGO_URL = 2_000;

/** Dominios desde los que se aceptan imágenes: el nuestro y el bucket público. */
export const HOSTS_IMAGEN_PROPIOS = ["barraca.jurmaq.cl", "www.barraca.jurmaq.cl"] as const;
export const HOST_SUPABASE_BARRACA = "wmoizhbdalvnveclenvf.supabase.co";
export const PREFIJO_BUCKET_PUBLICO = "/storage/v1/object/public/barraca-redes/";

// Control (salvo \t y \n), bidi (LRE..RLO, LRI..PDI), ancho cero, BOM, separadores de línea Unicode.
const CARACTERES_PROHIBIDOS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2028\u2029\u2060-\u2069\uFEFF]/g;

export function limpiarCaracteres(s: string): string {
  return s.replace(/\r\n?/g, "\n").replace(CARACTERES_PROHIBIDOS, "");
}

const ETIQUETAS_CON_CONTENIDO = /<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi;
const COMENTARIOS = /<!--[\s\S]*?(?:-->|$)/g;
// "<" seguido de letra, "/", "!" o "?" abre una etiqueta: se borra hasta ">" o hasta el fin de línea.
const ETIQUETA = /<\/?[A-Za-z!?][^>\n]*>?/g;

/** Quita todo el HTML. Itera hasta que no cambie (cubre "<scr<b>ipt>"). */
export function quitarHtml(s: string): string {
  let actual = s;
  for (let i = 0; i < 8; i++) {
    const previo = actual;
    actual = actual.replace(COMENTARIOS, "").replace(ETIQUETAS_CON_CONTENIDO, "").replace(ETIQUETA, "");
    if (actual === previo) break;
  }
  // Un "<" suelto junto a una letra tras las pasadas (residuo de un ataque anidado): se escapa.
  return actual.replace(/<(?=[A-Za-z!?/])/g, "&lt;");
}

/**
 * ¿Es un enlace permitido? https://host/... o ruta interna ("/x", "/x#y", "#y").
 * Devuelve la URL normalizada o null.
 */
export function enlaceSeguro(crudo: unknown): string | null {
  if (typeof crudo !== "string") return null;
  const url = crudo.trim();
  if (!url || url.length > MAX_LARGO_URL) return null;
  // Espacios, controles, comillas, <>, backslash, entidades HTML y % mal formado: fuera.
  if (/[\s\u0000-\u001F\u007F-\u009F"'`<>\\]/.test(url)) return null;
  if (/&(?:#|[A-Za-z]+;)/.test(url)) return null;
  if (url.startsWith("#")) return /^#[A-Za-z0-9._~\-%]*$/.test(url) ? url : null;
  if (url.startsWith("/")) {
    if (url.startsWith("//")) return null;
    return /^\/[A-Za-z0-9\-._~!$&()*+,;=:@%/?#\[\]]*$/.test(url) ? url : null;
  }
  if (!/^https:\/\//i.test(url)) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !u.hostname || u.username || u.password) return null;
    if (u.hostname.includes("%")) return null;
    return u.toString() === url || u.toString() === `${url}/` ? url : u.toString();
  } catch {
    return null;
  }
}

/**
 * ¿La imagen es nuestra? Ruta interna a un archivo de imagen, https del dominio
 * de la tienda, o https del bucket público barraca-redes (carpeta tienda/).
 */
export function esUrlImagenPermitida(crudo: unknown): boolean {
  const url = enlaceSeguro(crudo);
  if (!url || url.startsWith("#")) return false;
  const extension = /\.(?:jpe?g|png|webp|gif|avif)(?:\?[A-Za-z0-9=&._-]*)?$/i;
  if (url.startsWith("/")) return extension.test(url.split("#")[0]);
  const u = new URL(url);
  if ((HOSTS_IMAGEN_PROPIOS as readonly string[]).includes(u.hostname)) return extension.test(u.pathname);
  if (u.hostname === HOST_SUPABASE_BARRACA) {
    return u.pathname.startsWith(`${PREFIJO_BUCKET_PUBLICO}tienda/`) && !u.pathname.includes("..") && extension.test(u.pathname);
  }
  return false;
}

/** Texto plano de una línea (títulos, botones, etiquetas): sin HTML, espacios colapsados, con tope. */
export function sanearTextoPlano(entrada: unknown, max = MAX_CHARS_TEXTO_CORTO): string {
  if (typeof entrada !== "string") return "";
  const t = quitarHtml(limpiarCaracteres(entrada)).replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max).trimEnd() : t;
}

/** Texto plano de varias líneas (párrafos cortos): sin HTML, sin enlaces markdown activos, con tope. */
export function sanearTextoMultilinea(entrada: unknown, max = MAX_CHARS_TEXTO_MEDIO): string {
  if (typeof entrada !== "string") return "";
  const t = quitarHtml(limpiarCaracteres(entrada))
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t.length > max ? t.slice(0, max).trimEnd() : t;
}

const IMAGEN_MD = /!\[([^\]]*)\]\([^)]*\)/g;
const ENLACE_MD = /\[([^\]\n]*)\]\(([^()\n]*(?:\([^()\n]*\)[^()\n]*)*)\)/g;
const DEFINICION_REFERENCIA = /^[ \t]*\[[^\]\n]+\]:[ \t]*\S.*$/gm;

function sanearEnlaces(md: string): string {
  return md.replace(ENLACE_MD, (_t, texto: string, destino: string) => {
    // "(url "título")": se toma solo la url.
    const url = destino.trim().replace(/\s+(?:"[^"]*"|'[^']*')\s*$/, "");
    const seguro = enlaceSeguro(url);
    return seguro ? `[${texto}](${seguro})` : texto;
  });
}

export interface ResultadoMarkdown {
  texto: string;
  /** El saneamiento cambió el texto (había algo no permitido o espacios raros). */
  modificado: boolean;
  /** Se cortó por exceder el máximo. */
  truncado: boolean;
}

/**
 * Sanea markdown de documentos (términos, privacidad, envíos, nosotros).
 * Conserva títulos, listas, tablas, negritas, separadores y enlaces permitidos.
 */
export function sanearMarkdown(entrada: unknown, max = MAX_CHARS_DOCUMENTO): ResultadoMarkdown {
  const original = typeof entrada === "string" ? entrada : "";
  let t = limpiarCaracteres(original);
  let truncado = false;
  if (t.length > max) {
    t = t.slice(0, max);
    truncado = true;
  }
  // Autoenlaces <https://x> pierden los ángulos antes de borrar el HTML (quedan como texto).
  t = t.replace(/<(https?:\/\/[^\s<>]+)>/gi, "$1");
  t = quitarHtml(t);
  t = t.replace(IMAGEN_MD, (_m, alt: string) => alt);
  t = t.replace(DEFINICION_REFERENCIA, "");
  t = sanearEnlaces(t);
  t = t
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  return { texto: t, modificado: t !== original.trim() || truncado, truncado };
}
