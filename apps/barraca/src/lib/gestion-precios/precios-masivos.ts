/**
 * Precios masivos en DOS pasos.
 *   previsualizarPrecios: calcula, no escribe en la tienda; guarda una vista previa
 *     de un solo uso (ligada al usuario, con huella de los datos) y devuelve el resumen.
 *   confirmarPrecios: gasta la vista previa, pasa por el centro de reglas
 *     (evaluarCambioPrecios) y, si Jorge debe aprobar, queda pendiente; si no,
 *     aplica con auditoría y refresca la tienda.
 * Todo el dinero se calcula aquí, en servidor (modelo.ts / plan.ts).
 */
import { consumirVistaPrevia, crearVistaPrevia } from "../gestion/index.ts";
import type { CtxGestion, DepsGestion } from "./deps.ts";
import { exigirAprobacion, textoMotivos } from "./aprobacion.ts";
import { aplicarCambiosPrecio, auditoriaDePrecios } from "./aplicar.ts";
import { type FichaProducto, estadoDe, pesos, precioLocalDe, precioWebDe } from "./modelo.ts";
import {
  type CambioFicha, type ItemLista, type PlanPrecios, type ResumenPlan, compactar, descompactar, huellaDeCambios, planificarDescuentoWeb,
  planificarLista, planificarReajuste, porcentajeABp, resumirPlan,
} from "./plan.ts";
import { type CambioEvaluable, evaluarCambioPrecios, registrarCambioAplicado } from "./reglas.ts";
import { MENSAJE_VISTA, mirarVistaPrevia } from "./vistas.ts";

export const TIPO_VISTA_PRECIOS = "precios_masivos";
export const HERRAMIENTA_PRECIOS = "confirmar_precios";
/** Tope de fichas por operación: cada ficha es una escritura a Supabase. Más que esto se divide en partes. */
export const MAX_FICHAS_POR_OPERACION = 1200;
const TTL_NORMAL_MS = 15 * 60_000;
const TTL_CON_APROBACION_MS = 5 * 3_600_000;

export class ErrorGestion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorGestion";
  }
}

export interface EntradaPreviaPrecios {
  por: "lista" | "porcentaje" | "categoria";
  items?: ItemLista[];
  codigos?: string[];
  categoria_id?: number;
  incluir_subcategorias?: boolean;
  descuento_web_pct?: number;
  reajuste_pct?: number;
}

export interface Salida {
  texto: string;
  datos: Record<string, unknown>;
}

// ───────── utilidades compartidas ─────────
export function evaluables(cambios: CambioFicha[]): CambioEvaluable[] {
  return cambios.map((c) => ({
    clave: c.codigo || `id:${c.id}`,
    precioAntes: precioWebDe(c.antes),
    precioDespues: precioWebDe(c.despues),
    localAntes: precioLocalDe(c.antes),
    localDespues: precioLocalDe(c.despues),
    costo: c.costo,
  }));
}

/** Ids de la categoría y de todas sus subcategorías. */
export function descendientes(raiz: number, filas: Array<{ id: number; padre_id: number | null }>): number[] {
  const hijos = new Map<number, number[]>();
  for (const f of filas) if (f.padre_id !== null) hijos.set(f.padre_id, [...(hijos.get(f.padre_id) ?? []), f.id]);
  const out = [raiz];
  for (let i = 0; i < out.length; i++) for (const h of hijos.get(out[i]) ?? []) if (!out.includes(h)) out.push(h);
  return out;
}

function unicasPorId(fichas: FichaProducto[]): FichaProducto[] {
  return [...new Map(fichas.map((f) => [f.id, f])).values()];
}

