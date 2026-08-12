import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { whatsappCtaContacto } from '@jurmaq/shared/whatsapp';
import { IconWhatsapp } from '@jurmaq/shared/icons';
import WhatsappLink from '@/components/public/WhatsappLink';
import { ContactForm } from '@/components/public/ContactForm';
import { canonical, CONSTRUCTORA_URL, CONSTRUCTORA_INFO } from '@/lib/constructora-site';

const TITLE = 'Cotizar Obra Civil o Industrial en Curicó y Maule · JURMAQ';
const DESCRIPTION =
  'Envíanos los antecedentes de tu obra civil o industrial en la Región del Maule y te respondemos con propuesta técnica y económica. Licitaciones, contratos de mantención y obras por administración.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonical('/cotizar-obra') },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: canonical('/cotizar-obra'),
    siteName: 'Constructora JURMAQ',
    locale: 'es_CL',
    type: 'website',
  },
};

/** Qué mandar para que la propuesta sea precisa a la primera. */
const ANTECEDENTES = [
  {
    t: 'Alcance y ubicación',
    d: 'Qué hay que ejecutar y en qué planta o terreno. Con la comuna basta para partir.',
  },
  {
    t: 'Ventana de ejecución',
    d: 'Si hay detención programada, temporada de proceso o una fecha comprometida con tu cliente.',
  },
  {
    t: 'Planos o especificaciones',
    d: 'Si existen. Si no, coordinamos visita a terreno y levantamos nosotros.',
  },
  {
    t: 'Requisitos de acreditación',
    d: 'Si tu empresa exige carpeta de contratista, dínoslo y la preparamos durante la evaluación.',
  },
];

export default function CotizarObraPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ContactPage',
        '@id': canonical('/cotizar-obra'),
        name: TITLE,
        description: DESCRIPTION,
        url: canonical('/cotizar-obra'),
        isPartOf: { '@id': `${CONSTRUCTORA_URL}/#website` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: CONSTRUCTORA_URL },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Cotizar obra',
            item: canonical('/cotizar-obra'),
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <section className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <nav aria-label="Migas de pan" className="text-xs text-neutral-500">
            <Link href="/" className="hover:text-navy-950 transition-colors">
              Inicio
            </Link>
            <span className="mx-2">/</span>
            <span className="text-neutral-700">Cotizar obra</span>
          </nav>
          <p className="mt-8 text-xs uppercase tracking-[0.18em] text-gold-600 font-semibold">
            Propuesta técnica y económica
          </p>
          <h1 className="editorial-h1 mt-3 text-4xl lg:text-5xl font-semibold text-navy-950 max-w-3xl leading-[1.08]">
            Cotiza tu obra civil o industrial
          </h1>
          <p className="mt-5 text-lg text-neutral-600 max-w-2xl leading-relaxed">
            Cuéntanos qué necesitas ejecutar. Un ejecutivo revisa los
            antecedentes y coordina visita a terreno si hace falta antes de
            emitir la propuesta.
          </p>
        </div>
      </section>

      <section className="bg-[#FBFBFA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid lg:grid-cols-[1fr_minmax(0,32rem)] gap-12 lg:gap-16 items-start">
            {/* Columna informativa */}
            <div>
              <h2 className="editorial-h1 text-2xl font-semibold text-navy-950">
                Qué nos sirve que nos mandes
              </h2>
              <dl className="mt-8 space-y-7">
                {ANTECEDENTES.map((a) => (
                  <div key={a.t} className="border-l-2 border-gold-500 pl-5">
                    <dt className="text-base font-semibold text-navy-950">{a.t}</dt>
                    <dd className="mt-1.5 text-neutral-600 leading-relaxed">{a.d}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-10 rounded-xl border border-neutral-200 bg-white p-6">
                <p className="text-sm font-semibold text-navy-950">
                  ¿Es urgente o es una emergencia estructural?
                </p>
                <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                  Para daño de cubierta, falla estructural o una detención que ya
                  está corriendo, escríbenos directo. Movilizamos con prioridad.
                </p>
                <WhatsappLink
                  href={whatsappCtaContacto()}
                  source="constructora_cotizar_obra_urgencia"
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-navy-950 hover:bg-navy-900 text-white text-sm font-bold rounded-lg transition-colors"
                >
                  <IconWhatsapp className="w-4 h-4" />
                  {CONSTRUCTORA_INFO.telefonoDisplay}
                </WhatsappLink>
              </div>
            </div>

            {/* Formulario */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-navy-950">
                Antecedentes de la obra
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                Te respondemos en horario hábil. Sin compromiso.
              </p>
              <div className="mt-6">
                <Suspense
                  fallback={<div className="animate-pulse bg-neutral-100 rounded-xl h-96" />}
                >
                  <ContactForm
                    servicioInicial="constructora"
                    mensajePlaceholder="Ej: Necesitamos ampliar la fundación de la línea 2 en nuestra planta de Teno, con ventana de detención en julio…"
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
