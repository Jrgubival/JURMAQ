/**
 * OFERTAS CON VIGENCIA: un precio de oferta por código que empieza y termina
 * solo (cron de 30 minutos), con los precios de antes guardados para devolverlos.
 *
 * Qué hace una oferta con las fichas de un código:
 *   al empezar : precio web = precio de oferta; precio local (tachado) = el local
 *                de hoy; en_oferta = true. Se guarda cómo estaba cada ficha ANTES
 *                y cómo quedó (tabla `ofertas`, columnas antes / aplicado).
 *   al terminar: cada ficha que SIGUE como la dejó la oferta vuelve a como estaba.
 *                Si alguien la cambió entre medio, NO se pisa y queda un aviso
 *                (columna `aviso`, visible en ver_ofertas y en la auditoría).
 * No se escribe `oferta_fin` en las fichas: el "expirar" manual antiguo
 * (/api/promociones/import?mode=expire) revertiría mal (usa la otra convención
 * de columnas). La fecha de fin vive aquí.
 *
 * A prueba de dobles ejecuciones: cada paso "reclama" la oferta con un UPDATE
 * atómico (programada → activando → activa → terminando → terminada). Una
 * segunda corrida del cron no reclama nada. Si una corrida se cae a la mitad,
 * la reclamación vence a los 10 minutos y otra corrida retoma desde la foto
 * guardada (los pasos se pueden repetir sin daño).
 */
import { parseFecha } from "../contenido/fechas.ts";
import { type D1Like, type EntradaAuditoria, consumirVistaPrevia, crearVistaPrevia, nuevoLoteId, registrarLote } from "../gestion/index.ts";
import { desdeJson, huellaDeDatos, idUuid } from "../gestion/util.ts";
import { registrarAvisoOfertaBloqueada } from "../mcp/aviso-operacion.ts";
import { exigirAprobacion, textoMotivos } from "./aprobacion.ts";
import type { CtxGestion, DepsGestion } from "./deps.ts";
import {
  type EstadoPrecio, type FichaProducto, agruparPorCodigo, clasificarMargen, construirEstado, esPesosValido, estadoDe, mismoEstado,
  pesos, precioBajoLocal, precioLocalDe, precioWebDe, porcentajeABp,
} from "./modelo.ts";
import { ErrorGestion, type Salida } from "./precios-masivos.ts";
import { type CambioEvaluable, evaluarCambioPrecios, registrarCambioAplicado } from "./reglas.ts";
import { incumplimientosTopes } from "./topes.ts";
import { MENSAJE_VISTA, mirarVistaPrevia } from "./vistas.ts";

export const TIPO_VISTA_OFERTAS = "ofertas_masivas";
export const HERRAMIENTA_OFERTAS = "programar_oferta";
const HERRAMIENTA_AUTO = "ofertas_automatico";
/** Más de esto se hace en dos pasos (vista previa y confirmar). */
export const MAX_OFERTAS_DIRECTAS = 5;
export const MAX_OFERTAS_POR_LLAMADA = 300;
export const RECLAMO_VENCE_MS = 10 * 60_000;
const MAX_DURACION_MS = 366 * 86_400_000;
const POR_CORRIDA = 25;

export type EstadoOferta = "programada" | "activando" | "activa" | "terminando" | "terminada" | "cancelada" | "omitida";
const VIGENTES: EstadoOferta[] = ["programada", "activando", "activa", "terminando"];

export interface FilaOferta {
  id: string;
  grupo_id: string;
  codigo: string;
  precio_oferta: number;
  inicio_en: number;
  fin_en: number;
  estado: EstadoOferta;
  aprobada: number;
  reclamada_en: number | null;
  antes: string | null;
  aplicado: string | null;
  aviso: string | null;
  nota: string | null;
  usuario_id: string;
  usuario_email: string | null;
  creado_en: number;
  activada_en: number | null;
  terminada_en: number | null;
}

type Foto = Array<EstadoPrecio & { id: number }>;

const chile = (ms: number) => new Date(ms).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" });
const foto = (json: string | null): Foto | null => {
  const x = desdeJson<Foto>(json);
  return Array.isArray(x) ? x : null;
};

// ═════════════ planificar una programación ═════════════
export interface EntradaOferta {
  productos?: Array<{ codigo: string; precio_oferta: number }>;
  codigos?: string[];
  descuento_pct?: number;
  inicio?: string;
  fin: string;
  nota?: string;
  modo?: "previsualizar" | "confirmar";
  vista_previa_id?: string;
}

interface ItemOferta {
  codigo: string;
  precioOferta: number;
  fichas: FichaProducto[];
  /** Descuento sobre el precio web actual más bajo del código. */
  descuentoPct: number;
}

export interface PlanOfertas {
  items: ItemOferta[];
  inicio: number;
  fin: number;
  nota: string | null;
  noEncontrados: string[];
  invalidos: Array<{ referencia: string; motivo: string }>;
}

interface Ventana {
  inicio: number;
  fin: number;
}

export function leerVentana(e: { inicio?: string; fin: string }, ahora: number): Ventana {
  const inicio = e.inicio ? parseFecha(e.inicio) : ahora;
  if (inicio === null) throw new ErrorGestion('La fecha de inicio no es válida. Usa AAAA-MM-DDTHH:MM en hora de Chile (por ejemplo "2026-12-01T09:00").');
  const fin = parseFecha(e.fin);
  if (fin === null) throw new ErrorGestion('La fecha de fin no es válida. Usa AAAA-MM-DDTHH:MM en hora de Chile (por ejemplo "2026-12-07T23:59").');
  if (fin <= inicio) throw new ErrorGestion("El fin de la oferta debe ser posterior al inicio.");
  if (fin <= ahora) throw new ErrorGestion("El fin de la oferta ya pasó.");
  if (fin - inicio > MAX_DURACION_MS) throw new ErrorGestion("Una oferta no puede durar más de un año.");
  if (inicio - ahora > MAX_DURACION_MS) throw new ErrorGestion("El inicio está demasiado lejos (máximo un año).");
  return { inicio, fin };
}

