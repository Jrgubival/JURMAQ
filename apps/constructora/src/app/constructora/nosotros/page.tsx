import type { Metadata } from 'next';
import Link from 'next/link';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { whatsappCtaContacto } from '@jurmaq/shared/whatsapp';
import { IconWhatsapp } from '@jurmaq/shared/icons';
import WhatsappLink from '@/components/public/WhatsappLink';
import { getProyectosStats, PROYECTOS } from '@/lib/proyectos-data';
import { getServiciosOrdenados } from '@/lib/servicios-obras-data';
import {
  canonical,
  CONSTRUCTORA_URL,
  CONSTRUCTORA_INFO,
  COMUNAS_OBRA,
} from '@/lib/constructora-site';

const TITLE = 'Constructora JURMAQ · Empresa de Obras Civiles en Curicó, Maule';
const DESCRIPTION =
  'Constructora Jorge Ubilla Rivera E.I.R.L. — obras civiles e industriales en la Región del Maule desde Curicó. Maquinaria, maestranza y barraca de fierros propias. Mandantes: Nestlé, Miguel Torres, Iansagro, Surfrut y Cementos Biobío.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonical('/nosotros') },
  keywords: [
    'constructora Curicó empresa',
    'Constructora Jorge Ubilla Rivera',
    'empresa constructora Región del Maule',
    'contratista industrial Maule',
    'JURMAQ constructora',
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: canonical('/nosotros'),
    siteName: 'Constructora JURMAQ',
    locale: 'es_CL',
    type: 'website',
  },
};

/** Las cuatro unidades. Es el diferenciador estructural, no un adorno. */
const UNIDADES = [
  {
    t: 'Constructora',
    d: 'Obra civil e industrial: fundaciones, estructura, pavimentos, cubiertas y mantención de planta.',
    href: '/servicios',
    externo: false,
  },
  {
    t: 'Arriendo de maquinaria',
    d: 'Flota propia: excavadora, retroexcavadora Hidromek, minicargador Bobcat y miniexcavadora XCMG.',
    href: 'https://jurmaq.cl/maquinarias',
    externo: true,
  },
  {
    t: 'Maestranza',
    d: 'Fabricación y reparación de estructura metálica en Curicó, con capacidad de ajuste en obra.',
    href: '/servicios/estructuras-metalicas-y-montaje-industrial',
    externo: false,
  },
  {
    t: 'Barraca de fierros',
    d: 'Acero, mallas, perfiles y materiales desde nuestra bodega en Molina, con más de 1.600 productos.',
    href: 'https://barraca.jurmaq.cl',
    externo: true,
  },
];

