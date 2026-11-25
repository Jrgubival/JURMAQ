/**
 * CENTRO DE REGLAS de aprobación de precios (una sola función para toda la
 * gestión). Toda herramienta que cambia precios o despacho pasa por aquí; no se
 * repite la regla por herramienta, así nadie se la salta usando otra.
 *
 * Reglas (las de Jorge, ver mcp/aprobaciones.ts):
 *   - precio web bajo el costo, o con menos de 15 % sobre el costo;
 *   - más de 300 productos distintos en 24 h, o algún producto con variación
 *     acumulada de más de 30 % en 24 h (acumulado por usuario, aunque el cambio
 *     se parta en varios chicos; lo ya aprobado por Jorge no cuenta);
 *   - banderas que la herramienta ya sabe: 2 % de transferencia, costos de
 *     despacho, envío gratis, texto legal, cupones, correos al cliente.
 *
 * Uso típico:
 *   const e = await evaluarCambioPrecios(db, { usuarioId, cambios, banderas });
 *   if (e.requiere) { ... exigirAprobacion(...) }  // si no, se aplica directo
 *   ... aplicar ...
 *   await registrarCambioAplicado(db, usuarioId, cambios, { aprobado: e.requiere });
 */
import type { D1Like } from "../gestion/index.ts";
import {
  TEXTO_MOTIVO, leerAcumulado, registrarAcumulado, requiereAprobacion,
  type Acumulado24h, type MotivoAprobacion,
} from "../mcp/aprobaciones.ts";
import { variacionPct } from "./modelo.ts";
import { exigirTopesDuros, type PrecioARevisar } from "./topes.ts";

/** Un cambio de precio de un producto (una ficha). `clave` = código: las fichas repetidas cuentan como uno. */
export interface CambioEvaluable {
  clave: string;
  /** Precio web de venta antes y después. */
  precioAntes: number;
  precioDespues: number;
  /** Precio local (tachado) antes y después, si cambia. */
  localAntes?: number | null;
  localDespues?: number | null;
  costo?: number | null;
  /** Producto nuevo (crear_producto): su precio se revisa contra los topes duros aunque «antes» y «después» sean iguales. */
  nuevo?: boolean;
  /** Precio unitario de combo (combo_precio / combo_cantidad), si el cambio lo toca. */
  precioComboUnitario?: number | null;
  /** Precio unitario implícito del combo que tenía antes (si tenía). */
  comboUnitarioAntes?: number | null;
}

export interface EvaluacionCambio {
  requiere: boolean;
  motivos: MotivoAprobacion[];
  /** Los motivos en palabras (para mostrar). */
  motivosTexto: string[];
  /** Productos distintos que toca este cambio. */
  productos: number;
  /** Productos distintos acumulados en 24 h contando este cambio. */
  productosEn24h: number;
}

/** Variación del producto = la mayor entre su precio web y su precio local (en %). */
function variacionDe(c: CambioEvaluable): number {
  const web = variacionPct(c.precioAntes, c.precioDespues);
  const local = c.localAntes && c.localDespues ? variacionPct(c.localAntes, c.localDespues) : 0;
  // Un combo es un precio por unidad: se mide contra el combo anterior, o contra el precio web.
  const combo = c.precioComboUnitario ? variacionPct(c.comboUnitarioAntes ?? c.precioDespues, c.precioComboUnitario) : 0;
  return Math.max(web, local, combo);
}

/** Un renglón por producto (código): se queda con la mayor variación entre sus fichas. */
export function resumirPorProducto(cambios: CambioEvaluable[]): Array<{ clave: string; variacionPct: number }> {
  const m = new Map<string, number>();
  for (const c of cambios) m.set(c.clave, Math.max(m.get(c.clave) ?? 0, variacionDe(c)));
  return [...m].map(([clave, v]) => ({ clave, variacionPct: v }));
}

