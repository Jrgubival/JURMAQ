/**
 * Servicio de las guías editables (puro: D1 y tienda por parámetro). Mismo modelo que el contenido de
 * la Etapa 1: borrador libre, publicación en dos pasos (previsualizar y confirmar), versiones y
 * restaurar. El respaldo es la guía escrita en código (`lib/guias-seo-data.ts`): sin nada publicado
 * la página es idéntica a la de siempre.
 */
import { consumirVistaPrevia, crearVistaPrevia, huellaDeDatos, type D1Like, type EntradaAuditoria, type UsuarioGestion } from "../gestion/index.ts";
import { exigirAprobacion, textoMotivos } from "../gestion-precios/aprobacion.ts";
import { ErrorGestion } from "../gestion-precios/precios-masivos.ts";
import { MENSAJE_VISTA, mirarVistaPrevia } from "../gestion-precios/vistas.ts";
import { agregaDesvio } from "../contenido/desvio.ts";
import { desdeJson } from "../gestion/util.ts";
import { GUIAS } from "../guias-seo-data.ts";
import type { MotivoAprobacion } from "../mcp/aprobaciones.ts";
import type { DepsSeo } from "./deps.ts";
import { guiaAEditable, validarGuia, type GuiaEditable } from "./guias.ts";
import {
  despublicarGuiaD1, escribirBorradorGuia, leerFilaGuia, listarFilasGuias, publicarGuiaD1, valorVersionGuia, versionesGuia, type FilaGuia,
} from "./repositorio.ts";
import type { CtxSeo, ResultadoRevertir, Salida } from "./servicio.ts";

export const TIPO_VISTA_GUIA = "guia_publicacion";
export const HERRAMIENTA_GUIA_PUBLICAR = "confirmar_publicacion_guia";
export const HERRAMIENTA_GUIA_BORRADOR = "guardar_borrador_guia";
const TTL_NORMAL_MS = 15 * 60_000;
const TTL_CON_APROBACION_MS = 5 * 3_600_000;
const MAX_PARTE = 12_000;

const RE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const esSlug = (s: unknown): s is string => typeof s === "string" && s.length <= 80 && RE_SLUG.test(s);
const recortar = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

function validarGuard(json: string | null): GuiaEditable | null {
  if (!json) return null;
  const v = validarGuia(desdeJson(json));
  return v.ok ? v.valor : null;
}

/** Lo que se ve hoy: lo publicado si valida, si no la guía de código (o nada si es nueva). */
function vigente(slug: string, fila: FilaGuia | null): { valor: GuiaEditable | null; origen: "publicada" | "codigo" | "ninguna" } {
  const pub = validarGuard(fila?.publicado ?? null);
  if (pub && pub.slug === slug) return { valor: pub, origen: "publicada" };
  const cod = GUIAS.find((g) => g.slug === slug);
  return cod ? { valor: guiaAEditable(cod), origen: "codigo" } : { valor: null, origen: "ninguna" };
}

// ───────── lectura ─────────

export async function listarGuias(db: D1Like): Promise<Salida> {
  const filas = new Map((await listarFilasGuias(db)).map((f) => [f.slug, f]));
  const slugs = [...new Set([...GUIAS.map((g) => g.slug), ...filas.keys()])];
  const lineas = slugs.map((slug) => {
    const f = filas.get(slug) ?? null;
    const v = vigente(slug, f);
    const titulo = v.valor?.titulo ?? "(solo borrador)";
    const estado = v.origen === "publicada" ? `publicada versión ${f?.versionPublicada}` : v.origen === "codigo" ? "la de código (sin cambios publicados)" : "NUEVA, sin publicar";
    return `- ${slug} · ${recortar(titulo, 70)} · ${estado}${f?.borrador ? " · con borrador" : ""}`;
  });
  return { texto: `${slugs.length} guías:\n${lineas.join("\n")}`, datos: { total: slugs.length, slugs } };
}

