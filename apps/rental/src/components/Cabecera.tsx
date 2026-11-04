'use client';

import type { ComponentProps } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CabeceraGrupo } from '@jurmaq/shared/ui/grupo';
import { ENLACES } from '@/lib/enlaces';
import { SITIO } from '@/lib/sitio';

function Enlace(props: ComponentProps<typeof Link>) {
  return <Link prefetch={false} {...props} />;
}

export default function Cabecera() {
  const ruta = usePathname();
  // `key` remonta la cabecera al navegar: así el menú de celular se cierra solo.
  return (
    <CabeceraGrupo key={ruta} negocio="Arriendo" enlaces={ENLACES} actual={ruta} Enlace={Enlace}>
      <a href={`tel:${SITIO.telefono}`} className="solo-menu">Llamar {SITIO.telefonoVisible}</a>
      <Enlace href="/cotizar-arriendo" className="g-boton">Cotizar</Enlace>
    </CabeceraGrupo>
  );
}
