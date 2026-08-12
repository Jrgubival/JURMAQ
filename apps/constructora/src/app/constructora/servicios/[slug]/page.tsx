import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { whatsappCtaContacto } from '@jurmaq/shared/whatsapp';
import { IconWhatsapp } from '@jurmaq/shared/icons';
import WhatsappLink from '@/components/public/WhatsappLink';
import {
  SERVICIOS_OBRAS,
  getServicioBySlug,
  getServiciosOrdenados,
} from '@/lib/servicios-obras-data';
import { getProyectoBySlug } from '@/lib/proyectos-data';
import {
  canonical,
  CONSTRUCTORA_URL,
  CONSTRUCTORA_INFO,
  COMUNAS_OBRA,
} from '@/lib/constructora-site';

export const dynamicParams = false;

export function generateStaticParams() {
  return SERVICIOS_OBRAS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const servicio = getServicioBySlug(slug);
  if (!servicio) return {};

  const title = `${servicio.nombre} en Curicó y Región del Maule · JURMAQ`;
  return {
    title,
    description: servicio.metaDescription,
    alternates: { canonical: canonical(`/servicios/${servicio.slug}`) },
    keywords: servicio.keywords,
    openGraph: {
      title,
      description: servicio.metaDescription,
      url: canonical(`/servicios/${servicio.slug}`),
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
}

export default async function ServicioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const servicio = getServicioBySlug(slug);
  if (!servicio) notFound();

  // Obras reales que demuestran este servicio. Filtramos los slugs que no
  // resuelven para que un typo en la data nunca renderice una card vacía.
  const proyectos = servicio.proyectosSlugs
    .map((s) => getProyectoBySlug(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const otrosServicios = getServiciosOrdenados().filter((s) => s.slug !== servicio.slug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': canonical(`/servicios/${servicio.slug}#service`),
        name: servicio.nombre,
        description: servicio.metaDescription,
        serviceType: servicio.nombre,
        url: canonical(`/servicios/${servicio.slug}`),
        provider: {
          '@type': 'GeneralContractor',
          '@id': `${CONSTRUCTORA_URL}/#organization`,
          name: 'Constructora JURMAQ',
          telephone: CONSTRUCTORA_INFO.telefono,
          url: CONSTRUCTORA_URL,
        },
        areaServed: COMUNAS_OBRA.map((c) => ({ '@type': 'City', name: c.nombre })),
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: `Alcances de ${servicio.nombreCorto}`,
          itemListElement: servicio.incluye.map((i) => ({
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name: i },
          })),
        },
      },
      {
        '@type': 'FAQPage',
        '@id': canonical(`/servicios/${servicio.slug}#faq`),
        mainEntity: servicio.faq.map((f) => ({
          '@type': 'Question',
          name: f.pregunta,
          acceptedAnswer: { '@type': 'Answer', text: f.respuesta },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: CONSTRUCTORA_URL },
          { '@type': 'ListItem', position: 2, name: 'Servicios', item: canonical('/servicios') },
          {
            '@type': 'ListItem',
            position: 3,
            name: servicio.nombreCorto,
            item: canonical(`/servicios/${servicio.slug}`),
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

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
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
            <Link href="/servicios" className="hover:text-gold-400 transition-colors">
              Servicios
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white/70">{servicio.nombreCorto}</span>
          </nav>

          <div className="max-w-3xl mt-8">
            <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-gold-400 font-semibold">
              {servicio.eyebrow}
            </p>
            <h1 className="editorial-h1 mt-5 text-4xl sm:text-5xl font-semibold leading-[1.08] text-white">
              {servicio.nombre} en Curicó y la Región del Maule
            </h1>
            <p className="mt-6 text-lg text-white/75 leading-relaxed">{servicio.intro}</p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Link
                href="/cotizar-obra"
                className="inline-flex items-center justify-center px-7 py-3.5 bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold rounded-lg transition-colors"
              >
                Cotizar este servicio
              </Link>
              <WhatsappLink
                href={whatsappCtaContacto()}
                source={`constructora_servicio_${servicio.slug}_hero`}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-white/25 hover:border-gold-400 hover:text-gold-400 font-semibold rounded-lg transition-colors"
              >
                <IconWhatsapp className="w-5 h-5" />
                Consultar por WhatsApp
              </WhatsappLink>
            </div>
          </div>
        </div>
      </section>

      {/* ── Qué incluye / a quién aplica ─────────────────────────────────── */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
            <div>
              <h2 className="editorial-h1 text-2xl lg:text-3xl font-semibold text-navy-950">
                Qué incluye el alcance
              </h2>
              <ul className="mt-7 space-y-3.5">
                {servicio.incluye.map((i) => (
                  <li key={i} className="flex gap-3 text-neutral-700 leading-relaxed">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="editorial-h1 text-2xl lg:text-3xl font-semibold text-navy-950">
                Para qué obras aplica
              </h2>
              <ul className="mt-7 space-y-3.5">
                {servicio.aplicaA.map((i) => (
                  <li key={i} className="flex gap-3 text-neutral-700 leading-relaxed">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-950" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Diferenciadores ──────────────────────────────────────────────── */}
      <section className="bg-[#FBFBFA] border-y border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <h2 className="editorial-h1 text-2xl lg:text-3xl font-semibold text-navy-950 max-w-2xl">
            Por qué este servicio funciona distinto con JURMAQ
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {servicio.diferenciadores.map((d) => (
              <div key={d.titulo} className="rounded-xl bg-white border border-neutral-200 p-6">
                <h3 className="text-lg font-semibold text-navy-950 leading-snug">{d.titulo}</h3>
                <p className="mt-3 text-sm text-neutral-600 leading-relaxed">{d.detalle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Prueba: obras reales ─────────────────────────────────────────── */}
      {proyectos.length > 0 && (
        <section className="bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <p className="text-xs uppercase tracking-[0.18em] text-gold-600 font-semibold">
              Obra ejecutada
            </p>
            <h2 className="editorial-h1 mt-3 text-2xl lg:text-3xl font-semibold text-navy-950 max-w-2xl">
              Dónde hicimos exactamente esto
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {proyectos.map((p) => (
                <Link
                  key={p.slug}
                  href={`/proyectos/${p.slug}`}
                  className="group rounded-xl border border-neutral-200 p-6 hover:border-navy-950 hover:shadow-lg transition-all"
                >
                  <p className="text-[11px] uppercase tracking-widest text-neutral-500">
                    {p.ubicacion}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-navy-950 leading-snug">
                    {p.cliente} — {p.titulo}
                  </h3>
                  <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
                    {p.descripcionCorta}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-950 group-hover:text-gold-600 transition-colors">
                    Ver la obra completa <span aria-hidden="true">→</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="bg-[#FBFBFA] border-t border-neutral-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <h2 className="editorial-h1 text-2xl lg:text-3xl font-semibold text-navy-950">
            Preguntas frecuentes
          </h2>
          <dl className="mt-9 divide-y divide-neutral-200 border-t border-neutral-200">
            {servicio.faq.map((f) => (
              <div key={f.pregunta} className="py-6">
                <dt className="text-base font-semibold text-navy-950">{f.pregunta}</dt>
                <dd className="mt-2.5 text-neutral-600 leading-relaxed">{f.respuesta}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Cobertura + otros servicios ──────────────────────────────────── */}
      <section className="bg-white border-t border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-sm uppercase tracking-[0.18em] text-neutral-500 font-semibold">
            {servicio.nombreCorto} por comuna
          </h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {COMUNAS_OBRA.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/obras-civiles-en/${c.slug}`}
                  className="inline-block px-3.5 py-1.5 rounded-lg border border-neutral-200 text-sm text-navy-950 hover:border-navy-950 transition-colors"
                >
                  {c.nombre}
                </Link>
              </li>
            ))}
          </ul>

          <h2 className="mt-12 text-sm uppercase tracking-[0.18em] text-neutral-500 font-semibold">
            Otros servicios
          </h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {otrosServicios.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/servicios/${s.slug}`}
                  className="inline-block px-3.5 py-1.5 rounded-lg border border-neutral-200 text-sm text-navy-950 hover:border-navy-950 transition-colors"
                >
                  {s.nombreCorto}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="bg-navy-950 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="editorial-h1 text-2xl lg:text-3xl font-semibold text-white">
            Cuéntanos el alcance y te cotizamos
          </h2>
          <p className="mt-4 text-white/70 leading-relaxed">
            Planos, ventana de ejecución o simplemente el problema. Con eso
            armamos la propuesta técnica y económica.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/cotizar-obra"
              className="inline-flex items-center justify-center px-7 py-3.5 bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold rounded-lg transition-colors"
            >
              Enviar antecedentes
            </Link>
            <WhatsappLink
              href={whatsappCtaContacto()}
              source={`constructora_servicio_${servicio.slug}_footer`}
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
