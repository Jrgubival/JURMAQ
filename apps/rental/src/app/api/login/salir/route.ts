import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@jurmaq/shared/auth/config';

/**
 * GET /api/login/salir — borra la cookie de sesión del panel y lleva al login.
 * La usa el layout de /admin cuando la sesión ya no es válida (cuenta fuera de
 * la lista, rol quitado o sesión antigua): sin esto el middleware, que sólo ve
 * que hay cookie, devolvería al panel y quedaría rebotando.
 */
export function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', request.url));
  const seguro = SESSION_COOKIE_NAME.startsWith('__Host-');
  // NextAuth puede partir la cookie en trozos (.0, .1, …) si el token es grande.
  for (const nombre of [SESSION_COOKIE_NAME, ...[0, 1, 2, 3].map((i) => `${SESSION_COOKIE_NAME}.${i}`)]) {
    if (request.cookies.has(nombre)) {
      res.cookies.set(nombre, '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: seguro });
    }
  }
  return res;
}
