/**
 * Descuento por transferencia configurable (hoy 2 %). Ver, previsualizar y
 * confirmar el cambio. SIEMPRE requiere la aprobación de Jorge (también
 * deshacerlo): la herramienta deja la solicitud y, cuando él aprueba, se repite
 * la misma llamada y recién ahí se escribe (a nombre del usuario que la pidió,
 * con auditoría).
 *
 * El valor vive en D1 (`ajustes`, clave `descuento_transferencia_pct`); sin fila
 * la tienda usa el 2 % de respaldo en código (lib/pagos/descuento-transferencia.ts).
 * Rango válido: de 0 a 10 %, con a lo más un decimal (0 apaga el descuento).
 */
import type { D1Like } from "../gestion/tipos.ts";
import { consumirVistaPrevia, crearVistaPrevia } from "../gestion/index.ts";
import { huellaDeDatos } from "../gestion/util.ts";
import {
  CLAVE_DESCUENTO_TRANSFERENCIA, leerDescuentoTransferencia, type LecturaDescuento,
} from "../pagos/descuento-config.ts";
import {
  DESCUENTO_TRANSFERENCIA_MAX, DESCUENTO_TRANSFERENCIA_MIN, DESCUENTO_TRANSFERENCIA_PCT,
  descuentoTransferencia, formatoPct, pctTransferenciaValido, textoPctGuardado,
} from "../pagos/descuento-transferencia.ts";
import { exigirAprobacion } from "./aprobacion.ts";
import type { CtxGestion, DepsGestion } from "./deps.ts";
import { pesos } from "./modelo.ts";
import { ErrorGestion, type Salida } from "./precios-masivos.ts";
import { MENSAJE_VISTA, mirarVistaPrevia } from "./vistas.ts";
import type { ResultadoRevertir } from "./revertir.ts";
import type { EntradaAuditoria, UsuarioGestion } from "../gestion/index.ts";

export const HERRAMIENTA_DESCUENTO = "confirmar_descuento_transferencia";
export const TIPO_VISTA_DESCUENTO = "descuento_transferencia";
export const ENTIDAD_AJUSTE = "ajuste";
const SUBTOTAL_EJEMPLO = 100_000;
const MAX_SUBTOTAL_EJEMPLO = 10_000_000;
/** Igual que precios: la vista previa dura más que el plazo de aprobación (4 h). */
const TTL_VISTA_MS = 5 * 60 * 60 * 1000;

/** Dónde se muestra o se usa el descuento (para `ver_descuento_transferencia`). */
export const DONDE_SE_MUESTRA = [
  "Checkout: la etiqueta «X% de descuento» junto a «Transferencia bancaria» y la línea «Descuento transferencia» del resumen (se leen del valor configurado).",
  "Al crear el pedido: el servidor calcula el descuento con el valor configurado (lo lee una vez por pedido); es lo que se cobra. El monto queda guardado en el pedido.",
  "Cupones: el tope de descuento de un cupón (piso cobrable) considera este porcentaje.",
  "Pedidos ya hechos, su página, correos y el panel de Ventas muestran el monto guardado de cada pedido: no cambian.",
  "Términos y Condiciones, puntos 14.2 y 16.1: dicen «2%» en texto fijo. NO se actualizan solos (ver advertencia al cambiar).",
] as const;

export const AVISO_LEGAL =
  "Los Términos y Condiciones (puntos 14.2 y 16.1) dicen «2% de descuento por transferencia». Si el valor deja de ser 2 %, el texto legal quedaría diciendo otra cosa: hay que publicar términos nuevos (siguen su propia aprobación de Jorge) y actualizar la versión de los términos (VERSION_TERMINOS en lib/vigencia.ts, a mano) ANTES o junto con este cambio.";

function lineaEjemplo(sub: number, pct: number): string {
  const d = descuentoTransferencia(sub, pct);
  return `${formatoPct(pct)} % → descuento ${pesos(d)}, productos a pagar ${pesos(sub - d)}`;
}

