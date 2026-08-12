import type { Metadata } from 'next';
import Link from 'next/link';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { whatsappCtaContacto } from '@jurmaq/shared/whatsapp';
import { IconWhatsapp } from '@jurmaq/shared/icons';
import WhatsappLink from '@/components/public/WhatsappLink';
import { getServiciosOrdenados } from '@/lib/servicios-obras-data';
import { PROYECTOS, getProyectosStats } from '@/lib/proyectos-data';
import {
  canonical,
  CONSTRUCTORA_URL,
  CONSTRUCTORA_INFO,
  COMUNAS_OBRA,
} from '@/lib/constructora-site';

const TITLE =
  'Constructora en Curicó y Región del Maule · Obras Civiles e Industriales · JURMAQ';
const DESCRIPTION =
  'Constructora de obras civiles e industriales en Curicó, Teno, Molina, Talca y toda la Región del Maule. Fundaciones, estructuras metálicas, pavimentos y mantención industrial. Obras ejecutadas para Nestlé, Miguel Torres, Iansagro y Surfrut.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonical('/') },
  keywords: [
    'constructora Curicó',
    'constructora Región del Maule',
    'obras civiles Curicó',
    'obras civiles Maule',
    'constructora industrial Talca',
    'empresa constructora Curicó',
    'contratista obras civiles agroindustria',
    'fundaciones industriales Maule',
    'estructuras metálicas Curicó',
    'mantención industrial Maule',
    'constructora Teno',
    'constructora Molina',
    'constructora Linares',
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: canonical('/'),
    siteName: 'Constructora JURMAQ',
    locale: 'es_CL',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

export default function ConstructoraHome() {
  const servicios = getServiciosOrdenados();
  const stats = getProyectosStats();
  const destacados = PROYECTOS.slice(0, 3);

  /**
   * JSON-LD `GeneralContractor` — subtipo específico de LocalBusiness para
   * constructoras. Es más preciso que el `LocalBusiness` genérico del hub y
   * ayuda a Google a entender que este subdominio es una entidad de obra
   * civil, no la misma cosa que el arriendo de maquinaria.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'GeneralContractor',
        '@id': `${CONSTRUCTORA_URL}/#organization`,
        name: 'Constructora JURMAQ',
        legalName: 'Constructora Jorge Ubilla Rivera E.I.R.L.',
        url: CONSTRUCTORA_URL,
        telephone: CONSTRUCTORA_INFO.telefono,
        description: DESCRIPTION,
        address: {
          '@type': 'PostalAddress',
          streetAddress: CONSTRUCTORA_INFO.streetAddress,
          addressLocality: CONSTRUCTORA_INFO.addressLocality,
          addressRegion: CONSTRUCTORA_INFO.addressRegion,
          addressCountry: CONSTRUCTORA_INFO.addressCountry,
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: CONSTRUCTORA_INFO.geo.latitude,
          longitude: CONSTRUCTORA_INFO.geo.longitude,
        },
        areaServed: COMUNAS_OBRA.map((c) => ({
          '@type': 'City',
          name: c.nombre,
          address: {
            '@type': 'PostalAddress',
            addressRegion: 'Región del Maule',
            addressCountry: 'CL',
          },
        })),
        knowsAbout: servicios.map((s) => s.nombre),
        parentOrganization: { '@id': 'https://jurmaq.cl/#organization' },
      },
      {
        '@type': 'WebSite',
        '@id': `${CONSTRUCTORA_URL}/#website`,
        url: CONSTRUCTORA_URL,
        name: 'Constructora JURMAQ',
        inLanguage: 'es-CL',
        publisher: { '@id': `${CONSTRUCTORA_URL}/#organization` },
      },
      ...servicios.map((s) => ({
        '@type': 'Service',
        '@id': canonical(`/servicios/${s.slug}#service`),
        name: s.nombre,
        description: s.metaDescription,
        serviceType: s.nombre,
        url: canonical(`/servicios/${s.slug}`),
        provider: { '@id': `${CONSTRUCTORA_URL}/#organization` },
        areaServed: { '@type': 'State', name: 'Región del Maule' },
      })),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative bg-navy-950 text-white overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 14px)',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 lg:pt-44 lg:pb-28">
          <div className="max-w-3xl">
            <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-gold-400 font-semibold">
              Curicó · Teno · Molina · Talca · Linares · Región del Maule
            </p>
            <h1 className="editorial-h1 mt-5 text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05] text-white">
              Obras civiles e industriales para plantas que no pueden parar
            </h1>
            <p className="mt-6 text-lg lg:text-xl text-white/75 leading-relaxed max-w-2xl">
              Fundaciones, estructuras metálicas, pavimentos y mantención
              industrial en la Región del Maule. Ejecutamos con planta en
              operación, con maquinaria, maestranza y barraca propias.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Link
                href="/cotizar-obra"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold rounded-lg transition-colors"
              >
                Cotizar una obra
              </Link>
              <WhatsappLink
                href={whatsappCtaContacto()}
                source="constructora_home_hero"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-white/25 hover:border-gold-400 hover:text-gold-400 text-white font-semibold rounded-lg transition-colors"
              >
                <IconWhatsapp className="w-5 h-5" />
                Hablar con un ejecutivo
              </WhatsappLink>
            </div>

            {/* Prueba dura, arriba del fold */}
            <dl className="mt-14 grid grid-cols-3 gap-6 max-w-lg border-t border-white/15 pt-7">
              <div>
                <dt className="text-[11px] uppercase tracking-widest text-white/50">
                  Obras documentadas
                </dt>
                <dd className="mt-1 text-2xl lg:text-3xl font-bold text-white">
                  {stats.totalObras}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-widest text-white/50">
                  UF ejecutadas
                </dt>
                <dd className="mt-1 text-2xl lg:text-3xl font-bold text-white">
                  {stats.totalUF.toLocaleString('es-CL')}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-widest text-white/50">
                  Mandantes
                </dt>
                <dd className="mt-1 text-2xl lg:text-3xl font-bold text-white">
                  {stats.clientesUnicos}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ── Mandantes ────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 font-semibold text-center">
            Han confiado la obra a JURMAQ
          </p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {Array.from(new Set(PROYECTOS.map((p) => p.cliente))).map((cliente) => (
              <li
                key={cliente}
                className="text-base sm:text-lg font-semibold text-neutral-400 tracking-tight"
              >
                {cliente}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Servicios ────────────────────────────────────────────────────── */}
      <section className="bg-[#FBFBFA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
          <p className="text-xs uppercase tracking-[0.18em] text-gold-600 font-semibold">
            Qué ejecutamos
          </p>
          <h2 className="editorial-h1 mt-3 text-3xl lg:text-4xl font-semibold text-navy-950 max-w-2xl">
            Seis alcances, todos con obra ejecutada detrás
          </h2>
          <p className="mt-4 text-neutral-600 max-w-2xl leading-relaxed">
            No listamos servicios que no hayamos hecho. Cada uno de estos enlaza
            a las obras reales donde lo ejecutamos, con mandante y ubicación.
          </p>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {servicios.map((s) => (
              <Link
                key={s.slug}
                href={`/servicios/${s.slug}`}
                className="group flex flex-col rounded-xl border border-neutral-200 bg-white p-6 hover:border-navy-950 hover:shadow-lg transition-all"
              >
                <p className="text-[11px] uppercase tracking-widest text-gold-600 font-semibold">
                  {s.eyebrow}
                </p>
                <h3 className="mt-3 text-xl font-semibold text-navy-950 leading-snug">
                  {s.nombre}
                </h3>
                <p className="mt-3 text-sm text-neutral-600 leading-relaxed flex-1">
                  {s.intro.split('. ')[0]}.
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-950 group-hover:text-gold-600 transition-colors">
                  Ver el servicio
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Diferenciador estructural ────────────────────────────────────── */}
      <section className="bg-navy-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-14 items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gold-400 font-semibold">
                Por qué contratarnos
              </p>
              <h2 className="editorial-h1 mt-3 text-3xl lg:text-4xl font-semibold text-white">
                Somos las cuatro cosas, no solo la constructora
              </h2>
              <p className="mt-5 text-white/70 leading-relaxed">
                Constructora, arriendo de maquinaria, maestranza y barraca de
                fierros son la misma empresa. Eso cambia cómo se comporta la
                obra: cuando el cálculo cambia un jueves, el acero sale de
                nuestra propia barraca; cuando falta una máquina, sale de
                nuestra flota. No hay tres proveedores culpándose entre sí.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/nosotros"
                  className="inline-flex items-center justify-center px-6 py-3 border border-white/25 hover:border-gold-400 hover:text-gold-400 font-semibold rounded-lg transition-colors"
                >
                  Conocer la empresa
                </Link>
                <Link
                  href="/proyectos"
                  className="inline-flex items-center justify-center px-6 py-3 bg-white/10 hover:bg-white/15 font-semibold rounded-lg transition-colors"
                >
                  Ver obras ejecutadas
                </Link>
              </div>
            </div>

            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-8">
              {[
                {
                  t: 'Maquinaria propia',
                  d: 'Excavadora, retroexcavadora Hidromek, minicargador Bobcat y miniexcavadora XCMG. Sin margen de intermediario ni espera de disponibilidad.',
                },
                {
                  t: 'Maestranza propia',
                  d: 'Fabricamos la estructura metálica en Curicó. El ajuste que aparece el martes en terreno se resuelve el miércoles.',
                },
                {
                  t: 'Barraca de fierros propia',
                  d: 'Acero, malla y perfiles salen de nuestra bodega en Molina. El proveedor deja de estar en la ruta crítica.',
                },
                {
                  t: 'Contratista local',
                  d: 'Operamos desde Curicó. Teno, Molina y Romeral a menos de media hora; Talca y Linares el mismo día.',
                },
              ].map((item) => (
                <div key={item.t} className="border-t border-white/15 pt-5">
                  <dt className="text-base font-semibold text-gold-400">{item.t}</dt>
                  <dd className="mt-2 text-sm text-white/65 leading-relaxed">{item.d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── Obras ────────────────────────────────────────────────────────── */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gold-600 font-semibold">
                Obra ejecutada
              </p>
              <h2 className="editorial-h1 mt-3 text-3xl lg:text-4xl font-semibold text-navy-950">
                Lo que hicimos, con nombre y apellido
              </h2>
            </div>
            <Link
              href="/proyectos"
              className="text-sm font-semibold text-navy-950 hover:text-gold-600 transition-colors"
            >
              Ver todas las obras →
            </Link>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {destacados.map((p) => (
              <Link
                key={p.slug}
                href={`/proyectos/${p.slug}`}
                className="group flex flex-col rounded-xl border border-neutral-200 overflow-hidden hover:border-navy-950 hover:shadow-lg transition-all"
              >
                <div className="relative h-40 bg-navy-950">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 12px)',
                    }}
                  />
                  <div className="absolute inset-0 flex items-end p-5">
                    <span className="text-white font-bold text-lg tracking-tight">
                      {p.cliente}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col flex-1 p-6">
                  <p className="text-[11px] uppercase tracking-widest text-neutral-500">
                    {p.ubicacion}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-navy-950 leading-snug">
                    {p.titulo}
                  </h3>
                  <p className="mt-3 text-sm text-neutral-600 leading-relaxed flex-1">
                    {p.descripcionCorta}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {p.servicios.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className="text-[11px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-600"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cobertura ────────────────────────────────────────────────────── */}
      <section className="bg-[#FBFBFA] border-t border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <p className="text-xs uppercase tracking-[0.18em] text-gold-600 font-semibold">
            Dónde trabajamos
          </p>
          <h2 className="editorial-h1 mt-3 text-3xl lg:text-4xl font-semibold text-navy-950 max-w-2xl">
            Toda la Región del Maule, desde Curicó
          </h2>
          <p className="mt-4 text-neutral-600 max-w-2xl leading-relaxed">
            Cada comuna tiene su propia página con el tejido industrial local y
            las obras que hemos ejecutado ahí.
          </p>
          <ul className="mt-9 flex flex-wrap gap-2.5">
            {COMUNAS_OBRA.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/obras-civiles-en/${c.slug}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-200 bg-white text-sm font-medium text-navy-950 hover:border-navy-950 transition-colors"
                >
                  {c.nombre}
                  {c.distanciaKm > 0 && (
                    <span className="text-xs text-neutral-400">{c.distanciaKm} km</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────────────────── */}
      <section className="bg-navy-950 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="editorial-h1 text-3xl lg:text-4xl font-semibold text-white">
            ¿Tienes una obra o una licitación en carpeta?
          </h2>
          <p className="mt-5 text-white/70 leading-relaxed max-w-2xl mx-auto">
            Cuéntanos el alcance y la ventana de ejecución. Te respondemos con
            una propuesta técnica y económica, y si necesitas carpeta de
            acreditación de contratista la preparamos durante la evaluación.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/cotizar-obra"
              className="inline-flex items-center justify-center px-7 py-3.5 bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold rounded-lg transition-colors"
            >
              Enviar antecedentes de la obra
            </Link>
            <WhatsappLink
              href={whatsappCtaContacto()}
              source="constructora_home_footer"
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
