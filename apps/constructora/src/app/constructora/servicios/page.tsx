import type { Metadata } from 'next';
import Link from 'next/link';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { whatsappCtaContacto } from '@jurmaq/shared/whatsapp';
import { IconWhatsapp } from '@jurmaq/shared/icons';
import WhatsappLink from '@/components/public/WhatsappLink';
import { getServiciosOrdenados } from '@/lib/servicios-obras-data';
import { canonical, CONSTRUCTORA_URL, COMUNAS_OBRA } from '@/lib/constructora-site';

const TITLE = 'Servicios de Obra Civil e Industrial en Curicó y Maule · JURMAQ';
const DESCRIPTION =
  'Fundaciones, estructuras metálicas, pavimentos industriales, cubiertas, mantención industrial y movimiento de tierras en Curicó, Talca, Linares y toda la Región del Maule.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonical('/servicios') },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: canonical('/servicios'),
    siteName: 'Constructora JURMAQ',
    locale: 'es_CL',
    type: 'website',
  },
};

export default function ServiciosIndex() {
  const servicios = getServiciosOrdenados();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': canonical('/servicios'),
        name: TITLE,
        description: DESCRIPTION,
        url: canonical('/servicios'),
        isPartOf: { '@id': `${CONSTRUCTORA_URL}/#website` },
      },
      {
        '@type': 'ItemList',
        itemListElement: servicios.map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: s.nombre,
          url: canonical(`/servicios/${s.slug}`),
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: CONSTRUCTORA_URL },
          { '@type': 'ListItem', position: 2, name: 'Servicios', item: canonical('/servicios') },
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18">
          <nav aria-label="Migas de pan" className="text-xs text-neutral-500">
            <Link href="/" className="hover:text-navy-950 transition-colors">
              Inicio
            </Link>
            <span className="mx-2">/</span>
            <span className="text-neutral-700">Servicios</span>
          </nav>
          <p className="mt-8 text-xs uppercase tracking-[0.18em] text-gold-600 font-semibold">
            Obra civil e industrial
          </p>
          <h1 className="editorial-h1 mt-3 text-4xl lg:text-5xl font-semibold text-navy-950 max-w-3xl leading-[1.08]">
            Servicios de obra civil en Curicó y la Región del Maule
          </h1>
          <p className="mt-5 text-lg text-neutral-600 max-w-2xl leading-relaxed">
            {DESCRIPTION} Cada servicio enlaza a las obras reales donde lo
            ejecutamos, con mandante, ubicación y alcance.
          </p>
        </div>
      </section>

      <section className="bg-[#FBFBFA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="grid gap-6 lg:grid-cols-2">
            {servicios.map((s) => (
              <article
                key={s.slug}
                className="flex flex-col rounded-xl border border-neutral-200 bg-white p-7 hover:border-navy-950 hover:shadow-lg transition-all"
              >
                <p className="text-[11px] uppercase tracking-widest text-gold-600 font-semibold">
                  {s.eyebrow}
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-navy-950 leading-snug">
                  <Link href={`/servicios/${s.slug}`} className="hover:text-gold-600 transition-colors">
                    {s.nombre}
                  </Link>
                </h2>
                <p className="mt-3 text-neutral-600 leading-relaxed">{s.intro}</p>
                <ul className="mt-5 flex flex-wrap gap-1.5">
                  {s.incluye.slice(0, 4).map((i) => (
                    <li
                      key={i}
                      className="text-xs px-2.5 py-1 rounded bg-neutral-100 text-neutral-600"
                    >
                      {i}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/servicios/${s.slug}`}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-950 hover:text-gold-600 transition-colors"
                >
                  Ver el servicio completo <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>

          <div className="mt-14">
            <h2 className="text-sm uppercase tracking-[0.18em] text-neutral-500 font-semibold">
              Obra civil por comuna
            </h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {COMUNAS_OBRA.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/obras-civiles-en/${c.slug}`}
                    className="inline-block px-3.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-sm text-navy-950 hover:border-navy-950 transition-colors"
                  >
                    {c.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-navy-950 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="editorial-h1 text-2xl lg:text-3xl font-semibold text-white">
            ¿No calza exactamente con ninguno?
          </h2>
          <p className="mt-4 text-white/70 leading-relaxed">
            La mayoría de las obras combinan varios alcances. Cuéntanos el
            problema y armamos la propuesta.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/cotizar-obra"
              className="inline-flex items-center justify-center px-7 py-3.5 bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold rounded-lg transition-colors"
            >
              Cotizar una obra
            </Link>
            <WhatsappLink
              href={whatsappCtaContacto()}
              source="constructora_servicios_index"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-white/25 hover:border-gold-400 hover:text-gold-400 font-semibold rounded-lg transition-colors"
            >
              <IconWhatsapp className="w-5 h-5" />
              Hablar por WhatsApp
            </WhatsappLink>
          </div>
        </div>
      </section>
    </>
  );
}