async function codigosConOfertaEnVentana(db: D1Like, codigos: string[], v: Ventana): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < codigos.length; i += 80) {
    const lote = codigos.slice(i, i + 80);
    const marcas = lote.map(() => "?").join(",");
    const r = await db
      .prepare(`SELECT codigo, id FROM ofertas WHERE estado IN ('programada','activando','activa','terminando') AND inicio_en < ? AND fin_en > ? AND codigo IN (${marcas})`)
      .bind(v.fin, v.inicio, ...lote)
      .all<{ codigo: string; id: string }>();
    for (const f of r.results) out.set(f.codigo, f.id);
  }
  return out;
}

export async function planificarOfertas(
  deps: DepsGestion, db: D1Like,
  spec: { productos?: Array<{ codigo: string; precio_oferta?: number }>; codigos?: string[]; bp?: number; ventana: Ventana; nota?: string | null },
): Promise<PlanOfertas> {
  const pedidos = spec.productos ?? (spec.codigos ?? []).map((c) => ({ codigo: c, precio_oferta: undefined as number | undefined }));
  const plan: PlanOfertas = { items: [], inicio: spec.ventana.inicio, fin: spec.ventana.fin, nota: spec.nota ?? null, noEncontrados: [], invalidos: [] };
  const codigos = [...new Set(pedidos.map((p) => p.codigo.trim()).filter(Boolean))];
  if (codigos.length === 0) throw new ErrorGestion("Falta la lista de productos de la oferta.");
  if (codigos.length > MAX_OFERTAS_POR_LLAMADA) throw new ErrorGestion(`Máximo ${MAX_OFERTAS_POR_LLAMADA} productos por llamada.`);
  const porCodigo = agruparPorCodigo(await deps.productos.fichasPorCodigos(codigos));
  const choques = await codigosConOfertaEnVentana(db, codigos, spec.ventana);
  const vistos = new Set<string>();
  for (const p of pedidos) {
    const codigo = p.codigo.trim();
    if (!codigo) continue;
    if (vistos.has(codigo)) {
      plan.invalidos.push({ referencia: codigo, motivo: "Repetido en la lista (se usa la primera fila)." });
      continue;
    }
    vistos.add(codigo);
    const fichas = porCodigo.get(codigo);
    if (!fichas?.length) {
      plan.noEncontrados.push(codigo);
      continue;
    }
    const webMin = Math.min(...fichas.map((f) => precioWebDe(f)));
    let precioOferta = p.precio_oferta;
    if (precioOferta === undefined && spec.bp !== undefined) precioOferta = precioBajoLocal(webMin, spec.bp);
    if (!esPesosValido(precioOferta)) {
      plan.invalidos.push({ referencia: codigo, motivo: "El precio de oferta debe ser un entero de pesos mayor a 0." });
      continue;
    }
    if (fichas.some((f) => precioOferta >= precioWebDe(f))) {
      plan.invalidos.push({ referencia: codigo, motivo: `El precio de oferta (${pesos(precioOferta)}) debe ser menor al precio web actual (${pesos(webMin)}).` });
      continue;
    }
    const choque = choques.get(codigo);
    if (choque) {
      plan.invalidos.push({ referencia: codigo, motivo: `Ya tiene otra oferta programada o activa que se cruza con esas fechas (${choque}).` });
      continue;
    }
    plan.items.push({ codigo, precioOferta, fichas, descuentoPct: Math.round((1 - precioOferta / webMin) * 10_000) / 100 });
  }
  return plan;
}

function evaluablesOferta(plan: PlanOfertas): CambioEvaluable[] {
  return plan.items.flatMap((i) =>
    i.fichas.map((f) => ({ clave: i.codigo, precioAntes: precioWebDe(f), precioDespues: i.precioOferta, costo: f.costo })),
  );
}

async function huellaPlan(plan: PlanOfertas): Promise<string> {
  return huellaDeDatos({
    v: 1, inicio: plan.inicio, fin: plan.fin,
    items: plan.items.map((i) => [i.codigo, i.precioOferta, i.fichas.map((f) => [f.id, f.precio, f.precio_original, f.en_oferta ? 1 : 0])]),
  });
}

function textoProblemas(plan: PlanOfertas): string[] {
  const out: string[] = [];
  if (plan.noEncontrados.length) out.push(`No encontrados (${plan.noEncontrados.length}): ${plan.noEncontrados.slice(0, 20).join(", ")}.`);
  if (plan.invalidos.length) out.push(`No válidos (${plan.invalidos.length}, no se programan): ${plan.invalidos.slice(0, 8).map((i) => `${i.referencia} (${i.motivo})`).join("; ")}${plan.invalidos.length > 8 ? "; …" : ""}`);
  return out;
}

