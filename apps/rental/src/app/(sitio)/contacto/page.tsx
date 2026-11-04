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
        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-[12px] border border-hairline bg-surface p-6 shadow-[var(--sombra-baja)] md:p-8">
            <h2 className="medio">Cotiza por WhatsApp</h2>
            <p className="mt-4 max-w-[44ch] text-lg text-ink-soft">Indícanos el equipo, la comuna y las fechas.</p>
            <a href={enlaceWhatsapp('Hola, quiero cotizar el arriendo de una máquina.')} rel="noopener" className="boton boton-principal mt-8 w-full sm:w-auto">Escribir por WhatsApp</a>
          </div>
          <address className="not-italic md:p-8">
            <p className="text-sm text-ink-muted">Teléfono</p>
            <p className="mt-1"><a href={`tel:${SITIO.telefono}`} className="font-titulo text-[clamp(1.75rem,3vw,2.25rem)] tabular-nums underline-offset-4 hover:underline">{SITIO.telefonoVisible}</a></p>
            <p className="mt-6 text-sm text-ink-muted">Correo</p>
            <p className="mt-1 text-lg"><a href={`mailto:${SITIO.correo}`} className="underline underline-offset-4">{SITIO.correo}</a></p>
            <p className="mt-6 text-sm text-ink-muted">Dirección</p>
            <p className="mt-1 text-lg">{SITIO.direccion}</p>
          </address>
        </div>
      </div>
    </div>
  );
}