export function textosQueCambian(pctActual: number, pctNuevo: number): string[] {
  const t: string[] = [];
  const etiquetaAntes = pctActual > 0 ? `«${formatoPct(pctActual)}% de descuento»` : "(sin etiqueta)";
  const etiquetaDespues = pctNuevo > 0 ? `«${formatoPct(pctNuevo)}% de descuento»` : "(la etiqueta desaparece y no se muestra la línea de descuento)";
  t.push(`Checkout, opción «Transferencia bancaria»: ${etiquetaAntes} → ${etiquetaDespues}.`);
  t.push("Checkout, resumen: la línea «Descuento transferencia» se calcula con el valor nuevo.");
  t.push("Total del pedido por transferencia: se calcula con el valor nuevo (siempre en el servidor, al crear el pedido).");
  t.push("Pedidos ya creados: no cambian.");
  if (pctNuevo !== DESCUENTO_TRANSFERENCIA_PCT || pctActual !== DESCUENTO_TRANSFERENCIA_PCT) {
    t.push(`TEXTO LEGAL: ${AVISO_LEGAL}`);
  }
  return t;
}

// ───────── lectura ─────────
export async function verDescuentoTransferencia(db: D1Like, opciones: { subtotal_ejemplo?: number } = {}): Promise<Salida> {
  const l = await leerDescuentoTransferencia(db);
  const sub = opciones.subtotal_ejemplo ?? SUBTOTAL_EJEMPLO;
  if (!Number.isInteger(sub) || sub < 1 || sub > MAX_SUBTOTAL_EJEMPLO) throw new ErrorGestion(`El carrito de ejemplo debe ser un entero de pesos entre $1 y ${pesos(MAX_SUBTOTAL_EJEMPLO)}.`);
  const texto = [
    `Descuento por transferencia: ${formatoPct(l.pct)} %${l.origen === "codigo" ? " (valor de respaldo del código: no hay uno guardado)" : " (configurado)"}. Se aplica solo a los productos (después de un cupón, si hay), nunca al despacho. Rango permitido: ${DESCUENTO_TRANSFERENCIA_MIN} a ${DESCUENTO_TRANSFERENCIA_MAX} %, con un decimal como máximo.`,
    `Ejemplo con un carrito de ${pesos(sub)}: ${lineaEjemplo(sub, l.pct)}.`,
    "Dónde se muestra:",
    ...DONDE_SE_MUESTRA.map((x) => `- ${x}`),
    "Para cambiarlo: previsualizar_descuento_transferencia y luego confirmar_descuento_transferencia (siempre necesita la aprobación de Jorge).",
  ].join("\n");
  return { texto, datos: { pct: l.pct, origen: l.origen, respaldo: DESCUENTO_TRANSFERENCIA_PCT, minimo: DESCUENTO_TRANSFERENCIA_MIN, maximo: DESCUENTO_TRANSFERENCIA_MAX, donde_se_muestra: [...DONDE_SE_MUESTRA] } };
}

// ───────── paso 1 ─────────
const huellaDe = (actual: number, nuevo: number) => huellaDeDatos({ v: 1, h: HERRAMIENTA_DESCUENTO, actual, nuevo });

function validarPct(pct: unknown): number {
  const v = pctTransferenciaValido(pct);
  if (v === null) throw new ErrorGestion(`El porcentaje debe estar entre ${DESCUENTO_TRANSFERENCIA_MIN} y ${DESCUENTO_TRANSFERENCIA_MAX} y tener un decimal como máximo (por ejemplo 2, 2.5 o 0 para apagarlo).`);
  return v;
}

