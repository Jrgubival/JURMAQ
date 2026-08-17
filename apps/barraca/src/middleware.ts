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
  matcher: [
    // Excluye TODO lo estático, no solo _next.
    //
    // El patrón anterior ('/((?!_next/static|_next/image|favicon\\.ico).*)')
    // hacía correr el middleware en cada imagen de /public, cada PDF, el
    // robots.txt y el manifest. En Vercel cada ejecución del middleware es una
    // Edge Request facturable, así que una sola visita con 30 imágenes gastaba
    // 30 requests de más. Era la causa principal de 1.4M/1M Edge Requests.
    //
    // Si agregas una carpeta nueva de assets en /public, súmala acá.
    '/((?!_next/|images/|img/|icons/|pdf/|fonts/|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|pdf|txt|xml|json|webmanifest|woff|woff2|ttf|mp4)$).*)',
  ],
};
