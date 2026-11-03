import type { Metadata } from 'next';
import CabezaPagina from '@/components/CabezaPagina';
import { SITIO, enlaceWhatsapp } from '@/lib/sitio';

export const metadata: Metadata = {
  title: 'Contacto · Arriendo de Maquinaria JURMAQ',
  description: `Contacto del arriendo de maquinaria JURMAQ: ${SITIO.telefonoVisible}, ${SITIO.direccion}.`,
  alternates: { canonical: `${SITIO.url}/contacto` },
};

export default function Contacto() {
  return (
    <div className="sobre-claro">
      <CabezaPagina migas={[{ nombre: 'Contacto' }]} titulo="Hablemos de tu obra" />
      <div className="mx-auto max-w-[1320px] px-4 py-12 md:px-8 md:py-20">
      <address className="space-y-3 font-titulo text-[clamp(1.75rem,4vw,3rem)] font-medium not-italic leading-tight">
        <p><a href={`tel:${SITIO.telefono}`} className="underline underline-offset-4">{SITIO.telefonoVisible}</a></p>
        <p><a href={`mailto:${SITIO.correo}`} className="underline underline-offset-4">{SITIO.correo}</a></p>
        <p>{SITIO.direccion}</p>
      </address>
      <a href={enlaceWhatsapp('Hola, quiero cotizar el arriendo de una máquina.')} rel="noopener" className="boton boton-principal mt-6">Escribir por WhatsApp</a>
      <p className="mt-8 text-sm text-ink-muted">{SITIO.razonSocial}, RUT {SITIO.rut}</p>
      </div>
    </div>
  );
}
