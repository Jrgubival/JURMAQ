import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@jurmaq/shared/auth/config';

const authMiddleware = NextAuth(authConfig).auth;

export default async function middleware(request: NextRequest) {
  // En apps/barraca el dominio canónico es barraca.jurmaq.cl directo.
  // No hay rewriting — todas las rutas van como están.
  // Solo aplicamos NextAuth protection para /admin/*
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // @ts-ignore — NextAuth middleware spread compatibility
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
