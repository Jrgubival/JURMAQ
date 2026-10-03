import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@jurmaq/shared/auth/config';

const authMiddleware = NextAuth({
  ...authConfig,
  pages: {
    ...authConfig.pages,
    // Login admin propio con SSO Google (+ fallback a credenciales en
    // /cuenta/login). Sin esto, /admin rebotaba al login de clientes.
    signIn: '/login',
  },
}).auth;

export default async function middleware(request: NextRequest) {
  // En apps/barraca el dominio canónico es barraca.jurmaq.cl directo.
  // Compatibilidad: links antiguos con /barraca/* deben caer en la ruta
  // canónica del subdominio, no en 404.
  const pathname = request.nextUrl.pathname;
  if (pathname === '/barraca' || pathname.startsWith('/barraca/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/barraca' ? '/' : pathname.replace(/^\/barraca/, '');
    return NextResponse.redirect(url, { status: 301 });
  }

  // Compatibilidad para webhooks/APIs heredados del antiguo monolito.
  if (pathname.startsWith('/api/barraca/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/api\/barraca/, '/api');
    return NextResponse.rewrite(url);
  }

  if (pathname === '/admin/barraca' || pathname.startsWith('/admin/barraca/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/admin/barraca' ? '/admin' : pathname.replace(/^\/admin\/barraca/, '/admin');
    return NextResponse.redirect(url, { status: 301 });
  }

  // Solo aplicamos NextAuth protection para /admin/*
  if (pathname.startsWith('/admin')) {
    // @ts-expect-error — NextAuth middleware spread compatibility
    return authMiddleware(request);
  }
  return NextResponse.next();
}

export const config = {
  // Sólo las rutas donde este middleware hace algo: los redirects heredados
  // del monolito (/barraca/*, /api/barraca/*, /admin/barraca/*) y el login
  // de /admin. Antes corría en TODAS las páginas públicas para terminar en
  // NextResponse.next(): en los logs de oct-2026, 9 de cada 10 líneas eran
  // invocaciones del middleware que no hacían nada.
  matcher: ['/barraca', '/barraca/:path*', '/api/barraca/:path*', '/admin', '/admin/:path*'],
};
