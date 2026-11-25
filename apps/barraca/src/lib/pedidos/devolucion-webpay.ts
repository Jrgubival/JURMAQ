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
  if (err?.name === "TransbankError" && typeof err.message === "string") return /status code (?:400|401|403|404|422)\b/.test(err.message);
  return false;
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

/**
 * Reintento SEGURO de una devolución que quedó «en curso» y ya es vieja. No se sabe si el proceso murió antes o después de
 * hablar con Transbank, así que ANTES de pedir nada se consulta el estado real (solo lectura):
 *  - REVERSED o NULLIFIED  → ya se devolvió: se deja «hecho» sin pedir otra.
 *  - AUTHORIZED            → sigue cobrada, sin devolución: se pide una (con el candado tomado de forma atómica).
 *  - cualquier otra cosa, o no se pudo consultar → «incierto» (se resuelve a mano; nunca se pide a ciegas).
 * El candado es un update condicional contra la misma fecha: dos clics a la vez = uno solo avanza.
 */
export async function retomarDevolucionEnCurso(
  deps: DepsRetomarDevolucion, p: PedidoParaDevolver & { fechaEnCurso: string },
): Promise<{ resultado: ResultadoDevolucionWebpay; sinRegistro?: boolean }> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const base = { medio: "webpay" as const, monto: p.total };
  if (!(await deps.retomarReembolso(p.numero, p.fechaEnCurso, { ...base, estado: "en_curso", fecha: ahora() }))) return { resultado: "ocupada" };
  const guardar = async (r: Reembolso): Promise<boolean> => {
    for (let i = 0; i < 2; i++) {
      try { await deps.guardarReembolso(p.numero, r); return true; } catch { /* reintento */ }
    }
    return false;
  };
  let t: { estado: string | null; monto: number | null; saldo: number | null };
  try {
    t = await deps.estadoTransaccion(p.pasarela_referencia);
  } catch (error) {
    deps.log?.("admin-pedido-reembolso-estado-error", { numero: p.numero, error: String(error).slice(0, 200) });
    const sinRegistro = !(await guardar({ ...base, estado: "incierto", fecha: ahora() }));
    return { resultado: "incierta", ...(sinRegistro ? { sinRegistro } : {}) };
  }
  if (t.estado === "REVERSED" || t.estado === "NULLIFIED") {
    const sinRegistro = !(await guardar({ ...base, estado: "hecho", tipo: t.estado, autorizacion: null, fecha: ahora(), hecho_at: ahora(), hecho_por: "comprobado en Transbank" }));
    return { resultado: "hecho", ...(sinRegistro ? { sinRegistro } : {}) };
  }
  if (t.estado === "AUTHORIZED") return pedirYGuardarReembolso(deps, p);
  const sinRegistro = !(await guardar({ ...base, estado: "incierto", fecha: ahora() }));
  return { resultado: "incierta", ...(sinRegistro ? { sinRegistro } : {}) };
}