export async function previsualizarDescuentoTransferencia(ctx: CtxGestion, e: { pct: number; subtotal_ejemplo?: number }): Promise<Salida> {
  const nuevo = validarPct(e.pct);
  const sub = e.subtotal_ejemplo ?? SUBTOTAL_EJEMPLO;
  if (!Number.isInteger(sub) || sub < 1 || sub > MAX_SUBTOTAL_EJEMPLO) throw new ErrorGestion(`El carrito de ejemplo debe ser un entero de pesos entre $1 y ${pesos(MAX_SUBTOTAL_EJEMPLO)}.`);
  const actual = (await leerDescuentoTransferencia(ctx.db)).pct;
  if (actual === nuevo) return { texto: `El descuento por transferencia ya es ${formatoPct(actual)} %. No hay nada que cambiar.`, datos: { cambia: false, pct: actual } };

  const dA = descuentoTransferencia(sub, actual);
  const dN = descuentoTransferencia(sub, nuevo);
  const huella = await huellaDe(actual, nuevo);
  const vista = await crearVistaPrevia(ctx.db, { usuarioId: ctx.usuario.id, tipo: TIPO_VISTA_DESCUENTO, payload: { actual, nuevo }, huella, ttlMs: TTL_VISTA_MS }, ctx.ahora);
  const textos = textosQueCambian(actual, nuevo);
  const legal = nuevo !== DESCUENTO_TRANSFERENCIA_PCT || actual !== DESCUENTO_TRANSFERENCIA_PCT;
  const texto = [
    `Vista previa: descuento por transferencia ${formatoPct(actual)} % → ${formatoPct(nuevo)} %. NO se cambió nada todavía.`,
    `Ejemplo con un carrito de ${pesos(sub)} pagado por transferencia:`,
    `- Hoy: ${lineaEjemplo(sub, actual)}.`,
    `- Después: ${lineaEjemplo(sub, nuevo)}.`,
    `- Diferencia para el cliente: ${dN >= dA ? "+" : "−"}${pesos(Math.abs(dN - dA))} de descuento.`,
    "Qué textos cambian:",
    ...textos.map((x) => `- ${x}`),
    `Para aplicarlo usa confirmar_descuento_transferencia con vista_previa_id ${vista.id}. Este cambio SIEMPRE necesita la aprobación de Jorge: le llegará un correo y, cuando apruebe, repite la misma llamada. El id vale 5 horas y una sola vez.`,
    ...(legal ? ["IMPORTANTE: avisa a Jorge que los Términos y Condiciones también hay que actualizarlos."] : []),
  ].join("\n");
  return {
    texto,
    datos: {
      vista_previa_id: vista.id, expira_en: vista.expiraEn, pct_actual: actual, pct_nuevo: nuevo,
      ejemplo: { carrito: sub, descuento_hoy: dA, descuento_despues: dN, a_pagar_hoy: sub - dA, a_pagar_despues: sub - dN },
      textos_que_cambian: textos, advertencia_legal: legal ? AVISO_LEGAL : null,
    },
  };
}

// ───────── escritura condicional (sin carreras) ─────────
async function leerCrudo(db: D1Like): Promise<string | null> {
  const f = await db.prepare("SELECT valor FROM ajustes WHERE clave = ?").bind(CLAVE_DESCUENTO_TRANSFERENCIA).first<{ valor: string }>();
  return f ? f.valor : null;
}

/** Escribe solo si el valor sigue como se leyó (null = no había fila). Devuelve si escribió. */
async function escribirSiSigue(db: D1Like, esperadoCrudo: string | null, nuevo: number, usuarioId: string, ahora: number): Promise<boolean> {
  const valor = textoPctGuardado(nuevo);
  const r = esperadoCrudo === null
    ? await db.prepare("INSERT OR IGNORE INTO ajustes (clave, valor, actualizado_en, actualizado_por) VALUES (?, ?, ?, ?)").bind(CLAVE_DESCUENTO_TRANSFERENCIA, valor, ahora, usuarioId).run()
    : await db.prepare("UPDATE ajustes SET valor = ?, actualizado_en = ?, actualizado_por = ? WHERE clave = ? AND valor = ?").bind(valor, ahora, usuarioId, CLAVE_DESCUENTO_TRANSFERENCIA, esperadoCrudo).run();
  return (r.meta?.changes ?? 0) === 1;
}

