'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CabeceraGrupo } from '@jurmaq/shared/ui/grupo';

const ENLACES = [
  { href: '/#empresas', texto: 'Empresas' },
  { href: '/nosotros', texto: 'Nosotros' },
  { href: '/contacto', texto: 'Contacto' },
];

export default function CabeceraHub() {
  const ruta = usePathname();
  return <CabeceraGrupo enlaces={ENLACES} actual={ruta} Enlace={Link} />;
}
