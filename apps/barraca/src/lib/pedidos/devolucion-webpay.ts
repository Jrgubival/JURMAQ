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
  const base = { medio: "webpay" as const, monto: p.total };
  if (!(await deps.tomarReembolso(p.numero, { ...base, estado: "en_curso", fecha: ahora() }))) return { resultado: "ocupada" };
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
