/**
 * Descuento por pagar con transferencia (Jorge, 31-10-2026): 2% sobre los
 * productos (ya con combos y liquidación), nunca sobre el despacho. Se
 * redondea a favor del cliente (el descuento hacia arriba, al peso).
 * El monto que vale es el que calcula el servidor al crear el pedido.
 */
export const DESCUENTO_TRANSFERENCIA_PCT = 2;

export function descuentoTransferencia(subtotalProductos: number): number {
  if (!Number.isInteger(subtotalProductos) || subtotalProductos <= 0) return 0;
  return Math.ceil((subtotalProductos * DESCUENTO_TRANSFERENCIA_PCT) / 100);
}