// ───────── paso 1: vista previa ─────────
export async function construirPlanPrecios(deps: DepsGestion, e: EntradaPreviaPrecios): Promise<PlanPrecios> {
  if (e.por === "lista") {
    const items = e.items ?? [];
    if (items.length === 0) throw new ErrorGestion("Falta la lista de productos (items).");
    const codigos = items.map((i) => i.codigo?.trim()).filter((c): c is string => !!c);
    const ids = items.filter((i) => !i.codigo?.trim() && i.id !== undefined).map((i) => i.id as number);
    const fichas = unicasPorId([...(await deps.productos.fichasPorCodigos(codigos)), ...(await deps.productos.fichasPorIds(ids))]);
    // Un id de una ficha con código trae también las demás fichas de ese código.
    const codigosDeIds = [...new Set(fichas.filter((f) => ids.includes(f.id) && f.codigo).map((f) => f.codigo as string))].filter((c) => !codigos.includes(c));
    const extra = codigosDeIds.length ? await deps.productos.fichasPorCodigos(codigosDeIds) : [];
    return planificarLista(items, unicasPorId([...fichas, ...extra]));
  }

  if (e.por === "porcentaje") {
    const codigos = [...new Set((e.codigos ?? []).map((c) => c.trim()).filter(Boolean))];
    if (codigos.length === 0) throw new ErrorGestion("Falta la lista de códigos (codigos).");
    const bp = bpDescuento(e.descuento_web_pct);
    return planificarDescuentoWeb(await deps.productos.fichasPorCodigos(codigos), bp, codigos);
  }

  // categoria
  if (!Number.isInteger(e.categoria_id)) throw new ErrorGestion("Falta la categoría (categoria_id).");
  const tieneDescuento = e.descuento_web_pct !== undefined;
  const tieneReajuste = e.reajuste_pct !== undefined;
  if (tieneDescuento === tieneReajuste) throw new ErrorGestion("Indica una sola cosa: descuento_web_pct (precio web = local menos X %) o reajuste_pct (subir o bajar local y web X %).");
  const todas = await deps.categorias.listar({ incluirInactivas: true });
  if (!todas.some((c) => c.id === e.categoria_id)) throw new ErrorGestion("No encontré esa categoría. Mira las ids con listar_categorias.");
  const ids = e.incluir_subcategorias === false ? [e.categoria_id as number] : descendientes(e.categoria_id as number, todas);
  const fichas = await deps.productos.fichasPorCategorias(ids, { soloActivas: true, tope: MAX_FICHAS_POR_OPERACION + 1 });
  if (fichas.length === 0) throw new ErrorGestion("Esa categoría no tiene productos activos.");
  if (fichas.length > MAX_FICHAS_POR_OPERACION) throw new ErrorGestion(`La categoría tiene más de ${MAX_FICHAS_POR_OPERACION} productos activos; hazlo por subcategorías o por lista de códigos.`);
  if (tieneDescuento) return planificarDescuentoWeb(fichas, bpDescuento(e.descuento_web_pct));
  const bp = porcentajeABp(e.reajuste_pct as number);
  if (bp === null || bp === 0 || bp < -9000 || bp > 20000) throw new ErrorGestion("reajuste_pct debe estar entre -90 y 200, con hasta 2 decimales, y no ser 0.");
  return planificarReajuste(fichas, bp);
}

function bpDescuento(pct: number | undefined): number {
  const bp = pct === undefined ? null : porcentajeABp(pct);
  if (bp === null || bp < 1 || bp > 5000) throw new ErrorGestion("descuento_web_pct debe estar entre 0,01 y 50, con hasta 2 decimales.");
  return bp;
}

export async function previsualizarPrecios(deps: DepsGestion, ctx: CtxGestion, entrada: EntradaPreviaPrecios): Promise<Salida> {
  const plan = await construirPlanPrecios(deps, entrada);
  const resumen = resumirPlan(plan);

  if (plan.cambios.length === 0) {
    return {
      texto: `No hay nada que cambiar. ${plan.formula}\n${textoPendientes(resumen)}`.trim(),
      datos: { cambia: false, resumen, formula: plan.formula },
    };
  }
  if (plan.cambios.length > MAX_FICHAS_POR_OPERACION) {
    throw new ErrorGestion(`Son ${plan.cambios.length} fichas: el máximo por vez es ${MAX_FICHAS_POR_OPERACION}. Divide el cambio en partes (por categoría o en listas más cortas).`);
  }

  const eval_ = await evaluarCambioPrecios(ctx.db, { usuarioId: ctx.usuario.id, cambios: evaluables(plan.cambios), ahora: ctx.ahora });
  const huella = await huellaDeCambios(plan.cambios);
  const vista = await crearVistaPrevia(
    ctx.db,
    {
      usuarioId: ctx.usuario.id,
      tipo: TIPO_VISTA_PRECIOS,
      huella,
      ttlMs: eval_.requiere ? TTL_CON_APROBACION_MS : TTL_NORMAL_MS,
      payload: { v: 1, metodo: plan.metodo, formula: plan.formula, cambios: compactar(plan.cambios), requiere: eval_.requiere, motivos: eval_.motivos },
    },
    ctx.ahora,
  );

  const efectos = [
    `Se actualizan ${resumen.fichasQueCambian} fichas de la tienda (${resumen.productosQueCambian} productos); las páginas se refrescan en unos minutos.`,
    "No se envían correos ni avisos a clientes.",
  ];
  const lineas = [
    `Vista previa de precios. Id: ${vista.id} (sirve una sola vez; vence en ${eval_.requiere ? "5 horas" : "15 minutos"}).`,
    `Fórmula: ${plan.formula}`,
    `Cambian ${resumen.productosQueCambian} productos (${resumen.fichasQueCambian} fichas). Quedan igual: ${resumen.sinCambio}.`,
    ...textoCambios(resumen),
    ...textoPendientes(resumen).split("\n").filter(Boolean),
    ...efectos,
    eval_.requiere
      ? `Necesita el OK de Jorge: ${textoMotivos(eval_.motivos)}. Al confirmar le llega un correo; se aplica cuando apruebe y repitas confirmar_precios con este mismo id.`
      : "No necesita aprobación de Jorge.",
    `Para aplicar: confirmar_precios con vista_previa_id "${vista.id}".`,
  ];
  return {
    texto: lineas.join("\n"),
    datos: {
      vista_previa_id: vista.id,
      expira_en: vista.expiraEn,
      formula: plan.formula,
      requiere_aprobacion: eval_.requiere,
      motivos: eval_.motivosTexto,
      resumen,
      efectos,
    },
  };
}