export async function verGuia(db: D1Like, slug: string, parte = 1): Promise<Salida> {
  if (!esSlug(slug)) throw new ErrorGestion("El slug de la guía no es válido.");
  const fila = await leerFilaGuia(db, slug);
  const v = vigente(slug, fila);
  const borrador = validarGuard(fila?.borrador ?? null);
  if (!v.valor && !borrador) throw new ErrorGestion(`No existe la guía «${slug}». Mira listar_guias, o crea una con guardar_borrador_guia.`);
  const versiones = await versionesGuia(db, slug, 8);
  const mostrado = borrador ?? v.valor!;
  const json = JSON.stringify(mostrado, null, 1);
  const partes = Math.max(1, Math.ceil(json.length / MAX_PARTE));
  if (!Number.isInteger(parte) || parte < 1 || parte > partes) throw new ErrorGestion(`La parte debe estar entre 1 y ${partes}.`);
  const lineas = [
    `Guía ${slug} · ${v.origen === "publicada" ? `publicada versión ${fila?.versionPublicada}` : v.origen === "codigo" ? "la de código" : "nueva, sin publicar"}${borrador ? " · HAY BORRADOR (lo que sigue es el borrador)" : ""}.`,
    versiones.length ? `Versiones: ${versiones.map((x) => `v${x.version}${x.estado === "publicada" ? " (vigente)" : ""}${x.restauradaDe ? ` restaurada de v${x.restauradaDe}` : ""}`).join(", ")}.` : "Sin versiones publicadas todavía.",
    "El texto de cada sección es markdown seguro: párrafos, «- » para listas, «1. » para listas numeradas, **negrita**, ### subtítulo y enlaces https o internos.",
    `Parte ${parte} de ${partes}:`,
    json.slice((parte - 1) * MAX_PARTE, parte * MAX_PARTE),
  ];
  if (parte < partes) lineas.push(`(sigue: pide la parte ${parte + 1})`);
  return { texto: lineas.join("\n"), datos: { slug, origen: v.origen, tieneBorrador: !!borrador, versionPublicada: fila?.versionPublicada ?? null, partes } };
}

// ───────── borrador ─────────

async function validarContraTienda(deps: DepsSeo, db: D1Like, g: GuiaEditable): Promise<string[]> {
  const errores: string[] = [];
  const cats = await deps.categorias.listar({ incluirInactivas: false });
  if (!cats.some((c) => c.slug === g.categoriaSlugRelacionada)) errores.push(`categoriaSlugRelacionada: no existe una categoría activa con el slug «${g.categoriaSlugRelacionada}» (mira listar_categorias).`);
  if (g.guiasRelacionadas.length) {
    const existentes = new Set([...GUIAS.map((x) => x.slug), ...(await listarFilasGuias(db)).filter((f) => f.publicado).map((f) => f.slug)]);
    for (const s of g.guiasRelacionadas) if (!existentes.has(s)) errores.push(`guiasRelacionadas: no existe la guía «${s}».`);
  }
  return errores;
}

export async function guardarBorradorGuia(deps: DepsSeo, ctx: CtxSeo, entrada: unknown): Promise<Salida> {
  const v = validarGuia(entrada);
  if (!v.ok) throw new ErrorGestion(`La guía no es válida; no se guardó nada:\n${v.errores.slice(0, 20).map((e) => `- ${e}`).join("\n")}`);
  const errores = await validarContraTienda(deps, ctx.db, v.valor);
  if (errores.length) throw new ErrorGestion(`No se guardó nada:\n${errores.map((e) => `- ${e}`).join("\n")}`);
  const json = JSON.stringify(v.valor);
  const previa = await leerFilaGuia(ctx.db, v.valor.slug);
  if (previa?.borrador === json) return { texto: "Sin cambios: ese borrador ya estaba guardado.", datos: { aplicado: false } };
  const antes = await escribirBorradorGuia(ctx.db, ctx.usuario, v.valor.slug, json, ctx.ahora);
  await ctx.auditar([{ entidad: "guia_borrador", entidadId: v.valor.slug, herramienta: HERRAMIENTA_GUIA_BORRADOR, antes: { json: antes }, despues: { json } }]);
  const esNueva = !GUIAS.some((g) => g.slug === v.valor.slug) && !previa?.publicado;
  return {
    texto: [
      `Borrador guardado para la guía «${v.valor.slug}»${esNueva ? " (guía NUEVA: aparece en la tienda y el sitemap cuando la publiques)" : ""}. La tienda no cambió.`,
      ...v.advertencias,
      `Revísalo con ver_guia y publícalo con previsualizar_publicacion_guia y confirmar_publicacion_guia.`,
    ].join("\n"),
    datos: { aplicado: true, slug: v.valor.slug, nueva: esNueva },
  };
}

export async function descartarBorradorGuia(ctx: CtxSeo, slug: string): Promise<Salida> {
  if (!esSlug(slug)) throw new ErrorGestion("El slug de la guía no es válido.");
  const fila = await leerFilaGuia(ctx.db, slug);
  if (!fila?.borrador) return { texto: "No había borrador que descartar.", datos: { aplicado: false } };
  await escribirBorradorGuia(ctx.db, ctx.usuario, slug, null, ctx.ahora);
  await ctx.auditar([{ entidad: "guia_borrador", entidadId: slug, herramienta: "descartar_borrador_guia", antes: { json: fila.borrador }, despues: { json: null } }]);
  return { texto: `Borrador de «${slug}» descartado. Lo publicado no cambió. Se puede deshacer.`, datos: { aplicado: true } };
}

