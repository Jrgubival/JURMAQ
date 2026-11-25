/**
 * Qué salida ofrece el panel (y acepta el servidor) para un pedido CERRADO (cancelado o no aprobado) que quedó cobrado.
 * Puro y sin Next: lo usan la pantalla (DetalleVenta), las rutas y las herramientas MCP, para que el botón que se
 * muestra sea SIEMPRE el que el servidor acepta (nada de botones que responden 409).
 */
import type { Reembolso } from "./index";
import { reembolsoEnCursoViejo } from "./devolucion-webpay.ts";

export interface PedidoParaSalida {
  estado: string;
  metodo_pago: string;
  pasarela: string | null;
  pasarela_referencia: string | null;
  pagado_at: string | null;
  reembolso?: Reembolso | null;
}

const CERRADOS = ["cancelado", "rechazado"];

/**
 * - `reintentar`: se puede pedir la devolución en Webpay (siempre consultando antes a Transbank).
 * - `resolver`: Webpay no confirmó (incierta): se cierra a mano con «Ya se devolvió» / «No se devolvió».
 * - `esperar`: devolución «en curso» reciente; todavía no se toca.
 * - `registrar_transferencia`: pagado por transferencia y SIN devolución registrada: se registra la pendiente.
 * - `null`: no hay nada que hacer.
 */
export type SalidaDevolucion = "reintentar" | "resolver" | "esperar" | "registrar_transferencia" | null;

/** ¿Es un pedido de Webpay con un token de pago? (con pago confirmado o, si fue pago tardío, con devolución abierta) */
function webpayConCobro(p: PedidoParaSalida): boolean {
  if (p.pasarela !== "webpay" || !p.pasarela_referencia) return false;
  // Pago tardío (el pago llegó cuando el pedido ya estaba cerrado): no tiene `pagado_at`, pero SÍ una devolución de Webpay
  // abierta; ese registro prueba que Transbank aprobó el cobro. Sin pago ni devolución no hay evidencia de cobro.
  return !!p.pagado_at || p.reembolso?.medio === "webpay";
}

export function pedidoTransferenciaPagadoSinDevolucion(p: PedidoParaSalida): boolean {
  return CERRADOS.includes(p.estado) && !!p.pagado_at && p.metodo_pago === "transferencia" && p.pasarela !== "webpay" && !p.reembolso;
}

export function salidaDevolucion(p: PedidoParaSalida, ahoraMs: number): SalidaDevolucion {
  if (!CERRADOS.includes(p.estado)) return null;
  if (pedidoTransferenciaPagadoSinDevolucion(p)) return "registrar_transferencia";
  if (!webpayConCobro(p)) return null;
  const r = p.reembolso;
  if (r && (r.medio !== "webpay" || r.estado === "hecho")) return null;
  if (!r) return p.pagado_at ? "reintentar" : null;
  if (r.estado === "incierto") return "resolver";
  if (r.estado === "error") return "reintentar";
  if (r.estado === "en_curso") return reembolsoEnCursoViejo(r, ahoraMs) ? "reintentar" : "esperar";
  return null;
}
