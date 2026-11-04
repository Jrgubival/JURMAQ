'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PESTANAS = [
  { href: '/admin', texto: 'Hoy' },
  { href: '/admin/maquinas', texto: 'Máquinas' },
  { href: '/admin/cotizaciones', texto: 'Cotizaciones' },
];

function activa(ruta: string, href: string) {
  return href === '/admin' ? ruta === href : ruta.startsWith(href);
}

export function PestanasArriba() {
  const ruta = usePathname();
  return (
    <nav className="hidden gap-1 md:flex" aria-label="Panel">
      {PESTANAS.map((p) => (
        <Link key={p.href} href={p.href} prefetch={false} aria-current={activa(ruta, p.href) ? 'page' : undefined} className={`presionable flex min-h-9 items-center rounded-[10px] px-3 font-semibold ${activa(ruta, p.href) ? 'bg-negro text-white' : ''}`}>{p.texto}</Link>
      ))}
    </nav>
  );
}

/** Se oculta al llenar un formulario: ahí manda el botón Guardar. */
export function PestanasAbajo() {
  const ruta = usePathname();
  if (/\/(nueva|editar)$/.test(ruta) || /\/maquinas\/[^/]+$/.test(ruta)) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Panel">
      {PESTANAS.map((p) => (
        <Link key={p.href} href={p.href} prefetch={false} aria-current={activa(ruta, p.href) ? 'page' : undefined} className={`presionable flex h-14 items-center justify-center font-semibold ${activa(ruta, p.href) ? 'bg-negro text-white' : ''}`}>{p.texto}</Link>
      ))}
    </nav>
  );
}