export async function evaluarCambioPrecios(
  db: D1Like,
  e: { usuarioId: string; cambios: CambioEvaluable[]; banderas?: MotivoAprobacion[]; ahora?: number },
): Promise<EvaluacionCambio> {
  // Topes duros, en ambos modos y antes que nada: precio 0 o negativo, o venta bajo el 50 % del costo. Lanza ErrorTopeDuro.
  const topes: PrecioARevisar[] = [];
  for (const c of e.cambios) {
    topes.push({ clave: c.clave, precio: c.precioDespues, costo: c.costo, sinCambio: !c.nuevo && c.precioDespues === c.precioAntes });
    if (c.precioComboUnitario) topes.push({ clave: `${c.clave} (combo)`, precio: c.precioComboUnitario, costo: c.costo });
  }
  exigirTopesDuros(topes);
  const acumulado: Acumulado24h = await leerAcumulado(db, e.usuarioId, e.ahora);
  const productos = resumirPorProducto(e.cambios);
  const precios: Array<{ precio: number; costo?: number | null; baja?: boolean }> = [];
  for (const c of e.cambios) {
    precios.push({ precio: c.precioDespues, costo: c.costo, baja: c.precioDespues < c.precioAntes });
    // El combo cuenta como precio por unidad: contra el costo y contra el precio que tenía (o el web).
    if (c.precioComboUnitario) precios.push({ precio: c.precioComboUnitario, costo: c.costo, baja: c.precioComboUnitario < (c.comboUnitarioAntes ?? c.precioDespues) });
  }
  const d = requiereAprobacion({ acumulado, productos, precios, banderas: e.banderas });
  const claves = new Set([...Object.keys(acumulado.porClave), ...productos.map((p) => p.clave)]);
  return {
    requiere: d.requiere,
    motivos: d.motivos,
    motivosTexto: d.motivos.map((m) => TEXTO_MOTIVO[m]),
    productos: productos.length,
    productosEn24h: claves.size,
  };
}

/** Después de aplicar: suma lo hecho al acumulado de 24 h del usuario (lo aprobado por Jorge no cuenta). */
export async function registrarCambioAplicado(
  db: D1Like,
  usuarioId: string,
  cambios: CambioEvaluable[],
  o: { aprobado: boolean; ahora?: number },
): Promise<void> {
  const items = resumirPorProducto(cambios);
  if (items.length === 0) return;
  await registrarAcumulado(db, usuarioId, items, { aprobado: o.aprobado, ahora: o.ahora });
}

// ───────── Cifras para Jorge (correo y página de aprobación) ─────────
export interface CifrasAprobacion {
  productos: number;
  fichas: number;
  /** Mayor variación (en %) de un precio, web, local o combo. */
  mayorVariacionPct: number;
  /** Cuántos productos quedarían con un precio bajo el costo. */
  bajoCosto: number;
  /** Cuántos quedarían con menos de 15 % sobre el costo (sin contar los bajo el costo). */
  menos15: number;
  /** Cuántos no tienen costo cargado (no se puede medir su margen). */
  sinCosto: number;
}

export function cifrasDeCambios(cambios: CambioEvaluable[]): CifrasAprobacion {
  const claves = new Set<string>();
  const bajo = new Set<string>();
  const menos = new Set<string>();
  const sin = new Set<string>();
  let mayor = 0;
  for (const c of cambios) {
    claves.add(c.clave);
    mayor = Math.max(mayor, variacionDe(c));
    const precios = [c.precioDespues, ...(c.precioComboUnitario ? [c.precioComboUnitario] : [])];
    if (!c.costo || c.costo <= 0) { sin.add(c.clave); continue; }
    for (const p of precios) {
      if (p < c.costo) bajo.add(c.clave);
      else if (p < c.costo * 1.15) menos.add(c.clave);
    }
  }
  for (const k of bajo) menos.delete(k);
  return { productos: claves.size, fichas: cambios.length, mayorVariacionPct: mayor, bajoCosto: bajo.size, menos15: menos.size, sinCosto: sin.size };
}

/** Precio unitario de combo sin redondear hacia arriba: solo se recorta a 2 decimales para mostrarlo. */
const redondear2 = (n: number) => Math.round(n * 100) / 100;

/** Una línea por ficha, completa (nada se recorta: es lo que Jorge revisa antes de aprobar). */
export function lineasDeCambios(cambios: CambioEvaluable[]): Array<Record<string, number | string | null>> {
  return cambios.map((c) => ({
    codigo: c.clave, antes: c.precioAntes, despues: c.precioDespues, costo: c.costo ?? null,
    ...(c.precioComboUnitario ? { combo_unitario: redondear2(c.precioComboUnitario), combo_unitario_antes: c.comboUnitarioAntes == null ? null : redondear2(c.comboUnitarioAntes) } : {}),
  }));
}