// ═════════════ programar_oferta ═════════════
export async function programarOferta(deps: DepsGestion, ctx: CtxGestion, e: EntradaOferta): Promise<Salida> {
  const { db, usuario, ahora } = ctx;

  // Confirmar un masivo: se rearma el plan desde la vista previa y se compara la huella con los datos de ahora.
  if (e.modo === "confirmar") {
    if (!e.vista_previa_id) throw new ErrorGestion("Para confirmar falta vista_previa_id (el de la vista previa).");
    const vista = await mirarVistaPrevia(db, { id: e.vista_previa_id, usuarioId: usuario.id, tipo: TIPO_VISTA_OFERTAS }, ahora);
    if (!vista.ok) throw new ErrorGestion(MENSAJE_VISTA[vista.motivo]);
    const p = vista.payload as { productos?: Array<{ codigo: string; precio_oferta: number }>; inicio?: number; fin?: number; nota?: string | null } | null;
    if (!p?.productos?.length || typeof p.inicio !== "number" || typeof p.fin !== "number" || !vista.huella) throw new ErrorGestion("La vista previa está dañada. Genera una nueva.");
    if (p.fin <= ahora) throw new ErrorGestion("El fin de esa oferta ya pasó. Genera una vista previa nueva.");
    const plan = await planificarOfertas(deps, db, { productos: p.productos, ventana: { inicio: Math.min(p.inicio, p.fin - 1), fin: p.fin }, nota: p.nota });
    plan.inicio = p.inicio;
    const huellaActual = await huellaPlan(plan);
    if (huellaActual !== vista.huella || plan.invalidos.length > 0 || plan.noEncontrados.length > 0) throw new ErrorGestion(MENSAJE_VISTA.huella_cambiada);
    const ev = await evaluarCambioPrecios(db, { usuarioId: usuario.id, cambios: evaluablesOferta(plan), ahora });
    let gastar: (() => Promise<boolean>) | null = null;
    if (ev.requiere) {
      const r = await exigirAprobacion(db, deps.aprobacion, {
        usuario, herramienta: HERRAMIENTA_OFERTAS, motivos: ev.motivos, huella: vista.huella,
        resumen: `Programar oferta en ${plan.items.length} productos, del ${chile(plan.inicio)} al ${chile(plan.fin)}.`,
        detalle: { productos: plan.items.map((i) => ({ codigo: i.codigo, precio_oferta: i.precioOferta, descuento_pct: i.descuentoPct })), motivos: ev.motivosTexto },
        cambios: evaluablesOferta(plan),
      }, ahora);
      if (r.tipo !== "aprobada") return { texto: r.mensaje, datos: { aplicado: false, estado: r.tipo, motivos: ev.motivosTexto } };
      gastar = r.gastar;
    }
    const consumo = await consumirVistaPrevia(db, { id: vista.id, usuarioId: usuario.id, tipo: TIPO_VISTA_OFERTAS, huellaActual }, ahora);
    if (!consumo.ok) throw new ErrorGestion(consumo.motivo === "huella_cambiada" ? MENSAJE_VISTA.huella_cambiada : MENSAJE_VISTA[consumo.motivo]);
    if (gastar && !(await gastar())) throw new ErrorGestion("La aprobación de Jorge ya se había usado. No se programó nada; genera una vista previa nueva.");
    return crearProgramacion(deps, ctx, plan, ev.requiere);
  }

  // Entrada común (directo o vista previa).
  const ventana = leerVentana(e, ahora);
  const hayLista = !!e.productos?.length;
  const hayPct = !!e.codigos?.length && e.descuento_pct !== undefined;
  if (hayLista === hayPct) throw new ErrorGestion("Indica productos (código y precio_oferta de cada uno) o bien codigos con descuento_pct, pero no ambas cosas.");
  let bp: number | undefined;
  if (hayPct) {
    const b = porcentajeABp(e.descuento_pct as number);
    if (b === null || b < 1 || b > 9000) throw new ErrorGestion("descuento_pct debe estar entre 0,01 y 90, con hasta 2 decimales.");
    bp = b;
  }
  const plan = await planificarOfertas(deps, db, { productos: e.productos, codigos: e.codigos, bp, ventana, nota: e.nota?.trim().slice(0, 200) || null });
  const cantidad = plan.items.length;

  if (e.modo === "previsualizar" || (e.modo === undefined && cantidad > MAX_OFERTAS_DIRECTAS)) {
    if (e.modo === undefined) throw new ErrorGestion(`Son ${cantidad} productos: una oferta de más de ${MAX_OFERTAS_DIRECTAS} se hace en dos pasos. Usa modo "previsualizar" y después modo "confirmar" con el id.`);
    if (cantidad === 0) return { texto: `No hay nada que programar.\n${textoProblemas(plan).join("\n")}`, datos: { programada: false } };
    const ev = await evaluarCambioPrecios(db, { usuarioId: usuario.id, cambios: evaluablesOferta(plan), ahora });
    const vista = await crearVistaPrevia(db, {
      usuarioId: usuario.id, tipo: TIPO_VISTA_OFERTAS, huella: await huellaPlan(plan), ttlMs: ev.requiere ? 5 * 3_600_000 : 15 * 60_000,
      payload: { v: 1, productos: plan.items.map((i) => ({ codigo: i.codigo, precio_oferta: i.precioOferta })), inicio: plan.inicio, fin: plan.fin, nota: plan.nota },
    }, ahora);
    const margen = plan.items.flatMap((i) => i.fichas.map((f) => ({ i, c: clasificarMargen(i.precioOferta, f.costo), costo: f.costo })));
    const bajo = [...new Map(margen.filter((m) => m.c === "bajo_costo").map((m) => [m.i.codigo, m])).values()];
    const m15 = [...new Map(margen.filter((m) => m.c === "menos_15").map((m) => [m.i.codigo, m])).values()];
    const mayores = [...plan.items].sort((a, b) => b.descuentoPct - a.descuentoPct).slice(0, 5);
    const lineas = [
      `Vista previa de oferta. Id: ${vista.id} (sirve una sola vez; vence en ${ev.requiere ? "5 horas" : "15 minutos"}).`,
      `Fórmula: ${bp !== undefined ? `precio de oferta = precio web actual − ${((bp as number) / 100).toString().replace(".", ",")} %, redondeado al peso más cercano (la mitad sube), sobre el precio web más bajo de las fichas del código.` : "precio de oferta exacto por producto."} El precio normal (tachado) se mantiene como el precio local de hoy.`,
      `Vigencia: del ${chile(plan.inicio)} al ${chile(plan.fin)} (hora de Chile). Empieza y termina sola; al terminar vuelve el precio anterior (salvo que alguien lo cambie antes: ahí no se pisa y queda un aviso).`,
      `${cantidad} productos (${plan.items.reduce((n, i) => n + i.fichas.length, 0)} fichas).`,
      ...(mayores.length ? ["Mayores descuentos:", ...mayores.map((i) => `  ${i.codigo}: ${pesos(Math.min(...i.fichas.map((f) => precioWebDe(f))))} → ${pesos(i.precioOferta)} (-${i.descuentoPct.toString().replace(".", ",")} %)`)] : []),
      ...(bajo.length ? [`QUEDAN BAJO EL COSTO: ${bajo.length}.`, ...bajo.slice(0, 5).map((m) => `  ${m.i.codigo}: oferta ${pesos(m.i.precioOferta)}, costo ${pesos(m.costo as number)}`)] : []),
      ...(m15.length ? [`Quedan con menos de 15 % sobre el costo: ${m15.length}.`, ...m15.slice(0, 5).map((m) => `  ${m.i.codigo}: oferta ${pesos(m.i.precioOferta)}, costo ${pesos(m.costo as number)}`)] : []),
      ...textoProblemas(plan),
      "Efecto en la tienda: al empezar y al terminar se refrescan las fichas. No se envían correos ni avisos a clientes.",
      ev.requiere ? `Necesita el OK de Jorge: ${textoMotivos(ev.motivos)}. Al confirmar le llega un correo; se programa cuando apruebe y repitas la confirmación con el mismo id.` : "No necesita aprobación de Jorge.",
      `Para programarla: programar_oferta con modo "confirmar" y vista_previa_id "${vista.id}".`,
    ];
    return { texto: lineas.join("\n"), datos: { vista_previa_id: vista.id, expira_en: vista.expiraEn, productos: cantidad, requiere_aprobacion: ev.requiere, motivos: ev.motivosTexto, no_encontrados: plan.noEncontrados, invalidos: plan.invalidos } };
  }

  // Directo (hasta 5 productos, sin modo): todo o nada.
  if (plan.noEncontrados.length || plan.invalidos.length || cantidad === 0) {
    return { texto: `No programé nada.\n${textoProblemas(plan).join("\n") || "No hay productos válidos."}`, datos: { programada: false, no_encontrados: plan.noEncontrados, invalidos: plan.invalidos } };
  }
  const ev = await evaluarCambioPrecios(db, { usuarioId: usuario.id, cambios: evaluablesOferta(plan), ahora });
  if (ev.requiere) {
    const r = await exigirAprobacion(db, deps.aprobacion, {
      usuario, herramienta: HERRAMIENTA_OFERTAS, motivos: ev.motivos, huella: await huellaPlan(plan),
      resumen: `Programar oferta en ${cantidad} producto(s), del ${chile(plan.inicio)} al ${chile(plan.fin)}.`,
      detalle: { productos: plan.items.map((i) => ({ codigo: i.codigo, precio_oferta: i.precioOferta, descuento_pct: i.descuentoPct })), motivos: ev.motivosTexto },
      cambios: evaluablesOferta(plan),
    }, ahora);
    if (r.tipo !== "aprobada") return { texto: r.mensaje, datos: { aplicado: false, estado: r.tipo, motivos: ev.motivosTexto } };
    if (!(await r.gastar())) throw new ErrorGestion("La aprobación de Jorge ya se había usado. No se programó nada; vuelve a pedirlo.");
  }
  return crearProgramacion(deps, ctx, plan, ev.requiere);
}

