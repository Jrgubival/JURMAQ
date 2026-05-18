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

export default function BarracaAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionWrapper>
      <AdminShell>{children}</AdminShell>
    </SessionWrapper>
  );
}
