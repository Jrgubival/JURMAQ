import { z } from "@jurmaq/shared/validation";

/**
 * Validación del seguimiento de carritos que llega del navegador (endpoint
 * público). NADA del cliente se guarda tal cual: del carrito solo se aceptan ids
 * y cantidades; el nombre y el precio salen siempre de la tabla de productos.
 * Así un cliente no puede dejar texto suyo (ni instrucciones para una IA) en
 * `barraca_carrito_abandonado`, que luego leen los reportes y los avisos.
 */
export const MAX_ITEMS_TRACK = 50;

const itemEntrada = z
  .object({
    producto_id: z.number().int().positive().max(2_000_000_000),
    cantidad: z.number().min(0.001).max(9999).optional(),
  })
  // El navegador manda también nombre y precio: se aceptan y se ignoran (no se guardan).
  .passthrough();

export const esquemaTrack = z.object({
  email: z.string().trim().max(254).optional(),
  telefono: z.string().trim().max(30).regex(/^[0-9+()\-\s.]*$/, "teléfono").optional(),
  session_id: z.string().trim().max(100).regex(/^[A-Za-z0-9_.:-]*$/, "sesión").optional(),
  items: z.array(itemEntrada).min(1).max(MAX_ITEMS_TRACK),
});

export type EntradaTrack = z.infer<typeof esquemaTrack>;

export interface ProductoTrack { id: number; nombre: string; precio: number }
export interface ItemGuardado { producto_id: number; nombre: string; precio: number; cantidad: number }

/** Arma los items a guardar con datos de la tabla de productos. Los ids que no existen se descartan. */
export function itemsDesdeCatalogo(items: EntradaTrack["items"], catalogo: ReadonlyMap<number, ProductoTrack>): { items: ItemGuardado[]; total: number } {
  const out: ItemGuardado[] = [];
  let total = 0;
  for (const i of items) {
    const p = catalogo.get(i.producto_id);
    if (!p || !Number.isFinite(p.precio) || p.precio <= 0) continue;
    const cantidad = Math.round((i.cantidad ?? 1) * 1000) / 1000;
    out.push({ producto_id: p.id, nombre: String(p.nombre).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 200), precio: Math.round(p.precio), cantidad });
    total += Math.round(p.precio * cantidad);
  }
  return { items: out, total };
}
