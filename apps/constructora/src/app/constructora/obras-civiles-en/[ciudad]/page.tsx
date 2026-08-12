import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { whatsappCtaContacto } from '@jurmaq/shared/whatsapp';
import { IconWhatsapp } from '@jurmaq/shared/icons';
import WhatsappLink from '@/components/public/WhatsappLink';
import { getServiciosOrdenados } from '@/lib/servicios-obras-data';
import { PROYECTOS } from '@/lib/proyectos-data';
import {
  canonical,
  CONSTRUCTORA_URL,
  CONSTRUCTORA_INFO,
  COMUNAS_OBRA,
  getComunaBySlug,
} from '@/lib/constructora-site';

export const dynamicParams = false;

export function generateStaticParams() {
  return COMUNAS_OBRA.map((c) => ({ ciudad: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ciudad: string }>;
}): Promise<Metadata> {
  const { ciudad } = await params;
  const comuna = getComunaBySlug(ciudad);
  if (!comuna) return {};

  const title = `Constructora en ${comuna.nombre} · Obras Civiles e Industriales · JURMAQ`;
  const description = `Constructora de obras civiles e industriales en ${comuna.nombre}, Región del Maule: fundaciones, estructuras metálicas, pavimentos y mantención industrial. ${
    comuna.distanciaKm === 0
      ? 'Oficina central en Curicó.'
      : `A ${comuna.distanciaKm} km de nuestra base en Curicó.`
  } Cotiza tu obra.`;

  return {
    title,
    description,
    alternates: { canonical: canonical(`/obras-civiles-en/${comuna.slug}`) },
    keywords: [
      `constructora ${comuna.nombre}`,
      `obras civiles ${comuna.nombre}`,
      `empresa constructora ${comuna.nombre}`,
      `constructora industrial ${comuna.nombre}`,
      `contratista ${comuna.nombre}`,
      `fundaciones ${comuna.nombre}`,
      `estructuras metálicas ${comuna.nombre}`,
      `mantención industrial ${comuna.nombre}`,
      'Región del Maule',
    ],
    openGraph: {
      title,
      description,
      url: canonical(`/obras-civiles-en/${comuna.slug}`),
      siteName: 'Constructora JURMAQ',
      locale: 'es_CL',
      type: 'website',
    },
    other: {
      'geo.region': 'CL-ML',
      'geo.placename': `${comuna.nombre}, Región del Maule, Chile`,
      'geo.position': `${comuna.geo.lat};${comuna.geo.lng}`,
      ICBM: `${comuna.geo.lat}, ${comuna.geo.lng}`,
    },
  };
}

export default async function ObrasEnComunaPage({
  params,
}: {
  params: Promise<{ ciudad: string }>;
}) {
  const { ciudad } = await params;
  const comuna = getComunaBySlug(ciudad);
  if (!comuna) notFound();

  const servicios = getServiciosOrdenados();
  // Obras que ejecutamos EN esta comuna. `ubicacion` es texto libre
  // ("Planta Nestlé, Teno · Región del Maule"), así que matcheamos por nombre.
  const proyectosLocales = PROYECTOS.filter((p) =>
    p.ubicacion.toLowerCase().includes(comuna.nombre.toLowerCase())
  );
  const otrasComunas = COMUNAS_OBRA.filter((c) => c.slug !== comuna.slug);

  const tiempoRespuesta =
    comuna.distanciaKm === 0
      ? 'Estamos acá mismo'
      : comuna.distanciaKm <= 30
        ? 'Menos de 40 minutos desde nuestra base'
        : comuna.distanciaKm <= 80
          ? 'Alrededor de una hora desde Curicó'
          : 'Mismo día desde Curicó';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'GeneralContractor',
        '@id': canonical(`/obras-civiles-en/${comuna.slug}#business`),
        name: `Constructora JURMAQ — ${comuna.nombre}`,
        parentOrganization: { '@id': `${CONSTRUCTORA_URL}/#organization` },
        url: canonical(`/obras-civiles-en/${comuna.slug}`),
        telephone: CONSTRUCTORA_INFO.telefono,
        address: {
          '@type': 'PostalAddress',
          streetAddress: CONSTRUCTORA_INFO.streetAddress,
          addressLocality: CONSTRUCTORA_INFO.addressLocality,
          addressRegion: CONSTRUCTORA_INFO.addressRegion,
          addressCountry: CONSTRUCTORA_INFO.addressCountry,
        },
        areaServed: {
          '@type': 'City',
          name: comuna.nombre,
          address: {
            '@type': 'PostalAddress',
            addressLocality: comuna.nombre,
            addressRegion: 'Región del Maule',
            addressCountry: 'CL',
          },
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: comuna.geo.lat,
          longitude: comuna.geo.lng,
        },
        makesOffer: servicios.map((s) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: `${s.nombre} en ${comuna.nombre}`,
            url: canonical(`/servicios/${s.slug}`),
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: CONSTRUCTORA_URL },
          {
            '@type': 'ListItem',
            position: 2,
            name: `Obras civiles en ${comuna.nombre}`,
            item: canonical(`/obras-civiles-en/${comuna.slug}`),
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
            <span className="text-white/70">Obras civiles en {comuna.nombre}</span>
          </nav>

          <div className="max-w-3xl mt-8">
            <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-gold-400 font-semibold">
              Provincia de {comuna.provincia} · Región del Maule
            </p>
            <h1 className="editorial-h1 mt-5 text-4xl sm:text-5xl font-semibold leading-[1.08] text-white">
              Constructora de obras civiles e industriales en {comuna.nombre}
            </h1>
            <p className="mt-6 text-lg text-white/75 leading-relaxed">
              {comuna.nombre} es {comuna.industria}. Ahí ejecutamos fundaciones,
              estructura metálica, pavimentos industriales y mantención de
              planta, con maquinaria, maestranza y barraca propias.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Link
                href="/cotizar-obra"
                className="inline-flex items-center justify-center px-7 py-3.5 bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold rounded-lg transition-colors"
              >
                Cotizar obra en {comuna.nombre}
              </Link>
              <WhatsappLink
                href={whatsappCtaContacto()}
                source={`constructora_comuna_${comuna.slug}_hero`}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-white/25 hover:border-gold-400 hover:text-gold-400 font-semibold rounded-lg transition-colors"
              >
                <IconWhatsapp className="w-5 h-5" />
                Hablar con un ejecutivo
              </WhatsappLink>
            </div>

            <dl className="mt-12 grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-xl border-t border-white/15 pt-7">
              <div>
                <dt className="text-[11px] uppercase tracking-widest text-white/50">
                  Desde Curicó
                </dt>
                <dd className="mt-1 text-xl font-bold text-white">
                  {comuna.distanciaKm === 0 ? 'Base' : `${comuna.distanciaKm} km`}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-widest text-white/50">
                  Movilización
                </dt>
                <dd className="mt-1 text-sm font-semibold text-white leading-snug">
                  {tiempoRespuesta}
                </dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-[11px] uppercase tracking-widest text-white/50">
                  Obras acá
                </dt>
                <dd className="mt-1 text-xl font-bold text-white">
                  {proyectosLocales.length > 0 ? proyectosLocales.length : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ── Rubros locales ───────────────────────────────────────────────── */}
      <section className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <h2 className="editorial-h1 text-2xl lg:text-3xl font-semibold text-navy-950 max-w-2xl">
            Con quién trabajamos en {comuna.nombre}
          </h2>
          <ul className="mt-7 flex flex-wrap gap-2.5">
            {comuna.rubros.map((r) => (
              <li
                key={r}
                className="px-4 py-2 rounded-lg bg-neutral-100 text-sm font-medium text-navy-950"
              >
                {r}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Obras locales (prueba) ───────────────────────────────────────── */}
      {proyectosLocales.length > 0 && (
        <section className="bg-[#FBFBFA] border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <p className="text-xs uppercase tracking-[0.18em] text-gold-600 font-semibold">
              Obra ejecutada en {comuna.nombre}
            </p>
            <h2 className="editorial-h1 mt-3 text-2xl lg:text-3xl font-semibold text-navy-950">
              No es cobertura teórica: acá ya trabajamos
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {proyectosLocales.map((p) => (
                <Link
                  key={p.slug}
                  href={`/proyectos/${p.slug}`}
                  className="group rounded-xl border border-neutral-200 bg-white p-6 hover:border-navy-950 hover:shadow-lg transition-all"
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
                    Ver la obra <span aria-hidden="true">→</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Servicios en esta comuna ─────────────────────────────────────── */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="editorial-h1 text-2xl lg:text-3xl font-semibold text-navy-950 max-w-2xl">
            Qué ejecutamos en {comuna.nombre}
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {servicios.map((s) => (
              <Link
                key={s.slug}
                href={`/servicios/${s.slug}`}
                className="group rounded-xl border border-neutral-200 p-6 hover:border-navy-950 hover:shadow-lg transition-all"
              >
                <h3 className="text-lg font-semibold text-navy-950 leading-snug">
                  {s.nombreCorto} en {comuna.nombre}
                </h3>
                <p className="mt-2.5 text-sm text-neutral-600 leading-relaxed">
                  {s.intro.split('. ')[0]}.
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-950 group-hover:text-gold-600 transition-colors">
                  Ver servicio <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Otras comunas ────────────────────────────────────────────────── */}
      <section className="bg-[#FBFBFA] border-t border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <h2 className="text-sm uppercase tracking-[0.18em] text-neutral-500 font-semibold">
            También trabajamos en
          </h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {otrasComunas.map((c) => (
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
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="bg-navy-950 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="editorial-h1 text-2xl lg:text-3xl font-semibold text-white">
            ¿Obra en {comuna.nombre}?
          </h2>
          <p className="mt-4 text-white/70 leading-relaxed">
            {tiempoRespuesta}. Cuéntanos el alcance y coordinamos una visita a
            terreno.
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
              source={`constructora_comuna_${comuna.slug}_footer`}
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
