/**
 * Servicio del SEO editable (título y descripción para Google por producto, categoría y página).
 * Puro respecto de Next: todo llega por parámetro (D1, dependencias de la tienda, contexto de la llamada),
 * así se prueba con D1 simulada y tienda falsa.
 *
 *   verSeo        lee: texto vigente, el que genera el código y uno sugerido, con avisos.
 *   auditarSeo    lee: repetidos, sin texto propio, largos; por lote paginado.
 *   editarSeo     escribe hasta 5 entradas directo (libre salvo términos/privacidad/desvío, que piden el OK de Jorge).
 *   previsualizarSeo / confirmarSeo   dos pasos para cambios masivos (hasta 200).
 *   revertirSeo   deshacer sin pisar lo que alguien cambió después.
 *
 * Nunca toca canonical, robots, slug ni URL: el único dato que se guarda son los 4 textos.
 */
import { consumirVistaPrevia, crearVistaPrevia, huellaDeDatos, type EntradaAuditoria } from "../gestion/index.ts";
import type { D1Like, UsuarioGestion } from "../gestion/index.ts";
import { exigirAprobacion, textoMotivos } from "../gestion-precios/aprobacion.ts";
import { ErrorGestion, descendientes } from "../gestion-precios/precios-masivos.ts";
import { MENSAJE_VISTA, mirarVistaPrevia } from "../gestion-precios/vistas.ts";
import { agregaDesvio } from "../contenido/desvio.ts";
import { vistaPrecio } from "../precio-web.ts";
import type { MotivoAprobacion } from "../mcp/aprobaciones.ts";
import { metaCategoriaDefecto, metaPaginaDefecto, metaProductoDefecto, type TextosMeta } from "./defecto.ts";
import type { DepsSeo } from "./deps.ts";
import {
  camposDe, entradasConTitulo, escribirSeo, gruposTituloRepetido, leerSeoVarios, mismosCampos, versionesSeo, type SeoGuardado,
} from "./repositorio.ts";
import {
  CAMPOS_VACIOS, DESCRIPCION_IDEAL, ETIQUETA_PAGINA, PAGINAS_LEGALES, PAGINAS_SEO, RUTA_PAGINA, TITULO_IDEAL, claveTitulo, claveValida, esPaginaSeo,
  hayTexto, validarSeo, type CamposSeo, type PaginaSeo, type TipoSeo,
} from "./reglas.ts";
import { sugerirCategoria, sugerirPagina, sugerirProducto } from "./sugerencias.ts";

export const MAX_ITEMS_DIRECTO = 5;
export const MAX_ITEMS_MASIVO = 200;
export const TIPO_VISTA_SEO = "seo_masivo";
export const HERRAMIENTA_SEO_DIRECTO = "editar_seo";
export const HERRAMIENTA_SEO_MASIVO = "confirmar_seo";
const TTL_NORMAL_MS = 15 * 60_000;
const TTL_CON_APROBACION_MS = 5 * 3_600_000;

export interface Salida { texto: string; datos: Record<string, unknown> }

export interface CtxSeo {
  db: D1Like;
  usuario: UsuarioGestion;
  ahora: number;
  loteId: string;
  auditar(cambios: Array<{ entidad: string; entidadId: string | number; antes?: unknown; despues?: unknown; herramienta?: string }>): Promise<void>;
}

/** Una entrada pedida por la herramienta. Un campo sin indicar (undefined) queda como está; vacío o null lo borra. */
export interface ItemSeoEntrada {
  tipo: TipoSeo;
  clave: string;
  titulo?: string | null;
  descripcion?: string | null;
  og_titulo?: string | null;
  og_descripcion?: string | null;
  /** Vuelve al texto automático (borra el texto propio). */
  restablecer?: boolean;
}

export const etiquetaEntrada = (tipo: TipoSeo, clave: string): string =>
  tipo === "pagina" && esPaginaSeo(clave) ? `página «${ETIQUETA_PAGINA[clave]}»` : `${tipo} ${clave}`;

const recortar = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** Normaliza la clave: el código del producto se recorta; el slug de categoría va en minúsculas. */
export function normalizarClave(tipo: TipoSeo, clave: string): string {
  const t = clave.trim();
  return tipo === "categoria" ? t.toLowerCase() : t;
}

// ───────── Qué existe y qué genera el código hoy ─────────

interface Entorno {
  /** Fichas por código (todas las de ese código). */
  fichas: Map<string, Array<{ id: number; nombre: string; precio: number; precio_original: number | null; en_oferta: boolean; stock: number | null; solo_cotizar: boolean | null; activo: boolean; categoria_id: number | null; codigo: string | null }>>;
  categorias: Map<string, { id: number; nombre: string; activa: boolean }>;
  totalesCategoria: Map<number, number>;
  local: Awaited<ReturnType<DepsSeo["local"]>> | null;
}

