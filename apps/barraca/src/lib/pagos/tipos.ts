import type { Pedido } from '@/lib/pedidos';

/**
 * Contrato que cumple cualquier pasarela de pago de la tienda.
 *
 * Hoy: Mercado Pago Checkout Pro (mercadopago.ts) y una simulada para
 * desarrollo (simulado.ts). Para pasar a Webpay Plus (Transbank) basta con
 * escribir webpay.ts que cumpla esta interfaz y elegirla en index.ts:
 *   - iniciar → crear la transacción (POST /rswebpaytransaction/api/webpay/v1.2/transactions)
 *     y devolver `url?token_ws=...` como `url` y el token como `referencia`.
 *   - consultarPago → confirmar la transacción con el token_ws del retorno (PUT .../transactions/{token}).
 * El resto de la tienda (checkout, webhook, confirmación, admin) no cambia.
 */

export type IdPasarela = 'mercadopago' | 'simulado' | 'webpay';

export interface InicioPago {
  /** A dónde se manda al comprador para pagar. */
  url: string;
  /** Id de la orden/preferencia en la pasarela (se guarda en el pedido). */
  referencia: string;
}

export interface EstadoPagoPasarela {
  /** Número de pedido que la pasarela tiene asociado (external_reference). */
  numero: string;
  estado: 'aprobado' | 'pendiente' | 'rechazado';
  /** Monto efectivamente pagado, en CLP. */
  monto: number;
  pagoId: string;
}

export interface UrlsPago {
  /** Página de confirmación del pedido (retorno del comprador). */
  retorno: string;
  /** Endpoint que recibe las notificaciones servidor-a-servidor. */
  notificacion: string;
}

export interface PasarelaPago {
  id: IdPasarela;
  iniciar(pedido: Pedido, urls: UrlsPago): Promise<InicioPago>;
  /**
   * Consulta el pago directamente a la pasarela. Nunca se confía en lo que
   * venga en la URL de retorno o en el cuerpo de una notificación.
   */
  consultarPago(pagoId: string): Promise<EstadoPagoPasarela | null>;
}
