import type { Metadata } from 'next';
import { headers } from 'next/headers';
import LoginCodigo from './LoginCodigo';

export const metadata: Metadata = {
  title: 'Acceso · JURMAQ Arriendo',
  robots: { index: false, follow: false },
};

/** Sólo /admin relativo o del mismo host: evita open redirect. */
function callbackSeguro(url: string | undefined, host: string | null): string {
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

export default async function Login({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  const host = (await headers()).get('host');
  return <LoginCodigo callbackUrl={callbackSeguro(callbackUrl, host)} />;
}