async function crearProgramacion(deps: DepsGestion, ctx: CtxGestion, plan: PlanOfertas, aprobada: boolean): Promise<Salida> {
  const { db, usuario, ahora } = ctx;
  const grupo = idUuid();
  const filas = plan.items.map((i) => ({ id: idUuid(), item: i }));
  const sentencias = filas.map(({ id, item }) =>
    db.prepare(
      `INSERT INTO ofertas (id, grupo_id, codigo, precio_oferta, inicio_en, fin_en, estado, aprobada, nota, usuario_id, usuario_email, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, 'programada', ?, ?, ?, ?, ?)`,
    ).bind(id, grupo, item.codigo, item.precioOferta, plan.inicio, plan.fin, aprobada ? 1 : 0, plan.nota, usuario.id, usuario.email ?? null, ahora),
  );
  for (let i = 0; i < sentencias.length; i += 90) await db.batch(sentencias.slice(i, i + 90));
  await ctx.auditar(filas.map(({ id, item }) => ({
    entidad: "oferta", entidadId: id, antes: null,
    despues: { codigo: item.codigo, precio_oferta: item.precioOferta, inicio_en: plan.inicio, fin_en: plan.fin, estado: "programada" },
  })));
  await registrarCambioAplicado(db, usuario.id, evaluablesOferta(plan), { aprobado: aprobada, ahora });

  // Si ya le toca empezar, no se espera al cron.
  let activadas = 0;
  if (plan.inicio <= ahora) {
    for (const { id } of filas) {
      try {
        const r = await activarOferta(db, deps, id, ahora);
        if (r.accion === "activada") activadas++;
      } catch {
        // la retoma el cron
      }
    }
  }
  const texto = plan.inicio <= ahora
    ? `Listo: oferta en ${plan.items.length} producto(s) hasta el ${chile(plan.fin)}. ${activadas === plan.items.length ? "Ya está activa en la tienda." : "Empieza en minutos (la revisa el cron cada 30 minutos)."}`
    : `Listo: oferta programada en ${plan.items.length} producto(s), del ${chile(plan.inicio)} al ${chile(plan.fin)}. Empieza y termina sola; al terminar vuelve el precio anterior.`;
  return {
    texto: `${texto}${aprobada ? " Estaba aprobado por Jorge." : ""} Puedes verla con ver_ofertas y cancelarla con cancelar_oferta; también se puede deshacer desde Administración > Conexiones.`,
    datos: { programada: true, grupo_id: grupo, ofertas: filas.map((f) => ({ id: f.id, codigo: f.item.codigo })), activadas, lote_id: ctx.loteId },
  };
}