async function cargarEntorno(deps: DepsSeo, items: Array<{ tipo: TipoSeo; clave: string }>): Promise<Entorno> {
  const codigos = [...new Set(items.filter((i) => i.tipo === "producto").map((i) => i.clave))];
  const hayCategoria = items.some((i) => i.tipo === "categoria");
  const paginasLocal = items.some((i) => i.tipo === "pagina" && (i.clave === "nosotros" || i.clave === "contacto" || i.clave === "sucursales"));
  const fichas: Entorno["fichas"] = new Map();
  if (codigos.length > 0) {
    for (let i = 0; i < codigos.length; i += 100) {
      for (const f of await deps.productos.fichasPorCodigos(codigos.slice(i, i + 100))) {
        if (!f.codigo) continue;
        fichas.set(f.codigo, [...(fichas.get(f.codigo) ?? []), f]);
      }
    }
  }
  const categorias: Entorno["categorias"] = new Map();
  const totalesCategoria = new Map<number, number>();
  if (hayCategoria) {
    const lista = await deps.categorias.listar({ incluirInactivas: true });
    for (const c of lista) categorias.set(c.slug, { id: c.id, nombre: c.nombre, activa: c.activa });
    const conteo = await deps.productos.conteoPorCategoria();
    for (const c of lista) {
      const ids = descendientes(c.id, lista);
      totalesCategoria.set(c.id, ids.reduce((s, id) => s + (conteo.get(id) ?? 0), 0));
    }
  }
  return { fichas, categorias, totalesCategoria, local: paginasLocal ? await deps.local() : null };
}

/** Lo que genera hoy el código para esa entrada (aproximado en producto: no cuenta promociones de categoría). */
export function textoPorDefecto(tipo: TipoSeo, clave: string, e: Entorno): TextosMeta | null {
  if (tipo === "pagina" && esPaginaSeo(clave)) return metaPaginaDefecto(clave, e.local ?? undefined);
  if (tipo === "categoria") {
    const c = e.categorias.get(clave);
    return c ? metaCategoriaDefecto({ nombre: c.nombre, total: e.totalesCategoria.get(c.id) ?? 0 }) : null;
  }
  if (tipo === "producto") {
    const lista = e.fichas.get(clave);
    if (!lista || lista.length === 0) return null;
    const f = [...lista].sort((a, b) => Number(b.activo) - Number(a.activo) || a.id - b.id)[0];
    const v = vistaPrecio({ precio: f.precio, precio_original: f.precio_original, en_oferta: f.en_oferta, stock: f.stock, solo_cotizar: f.solo_cotizar });
    return metaProductoDefecto({ nombre: f.nombre, codigo: f.codigo, disponible: v.disponible, precioFinal: v.precioWeb });
  }
  return null;
}

function sugerencia(tipo: TipoSeo, clave: string, e: Entorno, defecto: TextosMeta | null): TextosMeta | null {
  if (tipo === "producto") {
    const f = e.fichas.get(clave)?.[0];
    return f ? sugerirProducto({ nombre: f.nombre, codigo: f.codigo }) : null;
  }
  if (tipo === "categoria") {
    const c = e.categorias.get(clave);
    return c ? sugerirCategoria({ nombre: c.nombre }) : null;
  }
  return defecto && esPaginaSeo(clave) ? sugerirPagina(clave, defecto) : null;
}

// ───────── ver_seo ─────────

export async function verSeo(db: D1Like, deps: DepsSeo, entradas: Array<{ tipo: TipoSeo; clave: string }>): Promise<Salida> {
  const items = entradas.map((e) => ({ tipo: e.tipo, clave: normalizarClave(e.tipo, e.clave) }));
  for (const i of items) if (!claveValida(i.tipo, i.clave)) throw new ErrorGestion(`La clave «${i.clave}» no es válida para ${i.tipo}. ${ayudaClave(i.tipo)}`);
  const entorno = await cargarEntorno(deps, items);
  const propios = new Map<string, Map<string, SeoGuardado>>();
  for (const t of ["producto", "categoria", "pagina"] as const) {
    const claves = items.filter((i) => i.tipo === t).map((i) => i.clave);
    if (claves.length) propios.set(t, await leerSeoVarios(db, t, claves));
  }
  const bloques: string[] = [];
  const datos: Array<Record<string, unknown>> = [];
  for (const { tipo, clave } of items) {
    const defecto = textoPorDefecto(tipo, clave, entorno);
    const propio = propios.get(tipo)?.get(clave) ?? null;
    if (!defecto) {
      bloques.push(`${etiquetaEntrada(tipo, clave)}: no existe en la tienda.`);
      datos.push({ tipo, clave, existe: false });
      continue;
    }
    const efTitulo = propio?.titulo ?? defecto.titulo;
    const efDesc = propio?.descripcion ?? defecto.descripcion;
    const sug = sugerencia(tipo, clave, entorno, defecto);
    const avisos = avisosDe(efTitulo, efDesc);
    const lineas = [
      `${etiquetaEntrada(tipo, clave)} · ${propio ? `texto propio (versión ${propio.version})` : "texto automático (el del código)"}`,
      `  Título (${efTitulo.length}): ${efTitulo}`,
      `  Descripción (${efDesc.length}): ${efDesc}`,
    ];
    if (propio?.ogTitulo || propio?.ogDescripcion) lineas.push(`  Para redes: ${propio.ogTitulo ?? "(automático)"} / ${propio.ogDescripcion ?? "(automático)"}`);
    if (propio) lineas.push(`  El código genera: «${defecto.titulo}» / «${recortar(defecto.descripcion, 200)}»`);
    if (sug) lineas.push(`  Sugerido (${sug.titulo.length}/${sug.descripcion.length}): «${sug.titulo}» / «${sug.descripcion}»`);
    if (tipo === "producto") lineas.push("  (El texto del código incluye el precio de hoy; el sugerido no lleva precio. No se cuentan promociones de categoría.)");
    if (avisos.length) lineas.push(`  Avisos: ${avisos.join(" ")}`);
    bloques.push(lineas.join("\n"));
    datos.push({ tipo, clave, existe: true, textoPropio: !!propio, titulo: efTitulo, descripcion: efDesc, version: propio?.version ?? null });
  }
  return { texto: bloques.join("\n\n"), datos: { entradas: datos } };
}