function textoCambios(r: ResumenPlan): string[] {
  const out: string[] = [];
  const fila = (l: { codigo: string; nombre: string; antes: number; despues: number; pct: number }) =>
    `  ${l.codigo} ${recortar(l.nombre, 40)}: ${pesos(l.antes)} → ${pesos(l.despues)} (${l.pct > 0 ? "+" : ""}${l.pct.toString().replace(".", ",")} %)`;
  if (r.mayoresSubidas.length) out.push("Mayores subidas (precio web):", ...r.mayoresSubidas.slice(0, 5).map(fila));
  if (r.mayoresBajadas.length) out.push("Mayores bajadas (precio web):", ...r.mayoresBajadas.slice(0, 5).map(fila));
  const margen = (titulo: string, g: { total: number; ejemplos: Array<{ codigo: string; nombre: string; costo: number; precioWeb: number }> }) => {
    if (g.total === 0) return;
    out.push(`${titulo}: ${g.total}.`, ...g.ejemplos.slice(0, 5).map((l) => `  ${l.codigo} ${recortar(l.nombre, 40)}: costo ${pesos(l.costo)}, precio web ${pesos(l.precioWeb)}`));
  };
  margen("QUEDAN BAJO EL COSTO", r.bajoCosto);
  margen("Quedan con menos de 15 % sobre el costo", r.menos15);
  if (r.sinTachadoVisible > 0) out.push(`${r.sinTachadoVisible} productos quedan con ahorro menor a 5 %: la tienda no muestra el precio normal tachado en esos.`);
  if (r.codigosDesparejos > 0) out.push(`Aviso: ${r.codigosDesparejos} códigos tienen fichas con precios distintos entre sí; cada ficha se calcula con su propio precio.`);
  return out;
}

function textoPendientes(r: ResumenPlan): string {
  const out: string[] = [];
  if (r.noEncontrados.total) out.push(`No encontrados (${r.noEncontrados.total}): ${r.noEncontrados.ejemplos.join(", ")}${r.noEncontrados.total > r.noEncontrados.ejemplos.length ? ", …" : ""}.`);
  if (r.invalidos.total) out.push(`Filas no válidas (${r.invalidos.total}, no se tocan): ${r.invalidos.ejemplos.slice(0, 8).map((i) => `${i.referencia} (${i.motivo})`).join("; ")}${r.invalidos.total > 8 ? "; …" : ""}`);
  return out.join("\n");
}

const recortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ───────── paso 2: confirmar ─────────
export async function confirmarPrecios(deps: DepsGestion, ctx: CtxGestion, entrada: { vista_previa_id: string }): Promise<Salida> {
  const { db, usuario, ahora } = ctx;
  const vista = await mirarVistaPrevia(db, { id: entrada.vista_previa_id, usuarioId: usuario.id, tipo: TIPO_VISTA_PRECIOS }, ahora);
  if (!vista.ok) throw new ErrorGestion(MENSAJE_VISTA[vista.motivo]);
  const payload = vista.payload as { cambios?: unknown } | null;
  const plan = descompactar(payload?.cambios);
  if (!plan || plan.length === 0 || !vista.huella) throw new ErrorGestion("La vista previa está dañada. Genera una nueva.");

  // Estado de AHORA: si algo cambió desde la vista previa, se rechaza.
  const fichas = await deps.productos.fichasPorIds(plan.map((c) => c.id));
  const porId = new Map(fichas.map((f) => [f.id, f]));
  const huellaActual = await huellaDeCambios(plan.map((c) => {
    const f = porId.get(c.id);
    return { id: c.id, antes: f ? estadoDe(f) : { precio: -1, precio_original: null, en_oferta: false }, despues: c.despues };
  }));
  if (huellaActual !== vista.huella) throw new ErrorGestion(MENSAJE_VISTA.huella_cambiada);

  const cambios: CambioFicha[] = plan.map((c) => {
    const f = porId.get(c.id) as FichaProducto;
    return { id: c.id, codigo: f.codigo?.trim() ?? "", nombre: f.nombre, antes: c.antes, despues: c.despues, costo: f.costo ?? null };
  });

  // Centro de reglas: bajo costo, 15 %, 300 productos, 30 %, acumulado de 24 h.
  const ev = await evaluarCambioPrecios(db, { usuarioId: usuario.id, cambios: evaluables(cambios), ahora });
  let aprobacionGastar: (() => Promise<boolean>) | null = null;
  if (ev.requiere) {
    const resumen = resumirPlan({ metodo: "lista", formula: (vista.payload as { formula?: string }).formula ?? "", cambios, sinCambio: 0, noEncontrados: [], invalidos: [], fichasRevisadas: cambios.length, codigosDesparejos: 0 });
    const r = await exigirAprobacion(db, deps.aprobacion, {
      usuario,
      herramienta: HERRAMIENTA_PRECIOS,
      motivos: ev.motivos,
      resumen: `Cambiar precios de ${resumen.productosQueCambian} productos (${resumen.fichasQueCambian} fichas). ${(vista.payload as { formula?: string }).formula ?? ""}`.trim(),
      detalle: { motivos: ev.motivosTexto, subidas: resumen.mayoresSubidas.slice(0, 5), bajadas: resumen.mayoresBajadas.slice(0, 5), bajoCosto: resumen.bajoCosto, menos15: resumen.menos15 },
      huella: vista.huella,
    }, ahora);
    if (r.tipo !== "aprobada") {
      return { texto: r.mensaje, datos: { aplicado: false, estado: r.tipo, motivos: ev.motivosTexto } };
    }
    aprobacionGastar = r.gastar;
  }

  // Gasta la vista previa (atómico, una sola vez) y recién entonces la aprobación.
  const consumo = await consumirVistaPrevia(db, { id: vista.id, usuarioId: usuario.id, tipo: TIPO_VISTA_PRECIOS, huellaActual }, ahora);
  if (!consumo.ok) throw new ErrorGestion(consumo.motivo === "huella_cambiada" ? MENSAJE_VISTA.huella_cambiada : MENSAJE_VISTA[consumo.motivo]);
  if (aprobacionGastar && !(await aprobacionGastar())) throw new ErrorGestion("La aprobación de Jorge ya se había usado. No se aplicó nada; genera una vista previa nueva.");

  const res = await aplicarCambiosPrecio(deps.productos, cambios, porId, { ahora });
  if (res.aplicados.length > 0) {
    await ctx.auditar(auditoriaDePrecios(res.aplicados, res.ofertaFinLimpiada));
    await registrarCambioAplicado(db, usuario.id, evaluables(res.aplicados), { aprobado: ev.requiere, ahora });
    await deps.revalidar(res.aplicados.map((c) => c.id));
  }

  const ajenos = res.fallidos.filter((f) => f.motivo === "cambio_ajeno");
  const errores = res.fallidos.filter((f) => f.motivo === "error");
  const productos = new Set(res.aplicados.map((c) => c.codigo || c.id)).size;
  const partes = [`Listo: ${res.aplicados.length} fichas actualizadas (${productos} productos).${ev.requiere ? " Estaba aprobado por Jorge." : ""}`];
  if (ajenos.length) partes.push(`${ajenos.length} fichas no se tocaron porque alguien cambió su precio justo ahora (${ajenos.slice(0, 8).map((f) => f.codigo || f.id).join(", ")}).`);
  if (errores.length) partes.push(`${errores.length} fichas fallaron por un error; revisa y repite con una vista previa nueva (${errores.slice(0, 8).map((f) => f.codigo || f.id).join(", ")}).`);
  partes.push("Queda registrado y se puede deshacer desde Administración > Conexiones.");
  return {
    texto: partes.join(" "),
    datos: { aplicado: res.aplicados.length > 0, fichas: res.aplicados.length, productos, no_aplicadas: res.fallidos.length, lote_id: ctx.loteId },
  };
}

