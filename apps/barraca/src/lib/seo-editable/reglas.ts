/**
 * Reglas del SEO editable (puras: sin Next, sin Supabase, sin D1). Se prueban
 * directo con node --test.
 *
 * Lo que se puede editar es SOLO el título y la descripción para Google (y los
 * mismos textos para redes sociales, `og`). Nunca el canonical, robots, slug ni
 * la URL: eso no tiene herramienta ni campo.
 *
 * Límites (docs/MCP-NOTAS.md, sección SEO editable):
 *   - título: ideal hasta 60 caracteres, descripción hasta 160. Pasarse poco es
 *     una ADVERTENCIA (Google recorta, no es un error). Pasarse mucho (título
 *     más de 120, descripción más de 320) se rechaza.
 *   - texto plano: sin HTML, sin saltos de línea, sin caracteres de control.
 *   - nada inventado: ni reseñas o estrellas, ni precios en pesos, ni plazos de
 *     entrega prometidos. Los precios cambian y Google los compara con la ficha.
 */
import { limpiarCaracteres } from "../contenido/markdown.ts";

export const TITULO_IDEAL = 60;
export const DESCRIPCION_IDEAL = 160;
export const TITULO_MAX = 120;
export const DESCRIPCION_MAX = 320;
export const TITULO_MIN_SUGERIDO = 15;
export const DESCRIPCION_MIN_SUGERIDA = 70;

export const TIPOS_SEO = ["producto", "categoria", "pagina"] as const;
export type TipoSeo = (typeof TIPOS_SEO)[number];

/** Textos editables de una entrada. `null` = no se pisa lo que hace el código. */
export interface CamposSeo {
  titulo: string | null;
  descripcion: string | null;
  ogTitulo: string | null;
  ogDescripcion: string | null;
}

export const CAMPOS_VACIOS: CamposSeo = { titulo: null, descripcion: null, ogTitulo: null, ogDescripcion: null };

export interface EntradaSeo {
  titulo?: string | null;
  descripcion?: string | null;
  ogTitulo?: string | null;
  ogDescripcion?: string | null;
}

const RE_HTML = /[<>]/;
const RE_PRECIO = /(?:\$\s*\d|\b\d[\d.,]*\s*(?:pesos|clp)\b|\bclp\s*\d)/i;
const RE_RESENA = /(?:★|⭐|\brese[ñn]as?\b|\bopiniones?\b|\bvalorad[oa]s?\b|\bcalificad[oa]s?\b|\bcalificaci[oó]n\b|\b\d(?:[.,]\d)?\s*(?:\/\s*5|estrellas?)\b|\bestrellas?\b|\bclientes?\s+(?:satisfechos|felices)\b|\bmiles de clientes\b)/i;
const RE_PLAZO = /(?:\b(?:entrega\w*|despacho|env[ií]o|llega\w*|recib\w*)\s+(?:\w+\s+){0,3}(?:en|dentro de)\s+(?:menos de\s+)?\d+\s*(?:h|hrs?|horas?|d[ií]as?)\b|\bmismo d[ií]a\b|\bllega(?:mos)?\s+(?:hoy|ma[ñn]ana)\b|\bentrega\s+(?:inmediata|express|hoy|ma[ñn]ana|garantizada)\b|\b24\s*\/\s*7\b|\bdespacho\s+(?:inmediato|express)\b)/i;
const RE_GARANTIA = /(?:\bmejor precio\b|\bel m[aá]s barato\b|\bprecio garantizado\b|\bgarant[ií]a de por vida\b|\b100\s*%\s*garantizad)/i;

export interface ResultadoCampo {
  valor: string | null;
  errores: string[];
  advertencias: string[];
}

/** Texto plano de una sola línea. Devuelve null si queda vacío. */
export function limpiarTextoSeo(crudo: unknown): string {
  if (typeof crudo !== "string") return "";
  return limpiarCaracteres(crudo).replace(/\s+/g, " ").trim();
}

function validarCampo(etiqueta: string, crudo: string | null | undefined, ideal: number, max: number, min: number): ResultadoCampo {
  if (crudo === undefined || crudo === null) return { valor: null, errores: [], advertencias: [] };
  const errores: string[] = [];
  const advertencias: string[] = [];
  if (typeof crudo !== "string") return { valor: null, errores: [`${etiqueta}: debe ser texto.`], advertencias };
  if (RE_HTML.test(crudo)) errores.push(`${etiqueta}: debe ser texto plano, sin HTML (no uses < ni >).`);
  const texto = limpiarTextoSeo(crudo);
  if (texto === "") return { valor: null, errores, advertencias };
  if (texto.length > max) errores.push(`${etiqueta}: ${texto.length} caracteres es demasiado (máximo ${max}; lo ideal es ${ideal}).`);
  else if (texto.length > ideal) advertencias.push(`${etiqueta}: ${texto.length} caracteres; Google suele cortar después de ${ideal}.`);
  else if (texto.length < min) advertencias.push(`${etiqueta}: solo ${texto.length} caracteres; muy corto para decir de qué trata la página (sugerido desde ${min}).`);
  if (RE_PRECIO.test(texto)) errores.push(`${etiqueta}: no pongas precios en pesos; cambian y Google los compara con la ficha. Escribe sin monto.`);
  if (RE_RESENA.test(texto)) errores.push(`${etiqueta}: no menciones reseñas, opiniones, estrellas ni calificaciones: solo pueden salir de opiniones reales de la tienda.`);
  if (RE_PLAZO.test(texto)) errores.push(`${etiqueta}: no prometas plazos de entrega ni disponibilidad inmediata.`);
  if (RE_GARANTIA.test(texto)) errores.push(`${etiqueta}: no prometas «mejor precio» ni garantías que la tienda no ofrece.`);
  return { valor: texto, errores, advertencias };
}

