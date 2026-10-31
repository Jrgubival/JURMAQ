/**
 * Layout admin de Barraca (anidado bajo `/admin/*`).
 *
 * El layout RAÍZ (apps/barraca/src/app/layout.tsx) sigue montando metadata
 * SEO, globals.css y BarracaShell para todo el sitio público. Este layout
 * anidado SOLO afecta `/admin/*` y reemplaza el shell público con el
 * AdminShell (sidebar + sesión + RBAC).
 *
 * SEO: `/admin/*` está bloqueado en `robots.txt` (`Disallow: /admin/`) y
 * no aparece en sitemap.xml — cero impacto en indexación.
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@jurmaq/shared/auth';
import SessionWrapper from '@/components/admin/SessionWrapper';
import AdminShell from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

/**
 * Reforzamos el bloqueo de indexación a nivel HTML (además del robots.txt).
 * Útil para crawlers que ignoran robots.txt o si alguien llega a /admin
 * por link directo.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function BarracaAdminLayout({ children }: { children: React.ReactNode }) {
  // En cada carga: auth() revisa en la base que la cuenta siga permitida
  // (callback jwt de @jurmaq/shared/auth). Sin sesión válida, al login.
  const session = await auth();
  // /api/login/salir borra la cookie (un componente de servidor no puede) y lleva al login.
  if (!session?.user) redirect('/api/login/salir');
  return (
    <SessionWrapper>
      <AdminShell>{children}</AdminShell>
    </SessionWrapper>
  );
}
