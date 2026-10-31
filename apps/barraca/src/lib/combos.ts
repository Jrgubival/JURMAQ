import { formatCLP } from "@jurmaq/shared/format";

/**
 * Descuento por cantidad ("Lleva 2 por $12.000"), como en las tiendas grandes.
 * Reglas (Jorge, 31-10-2026):
 *   · El precio del combo se aplica por cada grupo completo; las unidades que
 *     sobran se cobran al precio web unitario.
 *   · Sólo vale si el precio por unidad del combo es menor que el precio web.
 *   · No se suma con otras promociones: el precio web ya es el más bajo.
 * Lo usan la ficha, el carrito y el servidor (que es quien cobra).
 */

export interface Combo {
  cantidad: number;
  precio: number;
}

/** El combo, si sirve para este precio unitario; si no, null. */
export function comboValido(combo: Combo | null | undefined, precioUnitario: number): Combo | null {
  if (!combo) return null;
  const { cantidad, precio } = combo;
  if (!Number.isInteger(cantidad) || cantidad < 2 || cantidad > 999) return null;
  if (!Number.isInteger(precio) || precio <= 0) return null;
  if (!Number.isFinite(precioUnitario) || precioUnitario <= 0) return null;
  if (precio >= cantidad * precioUnitario) return null;
  return { cantidad, precio };
}

/** Total de una línea del carrito y cuánto se ahorra por el combo. */
export function totalLinea(precio: number, cantidad: number, combo: Combo | null | undefined) {
  const sinCombo = precio * cantidad;
  const c = comboValido(combo, precio);
  if (!c || cantidad < c.cantidad) return { total: sinCombo, ahorro: 0 };
  const grupos = Math.floor(cantidad / c.cantidad);
  const total = grupos * c.precio + (cantidad - grupos * c.cantidad) * precio;
  return { total, ahorro: sinCombo - total };
}

/** "Lleva 2 por $12.000". */
export function textoCombo(c: Combo): string {
  return `Lleva ${c.cantidad} por ${formatCLP(c.precio)}`;
}
