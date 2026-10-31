import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { PATRON_NUMERO } from '@/lib/pedidos';
import { enlacePedidoValido, cookieEnlacePedido, DURACION_COOKIE_ENLACE } from '@/lib/pedidos/enlace';
import { origenTienda } from '@/lib/pagos';

/**
 * GET /pedido/acceso/<numero>/<token> — enlace "Ver tu pedido" de los correos.
 *
 * Si el token (HMAC del número) es válido deja una cookie httpOnly con él y
 * redirige (303) a /pedido/<numero>, para que el token salga de la barra de
 * direcciones y del historial. Si no es válido redirige igual, sin cookie: la
 * página dice que no encontró el pedido (no se distingue "no existe" de
 * "token malo"). El token nunca se escribe en los logs.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ numero: string; token: string }> }) {
  const { numero, token } = await params;
  const origen = origenTienda(request.url);

  if (!PATRON_NUMERO.test(numero)) {
    return NextResponse.redirect(`${origen}/`, 303);
  }
  const destino = `${origen}/pedido/${numero}`;

  const rl = rateLimit(`pedido-enlace:${getClientIp(request)}`, { maxAttempts: 20, windowSeconds: 300 });
  const res = NextResponse.redirect(destino, 303);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  if (!rl.success || !enlacePedidoValido(numero, token)) return res;

  res.cookies.set(cookieEnlacePedido(numero), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: origen.startsWith('https://'),
    path: '/',
    maxAge: DURACION_COOKIE_ENLACE,
  });
  return res;
}