const ayudaClave = (tipo: TipoSeo) =>
  tipo === "pagina" ? `Páginas: ${PAGINAS_SEO.join(", ")}.` : tipo === "categoria" ? "Usa el slug de la categoría (minúsculas y guiones; mira listar_categorias)." : "Usa el código del producto (mira buscar_productos).";

function avisosDe(titulo: string, descripcion: string): string[] {
  const a: string[] = [];
  if (titulo.length > TITULO_IDEAL) a.push(`El título tiene ${titulo.length} caracteres: Google corta desde ${TITULO_IDEAL}.`);
  if (descripcion.length > DESCRIPCION_IDEAL) a.push(`La descripción tiene ${descripcion.length} caracteres: Google corta desde ${DESCRIPCION_IDEAL}.`);
  if (!descripcion) a.push("Sin descripción.");
  return a;
}

// ───────── plan de cambios (compartido por editar, previsualizar y confirmar) ─────────

export interface CambioSeoPlan {
  tipo: TipoSeo;
  clave: string;
  /** Texto propio que quedaría (null = vuelve al texto automático). */
  nuevo: CamposSeo | null;
  /** Texto propio de hoy (null = no tenía). */
  antes: CamposSeo | null;
  versionAntes: number | null;
  advertencias: string[];
  /** Otras entradas con el mismo título. */
  repetidos: string[];
}

export interface PlanSeo {
  cambios: CambioSeoPlan[];
  sinCambio: string[];
  errores: string[];
  motivos: MotivoAprobacion[];
  huellaBase: unknown;
}

function aCampos(i: ItemSeoEntrada, previo: CamposSeo | null): { errores: string[]; advertencias: string[]; nuevo: CamposSeo | null } {
  if (i.restablecer) {
    if (i.titulo !== undefined || i.descripcion !== undefined || i.og_titulo !== undefined || i.og_descripcion !== undefined) {
      return { errores: ["No mezcles «restablecer» con textos nuevos."], advertencias: [], nuevo: null };
    }
    return { errores: [], advertencias: [], nuevo: null };
  }
  if (i.titulo === undefined && i.descripcion === undefined && i.og_titulo === undefined && i.og_descripcion === undefined) {
    return { errores: ["No indicaste ningún texto que cambiar."], advertencias: [], nuevo: null };
  }
  // Solo se validan los campos que se pidieron; los demás quedan como estaban.
  const v = validarSeo({
    titulo: i.titulo, descripcion: i.descripcion, ogTitulo: i.og_titulo, ogDescripcion: i.og_descripcion,
  });
  const errores = v.errores.filter((e) => !e.startsWith("No hay ningún texto"));
  const base = previo ?? CAMPOS_VACIOS;
  const fusion: CamposSeo = {
    titulo: i.titulo === undefined ? base.titulo : v.valor.titulo,
    descripcion: i.descripcion === undefined ? base.descripcion : v.valor.descripcion,
    ogTitulo: i.og_titulo === undefined ? base.ogTitulo : v.valor.ogTitulo,
    ogDescripcion: i.og_descripcion === undefined ? base.ogDescripcion : v.valor.ogDescripcion,
  };
  return { errores, advertencias: v.advertencias, nuevo: hayTexto(fusion) ? fusion : null };
}

