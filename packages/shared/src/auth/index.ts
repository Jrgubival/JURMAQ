import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './config';
import bcrypt from 'bcryptjs';
import { rateLimitPersistent } from '../rate-limit';
import { headers } from 'next/headers';
import { maskEmail, maskIp } from '../logging';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
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

          const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

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
          };
        } catch (err) {
          console.error('Error en authorize NextAuth:', err);
          return null;
        }
      },
    }),
  ],
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
