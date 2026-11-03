import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirSesion } from '@/lib/panel';

export const metadata: Metadata = { title: 'Panel · JURMAQ Rental', robots: { index: false, follow: false } };

const PESTANAS = [
  { href: '/admin', texto: 'Hoy' },
  { href: '/admin/maquinas', texto: 'Máquinas' },
  { href: '/admin/cotizaciones', texto: 'Cotizaciones' },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await exigirSesion();
  return (
    <div className="min-h-dvh pb-24 text-[1.0625rem] md:pb-8">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/admin" prefetch={false} className="font-titulo text-xl font-semibold">JURMAQ Rental</Link>
          <nav className="hidden gap-2 md:flex" aria-label="Panel">
            {PESTANAS.map((p) => <Link key={p.href} href={p.href} prefetch={false} className="boton boton-suave">{p.texto}</Link>)}
          </nav>
          <a href="/api/login/salir" className="text-sm underline underline-offset-4">Salir</a>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-hairline bg-surface md:hidden" aria-label="Panel">
        {PESTANAS.map((p) => <Link key={p.href} href={p.href} prefetch={false} className="presionable flex h-16 items-center justify-center font-semibold">{p.texto}</Link>)}
      </nav>
    </div>
  );
}