/** Pone una versión anterior como BORRADOR (no cambia la tienda). */
export async function restaurarVersionGuia(deps: DepsSeo, ctx: CtxSeo, slug: string, version: number): Promise<Salida> {
  if (!esSlug(slug)) throw new ErrorGestion("El slug de la guía no es válido.");
  const json = await valorVersionGuia(ctx.db, slug, version);
  if (!json) throw new ErrorGestion(`No existe la versión ${version} de la guía «${slug}» (mira ver_guia).`);
  const r = await guardarBorradorGuia(deps, ctx, desdeJson(json));
  return { texto: `${r.texto.split("\n")[0].replace("Borrador guardado", `Versión ${version} puesta como borrador`)}\nAhora publícala con previsualizar_publicacion_guia si quieres que vuelva a la tienda.`, datos: { ...r.datos, version } };
}

// ───────── publicación en dos pasos ─────────

function resumenDiferencias(actual: GuiaEditable | null, nuevo: GuiaEditable): string[] {
  if (!actual) return [`Guía nueva «${nuevo.slug}»: ${nuevo.secciones.length} secciones y ${nuevo.faq.length} preguntas frecuentes.`];
  const l: string[] = [];
  for (const k of ["titulo", "h1", "descripcionMeta", "intro", "categoriaSlugRelacionada", "categoriaNombre"] as const) {
    if (actual[k] !== nuevo[k]) l.push(`- ${k}: «${recortar(actual[k], 60)}» → «${recortar(nuevo[k], 60)}»`);
  }
  const hs = (g: GuiaEditable) => g.secciones.map((s) => s.h2);
  const agregadas = hs(nuevo).filter((h) => !hs(actual).includes(h));
  const quitadas = hs(actual).filter((h) => !hs(nuevo).includes(h));
  const cambiadas = nuevo.secciones.filter((s) => {
    const a = actual.secciones.find((x) => x.h2 === s.h2);
    return a && a.md !== s.md;
  }).map((s) => s.h2);
  if (agregadas.length) l.push(`- Secciones nuevas: ${agregadas.join("; ")}`);
  if (quitadas.length) l.push(`- Secciones quitadas: ${quitadas.join("; ")}`);
  if (cambiadas.length) l.push(`- Secciones con texto distinto: ${cambiadas.join("; ")}`);
  if (JSON.stringify(actual.secciones.map((s) => s.h2)) !== JSON.stringify(hs(nuevo)) && !agregadas.length && !quitadas.length) l.push("- Cambió el orden de las secciones.");
  if (JSON.stringify(actual.faq) !== JSON.stringify(nuevo.faq)) l.push(`- Preguntas frecuentes: ${actual.faq.length} → ${nuevo.faq.length} (con cambios)`);
  if (JSON.stringify(actual.guiasRelacionadas) !== JSON.stringify(nuevo.guiasRelacionadas)) l.push("- Cambiaron las guías relacionadas.");
  return l;
}

interface PlanGuia { slug: string; nuevo: GuiaEditable; actual: GuiaEditable | null; fila: FilaGuia | null; motivos: MotivoAprobacion[]; huellaBase: unknown }

async function planGuia(deps: DepsSeo, db: D1Like, slug: string): Promise<PlanGuia> {
  if (!esSlug(slug)) throw new ErrorGestion("El slug de la guía no es válido.");
  const fila = await leerFilaGuia(db, slug);
  const nuevo = validarGuard(fila?.borrador ?? null);
  if (!fila?.borrador) throw new ErrorGestion(`La guía «${slug}» no tiene borrador. Guárdalo con guardar_borrador_guia.`);
  if (!nuevo) throw new ErrorGestion("El borrador no es válido (guárdalo de nuevo con guardar_borrador_guia).");
  const errores = await validarContraTienda(deps, db, nuevo);
  if (errores.length) throw new ErrorGestion(`No se puede publicar:\n${errores.map((e) => `- ${e}`).join("\n")}`);
  const actual = vigente(slug, fila).valor;
  const motivos: MotivoAprobacion[] = agregaDesvio(actual ?? {}, nuevo) ? ["texto_desvio"] : [];
  return { slug, nuevo, actual, fila, motivos, huellaBase: { slug, borrador: fila.borrador, publicado: fila.publicado ?? null, version: fila.versionPublicada ?? null, codigo: !fila.publicado && actual ? actual : null } };
}

