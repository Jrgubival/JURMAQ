/**
 * Reglas de venta en línea, compartidas por la tienda (cliente) y el servidor.
 *
 * Un producto se puede comprar si tiene precio, no es "solo cotizar" y tiene al
 * menos una unidad en stock. Stock vacío (null) cuenta como sin stock: la
 * planilla de precios es la que lo carga, y vender algo que no sabemos si hay
 * es justo lo que la tienda tiene que evitar.
 */

export interface ProductoVendible {
  precio: number | null;
  stock: number | null;
  solo_cotizar?: boolean | null;
  activo?: boolean | null;
}

/** Unidades enteras disponibles (el stock puede venir con decimales o negativo). */
export function unidadesDisponibles(stock: number | null | undefined): number {
  if (stock == null || !Number.isFinite(stock)) return 0;
  return Math.max(0, Math.floor(stock));
}

export function tienePrecio(p: ProductoVendible): boolean {
  return !p.solo_cotizar && p.precio != null && Number.isFinite(p.precio) && p.precio > 0;
}

/** Motivo por el que no se puede comprar, o null si se puede. */
export function motivoNoComprable(p: ProductoVendible): string | null {
  if (p.activo === false) return "Producto no disponible";
  if (!tienePrecio(p)) return "Sin precio publicado";
  if (unidadesDisponibles(p.stock) < 1) return "Sin stock";
  return null;
}

export function esComprable(p: ProductoVendible): boolean {
  return motivoNoComprable(p) === null;
}
