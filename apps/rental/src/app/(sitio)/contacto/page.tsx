import type { Metadata } from 'next';
import CabezaPagina from '@/components/CabezaPagina';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { jsonLdNegocio } from '@/lib/jsonld';
import { SITIO, enlaceWhatsapp } from '@/lib/sitio';

export const metadata: Metadata = {
  title: 'Contacto · Arriendo de Maquinaria JURMAQ',
  description: `Contacto del arriendo de maquinaria JURMAQ: ${SITIO.telefonoVisible}, ${SITIO.direccion}.`,
  alternates: { canonical: `${SITIO.url}/contacto` },
};

export default function Contacto() {
  return (
    <div className="sobre-claro">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdNegocio([])) }} />
      <CabezaPagina migas={[{ nombre: 'Contacto' }]} titulo="Hablemos de tu obra" />
      <div className="mx-auto max-w-[1320px] px-4 py-12 md:px-8 md:py-20">
      <a href={enlaceWhatsapp('Hola, quiero cotizar el arriendo de una máquina.')} rel="noopener" className="boton boton-principal w-full md:w-auto">Escribir por WhatsApp</a>
      <address className="mt-8 not-italic">
        <p><a href={`tel:${SITIO.telefono}`} className="font-titulo text-[clamp(2rem,4vw,3rem)] underline-offset-4 hover:underline">{SITIO.telefonoVisible}</a></p>
        <p className="mt-3 text-lg"><a href={`mailto:${SITIO.correo}`} className="underline underline-offset-4">{SITIO.correo}</a></p>
        <p className="mt-3 text-lg">{SITIO.direccion}</p>
      </address>
      <p className="mt-8 text-sm text-ink-muted">{SITIO.razonSocial}, RUT {SITIO.rut}</p>
      </div>
    </div>
  );
}
