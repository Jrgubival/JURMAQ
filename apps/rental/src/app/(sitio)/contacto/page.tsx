import type { Metadata } from 'next';
import Migas from '@/components/Migas';
import { SITIO, enlaceWhatsapp } from '@/lib/sitio';

export const metadata: Metadata = {
  title: 'Contacto · Arriendo de Maquinaria JURMAQ',
  description: `Contacto del arriendo de maquinaria JURMAQ: ${SITIO.telefonoVisible}, ${SITIO.direccion}.`,
  alternates: { canonical: `${SITIO.url}/contacto` },
};

export default function Contacto() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Migas items={[{ nombre: 'Contacto' }]} />
      <h1 className="mt-4 text-4xl">Contacto</h1>
      <address className="mt-6 space-y-3 not-italic text-lg">
        <p><a href={`tel:${SITIO.telefono}`} className="underline underline-offset-4">{SITIO.telefonoVisible}</a></p>
        <p><a href={`mailto:${SITIO.correo}`} className="underline underline-offset-4">{SITIO.correo}</a></p>
        <p>{SITIO.direccion}</p>
      </address>
      <a href={enlaceWhatsapp('Hola, quiero cotizar el arriendo de una máquina.')} rel="noopener" className="boton boton-principal mt-6">Escribir por WhatsApp</a>
      <p className="mt-8 text-sm text-ink-muted">{SITIO.razonSocial} · RUT {SITIO.rut}</p>
    </div>
  );
}