// ═════════════ transiciones (cron y herramientas) ═════════════
export interface ResultadoTransicion {
  accion: "nada" | "activada" | "terminada" | "cancelada" | "omitida";
  aviso?: string;
}

async function reclamar(db: D1Like, id: string, desde: EstadoOferta, transitorio: EstadoOferta, ahora: number): Promise<FilaOferta | null> {
  return db
    .prepare("UPDATE ofertas SET estado = ?1, reclamada_en = ?2 WHERE id = ?3 AND (estado = ?4 OR (estado = ?1 AND reclamada_en < ?5)) RETURNING *")
    .bind(transitorio, ahora, id, desde, ahora - RECLAMO_VENCE_MS)
    .first<FilaOferta>();
}

async function cerrar(
  db: D1Like, id: string, desde: EstadoOferta, final: EstadoOferta, ahora: number,
  extra: { aviso?: string | null; aplicado?: string | null; activada?: boolean; terminada?: boolean },
): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE ofertas SET estado = ?1, aviso = COALESCE(?2, aviso), aplicado = COALESCE(?3, aplicado),
         activada_en = CASE WHEN ?4 = 1 THEN ?6 ELSE activada_en END, terminada_en = CASE WHEN ?5 = 1 THEN ?6 ELSE terminada_en END
       WHERE id = ?7 AND estado = ?8 RETURNING id`,
    )
    .bind(final, extra.aviso ?? null, extra.aplicado ?? null, extra.activada ? 1 : 0, extra.terminada ? 1 : 0, ahora, id, desde)
    .first<{ id: string }>();
  return !!r;
}

async function auditarAuto(db: D1Like, o: FilaOferta, ahora: number, entradas: Array<{ entidad: string; entidadId: string | number; antes?: unknown; despues?: unknown }>) {
  if (entradas.length === 0) return;
  try {
    await registrarLote(db, nuevoLoteId(), { id: o.usuario_id, email: o.usuario_email }, entradas.map((x) => ({ herramienta: HERRAMIENTA_AUTO, ...x })), ahora);
  } catch {
    // La auditoría no debe impedir que la oferta siga su curso; el estado queda en la tabla `ofertas`.
  }
}

const sinCambioDe = (f: FichaProducto) => ({ id: f.id, ...estadoDe(f) });

/** Pone la oferta en la tienda. Segura de repetir: solo actúa si la oferta sigue "programada" (o reclamada hace más de 10 min). */
export async function activarOferta(db: D1Like, deps: DepsGestion, id: string, ahora: number): Promise<ResultadoTransicion> {
  const row = await reclamar(db, id, "programada", "activando", ahora);
  if (!row) return { accion: "nada" };

  const omitir = async (aviso: string, avisarAJorge = false): Promise<ResultadoTransicion> => {
    await cerrar(db, id, "activando", "omitida", ahora, { aviso, terminada: true });
    await auditarAuto(db, row, ahora, [{ entidad: "oferta", entidadId: id, antes: { estado: "programada" }, despues: { estado: "omitida", aviso } }]);
    if (avisarAJorge) await registrarAvisoOfertaBloqueada(db, { ofertaId: id, codigo: row.codigo, usuario: { id: row.usuario_id, email: row.usuario_email }, motivo: aviso, ahora });
    return { accion: "omitida", aviso };
  };

  /** Topes duros con el costo de HOY (aunque la oferta tenga el OK de Jorge): ningún precio en 0 y ninguno bajo el 50 % del costo. */
  const sinTope = (fs: FichaProducto[]) => incumplimientosTopes(fs.map((f) => ({ clave: `${row.codigo} (ficha ${f.id})`, precio: row.precio_oferta, costo: f.costo })));
  const textoTope = (fuera: string[]) =>
    `No se activó: rompe un tope duro de precios con los costos de hoy (${fuera.slice(0, 3).join("; ")}${fuera.length > 3 ? `; y ${fuera.length - 3} más` : ""}). No se tocó ningún precio. Corrige el costo o el precio y vuelve a programar la oferta.`;
  // Una oferta de precio 0 o negativo no pasa nunca, tengan o no las fichas costo cargado.
  if (!Number.isFinite(row.precio_oferta) || row.precio_oferta <= 0) {
    return omitir(textoTope(incumplimientosTopes([{ clave: row.codigo, precio: row.precio_oferta }])), true);
  }

  if (row.fin_en <= ahora) return omitir("La oferta ya había terminado cuando le tocaba empezar; no se tocó ningún precio.");

  const fichas = await deps.productos.fichasPorCodigos([row.codigo]);
  let antes = foto(row.antes);
  let aplicado = foto(row.aplicado);
  let avisoBase = row.aviso;

  if (!antes || !aplicado) {
    if (fichas.length === 0) return omitir("El producto ya no existe en la tienda; no se tocó nada.");
    const elegibles = fichas.filter((f) => precioWebDe(f) > row.precio_oferta);
    if (elegibles.length === 0) return omitir(`El precio web actual ya es igual o menor al de la oferta (${pesos(row.precio_oferta)}); no se tocó nada.`);
    const fueraDeTope = sinTope(elegibles);
    if (fueraDeTope.length) return omitir(textoTope(fueraDeTope), true);
    if (!row.aprobada && elegibles.some((f) => ["bajo_costo", "menos_15"].includes(clasificarMargen(row.precio_oferta, f.costo)))) {
      return omitir(`No se activó: con los costos de hoy el precio de oferta (${pesos(row.precio_oferta)}) queda bajo el costo o con menos de 15 % sobre el costo y no tenía el OK de Jorge.`);
    }
    antes = elegibles.map(sinCambioDe);
    aplicado = elegibles.map((f) => ({ id: f.id, ...construirEstado(precioLocalDe(f), row.precio_oferta) }));
    const saltadas = fichas.filter((f) => !elegibles.includes(f));
    avisoBase = saltadas.length ? `Fichas sin oferta (su precio web ya era igual o menor): ${saltadas.map((f) => f.id).join(", ")}.` : null;
    // La foto se guarda ANTES de escribir en la tienda: si esto se cae a la mitad, otra corrida retoma desde aquí.
    const guardada = await db
      .prepare("UPDATE ofertas SET antes = ?, aplicado = ?, aviso = ? WHERE id = ? AND estado = 'activando' RETURNING id")
      .bind(JSON.stringify(antes), JSON.stringify(aplicado), avisoBase, id)
      .first<{ id: string }>();
    if (!guardada) return { accion: "nada" };
  }

  const actuales = new Map(fichas.map((f) => [f.id, f]));
  const hechos: Foto = [];
  const noHechas: string[] = [];
  const auditoria: Array<{ entidad: string; entidadId: string | number; antes?: unknown; despues?: unknown }> = [];
  for (const a of aplicado) {
    const b = antes.find((x) => x.id === a.id);
    const cur = actuales.get(a.id);
    if (!b || !cur) { noHechas.push(`${a.id} (ya no existe)`); continue; }
    if (mismoEstado(estadoDe(cur), a)) { hechos.push(a); continue; } // ya estaba puesta (reintento)
    if (!mismoEstado(estadoDe(cur), b)) { noHechas.push(`${a.id} (alguien cambió su precio)`); continue; }
    // Defensa extra (p. ej. una activación que se retomó con la foto vieja): con el costo de hoy, esta ficha no puede entrar.
    if (sinTope([cur]).length) { noHechas.push(`${a.id} (rompe un tope duro de precios con su costo de hoy)`); continue; }
    const ok = await deps.productos.actualizar(a.id, { precio: a.precio, precio_original: a.precio_original, en_oferta: a.en_oferta }, { precio: b.precio, precio_original: b.precio_original });
    if (ok) {
      hechos.push(a);
      auditoria.push({ entidad: "producto", entidadId: a.id, antes: { codigo: row.codigo, ...estadoDe(b) }, despues: { codigo: row.codigo, ...estadoDe(a) } });
    } else noHechas.push(`${a.id} (alguien cambió su precio)`);
  }
  if (hechos.length === 0) return omitir(`No se pudo poner la oferta: ${noHechas.join(", ")}. No se tocó ningún precio.`, noHechas.some((x) => x.includes("tope duro")));
  const aviso = [avisoBase, noHechas.length ? `Fichas que no entraron a la oferta: ${noHechas.join(", ")}.` : null].filter(Boolean).join(" ") || null;
  const ok = await cerrar(db, id, "activando", "activa", ahora, { aviso, aplicado: JSON.stringify(hechos), activada: true });
  if (!ok) return { accion: "nada" };
  await auditarAuto(db, row, ahora, [...auditoria, { entidad: "oferta", entidadId: id, antes: { estado: "programada" }, despues: { estado: "activa", ...(aviso ? { aviso } : {}) } }]);
  await deps.revalidar(hechos.map((h) => h.id));
  return { accion: "activada", aviso: aviso ?? undefined };
}

/**
 * Termina una oferta activa devolviendo los precios de antes, SIN pisar las fichas que alguien cambió
 * mientras duraba la oferta (quedan con un aviso). `final` = "terminada" (se cumplió el plazo) o "cancelada".
 */
export async function terminarOferta(db: D1Like, deps: DepsGestion, id: string, ahora: number, final: "terminada" | "cancelada" = "terminada"): Promise<ResultadoTransicion> {
  const row = await reclamar(db, id, "activa", "terminando", ahora);
  if (!row) return { accion: "nada" };
  const antes = foto(row.antes);
  const aplicado = foto(row.aplicado);
  if (!antes || !aplicado) {
    await cerrar(db, id, "terminando", final, ahora, { aviso: "Terminó sin foto guardada de los precios: revisa las fichas a mano.", terminada: true });
    return { accion: final };
  }
  const fichas = await deps.productos.fichasPorIds(aplicado.map((a) => a.id));
  const actuales = new Map(fichas.map((f) => [f.id, f]));
  const restauradas: number[] = [];
  const conflictos: string[] = [];
  const auditoria: Array<{ entidad: string; entidadId: string | number; antes?: unknown; despues?: unknown }> = [];
  for (const a of aplicado) {
    const b = antes.find((x) => x.id === a.id);
    const cur = actuales.get(a.id);
    if (!b) continue;
    if (!cur) { conflictos.push(`ficha ${a.id}: ya no existe`); continue; }
    const estado = estadoDe(cur);
    if (mismoEstado(estado, a)) {
      const ok = await deps.productos.actualizar(a.id, { precio: b.precio, precio_original: b.precio_original, en_oferta: b.en_oferta }, { precio: a.precio, precio_original: a.precio_original });
      if (ok) {
        restauradas.push(a.id);
        auditoria.push({ entidad: "producto", entidadId: a.id, antes: { codigo: row.codigo, ...estadoDe(a) }, despues: { codigo: row.codigo, ...estadoDe(b) } });
      } else conflictos.push(`ficha ${a.id}: alguien cambió su precio justo ahora; no se pisó`);
    } else if (mismoEstado(estado, b)) {
      restauradas.push(a.id); // ya había vuelto (reintento)
    } else {
      conflictos.push(`ficha ${a.id}: alguien cambió su precio mientras duraba la oferta (hoy ${pesos(precioWebDe(cur))}); no se pisó`);
    }
  }
  const aviso = conflictos.length ? [row.aviso, `Al terminar NO se devolvió el precio anterior en: ${conflictos.join("; ")}.`].filter(Boolean).join(" ") : null;
  const ok = await cerrar(db, id, "terminando", final, ahora, { aviso, terminada: true });
  if (!ok) return { accion: "nada" };
  await auditarAuto(db, row, ahora, [...auditoria, { entidad: "oferta", entidadId: id, antes: { estado: "activa" }, despues: { estado: final, ...(aviso ? { aviso } : {}) } }]);
  await deps.revalidar(aplicado.map((a) => a.id));
  return { accion: final, aviso: aviso ?? undefined };
}

// ═════════════ cron ═════════════
export interface ResumenOfertas {
  activadas: number;
  terminadas: number;
  omitidas: number;
  conAviso: number;
  errores: number;
}

/** Lo que corre cada 30 minutos: empezar las que ya les toca y terminar las vencidas. Idempotente y segura con dos corridas a la vez. */
export async function procesarOfertas(db: D1Like, deps: DepsGestion, ahora: number = Date.now()): Promise<ResumenOfertas> {
  const res: ResumenOfertas = { activadas: 0, terminadas: 0, omitidas: 0, conAviso: 0, errores: 0 };
  const vencida = ahora - RECLAMO_VENCE_MS;
  const terminar = await db
    .prepare("SELECT id FROM ofertas WHERE (estado = 'activa' AND fin_en <= ?1) OR (estado = 'terminando' AND reclamada_en < ?2) ORDER BY fin_en LIMIT ?3")
    .bind(ahora, vencida, POR_CORRIDA)
    .all<{ id: string }>();
  for (const { id } of terminar.results) {
    try {
      const r = await terminarOferta(db, deps, id, ahora, "terminada");
      if (r.accion === "terminada") res.terminadas++;
      if (r.aviso) res.conAviso++;
    } catch {
      res.errores++;
    }
  }
  const empezar = await db
    .prepare("SELECT id FROM ofertas WHERE (estado = 'programada' AND inicio_en <= ?1) OR (estado = 'activando' AND reclamada_en < ?2) ORDER BY inicio_en LIMIT ?3")
    .bind(ahora, vencida, POR_CORRIDA)
    .all<{ id: string }>();
  for (const { id } of empezar.results) {
    try {
      const r = await activarOferta(db, deps, id, ahora);
      if (r.accion === "activada") res.activadas++;
      if (r.accion === "omitida") res.omitidas++;
      if (r.aviso) res.conAviso++;
    } catch {
      res.errores++;
    }
  }
  return res;
}

// ═════════════ ver y cancelar ═════════════
export interface EntradaVerOfertas {
  estado?: "vigentes" | "terminadas" | "todas";
  codigo?: string;
  grupo_id?: string;
  limite?: number;
}

function lineaOferta(o: FilaOferta): string {
  const tramo = `${chile(o.inicio_en)} → ${chile(o.fin_en)}`;
  return `${o.id.slice(0, 8)} | ${o.codigo} | ${pesos(o.precio_oferta)} | ${o.estado.toUpperCase()} | ${tramo}${o.aviso ? ` | AVISO: ${o.aviso}` : ""}`;
}

export async function verOfertas(db: D1Like, e: EntradaVerOfertas): Promise<Salida> {
  const limite = Math.min(e.limite ?? 25, 50);
  const donde: string[] = [];
  const params: unknown[] = [];
  const estado = e.estado ?? "vigentes";
  if (estado === "vigentes") {
    donde.push(`estado IN (${VIGENTES.map(() => "?").join(",")})`);
    params.push(...VIGENTES);
  }
  if (estado === "terminadas") donde.push("estado IN ('terminada','cancelada','omitida')");
  if (e.codigo?.trim()) {
    donde.push("codigo = ?");
    params.push(e.codigo.trim());
  }
  if (e.grupo_id?.trim()) {
    donde.push("grupo_id = ?");
    params.push(e.grupo_id.trim());
  }
  const orden = estado === "vigentes" ? "inicio_en ASC" : "creado_en DESC";
  const r = await db
    .prepare(`SELECT * FROM ofertas ${donde.length ? `WHERE ${donde.join(" AND ")}` : ""} ORDER BY ${orden} LIMIT ?`)
    .bind(...params, limite)
    .all<FilaOferta>();
  const filas = r.results;
  // Avisos recientes (últimos 30 días) aunque no estén en el listado pedido.
  const av = await db
    .prepare("SELECT * FROM ofertas WHERE aviso IS NOT NULL AND creado_en > ? ORDER BY creado_en DESC LIMIT 15")
    .bind(Date.now() - 30 * 86_400_000)
    .all<FilaOferta>();
  const avisos = av.results.filter((a) => !filas.some((f) => f.id === a.id));
  const partes: string[] = [];
  partes.push(filas.length ? `Ofertas (${estado}):\n${filas.map(lineaOferta).join("\n")}` : `No hay ofertas ${estado === "vigentes" ? "vigentes" : "con ese filtro"}.`);
  if (avisos.length) partes.push(`Avisos de ofertas recientes que conviene revisar:\n${avisos.map(lineaOferta).join("\n")}`);
  return {
    texto: partes.join("\n"),
    datos: {
      ofertas: filas.map(datosOferta),
      avisos: avisos.map(datosOferta),
    },
  };
}

function datosOferta(o: FilaOferta) {
  return { id: o.id, grupo_id: o.grupo_id, codigo: o.codigo, precio_oferta: o.precio_oferta, inicio_en: o.inicio_en, fin_en: o.fin_en, estado: o.estado, aviso: o.aviso, nota: o.nota };
}

export async function cancelarOferta(deps: DepsGestion, ctx: CtxGestion, e: { oferta_id?: string; grupo_id?: string; codigo?: string }): Promise<Salida> {
  const { db, ahora } = ctx;
  const filtros = [e.oferta_id?.trim(), e.grupo_id?.trim(), e.codigo?.trim()].filter(Boolean);
  if (filtros.length !== 1) throw new ErrorGestion("Indica una sola cosa: oferta_id, grupo_id o codigo.");
  let sql = "SELECT * FROM ofertas WHERE estado IN ('programada','activa','activando','terminando') AND ";
  let valor: string;
  if (e.oferta_id?.trim()) {
    // Acepta el id completo o los 8 primeros caracteres que muestra ver_ofertas.
    const v = e.oferta_id.trim().toLowerCase();
    if (!/^[0-9a-f-]{8,36}$/.test(v)) throw new ErrorGestion("El id de la oferta no es válido. Copia el que muestra ver_ofertas.");
    sql += "id LIKE ?";
    valor = `${v}%`;
  } else if (e.grupo_id?.trim()) {
    sql += "grupo_id = ?";
    valor = e.grupo_id.trim();
  } else {
    sql += "codigo = ?";
    valor = e.codigo!.trim();
  }
  const r = await db.prepare(`${sql} LIMIT 300`).bind(valor).all<FilaOferta>();
  if (r.results.length === 0) return { texto: "No encontré ninguna oferta programada o activa con ese dato.", datos: { canceladas: 0 } };
  const canceladas: string[] = [];
  const pendientes: string[] = [];
  const auditoria: Array<{ entidad: string; entidadId: string | number; antes?: unknown; despues?: unknown }> = [];
  for (const o of r.results) {
    if (o.estado === "activando" || o.estado === "terminando") { pendientes.push(o.codigo); continue; }
    if (o.estado === "programada") {
      const ok = await cerrar(db, o.id, "programada", "cancelada", ahora, { terminada: true });
      if (ok) { canceladas.push(o.codigo); auditoria.push({ entidad: "oferta", entidadId: o.id, antes: { estado: "programada" }, despues: { estado: "cancelada" } }); }
    } else {
      const t = await terminarOferta(db, deps, o.id, ahora, "cancelada");
      if (t.accion === "cancelada") canceladas.push(o.codigo);
      else pendientes.push(o.codigo);
    }
  }
  if (auditoria.length) await ctx.auditar(auditoria);
  const partes = [`Canceladas: ${canceladas.length}${canceladas.length ? ` (${canceladas.slice(0, 10).join(", ")}${canceladas.length > 10 ? ", …" : ""})` : ""}. Las que ya estaban activas volvieron a su precio anterior, salvo las que alguien cambió mientras tanto (quedan con aviso en ver_ofertas).`];
  if (pendientes.length) partes.push(`${pendientes.length} se están procesando en este momento (${pendientes.slice(0, 5).join(", ")}); vuelve a intentar en unos minutos.`);
  return { texto: partes.join(" "), datos: { canceladas: canceladas.length, pendientes: pendientes.length } };
}

// ═════════════ deshacer programar_oferta ═════════════
export async function revertirOfertas(db: D1Like, deps: DepsGestion, entradas: EntradaAuditoria[], ahora: number): Promise<{ ok: true; mensaje?: string } | { ok: false; mensaje: string }> {
  let canceladas = 0;
  let yaTerminadas = 0;
  const ocupadas: string[] = [];
  for (const e of entradas.filter((x) => x.entidad === "oferta")) {
    const row = await db.prepare("SELECT * FROM ofertas WHERE id = ?").bind(String(e.entidadId)).first<FilaOferta>();
    if (!row) { yaTerminadas++; continue; }
    if (row.estado === "programada") {
      if (await cerrar(db, row.id, "programada", "cancelada", ahora, { terminada: true })) canceladas++;
      else ocupadas.push(row.codigo);
    } else if (row.estado === "activa") {
      const t = await terminarOferta(db, deps, row.id, ahora, "cancelada");
      if (t.accion === "cancelada") canceladas++;
      else ocupadas.push(row.codigo);
    } else if (row.estado === "activando" || row.estado === "terminando") ocupadas.push(row.codigo);
    else yaTerminadas++;
  }
  if (ocupadas.length) return { ok: false, mensaje: `Algunas ofertas se están procesando justo ahora (${ocupadas.slice(0, 5).join(", ")}). Vuelve a intentar en unos minutos.` };
  return { ok: true, mensaje: `${canceladas} ofertas canceladas${yaTerminadas ? ` y ${yaTerminadas} ya habían terminado` : ""}. Las activas volvieron a su precio anterior salvo las que alguien cambió después.` };
}
