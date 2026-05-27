import type { NextAuthConfig } from 'next-auth';
import { env } from '@jurmaq/shared/env';

/**
 * Aislamiento de sesión entre barraca y constructora:
 *
 * - Antes: cookie con `domain: '.jurmaq.cl'` compartida cross-subdomain.
 *   Cualquier sesión en barraca.jurmaq.cl también valía en jurmaq.cl
 *   (admin de constructora). El RBAC limitaba acciones pero la superficie
 *   de ataque era la suma de ambas apps.
 *
 * - Ahora: cada app lee `AUTH_SCOPE` ('barraca' | 'constructora') de su
 *   env, y la cookie se nombra `__Host-{scope}.session-token` con
 *   prefijo `__Host-` que FUERZA `Secure + Path=/ + sin Domain`. El
 *   navegador rechaza cookies cross-subdomain por arquitectura, no por
 *   configuración. Doble cinturón con los callbacks abajo que validan
 *   que `token.scope` coincide con AUTH_SCOPE.
 *
 * - Dev (HTTP localhost): se usa prefijo de cookie sin `__Host-` porque
 *   ese prefijo requiere HTTPS. El aislamiento por scope sigue activo a
 *   nivel JWT.
 */
const IS_PROD = env.NODE_ENV === 'production';

function getAuthScope(): 'barraca' | 'constructora' | 'app' {
  const s = env.AUTH_SCOPE;
  return s === 'barraca' || s === 'constructora' ? s : 'app';
}

const SCOPE = getAuthScope();

/**
 * `__Host-` prefix en prod fuerza:
 *   - Secure (HTTPS only)
 *   - Path=/
 *   - NO Domain attribute → cookie es host-only, no cross-subdomain.
 *
 * En dev (HTTP) no podemos usar `__Host-` (requiere Secure que requiere
 * HTTPS), así que prefijamos con `dev-{scope}` solamente.
 */
const COOKIE_PREFIX = IS_PROD ? '__Host-' : 'dev-';
const SESSION_COOKIE_NAME = `${COOKIE_PREFIX}${SCOPE}.session-token`;
const CALLBACK_COOKIE_NAME = `${COOKIE_PREFIX}${SCOPE}.callback-url`;
const CSRF_COOKIE_NAME = `${COOKIE_PREFIX}${SCOPE}.csrf-token`;

const SIGN_IN_PATH = SCOPE === 'barraca' ? '/cuenta/login' : '/login';

// This config is edge-compatible (no DB imports)
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: SIGN_IN_PATH,
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
      name: SESSION_COOKIE_NAME,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: IS_PROD,
        // __Host- prefix REQUIRES no `domain` attribute (browser rechaza
        // la cookie si lo seteamos). Es esto exactamente lo que nos da el
        // aislamiento cross-subdomain.
      },
    },
    callbackUrl: {
      name: CALLBACK_COOKIE_NAME,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: IS_PROD,
      },
    },
    csrfToken: {
      name: CSRF_COOKIE_NAME,
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
        // Persistir scope del usuario en el token. authorize() en index.ts
        // ya garantiza que el `user.scope` viene filtrado por AUTH_SCOPE,
        // pero también lo guardamos acá para que session() pueda hacer
        // doble-cinturón.
        const u = user as { scope?: 'barraca' | 'constructora' | 'both' };
        if (u.scope) token.scope = u.scope;
      }
      return token;
    },
    async session({ session, token }) {
      // Cinturón #2: si por cualquier motivo (cookie de otra app robada y
      // pegada acá, JWT secret leaked, etc.) un token con scope='barraca'
      // llega a un proceso con AUTH_SCOPE='constructora', cerramos la
      // sesión retornando un objeto sin user.
      if (token.scope && SCOPE !== 'app') {
        const s = token.scope as string;
        if (s !== SCOPE && s !== 'both') {
          // session.user undefined fuerza al consumer a tratar como anónimo;
          // NextAuth lo entiende como "no autenticado" en `auth()`.
          return { ...session, user: undefined as unknown as typeof session.user };
        }
      }
      if (session.user) {
        if (token.role) session.user.role = token.role;
        if (token.sub) session.user.id = token.sub;
        if (token.scope) {
          (session.user as { scope?: string }).scope = token.scope as string;
        }
      }
      return session;
    },
  },
  providers: [], // Providers added in auth.ts (needs DB)
};
