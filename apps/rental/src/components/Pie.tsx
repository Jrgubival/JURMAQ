import type { ComponentProps } from 'react';
import Link from 'next/link';
import { PieGrupo, URL_HUB, NEGOCIOS } from '@jurmaq/shared/ui/grupo';
import { COMUNAS } from '@/data/comunas';
import { PRIVACIDAD_URL, SITIO, TERMINOS_URL } from '@/lib/sitio';

function Enlace(props: ComponentProps<typeof Link>) {
  return <Link prefetch={false} {...props} />;
}

export default function Pie({ tipos }: { tipos: { slug: string; nombre: string }[] }) {
  return (
    // Espacio para la barra fija de Cotizar y WhatsApp en celular.
    <div className="bg-[#f4f5f7] pb-20 md:pb-0">
      <PieGrupo
        negocio="Arriendo"
        texto={`Arriendo de maquinaria en la Región del Maule desde ${SITIO.anioInicio}.`}
        telefono={SITIO.telefono}
        telefonoDisplay={SITIO.telefonoVisible}
        correo={SITIO.correo}
        direccion={SITIO.direccion}
        columnas={[
          { titulo: 'Maquinarias', enlaces: tipos.map((t) => ({ href: `/arriendo/${t.slug}`, texto: t.nombre })) },
          { titulo: 'Comunas', enlaces: COMUNAS.map((c) => ({ href: `/arriendo-en/${c.slug}`, texto: c.nombre })) },
          {
            titulo: 'Grupo JURMAQ',
            enlaces: [
              { href: URL_HUB, texto: 'Inicio del grupo' },
              { href: NEGOCIOS.barraca.url, texto: NEGOCIOS.barraca.nombre },
              { href: NEGOCIOS.constructora.url, texto: NEGOCIOS.constructora.nombre },
            ],
          },
        ]}
        legal={[`${SITIO.razonSocial}, RUT ${SITIO.rut}`]}
        enlacesLegales={[
          { href: TERMINOS_URL, texto: 'Términos' },
          { href: PRIVACIDAD_URL, texto: 'Privacidad' },
        ]}
        Enlace={Enlace}
      />
    </div>
  );
}
