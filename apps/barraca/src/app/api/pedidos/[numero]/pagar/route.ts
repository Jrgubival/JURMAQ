import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { logSafeError } from '@jurmaq/shared/logging';
import { pedidos, cookiePedido, tokenValido, PATRON_NUMERO } from '@/lib/pedidos';
import { pasarelaActiva, pagoEnLineaDisponible, origenTienda } from '@/lib/pagos';

/**
 * POST /api/pedidos/[numero]/pagar — vuelve a abrir el pago en línea de un
 * pedido pendiente o rechazado (por ejemplo si la tarjeta fue rechazada).
 * Sólo para quien tiene la cookie del pedido.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const rl = rateLimit(`pedidos-pagar:${getClientIp(request)}`, { maxAttempts: 10, windowSeconds: 60 });
  if (!rl.success) return NextResponse.json({ error: 'Demasiados intentos' }, { status: 429 });

  const { numero } = await params;
  if (!PATRON_NUMERO.test(numero)) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

  const store = pedidos();
  const pedido = await store.porNumero(numero);
  if (!pedido || !tokenValido(request.cookies.get(cookiePedido(numero))?.value, pedido.acceso_hash)) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  }
  if (pedido.estado !== 'pendiente_pago' && pedido.estado !== 'pago_rechazado') {
    return NextResponse.json({ error: 'Este pedido ya no está pendiente de pago' }, { status: 409 });
  }
  if (!pagoEnLineaDisponible()) {
    return NextResponse.json({ error: 'El pago en línea no está disponible' }, { status: 409 });
  }

  try {
    const origen = origenTienda(request.url);
    const pasarela = pasarelaActiva();
    const inicio = await pasarela.iniciar(pedido, {
      retorno: `${origen}/pedido/${numero}`,
      notificacion: `${origen}/api/pagos/webhook`,
    });
    await store.guardarReferenciaPago(numero, pasarela.id, inicio.referencia);
    return NextResponse.json({ redirect: inicio.url });
  } catch (error) {
    logSafeError('pedido-reintentar-pago', { numero, error: String(error) });
    return NextResponse.json({ error: 'No pudimos abrir el pago. Intenta de nuevo o paga por transferencia.' }, { status: 502 });
  }
}
