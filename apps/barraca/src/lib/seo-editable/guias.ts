/**
 * Guías de construcción editables (puro: sin Next, Supabase ni D1).
 *
 * La fuente de respaldo sigue siendo `lib/guias-seo-data.ts` (código). Una guía
 * publicada en D1 con el mismo slug la REEMPLAZA entera; con otro slug es una
 * guía nueva. La página de la guía no cambia: recibe el mismo objeto `GuiaSEO`.
 *
 * Texto editable en markdown seguro: párrafos, listas con «- » o «1. », negrita
 * `**así**`, títulos `### ` y enlaces https o internos. Cualquier HTML se descarta
 * y todo se escapa al convertir, así que lo que llega a la página nunca trae
 * etiquetas que no sean p, ul, ol, li, h3, strong y a.
 */
import { contieneDatosDePago, MENSAJE_DATOS_DE_PAGO } from "../contenido/datos-pago.ts";
import { enlaceSeguro, sanearMarkdown, sanearTextoPlano } from "../contenido/markdown.ts";
import { limpiarTextoSeo } from "./reglas.ts";
import type { GuiaSEO } from "../guias-seo-data.ts";

export interface SeccionGuiaEditable { h2: string; md: string }
export interface GuiaEditable {
  slug: string;
  titulo: string;
  descripcionMeta: string;
  h1: string;
  intro: string;
  secciones: SeccionGuiaEditable[];
  faq: Array<{ q: string; a: string }>;
  categoriaSlugRelacionada: string;
  categoriaNombre: string;
  guiasRelacionadas: string[];
}

export const MAX_SECCIONES = 20;
export const MAX_FAQ = 20;
export const MAX_MD_SECCION = 8_000;
export const MAX_INTRO = 3_000;
export const MAX_JSON_GUIA = 80_000;
const RE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Texto dentro de una etiqueta: & < > (las comillas no hace falta escaparlas ahí). */
const escaparHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Valor de un atributo: además las comillas. */
const escaparAtributo = (s: string) => escaparHtml(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// ── Markdown → HTML seguro ───────────────────────────────────────────────────

function inline(texto: string): string {
  // Se parte por enlaces [t](url); lo demás se escapa y recibe negrita.
  const partes: string[] = [];
  let resto = texto;
  const RE = /\[([^\]\n]*)\]\(([^()\s]+)\)/;
  for (let guardia = 0; guardia < 200; guardia++) {
    const m = RE.exec(resto);
    if (!m) break;
    partes.push(negrita(resto.slice(0, m.index)));
    const url = enlaceSeguro(m[2]);
    partes.push(url ? `<a href="${escaparAtributo(url)}"${url.startsWith("http") ? ' rel="noopener noreferrer"' : ""}>${negrita(m[1])}</a>` : negrita(m[1]));
    resto = resto.slice(m.index + m[0].length);
  }
  partes.push(negrita(resto));
  return partes.join("");
}

function negrita(texto: string): string {
  return escaparHtml(texto).replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
}

/** Convierte markdown seguro a HTML con solo p, ul, ol, li, h3, strong y a. */
export function mdAHtml(md: string): string {
  const limpio = sanearMarkdown(md, MAX_MD_SECCION).texto;
  const bloques = limpio.split(/\n{2,}/);
  const salida: string[] = [];
  for (const bloque of bloques) {
    const lineas = bloque.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
    if (lineas.length === 0) continue;
    if (lineas.every((l) => /^\s*[-*]\s+/.test(l))) {
      salida.push(`<ul>${lineas.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`);
    } else if (lineas.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      salida.push(`<ol>${lineas.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`);
    } else if (/^#{3,6}\s+/.test(lineas[0])) {
      salida.push(`<h3>${inline(lineas[0].replace(/^#{3,6}\s+/, ""))}</h3>`);
      const cola = lineas.slice(1).join(" ").trim();
      if (cola) salida.push(`<p>${inline(cola)}</p>`);
    } else {
      salida.push(`<p>${inline(lineas.join(" "))}</p>`);
    }
  }
  return salida.join("\n");
}

// ── HTML del código → markdown (para empezar a editar una guía existente) ────

const decodificar = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const aInline = (h: string) =>
  decodificar(h.replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**").replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)").replace(/<\/?[a-z][^>]*>/gi, ""))
    .replace(/\s+/g, " ")
    .trim();

/** HTML simple (p, ul, ol, li, strong) a markdown. Solo para mostrar el texto actual y editarlo. */
export function htmlAMd(html: string): string {
  const bloques: string[] = [];
  const RE = /<(p|ul|ol|h3)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(html))) {
    const [, etiqueta, interior] = m;
    if (etiqueta === "p") bloques.push(aInline(interior));
    else if (etiqueta === "h3") bloques.push(`### ${aInline(interior)}`);
    else {
      const items = [...interior.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((x) => aInline(x[1]));
      bloques.push(items.map((t, i) => (etiqueta === "ol" ? `${i + 1}. ${t}` : `- ${t}`)).join("\n"));
    }
  }
  return bloques.join("\n\n");
}