export async function armarPlan(db: D1Like, deps: DepsSeo, items: ItemSeoEntrada[], maximo: number): Promise<PlanSeo> {
  const errores: string[] = [];
  if (items.length === 0) throw new ErrorGestion("No indicaste ninguna entrada.");
  if (items.length > maximo) throw new ErrorGestion(`Máximo ${maximo} entradas por operación; recibí ${items.length}.`);
  const normalizados = items.map((i) => ({ ...i, clave: normalizarClave(i.tipo, i.clave) }));
  const vistos = new Set<string>();
  for (const i of normalizados) {
    const k = `${i.tipo}:${i.clave}`;
    if (!claveValida(i.tipo, i.clave)) errores.push(`${i.tipo} «${i.clave}»: clave no válida. ${ayudaClave(i.tipo)}`);
    else if (vistos.has(k)) errores.push(`${etiquetaEntrada(i.tipo, i.clave)}: aparece repetida en el pedido.`);
    vistos.add(k);
  }
  const entorno = await cargarEntorno(deps, normalizados.filter((i) => claveValida(i.tipo, i.clave)));
  const propios = new Map<string, Map<string, SeoGuardado>>();
  for (const t of ["producto", "categoria", "pagina"] as const) {
    const claves = normalizados.filter((i) => i.tipo === t && claveValida(t, i.clave)).map((i) => i.clave);
    if (claves.length) propios.set(t, await leerSeoVarios(db, t, claves));
  }

  const cambios: CambioSeoPlan[] = [];
  const sinCambio: string[] = [];
  const motivos = new Set<MotivoAprobacion>();
  const titulosEnLote = new Map<string, string[]>();
  for (const i of normalizados) {
    if (!claveValida(i.tipo, i.clave)) continue;
    const etiqueta = etiquetaEntrada(i.tipo, i.clave);
    if (textoPorDefecto(i.tipo, i.clave, entorno) === null) {
      errores.push(`${etiqueta}: no existe en la tienda.`);
      continue;
    }
    const guardado = propios.get(i.tipo)?.get(i.clave) ?? null;
    const previo = guardado ? camposDe(guardado) : null;
    const r = aCampos(i, previo);
    if (r.errores.length) {
      errores.push(...r.errores.map((e) => `${etiqueta}: ${e}`));
      continue;
    }
    if (mismosCampos(previo, r.nuevo)) {
      sinCambio.push(etiqueta);
      continue;
    }
    const advertencias = [...r.advertencias];
    if (i.tipo === "producto" && !(entorno.fichas.get(i.clave) ?? []).some((f) => f.activo)) advertencias.push("Ninguna ficha de este código está activa: el texto no se ve hasta que se active.");
    if (i.tipo === "categoria" && entorno.categorias.get(i.clave)?.activa === false) advertencias.push("La categoría está oculta: el texto no se ve hasta que se active.");
    const repetidos: string[] = [];
    if (r.nuevo?.titulo) {
      for (const o of await entradasConTitulo(db, r.nuevo.titulo, { tipo: i.tipo, clave: i.clave })) repetidos.push(etiquetaEntrada(o.tipo, o.clave));
      const k = claveTitulo(r.nuevo.titulo);
      for (const o of titulosEnLote.get(k) ?? []) repetidos.push(`${o} (en este mismo pedido)`);
      titulosEnLote.set(k, [...(titulosEnLote.get(k) ?? []), etiqueta]);
    }
    if (repetidos.length) advertencias.push(`El título se repite con: ${repetidos.slice(0, 4).join(", ")}${repetidos.length > 4 ? "…" : ""}. Google prefiere un título distinto por página.`);
    if (i.tipo === "pagina" && PAGINAS_LEGALES.has(i.clave)) motivos.add("texto_legal");
    if (r.nuevo && agregaDesvio(previo ?? {}, r.nuevo)) motivos.add("texto_desvio");
    cambios.push({ tipo: i.tipo, clave: i.clave, nuevo: r.nuevo, antes: previo, versionAntes: guardado?.version ?? null, advertencias, repetidos });
  }
  return {
    cambios, sinCambio, errores, motivos: [...motivos],
    huellaBase: cambios.map((c) => ({ t: c.tipo, k: c.clave, n: c.nuevo, a: c.antes, v: c.versionAntes })),
  };
}

const lineaCambio = (c: CambioSeoPlan): string => {
  const n = c.nuevo;
  const que = n === null ? "vuelve al texto automático" : [
    n.titulo !== null ? `título (${n.titulo.length}) «${recortar(n.titulo, 80)}»` : null,
    n.descripcion !== null ? `descripción (${n.descripcion.length}) «${recortar(n.descripcion, 110)}»` : null,
    n.ogTitulo !== null || n.ogDescripcion !== null ? "texto para redes" : null,
  ].filter(Boolean).join("; ");
  return `- ${etiquetaEntrada(c.tipo, c.clave)}: ${que}${c.advertencias.length ? `\n    Avisos: ${c.advertencias.join(" ")}` : ""}`;
};

// ───────── aplicar ─────────

function rutasYFichas(cambios: Array<{ tipo: TipoSeo; clave: string }>): { codigos: string[]; rutas: string[] } {
  const codigos = cambios.filter((c) => c.tipo === "producto").map((c) => c.clave);
  const rutas = new Set<string>();
  for (const c of cambios) {
    if (c.tipo === "categoria") rutas.add(`/categorias/${c.clave}`);
    if (c.tipo === "pagina" && esPaginaSeo(c.clave)) rutas.add(RUTA_PAGINA[c.clave]);
  }
  return { codigos, rutas: [...rutas] };
}

/** Refresca solo lo afectado: las fichas de esos códigos y las rutas de categoría o página. Nunca lanza. */
export async function refrescar(deps: DepsSeo, cambios: Array<{ tipo: TipoSeo; clave: string }>): Promise<void> {
  const { codigos, rutas } = rutasYFichas(cambios);
  try {
    if (codigos.length > 0) {
      const ids: number[] = [];
      for (let i = 0; i < codigos.length; i += 100) for (const f of await deps.productos.fichasPorCodigos(codigos.slice(i, i + 100))) ids.push(f.id);
      await deps.revalidar(ids);
    }
    await deps.revalidarRutas(rutas);
  } catch {
    // Refrescar la tienda nunca debe romper un cambio ya guardado: las páginas se regeneran solas con el tiempo.
  }
}