export async function previsualizarPublicacionGuia(deps: DepsSeo, ctx: CtxSeo, slug: string): Promise<Salida> {
  const plan = await planGuia(deps, ctx.db, slug);
  if (plan.actual && JSON.stringify(plan.actual) === JSON.stringify(plan.nuevo)) {
    return { texto: "El borrador es igual a lo que ya se ve en la tienda: no hay nada que publicar.", datos: { cambian: false } };
  }
  const huella = await huellaDeDatos({ v: 1, tipo: TIPO_VISTA_GUIA, plan: plan.huellaBase });
  const vista = await crearVistaPrevia(ctx.db, { usuarioId: ctx.usuario.id, tipo: TIPO_VISTA_GUIA, payload: { slug }, huella, ttlMs: plan.motivos.length ? TTL_CON_APROBACION_MS : TTL_NORMAL_MS }, ctx.ahora);
  const avisos: string[] = [];
  if (plan.nuevo.descripcionMeta.length > 160) avisos.push(`La descripción para Google tiene ${plan.nuevo.descripcionMeta.length} caracteres (se corta desde 160).`);
  if (plan.nuevo.titulo.length > 60) avisos.push(`El título tiene ${plan.nuevo.titulo.length} caracteres (se corta desde 60).`);
  const lineas = [
    `Vista previa de publicar la guía «${slug}». No se cambió nada todavía.`,
    ...resumenDiferencias(plan.actual, plan.nuevo),
    ...avisos,
    plan.motivos.length ? `Necesita el OK de Jorge: ${textoMotivos(plan.motivos)}. Al confirmar le llega un correo; se aplica cuando apruebe y repitas confirmar_publicacion_guia con este mismo id.` : "No necesita aprobación de Jorge.",
    `Efectos: se regeneran /guias, /guias/${slug} y el sitemap. No cambia la URL ni el canonical.`,
    `Para publicar: confirmar_publicacion_guia con vista_previa_id "${vista.id}".`,
  ];
  return { texto: lineas.join("\n"), datos: { vista_previa_id: vista.id, expira_en: vista.expiraEn, requiere_aprobacion: plan.motivos.length > 0 } };
}

export async function confirmarPublicacionGuia(deps: DepsSeo, ctx: CtxSeo, args: { vista_previa_id: string }): Promise<Salida> {
  const mirada = await mirarVistaPrevia(ctx.db, { id: args.vista_previa_id, usuarioId: ctx.usuario.id, tipo: TIPO_VISTA_GUIA }, ctx.ahora);
  if (!mirada.ok) throw new ErrorGestion(MENSAJE_VISTA[mirada.motivo]);
  const slug = (mirada.payload as { slug?: unknown } | null)?.slug;
  if (!esSlug(slug)) throw new ErrorGestion("La vista previa está dañada. Genera una nueva.");
  let plan: PlanGuia;
  try {
    plan = await planGuia(deps, ctx.db, slug);
  } catch {
    throw new ErrorGestion(MENSAJE_VISTA.huella_cambiada);
  }
  const huellaActual = await huellaDeDatos({ v: 1, tipo: TIPO_VISTA_GUIA, plan: plan.huellaBase });
  if (huellaActual !== mirada.huella) throw new ErrorGestion(MENSAJE_VISTA.huella_cambiada);

  let aprobacion: { devolver(): Promise<boolean> } | null = null;
  if (plan.motivos.length > 0) {
    const huella = await huellaDeDatos({ v: 1, h: HERRAMIENTA_GUIA_PUBLICAR, vista: mirada.id, plan: plan.huellaBase });
    const r = await exigirAprobacion(
      ctx.db, deps.aprobacion,
      { usuario: ctx.usuario, herramienta: HERRAMIENTA_GUIA_PUBLICAR, motivos: plan.motivos, resumen: `Publicar la guía «${slug}» (agrega un teléfono, un correo o un enlace a otro sitio).`, detalle: { guia: slug, diferencias: resumenDiferencias(plan.actual, plan.nuevo), texto: plan.nuevo }, huella },
      ctx.ahora,
    );
    if (r.tipo !== "aprobada") return { texto: r.mensaje, datos: { aplicado: false, estado: r.tipo } };
    if (!(await r.gastar())) throw new ErrorGestion("La aprobación de Jorge ya se había usado. Genera una vista previa nueva.");
    aprobacion = r;
  }
  const consumo = await consumirVistaPrevia(ctx.db, { id: mirada.id, usuarioId: ctx.usuario.id, tipo: TIPO_VISTA_GUIA, huellaActual }, ctx.ahora);
  if (!consumo.ok) {
    await aprobacion?.devolver().catch(() => false);
    throw new ErrorGestion(MENSAJE_VISTA[consumo.motivo]);
  }
  try {
    const json = JSON.stringify(plan.nuevo);
    const r = await publicarGuiaD1(ctx.db, ctx.usuario, slug, json, ctx.ahora, { limpiarBorrador: true });
    await ctx.auditar([{
      entidad: "guia", entidadId: slug, herramienta: HERRAMIENTA_GUIA_PUBLICAR,
      antes: { json: r.anterior?.json ?? null, version: r.anterior?.version ?? null }, despues: { json, version: r.version },
    }]);
    await refrescarGuia(deps, slug);
    return { texto: `Guía «${slug}» publicada (versión ${r.version}). Ya se ve en la tienda y se regeneró el sitemap. Se puede deshacer desde el historial.`, datos: { aplicado: true, version: r.version } };
  } catch (e) {
    await aprobacion?.devolver().catch(() => false);
    throw e;
  }
}

