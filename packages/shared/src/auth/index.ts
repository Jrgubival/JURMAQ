import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { authConfig } from './config';
import bcrypt from 'bcryptjs';
import { rateLimitPersistent } from '../rate-limit';
import { headers } from 'next/headers';
import { env } from '@jurmaq/shared/env';
import { maskEmail, maskIp } from '../logging';

/**
 * SSO Google (admins): busca el usuario cuyo `email` o `sso_email` coincida
 * con la cuenta Google ya verificada, filtrado por AUTH_SCOPE igual que el
 * login con credenciales. Allowlist pura — si no hay fila en public.users,
 * no hay sesión; NUNCA se auto-crean usuarios.
 */
async function findAdminPorSsoEmail(email: string) {
  // El email viene de Google con email_verified=true, pero igual evitamos
  // inyectar caracteres raros en el filtro `or=` de PostgREST.
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return null;

  const { supabaseAdmin } = await import('../supabase');
  const authScope = env.AUTH_SCOPE;
  const isScopedApp = authScope === 'barraca' || authScope === 'constructora';

  let query = supabaseAdmin
    .from('users')
    .select('id, name, email, role, scope')
    .or(`email.eq.${email},sso_email.eq.${email}`);
  if (isScopedApp) {
    query = query.in('scope', [authScope, 'both']);
  }
  // maybeSingle(): si por error de datos hay >1 match, falla → null →
  // login denegado (fail-closed).
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    // SSO Google para admins — solo se monta si hay credenciales OAuth
    // configuradas (en su ausencia queda únicamente el login con password).
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contrasena', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const email = String(credentials.email).trim().toLowerCase();

          const { supabaseAdmin } = await import('../supabase');

          // Brute-force protection: rate limit PERSISTENTE en DB (audit A4).
          // El rateLimit() en memoria no sirve en serverless: cada lambda
          // tiene su propio Map y un atacante con suficientes IPs (botnet)
          // o suerte de cold-start podia multiplicar los 5 intentos por
          // la cantidad de lambdas activas. Ahora el contador vive en
          // Postgres compartido y bcrypt (CPU caro) solo se ejecuta si
          // se pasa el rate-limit.
          // 5 intentos / 15 min por (ip, email).
          try {
            const hdrs = await headers();
            const fwd = hdrs.get('x-forwarded-for') || '';
            const ip = fwd.split(',')[0].trim() || hdrs.get('x-real-ip') || 'unknown';
            const limitKey = `admin-login:${ip}:${email}`;
            const { success } = await rateLimitPersistent(supabaseAdmin, limitKey, {
              maxAttempts: 5,
              windowSeconds: 900,
            });
            if (!success) {
              console.warn('admin-login rate-limited:', limitKey);
              return null;
            }
          } catch {
            // headers() may fail in edge — fall through and allow the attempt
          }

          // Filtrar por scope del proceso (`AUTH_SCOPE` env var). Un user
          // con scope='barraca' NO debe poder loguearse en el proceso de
          // constructora aunque acierte email+password. `scope='both'`
          // entra en cualquiera (es el dueño).
          const authScope = env.AUTH_SCOPE;
          const isScopedApp = authScope === 'barraca' || authScope === 'constructora';

          let query = supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', email);
          if (isScopedApp) {
            query = query.in('scope', [authScope, 'both']);
          }

          const { data: user, error } = await query.maybeSingle();

          if (error || !user) return null;

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!isValid) return null;

          // Audit Better-Auth: registrar login admin exitoso. Pista de
          // forensia + detección de credenciales comprometidas (multiple
          // logins desde IPs diferentes en ventana corta).
          try {
            const hdrs2 = await headers();
            const fwd2 = hdrs2.get('x-forwarded-for') || '';
            const ip2 = fwd2.split(',')[0].trim() || hdrs2.get('x-real-ip') || 'unknown';
            const ua = hdrs2.get('user-agent') || 'unknown';
            // PII masked (Ley 21.719 H1): email → jo***@x.com, ip → 192.168.*.*
            console.log('[admin-login-ok]', { user: user.id, email: maskEmail(email), ip: maskIp(ip2), ua: ua.substring(0, 80) });
          } catch { /* logging es best-effort */ }

          return {
            id: String(user.id),
            name: user.name,
            email: user.email,
            role: user.role,
            // Pasamos scope al callback jwt para que lo persista en el
            // token. La sesión validará scope vs AUTH_SCOPE en cada
            // request (doble cinturón).
            scope: user.scope as 'barraca' | 'constructora' | 'both' | undefined,
          };
        } catch (err) {
          console.error('Error en authorize NextAuth:', err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // SSO Google: allowlist dura contra public.users. El flujo credentials
    // ya valida en authorize(), así que pasa directo.
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;
      const email = String(profile?.email ?? '').trim().toLowerCase();
      // Sin email verificado por Google no hay login.
      if (!email || profile?.email_verified !== true) return false;
      const user = await findAdminPorSsoEmail(email);
      if (!user) {
        console.warn('[admin-sso-denegado]', { email: maskEmail(email) });
        return false;
      }
      return true;
    },
    async jwt(params) {
      const { token, account } = params;
      // Primer sign-in vía Google: poblar el token con los claims del
      // usuario admin de la DB (id/rol/scope), igual que hace authorize()
      // para credentials. Sin esto el token llevaría el `sub` de Google y
      // role/scope quedarían vacíos → sesión inútil para /admin.
      if (account?.provider === 'google' && token.email) {
        const user = await findAdminPorSsoEmail(String(token.email).trim().toLowerCase());
        if (!user) return token; // signIn ya denegó; defensa extra
        token.sub = String(user.id);
        token.role = user.role;
        token.scope = user.scope as 'barraca' | 'constructora' | 'both';
        try {
          const hdrs = await headers();
          const fwd = hdrs.get('x-forwarded-for') || '';
          const ip = fwd.split(',')[0].trim() || hdrs.get('x-real-ip') || 'unknown';
          console.log('[admin-login-ok]', {
            user: user.id,
            email: maskEmail(String(token.email)),
            ip: maskIp(ip),
            provider: 'google',
          });
        } catch {
          /* logging best-effort */
        }
        return token;
      }
      // Resto de flujos (credentials, refresh): lógica compartida de config.
      return authConfig.callbacks!.jwt!(params);
    },
  },
  // Audit Better-Auth: events callback para audit trail de sign-in/sign-out.
  // En NextAuth los `events` son fire-and-forget, no bloquean el flow.
  events: {
    async signIn({ user, account, isNewUser }) {
      console.log('[auth-event-signIn]', {
        user: user?.id,
        provider: account?.provider,
        isNewUser,
      });
    },
    async signOut(message) {
      // signOut puede llegar con shape { session } o { token }
      const ref = (message as { token?: { sub?: string }; session?: { userId?: string } } | undefined);
      const userId = ref?.token?.sub ?? ref?.session?.userId;
      console.log('[auth-event-signOut]', { user: userId });
    },
  },
});