export interface ResultadoSeo {
  ok: boolean;
  valor: CamposSeo;
  errores: string[];
  advertencias: string[];
}

/** Valida y limpia las cuatro entradas. `undefined` y `null` = sin texto propio en ese campo. */
export function validarSeo(e: EntradaSeo): ResultadoSeo {
  const t = validarCampo("Título", e.titulo, TITULO_IDEAL, TITULO_MAX, TITULO_MIN_SUGERIDO);
  const d = validarCampo("Descripción", e.descripcion, DESCRIPCION_IDEAL, DESCRIPCION_MAX, DESCRIPCION_MIN_SUGERIDA);
  const ot = validarCampo("Título para redes", e.ogTitulo, TITULO_IDEAL, TITULO_MAX, TITULO_MIN_SUGERIDO);
  const od = validarCampo("Descripción para redes", e.ogDescripcion, DESCRIPCION_IDEAL, DESCRIPCION_MAX, DESCRIPCION_MIN_SUGERIDA);
  const errores = [...t.errores, ...d.errores, ...ot.errores, ...od.errores];
  const advertencias = [...t.advertencias, ...d.advertencias, ...ot.advertencias, ...od.advertencias];
  const valor: CamposSeo = { titulo: t.valor, descripcion: d.valor, ogTitulo: ot.valor, ogDescripcion: od.valor };
  if (valor.titulo === null && valor.descripcion === null && valor.ogTitulo === null && valor.ogDescripcion === null && errores.length === 0) {
    errores.push("No hay ningún texto que guardar (usa «restablecer» para volver al texto automático).");
  }
  return { ok: errores.length === 0, valor, errores, advertencias };
}

export const hayTexto = (c: CamposSeo): boolean => c.titulo !== null || c.descripcion !== null || c.ogTitulo !== null || c.ogDescripcion !== null;

/** Clave de comparación para detectar títulos repetidos (sin tildes, mayúsculas ni espacios de más). */
export function claveTitulo(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// ── Claves ──────────────────────────────────────────────────────────────────

/** Páginas fijas cuyo título y descripción se pueden editar. */
export const PAGINAS_SEO = [
  "portada", "categorias", "guias", "calculadora_fierro", "envios", "nosotros", "contacto", "sucursales", "terminos", "privacidad",
] as const;
export type PaginaSeo = (typeof PAGINAS_SEO)[number];

export const RUTA_PAGINA: Record<PaginaSeo, string> = {
  portada: "/", categorias: "/categorias", guias: "/guias", calculadora_fierro: "/calculadora-fierro", envios: "/envios-y-devoluciones",
  nosotros: "/nosotros", contacto: "/contacto", sucursales: "/sucursales", terminos: "/terminos", privacidad: "/privacidad",
};

export const ETIQUETA_PAGINA: Record<PaginaSeo, string> = {
  portada: "Portada", categorias: "Índice de categorías", guias: "Índice de guías", calculadora_fierro: "Calculadora de fierro",
  envios: "Envíos y devoluciones", nosotros: "Quiénes somos", contacto: "Contacto", sucursales: "Dónde estamos",
  terminos: "Términos y condiciones", privacidad: "Política de privacidad",
};

/** Páginas legales: cambiar su título o descripción necesita el OK de Jorge. */
export const PAGINAS_LEGALES: ReadonlySet<string> = new Set(["terminos", "privacidad"]);

export const esPaginaSeo = (x: unknown): x is PaginaSeo => typeof x === "string" && (PAGINAS_SEO as readonly string[]).includes(x);

const RE_CODIGO = /^[A-Za-z0-9][A-Za-z0-9._\-/ ]{0,39}$/;
const RE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Clave válida para el tipo (formato; que exista se comprueba aparte contra la tienda). */
export function claveValida(tipo: TipoSeo, clave: unknown): clave is string {
  if (typeof clave !== "string") return false;
  if (tipo === "pagina") return esPaginaSeo(clave);
  if (tipo === "categoria") return clave.length <= 80 && RE_SLUG.test(clave);
  return RE_CODIGO.test(clave.trim());
}

// ── Aplicar sobre lo que ya genera el código ────────────────────────────────

/** Forma mínima de los metadatos que se tocan (compatible con `Metadata` de Next). */
export type MetaBase = object;

/**
 * Aplica el texto propio SOBRE lo que genera el código. Sin texto propio devuelve el mismo
 * objeto, sin cambios (prueba de equivalencia). Nunca toca canonical, robots, keywords,
 * url ni imágenes: solo title, description y los textos de openGraph.
 */
export function aplicarSeo<T extends MetaBase>(meta: T, campos: CamposSeo | null | undefined): T {
  if (!campos || !hayTexto(campos)) return meta;
  const base = meta as Record<string, unknown>;
  const salida: Record<string, unknown> = { ...base };
  if (campos.titulo !== null) salida.title = campos.titulo;
  if (campos.descripcion !== null) salida.description = campos.descripcion;
  if (campos.ogTitulo !== null || campos.ogDescripcion !== null) {
    const og = { ...((base.openGraph as Record<string, unknown> | undefined) ?? {}) };
    if (campos.ogTitulo !== null) og.title = campos.ogTitulo;
    if (campos.ogDescripcion !== null) og.description = campos.ogDescripcion;
    salida.openGraph = og;
  }
  return salida as T;
}
