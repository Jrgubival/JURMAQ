import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@jurmaq/shared/auth/config';

const authMiddleware = NextAuth(authConfig).auth;

export default async function middleware(request: NextRequest) {
  // En apps/constructora el dominio canónico es jurmaq.cl directo.
  // Si alguien llega a /barraca/* → redirect a barraca.jurmaq.cl
  const pathname = request.nextUrl.pathname;
  if (pathname === '/barraca' || pathname.startsWith('/barraca/')) {
    const suffix = pathname === '/barraca' ? '' : pathname.replace(/^\/barraca/, '');
    return NextResponse.redirect(
      `https://barraca.jurmaq.cl${suffix}${request.nextUrl.search}`,
      { status: 301 }
    );
  }
  // NextAuth protection en /admin/*
  if (pathname.startsWith('/admin')) {
    // @ts-ignore
    return authMiddleware(request);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
