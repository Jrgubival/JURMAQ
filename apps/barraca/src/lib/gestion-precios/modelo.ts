/**
 * Modelo de precios de la tienda (funciones puras, sin red ni base).
 *
 * Convención ÚNICA (la misma de lib/precio-web.ts y de cargar-precios-web.mjs):
 *   · `precio`          = precio web = lo que se cobra.
 *   · `precio_original` = precio local ("precio normal", el tachado).
 *   · `en_oferta`       = hay tachado: el local es mayor que el web.
 * Si el precio local es igual al web no hay tachado: `precio_original` null y
 * `en_oferta` false. La tienda resuelve por valor (en oferta se cobra el MENOR
 * de los dos, ver lib/pricing.ts), así que escribir siempre con
 * `construirEstado` deja a la tienda cobrando exactamente `precio`.
 *
 * REDONDEO (documentado, fijo): todo cálculo de porcentaje se hace en enteros
 * (puntos base: 5 % = 500) y se redondea al peso entero más cercano; la mitad
 * sube. Ejemplo: local $1.990 con 5 % menos = 1.990 × 0,95 = 1.890,5 → $1.891.
 */
import { MARGEN_MINIMO } from "../mcp/aprobaciones.ts";
import { AHORRO_MINIMO_PCT, precioDeVenta } from "../precio-web.ts";

export { AHORRO_MINIMO_PCT };

/** Tope sano de un precio en pesos (evita errores de digitación como 99999999). */
export const PRECIO_MAXIMO = 100_000_000;

export interface EstadoPrecio {
  precio: number;
  precio_original: number | null;
  en_oferta: boolean;
}

export interface FichaProducto extends EstadoPrecio {
  id: number;
  codigo: string | null;
  nombre: string;
  slug: string;
  descripcion: string | null;
  oferta_fin: string | null;
  combo_cantidad: number | null;
  combo_precio: number | null;
  costo: number | null;
  stock: number | null;
  activo: boolean;
  categoria_id: number | null;
  imagen: string | null;
  solo_cotizar: boolean | null;
}

/** Pesos válidos: entero entre 1 y PRECIO_MAXIMO (nunca 0, negativo ni decimal). */
export function esPesosValido(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= PRECIO_MAXIMO;
}

export function estadoDe(f: EstadoPrecio): EstadoPrecio {
  return { precio: f.precio, precio_original: f.precio_original ?? null, en_oferta: !!f.en_oferta };
}

/** Lo que paga el cliente (menor de los dos si hay oferta). */
export function precioWebDe(e: EstadoPrecio): number {
  return precioDeVenta({ precio: e.precio, precio_original: e.precio_original, en_oferta: e.en_oferta });
}

/** Precio local ("normal"): el tachado si hay oferta; si no, el mismo precio web. */
export function precioLocalDe(e: EstadoPrecio): number {
  return e.en_oferta && e.precio_original && e.precio_original > 0 ? Math.max(e.precio, e.precio_original) : e.precio;
}

export function mismoEstado(a: EstadoPrecio, b: EstadoPrecio): boolean {
  return a.precio === b.precio && (a.precio_original ?? null) === (b.precio_original ?? null) && !!a.en_oferta === !!b.en_oferta;
}

/** Arma lo que se guarda a partir del precio local y el web. Exige web <= local. */
export function construirEstado(local: number, web: number): EstadoPrecio {
  if (!esPesosValido(local) || !esPesosValido(web)) throw new RangeError("Precios fuera de rango");
  if (web > local) throw new RangeError("El precio web no puede superar al local");
  return web < local ? { precio: web, precio_original: local, en_oferta: true } : { precio: web, precio_original: null, en_oferta: false };
}

/** num/den redondeado al entero más cercano (la mitad sube), solo con enteros. */
export function dividirRedondeando(num: number, den: number): number {
  return Math.floor((2 * num + den) / (2 * den));
}

/** Porcentaje con hasta 2 decimales → puntos base enteros (5 → 500). null si tiene más decimales o no es finito. */
export function porcentajeABp(pct: number): number | null {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return null;
  const bp = Math.round(pct * 100);
  return Math.abs(pct * 100 - bp) < 1e-6 ? bp : null;
}

/** Precio web = local menos `bp` puntos base, al peso más cercano. */
export function precioBajoLocal(local: number, bp: number): number {
  return dividirRedondeando(local * (10_000 - bp), 10_000);
}

/** Reajuste firmado (+/-) de un precio, al peso más cercano. */
export function reajustarPrecio(valor: number, bp: number): number {
  return dividirRedondeando(valor * (10_000 + bp), 10_000);
}

/** Variación porcentual absoluta entre dos precios (0 si no hay base). */
export function variacionPct(antes: number, despues: number): number {
  if (!Number.isFinite(antes) || !Number.isFinite(despues) || antes <= 0) return 0;
  return Math.round((Math.abs(despues - antes) / antes) * 10_000) / 100;
}

/** Variación firmada en % (para ordenar subidas y bajadas). */
export function variacionFirmadaPct(antes: number, despues: number): number {
  if (!(antes > 0)) return 0;
  return Math.round(((despues - antes) / antes) * 10_000) / 100;
}

export type ClaseMargen = "sin_costo" | "bajo_costo" | "menos_15" | "ok";

/** Misma regla que `requiereAprobacion`: bajo el costo, o menos de 15 % sobre el costo. */
export function clasificarMargen(precio: number, costo: number | null | undefined): ClaseMargen {
  if (!costo || !Number.isFinite(costo) || costo <= 0) return "sin_costo";
  if (precio < costo) return "bajo_costo";
  if (precio < costo * (1 + MARGEN_MINIMO)) return "menos_15";
  return "ok";
}

/** Utilidad sobre el costo en % (redondeada a 1 decimal), o null sin costo. */
export function margenSobreCostoPct(precio: number, costo: number | null | undefined): number | null {
  if (!costo || !Number.isFinite(costo) || costo <= 0) return null;
  return Math.round(((precio - costo) / costo) * 1000) / 10;
}

/** ¿La tienda mostraría el tachado? (solo con ahorro de 5 % o más). */
export function tachadoSeMuestra(e: EstadoPrecio): boolean {
  const local = precioLocalDe(e);
  const web = precioWebDe(e);
  if (local <= web) return false;
  return Math.round((1 - web / local) * 100) >= AHORRO_MINIMO_PCT;
}

/** Los códigos se comparan tal cual están en la base, solo sin espacios sobrantes (hay códigos con minúsculas, p. ej. "ACH-12mm"). */
export function normalizarCodigo(c: string): string {
  return c.trim();
}

export function agruparPorCodigo<T extends { codigo: string | null }>(filas: T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const f of filas) {
    if (!f.codigo) continue;
    const k = normalizarCodigo(f.codigo);
    mapa.set(k, [...(mapa.get(k) ?? []), f]);
  }
  return mapa;
}

/** "$12.990" (puntos de miles, sin decimales). */
export function pesos(n: number): string {
  const s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}$${s}`;
}