async function aplicarPlan(deps: DepsSeo, ctx: CtxSeo, herramienta: string, plan: PlanSeo): Promise<number> {
  const aplicados: CambioSeoPlan[] = [];
  const auditoria: Array<{ entidad: string; entidadId: string; antes: unknown; despues: unknown; herramienta: string }> = [];
  try {
    for (const c of plan.cambios) {
      const r = await escribirSeo(ctx.db, ctx.usuario, c.tipo, c.clave, c.nuevo, ctx.ahora, ctx.loteId);
      aplicados.push(c);
      auditoria.push({
        entidad: "seo", entidadId: `${c.tipo}:${c.clave}`, herramienta,
        antes: { campos: r.antes, version: c.versionAntes }, despues: { campos: r.despues, version: r.version },
      });
    }
  } finally {
    // Aunque algo falle a mitad, lo ya escrito queda auditado y refrescado.
    if (auditoria.length > 0) await ctx.auditar(auditoria);
    if (aplicados.length > 0) await refrescar(deps, aplicados);
  }
  return aplicados.length;
}

const resumenAprobacion = (plan: PlanSeo) =>
  `Cambiar el título o la descripción para Google de ${plan.cambios.length} entrada${plan.cambios.length === 1 ? "" : "s"} (${plan.cambios.slice(0, 3).map((c) => etiquetaEntrada(c.tipo, c.clave)).join(", ")}${plan.cambios.length > 3 ? "…" : ""}).`;

const detalleAprobacion = (plan: PlanSeo) => ({
  cambios: plan.cambios.slice(0, 100).map((c) => ({ entrada: etiquetaEntrada(c.tipo, c.clave), antes: c.antes, despues: c.nuevo })),
});

// ───────── editar_seo (directo, hasta 5) ─────────

export async function editarSeo(deps: DepsSeo, ctx: CtxSeo, items: ItemSeoEntrada[]): Promise<Salida> {
  const plan = await armarPlan(ctx.db, deps, items, MAX_ITEMS_DIRECTO);
  if (plan.errores.length > 0) throw new ErrorGestion(`No se cambió nada:\n${plan.errores.map((e) => `- ${e}`).join("\n")}`);
  if (plan.cambios.length === 0) return { texto: `Sin cambios: ${plan.sinCambio.join(", ")} ya estaba${plan.sinCambio.length === 1 ? "" : "n"} así.`, datos: { aplicado: false, sinCambio: plan.sinCambio } };

  let aprobacion: { devolver(): Promise<boolean> } | null = null;
  if (plan.motivos.length > 0) {
    const huella = await huellaDeDatos({ v: 1, h: HERRAMIENTA_SEO_DIRECTO, plan: plan.huellaBase });
    const r = await exigirAprobacion(
      ctx.db, deps.aprobacion,
      { usuario: ctx.usuario, herramienta: HERRAMIENTA_SEO_DIRECTO, motivos: plan.motivos, resumen: resumenAprobacion(plan), detalle: detalleAprobacion(plan), huella },
      ctx.ahora,
    );
    if (r.tipo !== "aprobada") return { texto: r.mensaje, datos: { aplicado: false, estado: r.tipo } };
    if (!(await r.gastar())) throw new ErrorGestion("La aprobación de Jorge ya se había usado. No se cambió nada; vuelve a pedirlo.");
    aprobacion = r;
  }
  try {
    const n = await aplicarPlan(deps, ctx, HERRAMIENTA_SEO_DIRECTO, plan);
    return { texto: textoAplicado(plan, n), datos: { aplicado: true, cambiadas: n, sinCambio: plan.sinCambio } };
  } catch (e) {
    await aprobacion?.devolver().catch(() => false);
    throw e;
  }
}

function textoAplicado(plan: PlanSeo, n: number): string {
  const l = [`Listo: ${n} entrada${n === 1 ? "" : "s"} actualizada${n === 1 ? "" : "s"}. Google lo toma cuando vuelve a leer la página (las páginas afectadas ya se refrescaron).`, ...plan.cambios.map(lineaCambio)];
  if (plan.sinCambio.length) l.push(`Ya estaban así (sin cambio): ${plan.sinCambio.join(", ")}.`);
  l.push("Se puede deshacer desde el historial.");
  return l.join("\n");
}

// ───────── previsualizar_seo / confirmar_seo (masivo) ─────────

interface PayloadSeo { items: ItemSeoEntrada[] }

