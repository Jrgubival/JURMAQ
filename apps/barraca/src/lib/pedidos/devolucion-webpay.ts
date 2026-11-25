/**
 * Devolución de un pago de Webpay, con el candado del panel y manejo de la AMBIGÜEDAD (puro: sin Next ni Transbank;
 * las dependencias entran por parámetro para probarlo con dobles). Lo usan `devolverWebpay` (rechazo.ts, panel) y las
 * herramientas MCP de dinero: la MISMA función, no una lógica paralela.
 *
 * Orden (el candado va ANTES de llamar a Transbank):
 *  1. `tomarReembolso(en_curso)`: update condicional en Supabase (solo si no hay reembolso o el anterior falló).
 *     Si otro proceso lo tiene o ya está hecho → `ocupada`, y NO se llama a Transbank.
 *  2. Se pide el reembolso a Transbank por el TOTAL guardado y SOLO al pago original (token de la transacción).
 *  3. Se guarda el resultado:
 *     - Transbank respondió que devolvió  → `hecho`.
 *     - Transbank respondió que NO (rechazo claro, respuesta 400/401/403/404/422, o error nuestro antes de enviar) → `rechazada`
 *       (estado `error`: el panel puede reintentar).
 *     - Cualquier otra falla (red, tiempo agotado, 5xx, respuesta ilegible) → `incierta` (estado `incierto`): no se sabe
 *       si devolvió, así que NADA reintenta solo (`tomarReembolso` solo acepta «sin reembolso» o «error»). Se revisa a
 *       mano en el portal de Transbank y se resuelve en el panel.
 */
import type { Reembolso } from "./index";

export type ResultadoDevolucionWebpay = "hecho" | "rechazada" | "incierta" | "ocupada";

export interface PedidoParaDevolver {
  numero: string;
  total: number;
  pasarela_referencia: string;
}

export interface DepsDevolucionWebpay {
  tomarReembolso(numero: string, r: Reembolso): Promise<boolean>;
  guardarReembolso(numero: string, r: Reembolso): Promise<void>;
  reembolsar(token: string, monto: number): Promise<{ ok: boolean; tipo: string | null; autorizacion: string | null }>;
  /**
   * Solo lectura. Opcional: si falta, un 422 de «ya devuelta/anulada» queda `incierto` (nunca «no se hizo»). Con ella, si
   * Transbank dice REVERSED o NULLIFIED por el monto íntegro se registra como `hecho`.
   */
  estadoTransaccion?(token: string): Promise<{ estado: string | null; monto: number | null; saldo: number | null }>;
  ahora?: () => string;
  /** Registro seguro (sin datos personales). */
  log?: (evento: string, datos: Record<string, unknown>) => void;
}

/**
 * ¿La falla garantiza que Transbank NO devolvió? Solo dos casos: (a) falló antes de enviar nada (error local marcado),
 * (b) Transbank respondió con un 4xx que de verdad rechaza la solicitud: SOLO 400, 401, 403, 404 y 422. Todo lo demás es
 * ambiguo: 408 (tiempo agotado), 409 (conflicto: puede haber una devolución en proceso), 429 (límite) y cualquier 5xx
 * no dicen si se devolvió, así que quedan como «incierta».
 */
export function fallaGarantizaQueNoSeDevolvio(e: unknown): boolean {
  if (e && typeof e === "object" && (e as { sinEnviar?: unknown }).sinEnviar === true) return true;
  const err = e as { name?: unknown; message?: unknown } | null;
  if (err?.name === "TransbankError" && typeof err.message === "string") {
    if (esYaDevuelta(err.message)) return false;
    return /status code (?:400|401|403|404|422)\b/.test(err.message);
  }
  return false;
}

/**
 * Un 422 que dice que la transacción YA se devolvió o anuló («already nullified», «already reversed», «ya anulada»…) es lo
 * contrario de «no se hizo»: el dinero pudo haber salido (por una llamada anterior cuya respuesta se perdió). Los otros 422
 * (monto inválido, token inválido, transacción sin terminar, fuera de plazo) sí garantizan que no se devolvió.
 */
export function esYaDevuelta(mensaje: string): boolean {
  return /status code 422\b/.test(mensaje) && /already|nullif|reversed|refunded|anulad|devuelt|reversad/i.test(mensaje);
}

export async function ejecutarDevolucionWebpay(deps: DepsDevolucionWebpay, p: PedidoParaDevolver): Promise<{ resultado: ResultadoDevolucionWebpay; sinRegistro?: boolean }> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  if (!(await deps.tomarReembolso(p.numero, { medio: "webpay", monto: p.total, estado: "en_curso", fecha: ahora() }))) return { resultado: "ocupada" };
  return pedirYGuardarReembolso(deps, p);
}

