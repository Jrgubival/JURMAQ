// MercadoPago integration for JURMAQ Barraca
// MercadoPago is the most popular payment gateway in Chile

export async function createMercadoPagoPreference(cotizacion: {
  numero: string;
  items: Array<{ nombre: string; cantidad: number; precio: number }>;
  total: number;
  email: string;
}): Promise<string | null> {
  const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!MP_ACCESS_TOKEN) {
    console.warn('MERCADOPAGO_ACCESS_TOKEN no configurado, omitiendo creacion de preferencia');
    return null;
  }

  // The barraca lives on its own subdomain. We always send the user back
  // there after MercadoPago, regardless of NEXTAUTH_URL. The webhook
  // however lives on jurmaq.cl (admin domain) where API routes resolve.
  const barracaUrl = 'https://barraca.jurmaq.cl';
  const apiUrl = process.env.NEXTAUTH_URL || 'https://jurmaq.cl';

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      items: cotizacion.items.map(item => ({
        title: item.nombre,
        quantity: item.cantidad,
        unit_price: item.precio,
        currency_id: 'CLP',
      })),
      payer: {
        email: cotizacion.email,
      },
      back_urls: {
        success: `${barracaUrl}/pago/exito`,
        failure: `${barracaUrl}/pago/error`,
        pending: `${barracaUrl}/pago/pendiente`,
      },
      auto_return: 'approved',
      external_reference: cotizacion.numero,
      notification_url: `${apiUrl}/api/barraca/pagos/webhook`,
      statement_descriptor: 'JURMAQ Barraca',
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('Error creando preferencia MercadoPago:', errorData);
    return null;
  }

  const data = await response.json();
  return data.init_point; // MercadoPago checkout URL
}