// ───────── paso 2 ─────────
export async function confirmarDescuentoTransferencia(deps: DepsGestion, ctx: CtxGestion, entrada: { vista_previa_id: string }): Promise<Salida> {
  const { db, usuario, ahora } = ctx;
  const vista = await mirarVistaPrevia(db, { id: entrada.vista_previa_id, usuarioId: usuario.id, tipo: TIPO_VISTA_DESCUENTO }, ahora);
  if (!vista.ok) throw new ErrorGestion(MENSAJE_VISTA[vista.motivo]);
  const payload = vista.payload as { actual?: unknown; nuevo?: unknown } | null;
  const nuevo = pctTransferenciaValido(payload?.nuevo);
  if (nuevo === null || !vista.huella) throw new ErrorGestion("La vista previa está dañada. Genera una nueva.");

  // Estado de AHORA: si alguien cambió el valor desde la vista previa, se rechaza.
  const crudo = await leerCrudo(db);
  const actual = (await leerDescuentoTransferencia(db)).pct;
  const huellaActual = await huellaDe(actual, nuevo);
  if (huellaActual !== vista.huella) throw new ErrorGestion(MENSAJE_VISTA.huella_cambiada);
  if (actual === nuevo) throw new ErrorGestion("El descuento ya está en ese valor. No hay nada que cambiar.");

  const resumen = `Cambiar el descuento por transferencia de ${formatoPct(actual)} % a ${formatoPct(nuevo)} %. Ejemplo: carrito de ${pesos(SUBTOTAL_EJEMPLO)} → descuento ${pesos(descuentoTransferencia(SUBTOTAL_EJEMPLO, actual))} → ${pesos(descuentoTransferencia(SUBTOTAL_EJEMPLO, nuevo))}.`;
  const r = await exigirAprobacion(db, deps.aprobacion, {
    usuario, herramienta: HERRAMIENTA_DESCUENTO, motivos: ["descuento_transferencia"], resumen,
    detalle: { antes: { pct: actual }, despues: { pct: nuevo }, textosQueCambian: textosQueCambian(actual, nuevo), advertenciaLegal: nuevo !== DESCUENTO_TRANSFERENCIA_PCT || actual !== DESCUENTO_TRANSFERENCIA_PCT ? AVISO_LEGAL : null },
    huella: vista.huella,
  }, ahora);
  if (r.tipo !== "aprobada") return { texto: r.mensaje, datos: { aplicado: false, estado: r.tipo } };

  // Gasta la vista previa (atómico, una sola vez) y recién entonces la aprobación.
  const consumo = await consumirVistaPrevia(db, { id: vista.id, usuarioId: usuario.id, tipo: TIPO_VISTA_DESCUENTO, huellaActual }, ahora);
  if (!consumo.ok) throw new ErrorGestion(consumo.motivo === "huella_cambiada" ? MENSAJE_VISTA.huella_cambiada : MENSAJE_VISTA[consumo.motivo]);
  if (!(await r.gastar())) throw new ErrorGestion("La aprobación de Jorge ya se había usado. No se cambió nada; genera una vista previa nueva.");

  let escribio = false;
  try {
    escribio = await escribirSiSigue(db, crudo, nuevo, usuario.id, ahora);
  } catch {
    escribio = false;
  }
  if (!escribio) {
    await r.devolver().catch(() => false);
    throw new ErrorGestion("No pude guardar el cambio (el valor cambió justo ahora o la base falló). No se cambió nada; vuelve a pedir una vista previa.");
  }
  await ctx.auditar([{ entidad: ENTIDAD_AJUSTE, entidadId: CLAVE_DESCUENTO_TRANSFERENCIA, antes: { pct: actual }, despues: { pct: nuevo } }]);
  const aviso = nuevo !== DESCUENTO_TRANSFERENCIA_PCT || actual !== DESCUENTO_TRANSFERENCIA_PCT ? ` RECUERDA: ${AVISO_LEGAL}` : "";
  return {
    texto: `Listo (aprobado por Jorge): el descuento por transferencia pasó de ${formatoPct(actual)} % a ${formatoPct(nuevo)} %. El checkout lo toma de inmediato y los pedidos ya creados no cambian. Se puede deshacer (también con aprobación de Jorge).${aviso}`,
    datos: { aplicado: true, pct_antes: actual, pct_despues: nuevo, lote_id: ctx.loteId },
  };
}

