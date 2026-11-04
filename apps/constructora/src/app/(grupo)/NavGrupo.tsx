'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ENLACES = [
  { href: '/#empresas', texto: 'Empresas' },
  { href: '/nosotros', texto: 'Nosotros' },
  { href: '/contacto', texto: 'Contacto' },
];

export default function NavGrupo() {
  const ruta = usePathname();
  return (
    <nav aria-label="Principal">
      {ENLACES.map((e) => (
        <Link key={e.href} href={e.href} aria-current={ruta === e.href ? 'page' : undefined}>
          {e.texto}
        </Link>
      ))}
    </nav>
  );
}