export async function previsualizarSeo(deps: DepsSeo, ctx: CtxSeo, items: ItemSeoEntrada[]): Promise<Salida> {
  const plan = await armarPlan(ctx.db, deps, items, MAX_ITEMS_MASIVO);
  if (plan.errores.length > 0) {
    const mostrar = plan.errores.slice(0, 25);
    throw new ErrorGestion(`No se creó la vista previa; corrige esto y vuelve a pedirla:\n${mostrar.map((e) => `- ${e}`).join("\n")}${plan.errores.length > mostrar.length ? `\n… y ${plan.errores.length - mostrar.length} más.` : ""}`);
  }
  if (plan.cambios.length === 0) return { texto: `Nada que cambiar: ${plan.sinCambio.length} entrada${plan.sinCambio.length === 1 ? "" : "s"} ya estaba${plan.sinCambio.length === 1 ? "" : "n"} así.`, datos: { cambian: 0 } };
  const huella = await huellaDeDatos({ v: 1, tipo: TIPO_VISTA_SEO, plan: plan.huellaBase });
  const vista = await crearVistaPrevia(
    ctx.db,
    { usuarioId: ctx.usuario.id, tipo: TIPO_VISTA_SEO, payload: { items } satisfies PayloadSeo, huella, ttlMs: plan.motivos.length > 0 ? TTL_CON_APROBACION_MS : TTL_NORMAL_MS },
    ctx.ahora,
  );
  const conAvisos = plan.cambios.filter((c) => c.advertencias.length > 0).length;
  const repetidos = plan.cambios.filter((c) => c.repetidos.length > 0).length;
  const lineas = [
    `Vista previa: ${plan.cambios.length} entrada${plan.cambios.length === 1 ? "" : "s"} cambiarían (${plan.sinCambio.length} ya estaban así). No se cambió nada todavía.`,
    ...plan.cambios.slice(0, 12).map(lineaCambio),
    plan.cambios.length > 12 ? `… y ${plan.cambios.length - 12} más.` : "",
    conAvisos ? `Con avisos: ${conAvisos} (largos o títulos repetidos; no impiden aplicar).` : "Sin avisos de largo ni de títulos repetidos.",
    repetidos ? `Títulos repetidos con otras entradas: ${repetidos}.` : "",
    plan.motivos.length > 0
      ? `Necesita el OK de Jorge: ${textoMotivos(plan.motivos)}. Al confirmar le llega un correo; se aplica cuando apruebe y repitas confirmar_seo con este mismo id.`
      : "No necesita aprobación de Jorge.",
    "Efectos: solo se regeneran las fichas, categorías o páginas afectadas; no se tocan canonical, robots, slugs ni URL.",
    `Para aplicar: confirmar_seo con vista_previa_id "${vista.id}".`,
  ].filter(Boolean);
  return {
    texto: lineas.join("\n"),
    datos: { vista_previa_id: vista.id, expira_en: vista.expiraEn, cambian: plan.cambios.length, sinCambio: plan.sinCambio.length, conAvisos, requiere_aprobacion: plan.motivos.length > 0 },
  };
}

export async function confirmarSeo(deps: DepsSeo, ctx: CtxSeo, args: { vista_previa_id: string }): Promise<Salida> {
  const mirada = await mirarVistaPrevia(ctx.db, { id: args.vista_previa_id, usuarioId: ctx.usuario.id, tipo: TIPO_VISTA_SEO }, ctx.ahora);
  if (!mirada.ok) throw new ErrorGestion(MENSAJE_VISTA[mirada.motivo]);
  const payload = mirada.payload as PayloadSeo | null;
  if (!payload || !Array.isArray(payload.items)) throw new ErrorGestion("La vista previa está dañada. Genera una nueva.");
  const plan = await armarPlan(ctx.db, deps, payload.items, MAX_ITEMS_MASIVO);
  const huellaActual = await huellaDeDatos({ v: 1, tipo: TIPO_VISTA_SEO, plan: plan.huellaBase });
  if (plan.errores.length > 0 || huellaActual !== mirada.huella) throw new ErrorGestion(MENSAJE_VISTA.huella_cambiada);

  let aprobacion: { devolver(): Promise<boolean> } | null = null;
  if (plan.motivos.length > 0) {
    const huella = await huellaDeDatos({ v: 1, h: HERRAMIENTA_SEO_MASIVO, vista: mirada.id, plan: plan.huellaBase });
    const r = await exigirAprobacion(
      ctx.db, deps.aprobacion,
      { usuario: ctx.usuario, herramienta: HERRAMIENTA_SEO_MASIVO, motivos: plan.motivos, resumen: resumenAprobacion(plan), detalle: detalleAprobacion(plan), huella },
      ctx.ahora,
    );
    if (r.tipo !== "aprobada") return { texto: r.mensaje, datos: { aplicado: false, estado: r.tipo } };
    if (!(await r.gastar())) throw new ErrorGestion("La aprobación de Jorge ya se había usado. Genera una vista previa nueva.");
    aprobacion = r;
  }
  const consumo = await consumirVistaPrevia(ctx.db, { id: mirada.id, usuarioId: ctx.usuario.id, tipo: TIPO_VISTA_SEO, huellaActual }, ctx.ahora);
  if (!consumo.ok) {
    await aprobacion?.devolver().catch(() => false);
    throw new ErrorGestion(MENSAJE_VISTA[consumo.motivo]);
  }
  try {
    const n = await aplicarPlan(deps, ctx, HERRAMIENTA_SEO_MASIVO, plan);
    return { texto: textoAplicado(plan, n), datos: { aplicado: true, cambiadas: n } };
  } catch (e) {
    await aprobacion?.devolver().catch(() => false);
    throw e;
  }
}