/** La guía de código como valor editable. */
export function guiaAEditable(g: GuiaSEO): GuiaEditable {
  return {
    slug: g.slug,
    titulo: g.titulo,
    descripcionMeta: g.descripcionMeta,
    h1: g.h1,
    intro: g.intro,
    secciones: g.secciones.map((s) => ({ h2: s.h2, md: htmlAMd(s.html) })),
    faq: g.faq.map((f) => ({ q: f.q, a: f.a })),
    categoriaSlugRelacionada: g.categoriaSlugRelacionada,
    categoriaNombre: g.categoriaNombre,
    guiasRelacionadas: [...(g.guiasRelacionadas ?? [])],
  };
}

/** La guía editable como la espera la página (HTML ya convertido y seguro). */
export function editableAGuia(g: GuiaEditable): GuiaSEO {
  return {
    slug: g.slug,
    titulo: g.titulo,
    descripcionMeta: g.descripcionMeta,
    h1: g.h1,
    intro: g.intro,
    secciones: g.secciones.map((s) => ({ h2: s.h2, html: mdAHtml(s.md) })),
    faq: g.faq.map((f) => ({ q: f.q, a: f.a })),
    categoriaSlugRelacionada: g.categoriaSlugRelacionada,
    categoriaNombre: g.categoriaNombre,
    guiasRelacionadas: g.guiasRelacionadas,
  };
}

// ── Validación ───────────────────────────────────────────────────────────────

export type ResultadoGuia = { ok: true; valor: GuiaEditable; advertencias: string[] } | { ok: false; errores: string[] };

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const CLAVES_GUIA = new Set(["slug", "titulo", "descripcionMeta", "h1", "intro", "secciones", "faq", "categoriaSlugRelacionada", "categoriaNombre", "guiasRelacionadas"]);

function texto(errores: string[], etiqueta: string, v: unknown, max: number, min = 1): string {
  if (typeof v !== "string") { errores.push(`${etiqueta}: debe ser texto.`); return ""; }
  if (/[<>]/.test(v)) errores.push(`${etiqueta}: texto plano, sin HTML (no uses < ni >).`);
  const t = sanearTextoPlano(v, max + 1);
  if (t.length < min) errores.push(`${etiqueta}: no puede quedar vacío.`);
  if (t.length > max) { errores.push(`${etiqueta}: ${t.length} caracteres es demasiado (máximo ${max}).`); return t.slice(0, max); }
  return t;
}

