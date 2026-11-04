import type { ComponentProps } from 'react';
import Link from 'next/link';
import { PieGrupo } from '@jurmaq/shared/ui/grupo';
import { COMUNAS } from '@/data/comunas';
import { PRIVACIDAD_URL, SITIO, TERMINOS_URL } from '@/lib/sitio';

function Enlace(props: ComponentProps<typeof Link>) {
  return <Link prefetch={false} {...props} />;
}

const comuna = (c: { slug: string; nombre: string }) => ({ href: `/arriendo-en/${c.slug}`, texto: c.nombre });

export default function Pie({ tipos }: { tipos: { slug: string; nombre: string }[] }) {
  return (
    // Espacio para la barra fija de Cotizar y WhatsApp en celular.
    <div className="bg-[#f4f5f7] pb-20 md:pb-0">
      <PieGrupo
        sitio="arriendo"
        negocio="Arriendo"
        texto={`Arriendo de maquinaria en la Región del Maule desde ${SITIO.anioInicio}.`}
        telefono={SITIO.telefono}
        telefonoDisplay={SITIO.telefonoVisible}
        correo={SITIO.correo}
        direccion={SITIO.direccion}
        columnas={[
          { titulo: 'Maquinarias', enlaces: [...tipos.map((t) => ({ href: `/arriendo/${t.slug}`, texto: t.nombre })), { href: '/recursos', texto: 'Guías de arriendo' }] },
          { titulo: 'Comunas', enlaces: COMUNAS.slice(0, 6).map(comuna) },
          { titulo: 'Más comunas', enlaces: COMUNAS.slice(6).map(comuna) },
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