// ───────── deshacer ─────────

export type ResultadoRevertir = { ok: true; mensaje?: string } | { ok: false; mensaje: string };

interface DatoAuditoriaSeo { campos: CamposSeo | null; version: number | null }

const comoDato = (x: unknown): DatoAuditoriaSeo | null => {
  if (!x || typeof x !== "object") return null;
  const o = x as { campos?: unknown; version?: unknown };
  const c = o.campos;
  const campos = c && typeof c === "object" ? camposDe(c as CamposSeo) : null;
  return { campos, version: typeof o.version === "number" ? o.version : null };
};

/** Deshace entradas de `editar_seo` / `confirmar_seo`: restaura `antes` solo si el texto sigue como lo dejó la herramienta. */
export async function revertirSeo(deps: DepsSeo, p: { db: D1Like; usuario: UsuarioGestion; ahora: number; entradas: EntradaAuditoria[]; loteId?: string | null }): Promise<ResultadoRevertir> {
  let restauradas = 0;
  let yaEstaba = 0;
  const saltadas: string[] = [];
  const tocadas: Array<{ tipo: TipoSeo; clave: string }> = [];
  for (const e of p.entradas) {
    const m = /^(producto|categoria|pagina):(.+)$/.exec(e.entidadId);
    if (!m) continue;
    const tipo = m[1] as TipoSeo;
    const clave = m[2];
    const antes = comoDato(e.antes);
    const despues = comoDato(e.despues);
    if (!antes || !despues) { saltadas.push(`${tipo} ${clave} (registro dañado)`); continue; }
    const actual = (await leerSeoVarios(p.db, tipo, [clave])).get(clave) ?? null;
    if (mismosCampos(actual, antes.campos)) { yaEstaba++; continue; }
    if (!mismosCampos(actual, despues.campos)) { saltadas.push(etiquetaEntrada(tipo, clave)); continue; }
    await escribirSeo(p.db, p.usuario, tipo, clave, antes.campos, p.ahora, p.loteId ?? null);
    tocadas.push({ tipo, clave });
    restauradas++;
  }
  if (tocadas.length > 0) await refrescar(deps, tocadas);
  const partes = [`${restauradas} restaurada${restauradas === 1 ? "" : "s"}`];
  if (yaEstaba) partes.push(`${yaEstaba} ya estaba${yaEstaba === 1 ? "" : "n"} como antes`);
  if (saltadas.length) partes.push(`no toqué ${saltadas.length} porque alguien las cambió después: ${saltadas.slice(0, 5).join(", ")}`);
  if (restauradas === 0 && yaEstaba === 0) return { ok: false, mensaje: `No se pudo deshacer: ${partes.join("; ")}.` };
  return { ok: true, mensaje: `${partes.join("; ")}.` };
}

// ───────── auditar_seo ─────────

export interface OpcionesAuditoria { alcance: "producto" | "categoria" | "pagina" | "guia" | "repetidos"; pagina: number; porPagina: number }