/** Valida y limpia una guía completa (borrador o publicada). Lo que no valida no se guarda ni se muestra. */
export function validarGuia(entrada: unknown): ResultadoGuia {
  const errores: string[] = [];
  const advertencias: string[] = [];
  if (!esObjeto(entrada)) return { ok: false, errores: ["La guía debe ser un objeto."] };
  for (const k of Object.keys(entrada)) if (!CLAVES_GUIA.has(k)) errores.push(`Campo desconocido: ${k}.`);

  const slug = typeof entrada.slug === "string" ? entrada.slug.trim() : "";
  if (!RE_SLUG.test(slug) || slug.length > 80) errores.push("slug: solo minúsculas, números y guiones (ej. que-es-el-cemento), hasta 80 caracteres.");
  const titulo = texto(errores, "titulo", entrada.titulo, 120);
  const h1 = texto(errores, "h1", entrada.h1, 140);
  const descripcionMeta = texto(errores, "descripcionMeta", entrada.descripcionMeta, 320);
  if (descripcionMeta.length > 160) advertencias.push(`descripcionMeta: ${descripcionMeta.length} caracteres; Google suele cortar después de 160.`);
  if (titulo.length > 60) advertencias.push(`titulo: ${titulo.length} caracteres; Google suele cortar después de 60 (la página agrega «· Barraca JURMAQ»).`);
  if (typeof entrada.intro !== "string") errores.push("intro: debe ser texto.");
  const intro = typeof entrada.intro === "string" ? limpiarTextoSeo(sanearTextoPlano(entrada.intro, MAX_INTRO + 1)) : "";
  if (typeof entrada.intro === "string" && /[<>]/.test(entrada.intro)) errores.push("intro: texto plano, sin HTML (no uses < ni >).");
  if (!intro) errores.push("intro: no puede quedar vacío.");
  if (intro.length > MAX_INTRO) errores.push(`intro: demasiado largo (máximo ${MAX_INTRO}).`);

  const secciones: SeccionGuiaEditable[] = [];
  if (!Array.isArray(entrada.secciones) || entrada.secciones.length === 0) errores.push("secciones: debe haber al menos una sección.");
  else {
    if (entrada.secciones.length > MAX_SECCIONES) errores.push(`secciones: máximo ${MAX_SECCIONES}.`);
    entrada.secciones.slice(0, MAX_SECCIONES).forEach((s, i) => {
      if (!esObjeto(s)) { errores.push(`secciones[${i + 1}]: debe ser un objeto {h2, md}.`); return; }
      for (const k of Object.keys(s)) if (k !== "h2" && k !== "md") errores.push(`secciones[${i + 1}]: campo desconocido ${k}.`);
      const h2 = texto(errores, `secciones[${i + 1}].h2`, s.h2, 120);
      if (typeof s.md !== "string") { errores.push(`secciones[${i + 1}].md: debe ser texto markdown.`); return; }
      if (s.md.length > MAX_MD_SECCION) errores.push(`secciones[${i + 1}].md: demasiado largo (máximo ${MAX_MD_SECCION}).`);
      const md = sanearMarkdown(s.md, MAX_MD_SECCION).texto;
      if (!md) errores.push(`secciones[${i + 1}].md: no puede quedar vacío.`);
      secciones.push({ h2, md });
    });
  }

  const faq: Array<{ q: string; a: string }> = [];
  if (!Array.isArray(entrada.faq)) errores.push("faq: debe ser una lista (puede estar vacía).");
  else {
    if (entrada.faq.length > MAX_FAQ) errores.push(`faq: máximo ${MAX_FAQ} preguntas.`);
    entrada.faq.slice(0, MAX_FAQ).forEach((f, i) => {
      if (!esObjeto(f)) { errores.push(`faq[${i + 1}]: debe ser {q, a}.`); return; }
      for (const k of Object.keys(f)) if (k !== "q" && k !== "a") errores.push(`faq[${i + 1}]: campo desconocido ${k}.`);
      faq.push({ q: texto(errores, `faq[${i + 1}].q`, f.q, 200), a: texto(errores, `faq[${i + 1}].a`, f.a, 1_500) });
    });
  }

  const categoriaSlugRelacionada = typeof entrada.categoriaSlugRelacionada === "string" ? entrada.categoriaSlugRelacionada.trim() : "";
  if (!RE_SLUG.test(categoriaSlugRelacionada) || categoriaSlugRelacionada.length > 80) errores.push("categoriaSlugRelacionada: debe ser el slug de una categoría (ej. fierros-y-mallas).");
  const categoriaNombre = texto(errores, "categoriaNombre", entrada.categoriaNombre, 80);
  const relacionadas: string[] = [];
  if (entrada.guiasRelacionadas !== undefined) {
    if (!Array.isArray(entrada.guiasRelacionadas) || entrada.guiasRelacionadas.length > 6) errores.push("guiasRelacionadas: lista de hasta 6 slugs de guías.");
    else for (const s of entrada.guiasRelacionadas) {
      if (typeof s !== "string" || !RE_SLUG.test(s)) errores.push("guiasRelacionadas: cada una debe ser un slug válido.");
      else if (s === slug) errores.push("guiasRelacionadas: una guía no puede relacionarse con ella misma.");
      else if (!relacionadas.includes(s)) relacionadas.push(s);
    }
  }
  // Tope duro (ambos modos de aprobación): ni datos bancarios ni enlaces de pago.
  if (contieneDatosDePago(JSON.stringify([titulo, h1, descripcionMeta, intro, secciones, faq]))) errores.push(MENSAJE_DATOS_DE_PAGO);
  if (errores.length > 0) return { ok: false, errores };
  const valor: GuiaEditable = { slug, titulo, descripcionMeta, h1, intro, secciones, faq, categoriaSlugRelacionada, categoriaNombre, guiasRelacionadas: relacionadas };
  if (JSON.stringify(valor).length > MAX_JSON_GUIA) return { ok: false, errores: [`La guía completa es demasiado larga (máximo ${MAX_JSON_GUIA} caracteres en total).`] };
  return { ok: true, valor, advertencias };
}

/** Guías efectivas: las de código, con las publicadas encima (mismo slug la reemplaza; otro slug se agrega al final). */
export function fusionarGuias(codigo: readonly GuiaSEO[], publicadas: ReadonlyMap<string, GuiaEditable>): GuiaSEO[] {
  const salida = codigo.map((g) => {
    const p = publicadas.get(g.slug);
    return p ? editableAGuia(p) : g;
  });
  const existentes = new Set(codigo.map((g) => g.slug));
  for (const [slug, p] of publicadas) if (!existentes.has(slug)) salida.push(editableAGuia(p));
  return salida;
}