export default function NosotrosPage() {
  const stats = getProyectosStats();
  const servicios = getServiciosOrdenados();
  const clientes = Array.from(new Set(PROYECTOS.map((p) => p.cliente)));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AboutPage',
        '@id': canonical('/nosotros'),
        name: TITLE,
        description: DESCRIPTION,
        url: canonical('/nosotros'),
        isPartOf: { '@id': `${CONSTRUCTORA_URL}/#website` },
        about: { '@id': `${CONSTRUCTORA_URL}/#organization` },
      },
      {
        '@type': 'GeneralContractor',
        '@id': `${CONSTRUCTORA_URL}/#organization`,
        name: 'Constructora JURMAQ',
        legalName: 'Constructora Jorge Ubilla Rivera E.I.R.L.',
        taxID: '76.624.872-1',
        url: CONSTRUCTORA_URL,
        telephone: CONSTRUCTORA_INFO.telefono,
        address: {
          '@type': 'PostalAddress',
          streetAddress: CONSTRUCTORA_INFO.streetAddress,
          addressLocality: CONSTRUCTORA_INFO.addressLocality,
          addressRegion: CONSTRUCTORA_INFO.addressRegion,
          addressCountry: CONSTRUCTORA_INFO.addressCountry,
        },
        knowsAbout: servicios.map((s) => s.nombre),
        areaServed: COMUNAS_OBRA.map((c) => ({ '@type': 'City', name: c.nombre })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: CONSTRUCTORA_URL },
          { '@type': 'ListItem', position: 2, name: 'Nosotros', item: canonical('/nosotros') },
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

      <section className="relative bg-navy-950 text-white overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 14px)',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 lg:pt-40 lg:pb-20">
          <nav aria-label="Migas de pan" className="text-xs text-white/50">
            <Link href="/" className="hover:text-gold-400 transition-colors">
              Inicio
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white/70">Nosotros</span>
          </nav>
          <div className="max-w-3xl mt-8">
            <p className="text-xs uppercase tracking-[0.2em] text-gold-400 font-semibold">
              {CONSTRUCTORA_INFO.nombre} · Curicó
            </p>
            <h1 className="editorial-h1 mt-5 text-4xl sm:text-5xl font-semibold leading-[1.08] text-white">
              La constructora que además es su propio proveedor
            </h1>
            <p className="mt-6 text-lg text-white/75 leading-relaxed">
              Operamos desde Maquehua, Curicó, con obra ejecutada en plantas
              industriales y agroindustriales de toda la Región del Maule.
              Maquinaria, maestranza y barraca de fierros son nuestras: eso
              acorta los plazos y saca a los intermediarios de la ruta crítica.
            </p>
          </div>
        </div>
      </section>

      {/* Cifras */}
      <section className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-neutral-500">
                Obras documentadas
              </dt>
              <dd className="mt-1.5 text-3xl font-bold text-navy-950">{stats.totalObras}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-neutral-500">
                UF ejecutadas
              </dt>
              <dd className="mt-1.5 text-3xl font-bold text-navy-950">
                {stats.totalUF.toLocaleString('es-CL')}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-neutral-500">
                Mandantes industriales
              </dt>
              <dd className="mt-1.5 text-3xl font-bold text-navy-950">{stats.clientesUnicos}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-neutral-500">
                Comunas con cobertura
              </dt>
              <dd className="mt-1.5 text-3xl font-bold text-navy-950">{COMUNAS_OBRA.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Unidades */}
      <section className="bg-[#FBFBFA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <h2 className="editorial-h1 text-2xl lg:text-3xl font-semibold text-navy-950 max-w-2xl">
            Cuatro unidades, una sola empresa
          </h2>
          <p className="mt-4 text-neutral-600 max-w-2xl leading-relaxed">
            La mayoría de las constructoras de la zona subcontratan maquinaria y
            compran el acero afuera. Nosotros no, y por eso podemos comprometer
            plazos que de otro modo dependerían de terceros.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {UNIDADES.map((u) => (
              <Link
                key={u.t}
                href={u.href}
                {...(u.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="group rounded-xl border border-neutral-200 bg-white p-6 hover:border-navy-950 hover:shadow-lg transition-all"
              >
                <h3 className="text-lg font-semibold text-navy-950">{u.t}</h3>
                <p className="mt-2.5 text-sm text-neutral-600 leading-relaxed">{u.d}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-950 group-hover:text-gold-600 transition-colors">
                  {u.externo ? 'Ir al sitio' : 'Ver más'} <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Mandantes + datos legales */}
      <section className="bg-white border-t border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
            <div>
              <h2 className="editorial-h1 text-2xl lg:text-3xl font-semibold text-navy-950">
                Mandantes
              </h2>
              <p className="mt-4 text-neutral-600 leading-relaxed">
                Empresas que nos han contratado obra civil o mantención
                industrial. Cada una tiene su obra documentada.
              </p>
              <ul className="mt-7 space-y-2.5">
                {clientes.map((c) => (
                  <li key={c} className="text-lg font-semibold text-navy-950">
                    {c}
                  </li>
                ))}
              </ul>
              <Link
                href="/proyectos"
                className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-950 hover:text-gold-600 transition-colors"
              >
                Ver las obras ejecutadas <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div>
              <h2 className="editorial-h1 text-2xl lg:text-3xl font-semibold text-navy-950">
                Antecedentes de la empresa
              </h2>
              <dl className="mt-7 divide-y divide-neutral-200 border-t border-neutral-200">
                {[
                  ['Razón social', 'Constructora Jorge Ubilla Rivera E.I.R.L.'],
                  ['RUT', '76.624.872-1'],
                  ['Nombre comercial', 'Constructora JURMAQ'],
                  ['Dirección', CONSTRUCTORA_INFO.direccionLegal],
                  ['Teléfono', CONSTRUCTORA_INFO.telefonoDisplay],
                ].map(([k, v]) => (
                  <div key={k} className="py-4 grid grid-cols-[9rem_1fr] gap-4">
                    <dt className="text-sm text-neutral-500">{k}</dt>
                    <dd className="text-sm font-medium text-navy-950">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 text-sm text-neutral-500 leading-relaxed">
                Trabajamos con mandantes que exigen acreditación de contratistas
                y documentación laboral al día. Podemos entregar la carpeta
                durante la evaluación.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-navy-950 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="editorial-h1 text-2xl lg:text-3xl font-semibold text-white">
            Conversemos tu obra
          </h2>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/cotizar-obra"
              className="inline-flex items-center justify-center px-7 py-3.5 bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold rounded-lg transition-colors"
            >
              Cotizar una obra
            </Link>
            <WhatsappLink
              href={whatsappCtaContacto()}
              source="constructora_nosotros_footer"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-white/25 hover:border-gold-400 hover:text-gold-400 font-semibold rounded-lg transition-colors"
            >
              <IconWhatsapp className="w-5 h-5" />
              {CONSTRUCTORA_INFO.telefonoDisplay}
            </WhatsappLink>
          </div>
        </div>
      </section>
    </>
  );
}
