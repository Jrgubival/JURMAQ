/**
 * Transiciones de estado de un pedido desde el panel. UNA sola tabla: la usan
 * `PATCH /api/admin/pedidos/[numero]` (el panel) y las herramientas del MCP,
 * así Claude nunca puede hacer un cambio que el panel no permite.
 *
 * Puro (sin servidor): se prueba suelto. Los tipos de estado vienen de ./index.
 */
import type { EstadoPedido } from './index';

/** Un pedido pagado también se puede cancelar, pero con devolución: sólo quien puede reembolsar. */
export const CANCELABLE_PAGADO: readonly EstadoPedido[] = ['pagado', 'en_preparacion', 'listo_retiro'];

/**
 * Estado nuevo → estados desde los que se puede llegar (panel).
 * Un pedido cerrado no revive y uno sin pago no se salta el pago.
 * 'pago_discrepancia' no entra a ninguna: se cobró un monto distinto y sólo se
 * cierra con "No aprobar" + devolución (sólo administrador).
 */
export const DESDE_PANEL: Readonly<Record<string, readonly EstadoPedido[]>> = {
  pagado: ['pendiente_pago', 'transferencia_informada', 'pago_rechazado'],
  en_preparacion: ['pagado'],
  listo_retiro: ['en_preparacion'],
  despachado: ['en_preparacion'],
  entregado: ['listo_retiro', 'despachado'],
  cancelado: ['pendiente_pago', 'transferencia_informada', 'pago_rechazado', ...CANCELABLE_PAGADO],
};

// ---------------------------------------------------------------------------
// Lo que expone el MCP: SOLO el avance operativo (preparar, listo, despachado, entregado)
// ---------------------------------------------------------------------------

export const ESTADOS_OPERATIVOS = ['en_preparacion', 'listo_retiro', 'despachado', 'entregado'] as const;
export type EstadoOperativo = (typeof ESTADOS_OPERATIVOS)[number];

export function esEstadoOperativo(e: string): e is EstadoOperativo {
  return (ESTADOS_OPERATIVOS as readonly string[]).includes(e);
}

/** Estados desde los que el panel permite llegar a `hacia` (solo operativos). */
export function desdeOperativo(hacia: EstadoOperativo): readonly EstadoPedido[] {
  return DESDE_PANEL[hacia] ?? [];
}

export const ETIQUETA_OPERATIVO: Record<EstadoOperativo, string> = {
  en_preparacion: 'En preparación',
  listo_retiro: 'Listo para retiro',
  despachado: 'Despachado',
  entregado: 'Entregado',
};

export interface PedidoParaTransicion {
  estado: EstadoPedido;
  entrega: 'retiro' | 'despacho';
}

export type EvaluacionTransicion = { ok: true } | { ok: false; motivo: string };

/**
 * ¿Se puede llevar este pedido a `hacia`? Mismas reglas que el panel, más la
 * que el panel aplica en pantalla: retiro → "listo para retiro", despacho →
 * "despachado" (no se mezclan).
 */
export function evaluarTransicionOperativa(p: PedidoParaTransicion, hacia: EstadoOperativo): EvaluacionTransicion {
  if (p.estado === hacia) return { ok: false, motivo: `El pedido ya está en «${ETIQUETA_OPERATIVO[hacia]}».` };
  if (!desdeOperativo(hacia).includes(p.estado)) {
    return { ok: false, motivo: 'Ese cambio de estado no corresponde para este pedido (por ejemplo, un pedido sin pago o ya cerrado no avanza).' };
  }
  if (hacia === 'listo_retiro' && p.entrega !== 'retiro') {
    return { ok: false, motivo: 'Este pedido es con despacho: corresponde «Despachado», no «Listo para retiro».' };
  }
  if (hacia === 'despachado' && p.entrega !== 'despacho') {
    return { ok: false, motivo: 'Este pedido es con retiro en la barraca: corresponde «Listo para retiro», no «Despachado».' };
  }
  return { ok: true };
}

/** Estados a los que NUNCA se llega por el MCP (dinero, anulaciones, devoluciones). */
export const ESTADOS_PROHIBIDOS_MCP: readonly EstadoPedido[] = [
  'pendiente_pago', 'transferencia_informada', 'pagado', 'pago_rechazado', 'pago_discrepancia', 'cancelado', 'rechazado',
];

/**
 * Qué le pasa al cliente y al stock con cada cambio operativo (comprobado en el
 * código del panel, 25-11-2026):
 * - El panel NO manda correo al cambiar a preparación, listo, despachado ni entregado.
 * - Al marcar "entregado", el cron diario `post-purchase` le manda UNA vez, entre 2 y
 *   30 días después, un correo para que opine de los productos (si no pidió la baja).
 * - Ninguno toca el stock (se descuenta al pagar o reservar, no al avanzar).
 */
export interface EfectosTransicion {
  correoCliente: 'no' | 'diferido';
  textoCorreo: string;
  stock: string;
}

export function efectosTransicion(hacia: EstadoOperativo): EfectosTransicion {
  const stock = 'No toca el stock (ya se descontó al pagar).';
  if (hacia === 'entregado') {
    return {
      correoCliente: 'diferido',
      textoCorreo:
        'SÍ afecta al cliente por correo: unos 2 días después, el sistema le manda UNA vez un correo para pedirle su opinión de los productos (si no pidió la baja de correos). No sale ningún correo en el momento.',
      stock,
    };
  }
  return { correoCliente: 'no', textoCorreo: 'NO le manda ningún correo al cliente (el panel tampoco lo hace). Si hay que avisarle, hay que hacerlo por WhatsApp o teléfono.', stock };
}
