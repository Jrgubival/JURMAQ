import type { NextAuthConfig } from 'next-auth';

// Share cookies across jurmaq.cl and barraca.jurmaq.cl in production.
// In dev (localhost) no domain is set so cookies work normally.
const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_DOMAIN = IS_PROD ? '.jurmaq.cl' : undefined;

// This config is edge-compatible (no DB imports)
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/cuenta/login',
  },
  session: {
    strategy: 'jwt',
    // Audit Better-Auth: expiración explícita. Default NextAuth = 30 dias,
    // demasiado largo para sesiones admin con permisos destructivos. 7 dias
    // es estandar GDPR-friendly (tradeoff seguridad ↔ UX). updateAge:
    // refresca el token cada 24h para que JWT fresco refleje role updates
    // sin esperar 7 dias.
    maxAge: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // refresh cada 24h
  },
  cookies: {
    sessionToken: {
      // __Secure- prefix works with domain; __Host- would NOT allow domain.
      name: IS_PROD ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: IS_PROD,
        domain: COOKIE_DOMAIN,
      },
    },
    callbackUrl: {
      name: IS_PROD ? '__Secure-next-auth.callback-url' : 'next-auth.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: IS_PROD,
        domain: COOKIE_DOMAIN,
      },
    },
    csrfToken: {
      // __Host- prefix REQUIRES no domain attribute — keep CSRF token host-scoped (both
      // subdomains set their own, which is fine since CSRF tokens are per-origin).
      name: IS_PROD ? '__Host-next-auth.csrf-token' : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: IS_PROD,
      },
    },
  },
  callbacks: {
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdmin = nextUrl.pathname.startsWith('/admin');
      const isLogin = nextUrl.pathname === '/login';
      const isApi = nextUrl.pathname.startsWith('/api/');

      // Protect /admin/* pages
      if (isAdmin && !isLoggedIn) {
        return false; // Redirect to login
      }

      // Redirect logged-in users away from /login
      if (isLogin && isLoggedIn) {
        return Response.redirect(new URL('/admin', nextUrl));
      }

      // Also handle login pages for already logged-in admin users
      if ((nextUrl.pathname === '/cuenta/login' || nextUrl.pathname === '/barraca/cuenta/login') && isLoggedIn) {
        return Response.redirect(new URL('/admin', nextUrl));
      }

      // API route protection
      if (isApi && !isLoggedIn) {
        // Allow all /api/auth/* routes (NextAuth handlers)
        if (nextUrl.pathname.startsWith('/api/auth/')) {
          return true;
        }

        // Allow GET /api/maquinarias and GET /api/maquinarias/[id] (public catalog)
        // POST/PUT/DELETE are blocked at the route handler level
        if (nextUrl.pathname.match(/^\/api\/maquinarias(\/\d+)?$/)) {
          return true;
        }

        // Allow POST /api/solicitudes (public contact form)
        if (nextUrl.pathname === '/api/solicitudes') {
          return true;
        }

        // Allow barraca public API routes
        if (nextUrl.pathname.startsWith('/api/barraca/')) {
          const publicBarracaRoutes = [
            '/api/barraca/productos',
            '/api/barraca/categorias',
            '/api/barraca/carrito',
            '/api/barraca/cotizaciones',
            '/api/barraca/suscriptores',
            '/api/barraca/auth',
            '/api/barraca/buscar',
            '/api/barraca/upload',
            // MercadoPago webhook needs to be reachable from
            // api.mercadopago.com without auth — signature is verified
            // inside the route handler with MERCADOPAGO_WEBHOOK_SECRET.
            '/api/barraca/pagos/webhook',
          ];
          if (publicBarracaRoutes.some(r => nextUrl.pathname.startsWith(r))) {
            return true;
          }
        }

        // Allow public contract signature API routes (token-based auth).
        // The firma_token in the URL is the auth credential — the route
        // handlers verify it themselves.
        if (nextUrl.pathname.startsWith('/api/public/contratos/firmar/')) {
          return true;
        }

        // Block all other API routes for unauthenticated users
        return new Response(
          JSON.stringify({ error: 'No autorizado' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.role) session.user.role = token.role;
        if (token.sub) session.user.id = token.sub;
      }
      return session;
    },
  },
  providers: [], // Providers added in auth.ts (needs DB)
};
