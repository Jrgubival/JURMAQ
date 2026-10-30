import 'server-only';
import { env } from '@jurmaq/shared/env';
import { logSafeError } from '@jurmaq/shared/logging';
import type { PasarelaPago, EstadoPagoPasarela } from './tipos';

/**
 * Mercado Pago Checkout Pro.
 *
 * Credenciales por variable de entorno: MERCADOPAGO_ACCESS_TOKEN (las de
 * prueba empiezan con TEST-) y MERCADOPAGO_WEBHOOK_SECRET para la firma de las
 * notificaciones. Nunca van en el código.
 */

const API = 'https://api.mercadopago.com';

function token(): string {
  const t = env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!t) throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado');
  return t;
}

export const mercadoPago: PasarelaPago = {
  id: 'mercadopago',

  async iniciar(pedido, urls) {
    // CLP no tiene decimales. Los ítems (más el despacho, si se cobra) suman
    // exactamente el total; si algún día no cuadran, se manda una sola línea
    // por el total para que Mercado Pago cobre exactamente lo mismo que valida
    // el webhook.
    const despacho = pedido.costo_despacho ?? 0;
    const suma = pedido.items.reduce((s, i) => s + i.precio * i.cantidad, 0) + despacho;
    const items =
      suma === pedido.total
        ? [
            ...pedido.items.map((i) => ({
              id: String(i.productoId),
              title: i.nombre.slice(0, 250),
              quantity: i.cantidad,
              unit_price: i.precio,
              currency_id: 'CLP',
            })),
            ...(despacho > 0
              ? [{ id: 'despacho', title: `Despacho a ${pedido.comuna ?? 'domicilio'}`, quantity: 1, unit_price: despacho, currency_id: 'CLP' }]
              : []),
          ]
        : [{ id: pedido.numero, title: `Pedido ${pedido.numero}`, quantity: 1, unit_price: pedido.total, currency_id: 'CLP' }];

    const https = urls.retorno.startsWith('https://');
    const body: Record<string, unknown> = {
      items,
      payer: { name: pedido.nombre, email: pedido.email },
      external_reference: pedido.numero,
      back_urls: { success: urls.retorno, failure: urls.retorno, pending: urls.retorno },
      statement_descriptor: 'JURMAQ Barraca',
      // Mercado Pago rechaza auto_return y notification_url que no sean https
      // (por ejemplo localhost). En local se vuelve con el botón de MP y la
      // página de confirmación consulta el pago.
      ...(https ? { auto_return: 'approved' } : {}),
      ...(urls.notificacion.startsWith('https://') ? { notification_url: urls.notificacion } : {}),
    };

    const res = await fetch(`${API}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token()}`,
        'X-Idempotency-Key': pedido.numero,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logSafeError('mp-preferencia-error', { status: res.status, body: (await res.text()).slice(0, 500) });
      throw new Error('No se pudo crear la preferencia de Mercado Pago');
    }
    const data = (await res.json()) as { id: string; init_point: string; sandbox_init_point?: string };
    // Con credenciales de prueba el init_point ya abre el entorno de pruebas.
    return { url: data.init_point, referencia: data.id };
  },

  async consultarPago(pagoId) {
    if (!/^\d{1,30}$/.test(pagoId)) return null;
    const res = await fetch(`${API}/v1/payments/${pagoId}`, {
      headers: { Authorization: `Bearer ${token()}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      logSafeError('mp-consulta-error', { status: res.status });
      return null;
    }
    const p = (await res.json()) as { id: number; status: string; external_reference?: string; transaction_amount?: number };
    if (!p.external_reference) return null;
    const estado: EstadoPagoPasarela['estado'] =
      p.status === 'approved' ? 'aprobado'
        : p.status === 'rejected' || p.status === 'cancelled' || p.status === 'refunded' || p.status === 'charged_back' ? 'rechazado'
          : 'pendiente';
    return {
      numero: p.external_reference,
      estado,
      monto: Number(p.transaction_amount) || 0,
      pagoId: String(p.id),
    };
  },
};
