import { DESCUENTO_TRANSFERENCIA_PCT, descuentoTransferencia } from "../pagos/descuento-transferencia.ts";

/**
 * Totales de un pedido con cupón. Orden de los descuentos (decisión documentada):
 *   1. cupón, sobre los productos que califican;
 *   2. 2% por transferencia, sobre los productos MENOS el cupón (nunca sobre el despacho);
 *   3. despacho al final.
 * total = subtotal - cupón - descuentoTransferencia + despacho
 * Sin cupón (descuentoCupon = 0) el resultado es idéntico al de antes.
 */
/**
 * PISO COBRABLE (decisión documentada): un cupón nunca deja los PRODUCTOS de un
 * pedido en menos de $1.000 ni en menos del 1 % del subtotal (lo que sea mayor),
 * ni siquiera pagando por transferencia (con su 2 %). Si el subtotal ya es menor
 * que el piso, el cupón no da descuento. Así un cupón mal armado no puede dejar
 * una compra gratis ni a $0 con retiro en tienda.
 */
export const PISO_COBRABLE_MINIMO = 1000;
export const PISO_COBRABLE_PORCENTAJE = 1;

export function pisoCobrable(subtotal: number): number {
  if (!Number.isInteger(subtotal) || subtotal <= 0) return 0;
  return Math.min(subtotal, Math.max(PISO_COBRABLE_MINIMO, Math.ceil((subtotal * PISO_COBRABLE_PORCENTAJE) / 100)));
}

/** Descuento de cupón más alto permitido para este subtotal (cubre también el caso de transferencia). */
export function descuentoMaximoCupon(subtotal: number): number {
  const piso = pisoCobrable(subtotal);
  if (piso <= 0 || subtotal <= piso) return 0;
  const neto = (c: number) => subtotal - c - descuentoTransferencia(subtotal - c);
  let c = Math.max(0, subtotal - Math.ceil(piso / (1 - DESCUENTO_TRANSFERENCIA_PCT / 100)));
  while (c > 0 && neto(c) < piso) c--;
  return c;
}

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
  const cupon = Math.max(0, Math.min(Math.round(args.descuentoCupon ?? 0), descuentoMaximoCupon(args.subtotal)));
  const transf = args.metodoPago === "transferencia" ? descuentoTransferencia(args.subtotal - cupon) : 0;
  return {
    subtotal: args.subtotal,
    descuentoCupon: cupon,
    descuentoTransferencia: transf,
    costoDespacho: args.costoDespacho,
    total: args.subtotal - cupon - transf + (args.costoDespacho ?? 0),
  };
}