async function refrescarGuia(deps: DepsSeo, slug: string): Promise<void> {
  try {
    await deps.revalidarRutas(["/guias", `/guias/${slug}`, "/sitemap.xml"]);
  } catch {
    // Las páginas se regeneran solas con el tiempo.
  }
}

// ───────── deshacer ─────────

const jsonDe = (x: unknown): string | null => {
  const j = (x as { json?: unknown } | null)?.json;
  return typeof j === "string" ? j : null;
};

/** Deshace borradores (entidad guia_borrador) y publicaciones (entidad guia) sin pisar cambios posteriores. */
export async function revertirGuias(deps: DepsSeo, p: { db: D1Like; usuario: UsuarioGestion; ahora: number; entradas: EntradaAuditoria[] }): Promise<ResultadoRevertir> {
  let hechas = 0;
  let yaEstaba = 0;
  const saltadas: string[] = [];
  for (const e of p.entradas) {
    const slug = e.entidadId;
    const fila = await leerFilaGuia(p.db, slug);
    const antes = jsonDe(e.antes);
    const despues = jsonDe(e.despues);
    if (e.entidad === "guia_borrador") {
      const actual = fila?.borrador ?? null;
      if (actual === antes) { yaEstaba++; continue; }
      if (actual !== despues) { saltadas.push(slug); continue; }
      await escribirBorradorGuia(p.db, p.usuario, slug, antes, p.ahora);
      hechas++;
    } else if (e.entidad === "guia") {
      const actual = fila?.publicado ?? null;
      if (actual === antes) { yaEstaba++; continue; }
      if (actual !== despues) { saltadas.push(slug); continue; }
      if (antes) await publicarGuiaD1(p.db, p.usuario, slug, antes, p.ahora, { nota: "Deshacer una publicación" });
      else await despublicarGuiaD1(p.db, slug);
      await refrescarGuia(deps, slug);
      hechas++;
    }
  }
  const partes = [`${hechas} restaurada${hechas === 1 ? "" : "s"}`];
  if (yaEstaba) partes.push(`${yaEstaba} ya estaba${yaEstaba === 1 ? "" : "n"} como antes`);
  if (saltadas.length) partes.push(`no toqué ${saltadas.join(", ")} porque alguien lo cambió después`);
  if (hechas === 0 && yaEstaba === 0) return { ok: false, mensaje: `No se pudo deshacer: ${partes.join("; ")}.` };
  return { ok: true, mensaje: `${partes.join("; ")}.` };
}

/** Título y descripción vigentes de todas las guías (para auditar_seo). */
export async function guiasVigentesResumen(db: D1Like): Promise<Array<{ slug: string; titulo: string; descripcionMeta: string }>> {
  const filas = new Map((await listarFilasGuias(db)).map((f) => [f.slug, f]));
  const slugs = [...new Set([...GUIAS.map((g) => g.slug), ...[...filas.values()].filter((f) => f.publicado).map((f) => f.slug)])];
  const out: Array<{ slug: string; titulo: string; descripcionMeta: string }> = [];
  for (const slug of slugs) {
    const v = vigente(slug, filas.get(slug) ?? null).valor;
    if (v) out.push({ slug, titulo: v.titulo, descripcionMeta: v.descripcionMeta });
  }
  return out;
}