/** Con el candado ya tomado: pide el reembolso a Transbank y guarda el resultado (hecho, rechazada o incierta). */
async function pedirYGuardarReembolso(deps: DepsDevolucionWebpay, p: PedidoParaDevolver): Promise<{ resultado: ResultadoDevolucionWebpay; sinRegistro?: boolean }> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const base = { medio: "webpay" as const, monto: p.total };
  const guardar = async (r: Reembolso): Promise<boolean> => {
    // Se intenta dos veces: si no se puede registrar, el pedido queda «en curso» en Supabase (nada reintenta) y se avisa.
    for (let i = 0; i < 2; i++) {
      try { await deps.guardarReembolso(p.numero, r); return true; } catch { /* reintento */ }
    }
    return false;
  };
  let tb: { ok: boolean; tipo: string | null; autorizacion: string | null };
  try {
    tb = await deps.reembolsar(p.pasarela_referencia, p.total);
  } catch (error) {
    if (esYaDevuelta(String((error as { message?: unknown } | null)?.message ?? ""))) {
      // «Ya devuelta/anulada»: no es «no se hizo». Se consulta el estado real; si no se puede confirmar, queda incierta.
      deps.log?.("admin-pedido-reembolso-ya-devuelta", { numero: p.numero, error: String(error).slice(0, 200) });
      return verificarYaDevuelta(deps, p, guardar);
    }
    const definitivo = fallaGarantizaQueNoSeDevolvio(error);
    deps.log?.("admin-pedido-reembolso-error", { numero: p.numero, definitivo, error: String(error).slice(0, 200) });
    const sinRegistro = !(await guardar({ ...base, estado: definitivo ? "error" : "incierto", fecha: ahora() }));
    return { resultado: definitivo ? "rechazada" : "incierta", ...(sinRegistro ? { sinRegistro } : {}) };
  }
  // Respuesta sin forma reconocible (ni tipo): no se sabe qué pasó.
  if (!tb.ok && tb.tipo === null) {
    const sinRegistro = !(await guardar({ ...base, estado: "incierto", fecha: ahora() }));
    return { resultado: "incierta", ...(sinRegistro ? { sinRegistro } : {}) };
  }
  const sinRegistro = !(await guardar({ ...base, estado: tb.ok ? "hecho" : "error", tipo: tb.tipo, autorizacion: tb.autorizacion, fecha: ahora() }));
  deps.log?.("admin-pedido-reembolso", { numero: p.numero, ok: tb.ok, tipo: tb.tipo });
  return { resultado: tb.ok ? "hecho" : "rechazada", ...(sinRegistro ? { sinRegistro } : {}) };
}

/** Tras un 422 de «ya devuelta/anulada»: consulta a Transbank (solo lectura) y registra `hecho` o `incierto`, nunca `error`. */
async function verificarYaDevuelta(
  deps: DepsDevolucionWebpay, p: PedidoParaDevolver, guardar: (r: Reembolso) => Promise<boolean>,
): Promise<{ resultado: ResultadoDevolucionWebpay; sinRegistro?: boolean }> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const base = { medio: "webpay" as const, monto: p.total };
  let t: { estado: string | null; monto: number | null; saldo: number | null } | null = null;
  try { t = deps.estadoTransaccion ? await deps.estadoTransaccion(p.pasarela_referencia) : null; } catch { t = null; }
  // NULLIFIED/REVERSED por el monto íntegro del pedido: se devolvió. Parcial, otro monto o sin consulta: se resuelve a mano.
  if (t && (t.estado === "NULLIFIED" || t.estado === "REVERSED") && t.monto === p.total) {
    const sinRegistro = !(await guardar({ ...base, estado: "hecho", tipo: t.estado, autorizacion: null, fecha: ahora(), hecho_at: ahora(), hecho_por: "comprobado en Transbank" }));
    return { resultado: "hecho", ...(sinRegistro ? { sinRegistro } : {}) };
  }
  const sinRegistro = !(await guardar({ ...base, estado: "incierto", fecha: ahora() }));
  return { resultado: "incierta", ...(sinRegistro ? { sinRegistro } : {}) };
}

// ───────── Devolución «en curso» que quedó a medias (el proceso murió después de tomar el candado) ─────────
/** Minutos que debe llevar «en curso» una devolución para considerarla colgada y ofrecer reintentarla en el panel. */
export const MINUTOS_EN_CURSO_VIEJO = 15;

