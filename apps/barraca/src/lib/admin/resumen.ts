import type { EstadoPedido } from '@/lib/pedidos';

/**
 * Cálculos del Resumen del panel (ventas y pendientes). Sin dependencias de
 * servidor para poder probarlos sueltos.
 */

/** Estados que cuentan como venta: pagado y lo que viene después, sin los cerrados. */
export const ESTADOS_VENTA: EstadoPedido[] = ['pagado', 'en_preparacion', 'listo_retiro', 'despachado', 'entregado'];

export const GRUPOS_PENDIENTES = {
  por_pagar: ['pendiente_pago', 'transferencia_informada', 'pago_rechazado', 'pago_discrepancia'],
  por_preparar: ['pagado', 'en_preparacion'],
  listos: ['listo_retiro', 'despachado'],
} as const satisfies Record<string, EstadoPedido[]>;

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' });

/** "2026-10-30" en hora de Chile. */
export function diaChile(fecha: Date | string): string {
  return fmtDia.format(typeof fecha === 'string' ? new Date(fecha) : fecha);
}

interface PedidoResumen {
  estado: EstadoPedido;
  total: number;
  pagado_at: string | null;
  created_at: string;
}

export interface Resumen {
  hoy: { monto: number; pedidos: number };
  mes: { monto: number; pedidos: number };
  porPagar: number;
  porPreparar: number;
  listos: number;
}

export function calcularResumen(lista: PedidoResumen[], ahora = new Date()): Resumen {
  const hoy = diaChile(ahora);
  const mes = hoy.slice(0, 7);
  const r: Resumen = { hoy: { monto: 0, pedidos: 0 }, mes: { monto: 0, pedidos: 0 }, porPagar: 0, porPreparar: 0, listos: 0 };
  for (const p of lista) {
    if (ESTADOS_VENTA.includes(p.estado)) {
      // La venta cuenta el día en que se pagó (una transferencia puede llegar días después).
      const dia = diaChile(p.pagado_at || p.created_at);
      const total = Number.isFinite(p.total) ? p.total : 0;
      if (dia === hoy) { r.hoy.monto += total; r.hoy.pedidos++; }
      if (dia.slice(0, 7) === mes) { r.mes.monto += total; r.mes.pedidos++; }
    }
    if ((GRUPOS_PENDIENTES.por_pagar as readonly string[]).includes(p.estado)) r.porPagar++;
    else if ((GRUPOS_PENDIENTES.por_preparar as readonly string[]).includes(p.estado)) r.porPreparar++;
    else if ((GRUPOS_PENDIENTES.listos as readonly string[]).includes(p.estado)) r.listos++;
  }
  return r;
}
