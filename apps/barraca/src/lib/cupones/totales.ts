import { descuentoTransferencia } from "../pagos/descuento-transferencia.ts";

/**
 * Totales de un pedido con cupón. Orden de los descuentos (decisión documentada):
 *   1. cupón, sobre los productos que califican;
 *   2. 2% por transferencia, sobre los productos MENOS el cupón (nunca sobre el despacho);
 *   3. despacho al final.
 * total = subtotal - cupón - descuentoTransferencia + despacho
 * Sin cupón (descuentoCupon = 0) el resultado es idéntico al de antes.
 */
export interface TotalesPedido {
  subtotal: number;
  descuentoCupon: number;
  descuentoTransferencia: number;
  costoDespacho: number | null;
  total: number;
}

export function totalesPedido(args: {
  subtotal: number;
  descuentoCupon?: number;
  metodoPago: "webpay" | "transferencia";
  costoDespacho: number | null;
}): TotalesPedido {
  const cupon = Math.max(0, Math.min(Math.round(args.descuentoCupon ?? 0), args.subtotal));
  const transf = args.metodoPago === "transferencia" ? descuentoTransferencia(args.subtotal - cupon) : 0;
  return {
    subtotal: args.subtotal,
    descuentoCupon: cupon,
    descuentoTransferencia: transf,
    costoDespacho: args.costoDespacho,
    total: args.subtotal - cupon - transf + (args.costoDespacho ?? 0),
  };
}
