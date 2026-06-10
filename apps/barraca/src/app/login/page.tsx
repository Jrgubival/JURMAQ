import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signIn } from '@jurmaq/shared/auth';
import { env } from '@jurmaq/shared/env';

export const metadata: Metadata = {
  title: 'Acceso administración · JURMAQ Barraca',
  robots: { index: false, follow: false },
};

/**
 * Solo paths relativos del mismo sitio — nunca URLs absolutas (open redirect).
 */
function safeCallback(url: string | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//')) return '/admin';
  return url;
}

const LOGIN_CREDENCIALES = '/cuenta/login?source=admin';

/**
 * Login de administración de barraca.jurmaq.cl.
 *
 * Mismo patrón que jurmaq.cl/login: SSO con Google (allowlist en
 * public.users vía email/sso_email, filtrada por AUTH_SCOPE=barraca) como
 * vía rápida; el login con email+contraseña de /cuenta/login queda como
 * respaldo. Sin GOOGLE_CLIENT_ID/SECRET se redirige al flujo de
 * credenciales como antes.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ssoDisponible = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  if (!ssoDisponible) {
    redirect(LOGIN_CREDENCIALES);
  }

  const callbackUrl = safeCallback(params.callbackUrl);
  const ssoError = params.error;

  async function entrarConGoogle() {
    'use server';
    await signIn('google', { redirectTo: callbackUrl });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-3xl font-extrabold text-navy-950 tracking-tight">
            JURMAQ<span className="text-xl font-semibold text-orange-600 ml-1 align-baseline">Barraca</span>
          </span>
          <p className="text-sm text-gray-500 mt-2">Panel de administración</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm p-6">
          {ssoError && (
            <div
              role="alert"
              className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {ssoError === 'AccessDenied'
                ? 'Esta cuenta de Google no tiene acceso al panel de administración.'
                : 'No se pudo iniciar sesión. Intenta de nuevo.'}
            </div>
          )}

          <form action={entrarConGoogle}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-[#EAEAEA] bg-white px-4 py-3 text-sm font-semibold text-navy-950 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.97 10.97 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continuar con Google
            </button>
          </form>

          <div className="mt-4 text-center">
            <a
              href={`${LOGIN_CREDENCIALES}&callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="text-xs text-gray-500 hover:text-navy-950 underline underline-offset-2"
            >
              Entrar con email y contraseña
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Acceso solo para personal autorizado de JURMAQ.
        </p>
      </div>
    </div>
  );
}
