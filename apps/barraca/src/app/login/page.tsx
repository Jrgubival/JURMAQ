import type { Metadata } from 'next';
import { headers } from 'next/headers';
import LoginCodigo from './LoginCodigo';

export const metadata: Metadata = {
  title: 'Acceso administración · JURMAQ Barraca',
  robots: { index: false, follow: false },
};

/**
 * Sólo /admin… relativo: nada de "//", "/\\" ni caracteres de control (open
 * redirect). El middleware manda la URL absoluta del mismo sitio
 * (http://host/admin/…): se acepta sólo si el host es el de esta petición y
 * se reduce a su path.
 */
function safeCallback(url: string | undefined, host: string | null): string {
  if (url && host && /^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url);
      url = u.host === host ? `${u.pathname}${u.search}` : undefined;
    } catch {
      url = undefined;
    }
  }
  if (!url || !/^\/admin(?:[/?#][^\s\\]*)?$/.test(url) || /[\u0000-\u001f]/.test(url)) return '/admin';
  return url;
}

/**
 * Login del panel de barraca.jurmaq.cl (nov-2026): correo → código de 6
 * números por correo. Sin contraseña y sin Google. La lógica está en
 * @jurmaq/shared/auth/codigo-correo y el provider 'codigo-correo' de NextAuth
 * sólo se monta con AUTH_SCOPE=barraca.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const host = (await headers()).get('host');
  return <LoginCodigo callbackUrl={safeCallback(callbackUrl, host)} />;
}
