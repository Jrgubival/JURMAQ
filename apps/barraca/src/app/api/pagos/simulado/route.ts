import { NextRequest, NextResponse } from 'next/server';
import { env } from '@jurmaq/shared/env';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { z, parseBody } from '@jurmaq/shared/validation';
import { pedidos, esProduccion, PATRON_NUMERO } from '@/lib/pedidos';
import { puedeVerPedido } from '@/lib/pedidos/enlace';
import { aplicarEstadoPago } from '@/lib/pagos';

/**
 * POST /api/pagos/simulado — aprueba o rechaza un pago de la pasarela
 * simulada. Sólo existe en desarrollo con PAGO_PASARELA=simulado, y sólo para
 * quien tiene la cookie del pedido.
 */
const schema = z.object({
  numero: z.string().regex(PATRON_NUMERO),
  resultado: z.enum(['aprobar', 'rechazar']),
});

export async function POST(request: NextRequest) {
  if (env.PAGO_PASARELA !== 'simulado' || esProduccion()) {
    return NextResponse.json({ error: 'No disponible' }, { status: 404 });
  }
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const parsed = parseBody(schema, await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const { numero, resultado } = parsed.data;

  const pedido = await pedidos().porNumero(numero);
  if (!pedido || !puedeVerPedido((n) => request.cookies.get(n)?.value, pedido)) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  }

  const r = await aplicarEstadoPago(
    {
      numero,
      estado: resultado === 'aprobar' ? 'aprobado' : 'rechazado',
      monto: pedido.total,
      pagoId: `SIM-${Date.now()}`,
    },
    'simulado',
  );
  return NextResponse.json({ resultado: r, redirect: `/pedido/${numero}` });
}