/** ¿Es una devolución de Webpay «en curso» desde hace más de N minutos? (la fecha es la del candado). */
export function reembolsoEnCursoViejo(r: Pick<Reembolso, "estado" | "medio" | "fecha"> | null | undefined, ahoraMs: number, minutos = MINUTOS_EN_CURSO_VIEJO): boolean {
  if (!r || r.medio !== "webpay" || r.estado !== "en_curso") return false;
  const t = Date.parse(r.fecha);
  return Number.isFinite(t) && ahoraMs - t >= minutos * 60_000;
}

export interface DepsRetomarDevolucion extends DepsDevolucionWebpay {
  /** Update condicional: solo si sigue «en curso» con ESA fecha (nadie lo cambió en medio). */
  retomarReembolso(numero: string, fechaVieja: string, nuevo: Reembolso): Promise<boolean>;
  /** Solo consulta el estado de la transacción en Transbank (no mueve dinero). */
  estadoTransaccion(token: string): Promise<{ estado: string | null; monto: number | null; saldo: number | null }>;
}

export type DesdeDevolucion = { tipo: "sin_registro" } | { tipo: "error" } | { tipo: "en_curso"; fecha: string };

/**
 * Reintento SEGURO de una devolución (sin registro, en «error» o «en curso» vieja). Un `error` guardado puede ser mentira
 * (el código anterior guardaba `error` ante cualquier excepción, timeouts incluidos: Transbank pudo haber devuelto), y un
 * «en curso» no dice si el proceso murió antes o después de hablar con Transbank. Por eso en TODOS los casos, ANTES de pedir
 * nada, se consulta el estado real de la transacción (solo lectura):
 *  - REVERSED o NULLIFIED  → ya se devolvió: se deja «hecho» sin pedir otra.
 *  - AUTHORIZED con el monto y el saldo íntegros → sigue cobrada, sin devolución: se pide una (candado ya tomado).
 *  - cualquier otra cosa (parcial, monto raro, no se pudo consultar) → «incierto» (se resuelve a mano; nunca a ciegas).
 * El candado es atómico: sin registro/error con `tomarReembolso` (solo si no hay reembolso o falló); «en curso» con un update
 * condicional contra la misma fecha. Dos clics a la vez = uno solo avanza.
 */
export async function reintentarDevolucionConsultando(
  deps: DepsRetomarDevolucion, p: PedidoParaDevolver, desde: DesdeDevolucion,
): Promise<{ resultado: ResultadoDevolucionWebpay; sinRegistro?: boolean }> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const base = { medio: "webpay" as const, monto: p.total };
  const candado: Reembolso = { ...base, estado: "en_curso", fecha: ahora() };
  const tomado = desde.tipo === "en_curso" ? await deps.retomarReembolso(p.numero, desde.fecha, candado) : await deps.tomarReembolso(p.numero, candado);
  if (!tomado) return { resultado: "ocupada" };
  const guardar = async (r: Reembolso): Promise<boolean> => {
    for (let i = 0; i < 2; i++) {
      try { await deps.guardarReembolso(p.numero, r); return true; } catch { /* reintento */ }
    }
    return false;
  };
  const incierta = async () => {
    const sinRegistro = !(await guardar({ ...base, estado: "incierto", fecha: ahora() }));
    return { resultado: "incierta" as const, ...(sinRegistro ? { sinRegistro } : {}) };
  };
  let t: { estado: string | null; monto: number | null; saldo: number | null };
  try {
    t = await deps.estadoTransaccion(p.pasarela_referencia);
  } catch (error) {
    deps.log?.("admin-pedido-reembolso-estado-error", { numero: p.numero, error: String(error).slice(0, 200) });
    return incierta();
  }
  if (t.estado === "REVERSED" || t.estado === "NULLIFIED") {
    const sinRegistro = !(await guardar({ ...base, estado: "hecho", tipo: t.estado, autorizacion: null, fecha: ahora(), hecho_at: ahora(), hecho_por: "comprobado en Transbank" }));
    return { resultado: "hecho", ...(sinRegistro ? { sinRegistro } : {}) };
  }
  if (t.estado === "AUTHORIZED" && t.monto === p.total && (t.saldo === null || t.saldo === t.monto)) return pedirYGuardarReembolso(deps, p);
  return incierta();
}

/** Reintento de una devolución «en curso» colgada (compatibilidad: ver `reintentarDevolucionConsultando`). */
export async function retomarDevolucionEnCurso(
  deps: DepsRetomarDevolucion, p: PedidoParaDevolver & { fechaEnCurso: string },
): Promise<{ resultado: ResultadoDevolucionWebpay; sinRegistro?: boolean }> {
  return reintentarDevolucionConsultando(deps, p, { tipo: "en_curso", fecha: p.fechaEnCurso });
}
