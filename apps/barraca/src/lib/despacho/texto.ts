import { formatCLP } from '@jurmaq/shared/format';

/** Lo que el comprador y la barraca leen sobre el despacho de un pedido (página, correos, panel). */

interface PedidoDespacho {
  entrega: 'retiro' | 'despacho';
  despacho_tipo?: 'propio' | 'courier' | null;
  costo_despacho: number | null;
  courier?: string | null;
  courier_seguimiento?: string | null;
}

const NOMBRE_COURIER: Record<string, string> = { enviame: 'Envíame', simulado: 'courier (prueba)' };

export function nombreCourier(id: string | null | undefined): string {
  return (id && NOMBRE_COURIER[id]) || 'courier';
}

/** Monto para la fila "Despacho" del resumen: "$4.990", "Gratis" o "A coordinar". */
export function montoDespacho(p: PedidoDespacho): string {
  if (p.costo_despacho == null) return 'A coordinar';
  return p.costo_despacho === 0 ? 'Gratis' : formatCLP(p.costo_despacho);
}

export function textoDespacho(p: PedidoDespacho): { titulo: string; detalle: string } {
  if (p.despacho_tipo === 'courier') {
    return {
      // Al comprador no le dice nada "Envíame" (es el agregador): basta "courier".
      titulo: p.courier === 'simulado' ? 'Envío por courier (prueba)' : 'Envío por courier',
      detalle: p.courier_seguimiento
        ? `N° de seguimiento: ${p.courier_seguimiento}.`
        : 'Te mandamos el número de seguimiento cuando lo entreguemos al courier.',
    };
  }
  if (p.costo_despacho == null) {
    return { titulo: 'Despacho a coordinar', detalle: 'Te llamamos para acordar el día y el costo del despacho.' };
  }
  return { titulo: 'Despacho a domicilio', detalle: 'Te contactamos por WhatsApp o teléfono para coordinar el día de entrega.' };
}
