import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@jurmaq/shared/auth/config';

const authMiddleware = NextAuth(authConfig).auth;

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
  matcher: [
    // Match todas excepto estáticos
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
};
