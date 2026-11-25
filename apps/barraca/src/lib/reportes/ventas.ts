/**
 * Reportes de ventas de solo lectura. Puros: reciben los pedidos ya leídos.
 *
 * Criterio de "venta" = el del panel (Resumen y Ventas, lib/admin/ventas.ts):
 * pedidos en estado pagado, en preparación, listo para retiro, despachado o
 * entregado (`ESTADOS_VENTA`). Un pedido pendiente de pago, rechazado,
 * cancelado o no aprobado NO cuenta. Se mide por la fecha en que se hizo el
 * pedido (hora de Chile), igual que el panel. Montos = lo que pagó el cliente
 * (total con IVA, descuentos y despacho incluidos).
 */
import { ESTADOS_VENTA, calcularTotales, medioPago, type PedidoVenta } from "../admin/ventas.ts";

export type PedidoReporte = PedidoVenta & {
  items?: Array<{ productoId: number; codigo: string | null; nombre: string; cantidad: number; subtotal: number }>;
};

export interface ResumenVentas {
  total: number;
  pedidos: number;
  ticketMedio: number;
  despachos: number;
  porFormaDePago: Array<{ formaPago: string; pedidos: number; total: number }>;
}

export function pedidosQueSonVenta<T extends { estado: PedidoVenta["estado"] }>(lista: T[]): T[] {
  return lista.filter((p) => ESTADOS_VENTA.includes(p.estado));
}

export function resumenVentas(lista: PedidoReporte[]): ResumenVentas {
  const t = calcularTotales(lista);
  const ventas = pedidosQueSonVenta(lista);
  const medios = ["transferencia", "webpay", "mercadopago"] as const;
  const porFormaDePago = medios
    .map((m) => {
      const sub = calcularTotales(ventas.filter((p) => p.metodo_pago === m));
      return { formaPago: medioPago(m), pedidos: sub.pedidos, total: sub.vendido };
    })
    .filter((f) => f.pedidos > 0);
  return { total: t.vendido, pedidos: t.pedidos, ticketMedio: t.ticket, despachos: t.despachos, porFormaDePago };
}

export interface ProductoVendido {
  codigo: string | null;
  nombre: string;
  unidades: number;
  ingresos: number;
  pedidos: number;
}

export type OrdenVendidos = "unidades" | "ingresos";

/** Productos más vendidos del período (agrupados por código: las fichas duplicadas suman juntas). */
export function masVendidos(lista: PedidoReporte[], limite = 10, orden: OrdenVendidos = "unidades"): ProductoVendido[] {
  const mapa = new Map<string, ProductoVendido>();
  for (const p of pedidosQueSonVenta(lista)) {
    const vistos = new Set<string>();
    for (const i of p.items ?? []) {
      const clave = i.codigo ? `c:${i.codigo}` : `id:${i.productoId}`;
      const cur = mapa.get(clave) ?? { codigo: i.codigo ?? null, nombre: String(i.nombre ?? "").slice(0, 120), unidades: 0, ingresos: 0, pedidos: 0 };
      cur.unidades += Number.isFinite(i.cantidad) ? i.cantidad : 0;
      cur.ingresos += Number.isFinite(i.subtotal) ? i.subtotal : 0;
      if (!vistos.has(clave)) { cur.pedidos++; vistos.add(clave); }
      mapa.set(clave, cur);
    }
  }
  const lim = Math.min(Math.max(1, Math.trunc(limite)), 50);
  return [...mapa.values()]
    .sort((a, b) => (orden === "ingresos" ? b.ingresos - a.ingresos || b.unidades - a.unidades : b.unidades - a.unidades || b.ingresos - a.ingresos) || a.nombre.localeCompare(b.nombre))
    .slice(0, lim);
}