// ───────── deshacer (también pasa por la aprobación) ─────────
export async function revertirDescuentoTransferencia(
  deps: DepsGestion, ctx: { db: D1Like; usuario: UsuarioGestion; ahora: number }, entradas: EntradaAuditoria[],
): Promise<ResultadoRevertir> {
  const e = entradas.find((x) => x.entidad === ENTIDAD_AJUSTE && String(x.entidadId) === CLAVE_DESCUENTO_TRANSFERENCIA);
  const antes = pctTransferenciaValido((e?.antes as { pct?: unknown } | null)?.pct);
  const despues = pctTransferenciaValido((e?.despues as { pct?: unknown } | null)?.pct);
  if (!e || antes === null || despues === null) return { ok: false, mensaje: "El registro de este cambio está dañado; no se puede deshacer automáticamente." };
  try {
    const crudo = await leerCrudo(ctx.db);
    const actual = (await leerDescuentoTransferencia(ctx.db)).pct;
    if (actual === antes) return { ok: true, mensaje: `El descuento por transferencia ya estaba en ${formatoPct(antes)} %.` };
    if (actual !== despues) return { ok: false, mensaje: `No se deshizo: alguien cambió el descuento por transferencia después (ahora es ${formatoPct(actual)} %, la herramienta lo había dejado en ${formatoPct(despues)} %). Revísalo antes de tocar.` };

    const huella = await huellaDeDatos({ v: 1, h: "deshacer_descuento_transferencia", actual, restaurar: antes });
    const r = await exigirAprobacion(ctx.db, deps.aprobacion, {
      usuario: ctx.usuario, herramienta: "deshacer_lote", motivos: ["descuento_transferencia"], huella,
      resumen: `Deshacer un cambio: volver el descuento por transferencia de ${formatoPct(actual)} % a ${formatoPct(antes)} %.`,
      detalle: { antes: { pct: actual }, despues: { pct: antes }, textosQueCambian: textosQueCambian(actual, antes) },
    }, ctx.ahora);
    if (r.tipo !== "aprobada") return { ok: false, mensaje: `Deshacer queda pendiente de Jorge: ${r.mensaje} Nada se restauró. Cuando apruebe, vuelve a pedir previsualizar_deshacer_lote y luego deshacer_lote.` };
    if (!(await r.gastar())) return { ok: false, mensaje: "La aprobación de Jorge ya se había usado. Nada se restauró; vuelve a pedir deshacer." };
    let escribio = false;
    try {
      escribio = await escribirSiSigue(ctx.db, crudo, antes, ctx.usuario.id, ctx.ahora);
    } catch {
      escribio = false;
    }
    if (!escribio) {
      await r.devolver().catch(() => false);
      return { ok: false, mensaje: "No pude restaurar el descuento (cambió justo ahora o la base falló). Nada se restauró; vuelve a intentar." };
    }
    return { ok: true, mensaje: `Descuento por transferencia restaurado a ${formatoPct(antes)} %.` };
  } catch {
    return { ok: false, mensaje: "No se pudo deshacer por un error. Nada se restauró; vuelve a intentar (es seguro repetirlo)." };
  }
}

export type { LecturaDescuento };
