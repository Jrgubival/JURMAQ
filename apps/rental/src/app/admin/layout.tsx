import type { Metadata } from 'next';
import Link from 'next/link';
import { PestanasAbajo, PestanasArriba } from '@/components/admin/PestanasPanel';
import { exigirSesion } from '@/lib/panel';

// Depende de la sesión de cada request: nunca se prerenderiza ni se cachea.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Panel · JURMAQ Arriendo', robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await exigirSesion();
  return (
    <div className="panel min-h-dvh pb-28 text-[1.25rem] leading-relaxed md:pb-8">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex h-20 max-w-4xl items-center justify-between px-4">
          <Link href="/admin" prefetch={false} className="font-titulo text-xl">JURMAQ Arriendo</Link>
          <PestanasArriba />
          <a href="/api/login/salir" className="inline-flex min-h-12 items-center px-3 text-lg underline underline-offset-4">Salir</a>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      <PestanasAbajo />
    </div>
  );
}