export async function auditarSeo(db: D1Like, deps: DepsSeo, o: OpcionesAuditoria, guias: Array<{ slug: string; titulo: string; descripcionMeta: string }> = []): Promise<Salida> {
  const lineas: string[] = [];
  const datos: Record<string, unknown> = { alcance: o.alcance };

  if (o.alcance === "repetidos") {
    const grupos = await gruposTituloRepetido(db, 25);
    lineas.push(grupos.length ? `Títulos propios repetidos: ${grupos.length} grupo${grupos.length === 1 ? "" : "s"}.` : "No hay títulos propios repetidos.");
    for (const g of grupos) lineas.push(`- «${recortar(g.titulo, 70)}»: ${g.entradas.map((e) => etiquetaEntrada(e.tipo, e.clave)).join(", ")}`);
    lineas.push("(Solo se comparan los textos propios; los automáticos llevan el nombre y el código del producto, así que casi nunca se repiten.)");
    datos.grupos = grupos.length;
    return { texto: lineas.join("\n"), datos };
  }

  if (o.alcance === "pagina") {
    const entradas = PAGINAS_SEO.map((id) => ({ tipo: "pagina" as const, clave: id }));
    const entorno = await cargarEntorno(deps, entradas);
    const propios = await leerSeoVarios(db, "pagina", [...PAGINAS_SEO]);
    return resumenLista("Páginas", entradas.map(({ clave }) => {
      const d = textoPorDefecto("pagina", clave, entorno)!;
      const p = propios.get(clave);
      return { etiqueta: ETIQUETA_PAGINA[clave as PaginaSeo], propio: !!p, titulo: p?.titulo ?? d.titulo, descripcion: p?.descripcion ?? d.descripcion, propioTitulo: !!p?.titulo, propioDesc: !!p?.descripcion };
    }), datos);
  }

  if (o.alcance === "categoria") {
    const lista = await deps.categorias.listar({ incluirInactivas: false });
    const entradas = lista.map((c) => ({ tipo: "categoria" as const, clave: c.slug }));
    const entorno = await cargarEntorno(deps, entradas);
    const propios = await leerSeoVarios(db, "categoria", entradas.map((e) => e.clave));
    const filas = lista.slice((o.pagina - 1) * o.porPagina, o.pagina * o.porPagina).map((c) => {
      const d = textoPorDefecto("categoria", c.slug, entorno)!;
      const p = propios.get(c.slug);
      return { etiqueta: `categoría ${c.slug}`, propio: !!p, titulo: p?.titulo ?? d.titulo, descripcion: p?.descripcion ?? d.descripcion, propioTitulo: !!p?.titulo, propioDesc: !!p?.descripcion };
    });
    datos.total = lista.length;
    return resumenLista(`Categorías activas (${lista.length}, página ${o.pagina})`, filas, datos, o.pagina * o.porPagina < lista.length ? o.pagina + 1 : null);
  }

  if (o.alcance === "guia") {
    const filas = guias.map((g) => ({ etiqueta: `guía ${g.slug}`, propio: true, titulo: `${g.titulo} · Barraca JURMAQ`, descripcion: g.descripcionMeta, propioTitulo: true, propioDesc: true }));
    return resumenLista(`Guías (${filas.length})`, filas, datos);
  }

  // Productos: fichas activas por lote, agrupadas por código.
  const { filas: fichas, total } = await deps.productos.buscar({ estado: "activo", pagina: o.pagina, porPagina: o.porPagina });
  const porCodigo = new Map<string, (typeof fichas)[number]>();
  for (const f of fichas) if (f.codigo && !porCodigo.has(f.codigo)) porCodigo.set(f.codigo, f);
  const propios = await leerSeoVarios(db, "producto", [...porCodigo.keys()]);
  const filasP = [...porCodigo.values()].map((f) => {
    const v = vistaPrecio({ precio: f.precio, precio_original: f.precio_original, en_oferta: f.en_oferta, stock: f.stock, solo_cotizar: f.solo_cotizar });
    const d = metaProductoDefecto({ nombre: f.nombre, codigo: f.codigo, disponible: v.disponible, precioFinal: v.precioWeb });
    const p = propios.get(f.codigo!);
    return { etiqueta: `producto ${f.codigo}`, propio: !!p, titulo: p?.titulo ?? d.titulo, descripcion: p?.descripcion ?? d.descripcion, propioTitulo: !!p?.titulo, propioDesc: !!p?.descripcion };
  });
  datos.fichasTotal = total;
  const hayMas = o.pagina * o.porPagina < total;
  return resumenLista(`Productos activos (lote ${o.pagina}, ${fichas.length} fichas de ${total}; los códigos repetidos cuentan una vez)`, filasP, datos, hayMas ? o.pagina + 1 : null);
}

interface FilaAuditoria { etiqueta: string; propio: boolean; titulo: string; descripcion: string; propioTitulo: boolean; propioDesc: boolean }

function resumenLista(titulo: string, filas: FilaAuditoria[], datos: Record<string, unknown>, siguiente: number | null = null): Salida {
  const sinTitulo = filas.filter((f) => !f.propioTitulo);
  const sinDesc = filas.filter((f) => !f.propioDesc);
  const tituloLargo = filas.filter((f) => f.titulo.length > TITULO_IDEAL);
  const descLarga = filas.filter((f) => f.descripcion.length > DESCRIPCION_IDEAL);
  const descVacia = filas.filter((f) => f.descripcion.trim() === "");
  const ej = (xs: FilaAuditoria[], n = 8) => `${xs.slice(0, n).map((f) => f.etiqueta.replace(/^producto |^categoría |^guía /, "")).join(", ")}${xs.length > n ? ", …" : ""}`;
  const lineas = [
    `${titulo}:`,
    `- Sin título propio (usa el automático): ${sinTitulo.length}${sinTitulo.length ? ` (${ej(sinTitulo)})` : ""}`,
    `- Sin descripción propia (usa la automática): ${sinDesc.length}`,
    `- Título de más de ${TITULO_IDEAL} caracteres: ${tituloLargo.length}${tituloLargo.length ? ` (${ej(tituloLargo)})` : ""}`,
    `- Descripción de más de ${DESCRIPCION_IDEAL} caracteres: ${descLarga.length}${descLarga.length ? ` (${ej(descLarga)})` : ""}`,
    `- Descripción vacía: ${descVacia.length}${descVacia.length ? ` (${ej(descVacia)})` : ""}`,
    siguiente ? `Hay más: repite con pagina ${siguiente}.` : "Es el último lote.",
    "Para ver títulos propios repetidos usa alcance «repetidos». Para corregir, mira ver_seo (trae un texto sugerido) y usa editar_seo.",
  ];
  Object.assign(datos, { revisadas: filas.length, sinTituloPropio: sinTitulo.length, sinDescripcionPropia: sinDesc.length, tituloLargo: tituloLargo.length, descripcionLarga: descLarga.length, descripcionVacia: descVacia.length, siguientePagina: siguiente });
  return { texto: lineas.join("\n"), datos };
}

export { versionesSeo };
