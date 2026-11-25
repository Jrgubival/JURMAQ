/**
 * Descuento por pagar con transferencia (Jorge, 31-10-2026): 2% sobre los
 * productos (ya con combos y liquidación), nunca sobre el despacho. Se
 * redondea a favor del cliente (el descuento hacia arriba, al peso).
 * El monto que vale es el que calcula el servidor al crear el pedido.
 *
 * El porcentaje es configurable desde la base de gestión (tabla `ajustes`,
 * ver descuento-config.ts), pero ESTE archivo guarda el respaldo en código:
 * con la base vacía, caída o con un valor dañado todo calcula con 2% exacto.
 * Es lógica pura (sin Next ni base) para que el navegador, el servidor y las
 * pruebas usen la MISMA función.
 */
export const DESCUENTO_TRANSFERENCIA_PCT = 2;

/** Rango permitido por la herramienta de configuración (0 = sin descuento). Un decimal como máximo. */
export const DESCUENTO_TRANSFERENCIA_MIN = 0;
export const DESCUENTO_TRANSFERENCIA_MAX = 10;

/**
 * Porcentaje válido: número entre 0 y 10 con a lo más un decimal (0, 1, 2, 2.5, 10...).
 * Devuelve el número normalizado o null si no vale.
 */
export function pctTransferenciaValido(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < DESCUENTO_TRANSFERENCIA_MIN || v > DESCUENTO_TRANSFERENCIA_MAX) return null;
  const decimas = Math.round(v * 10);
  if (Math.abs(v * 10 - decimas) > 1e-9) return null;
  return decimas / 10;
}

/** Lee el valor guardado ("2", "2.5"). Cualquier otra cosa devuelve null (y se usa el respaldo). */
export function leerPctGuardado(texto: unknown): number | null {
  if (typeof texto !== "string" || !/^\d{1,2}(\.\d)?$/.test(texto)) return null;
  return pctTransferenciaValido(Number(texto));
}

/** Como se guarda en `ajustes`: sin ceros de más ("2", "2.5"). */
export function textoPctGuardado(pct: number): string {
  const v = pctTransferenciaValido(pct);
  if (v === null) throw new Error("Porcentaje de transferencia fuera de rango.");
  return String(v);
}

/** Como se le muestra a una persona, con coma chilena: "2", "2,5". */
export function formatoPct(pct: number): string {
  return String(pct).replace(".", ",");
}

/**
 * Descuento en pesos sobre el subtotal de productos. `pct` es opcional: sin él usa
 * el respaldo (2%), que da exactamente el mismo resultado de siempre.
 * Se hace en décimas de punto con enteros: ceil(subtotal * décimas / 1000). Para 2%
 * es el mismo cálculo que ceil(subtotal * 2 / 100).
 */
export function descuentoTransferencia(subtotalProductos: number, pct: number = DESCUENTO_TRANSFERENCIA_PCT): number {
  if (!Number.isInteger(subtotalProductos) || subtotalProductos <= 0) return 0;
  const valido = pctTransferenciaValido(pct);
  if (valido === null) return 0;
  return Math.ceil((subtotalProductos * Math.round(valido * 10)) / 1000);
}
