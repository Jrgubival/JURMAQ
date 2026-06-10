import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabasePublic } from '@jurmaq/shared/supabase';
import { CIUDADES, TIPOS_MAQUINA, HQ, DISTANCIAS_CONSTRUCTORA, operaElCliente } from '@jurmaq/shared/seo';
import { formatCLP } from '@jurmaq/shared/format';
import { precioPublicoDesde } from '@/lib/pricing-arriendo';
import { whatsappCtaCiudadTipo } from '@jurmaq/shared/whatsapp';
import { maquinariaHref } from '@/lib/maquinaria-slug';
import Breadcrumbs from '@jurmaq/shared/ui/Breadcrumbs';

/**
 * Tier 7 G1: Cross landings programáticas [ciudad] × [tipo].
 *
 * URL: /arriendo-en/[ciudad]/[tipo]  ej: /arriendo-en/curico/retroexcavadora
 *
 * Cada landing tiene contenido único combinando:
 *   - Contexto local de la ciudad (rubros, vecinas, distancia, tiempo despacho)
 *   - Casos de uso + FAQs del tipo de máquina
 *   - JSON-LD HardwareStore con geo coords del cliente (no de HQ)
 *
 * Generamos N×M páginas estáticas en build. Total: CIUDADES.length ×
 * TIPOS_MAQUINA.length (~10 ciudades × 9 tipos = 90 landings).
 *
 * SEO: contenido único garantizado por la combinación. Cada página tiene
 * H1 distinto, FAQs específicos del tipo aplicados al contexto local,
 * cross-links a otras ciudades del mismo tipo y otros tipos en la misma
 * ciudad (internal linking).
 */

interface Maquinaria {
  id: number;
  nombre: string;
  tipo: string;
  tarifa_neta: number | null;
  unidad_tarifa: 'hora' | 'dia' | null;
  minimo_unidades: number | null;
  estado: string;
  imagen: string | null;
}

export const dynamic = 'force-static';
export const revalidate = 86400; // 24h ISR — precios y stock pueden cambiar

export async function generateStaticParams() {
  // Cartesian product ciudad × tipo.
  return CIUDADES.flatMap((c) =>
    TIPOS_MAQUINA.map((t) => ({ ciudad: c.slug, tipo: t.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ciudad: string; tipo: string }>;
}): Promise<Metadata> {
  const { ciudad, tipo } = await params;
  const c = CIUDADES.find((x) => x.slug === ciudad);
  const t = TIPOS_MAQUINA.find((x) => x.slug === tipo);
  if (!c || !t) return { title: 'Página no encontrada' };

  const title = `Arriendo de ${t.nombre} en ${c.nombre} · JURMAQ`;
  const description = `${t.nombrePlural} en arriendo para ${c.nombre} (${c.region}). Despacho en ${DISTANCIAS_CONSTRUCTORA[c.slug].tiempo} desde Curicó. ${t.descripcionCorta} Cotiza por WhatsApp con disponibilidad inmediata.`;

  return {
    title,
    description,
    keywords: [
      `arriendo ${t.nombre.toLowerCase()} ${c.nombre}`,
      `arriendo ${t.nombrePlural.toLowerCase()} ${c.nombre}`,
      `${t.nombre.toLowerCase()} en ${c.nombre}`,
      `${t.nombre.toLowerCase()} ${c.region}`,
      ...(t.operadorIncluido ? [`arriendo ${t.nombre.toLowerCase()} con operador ${c.nombre}`] : []),
      `arriendo maquinaria ${c.nombre}`,
      ...c.comunasVecinas.map((cv) => `arriendo ${t.nombre.toLowerCase()} ${cv}`),
      'JURMAQ',
    ],
    openGraph: {
      title,
      description,
      url: `https://jurmaq.cl/arriendo-en/${c.slug}/${t.slug}`,
      siteName: 'JURMAQ',
      locale: 'es_CL',
      type: 'website',
    },
    alternates: {
      canonical: `https://jurmaq.cl/arriendo-en/${c.slug}/${t.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function CiudadTipoLanding({
  params,
}: {
  params: Promise<{ ciudad: string; tipo: string }>;
}) {
  const { ciudad, tipo } = await params;
  const c = CIUDADES.find((x) => x.slug === ciudad);
  const t = TIPOS_MAQUINA.find((x) => x.slug === tipo);
  if (!c || !t) notFound();

  // Máquinas reales del tipo desde DB. Filtramos por tipo_db (col 'tipo' en
  // maquinarias) para mostrar opciones reales con precio "desde".
  const { data: maquinariasRaw } = await supabasePublic
    .from('maquinarias')
    .select('id, nombre, tipo, tarifa_neta, unidad_tarifa, minimo_unidades, estado, imagen')
    .eq('tipo', t.tipoDb)
    .order('nombre');

  const maquinarias = (maquinariasRaw ?? []) as Maquinaria[];

  // Coords HQ desde la lista de ciudades (Curicó) — constructora despacha
  // desde Maquehua, Curicó. Usamos Curicó centroide como aproximación SEO.
  const HQ_CITY = CIUDADES.find((x) => x.slug === 'curico') ?? CIUDADES[0];

  // JSON-LD Service + LocalBusiness con geo coords del CLIENTE (no HQ) para
  // capturar Pack local de Google en la ciudad específica.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        name: `Arriendo de ${t.nombre} en ${c.nombre}`,
        provider: {
          '@type': 'LocalBusiness',
          name: 'JURMAQ',
          telephone: HQ.telefono,
          address: {
            '@type': 'PostalAddress',
            streetAddress: HQ.direccion,
            addressLocality: HQ.ciudad,
            addressRegion: HQ.region,
            addressCountry: 'CL',
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: HQ_CITY.lat,
            longitude: HQ_CITY.lng,
          },
        },
        areaServed: {
          '@type': 'City',
          name: c.nombre,
          containedInPlace: {
            '@type': 'AdministrativeArea',
            name: c.region,
          },
        },
        // Geo target: ciudad del cliente, no Molina.
        serviceArea: {
          '@type': 'GeoCircle',
          geoMidpoint: {
            '@type': 'GeoCoordinates',
            latitude: c.lat,
            longitude: c.lng,
          },
          geoRadius: '15000',
        },
        description: t.descripcionLarga,
      },
      {
        '@type': 'FAQPage',
        mainEntity: t.preguntasFrecuentes.map((faq) => ({
          '@type': 'Question',
          name: faq.q.replace('Curicó', c.nombre),
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.a.replace('Curicó', c.nombre),
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://jurmaq.cl' },
          {
            '@type': 'ListItem',
            position: 2,
            name: `Arriendo en ${c.nombre}`,
            item: `https://jurmaq.cl/arriendo-en/${c.slug}`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: `${t.nombre} en ${c.nombre}`,
            item: `https://jurmaq.cl/arriendo-en/${c.slug}/${t.slug}`,
          },
        ],
      },
    ],
  };

  // Otros tipos en la misma ciudad (internal linking horizontal).
  const otrosTipos = TIPOS_MAQUINA.filter((x) => x.slug !== t.slug).slice(0, 6);
  // Otras ciudades para este tipo (internal linking vertical).
  const otrasCiudades = CIUDADES.filter((x) => x.slug !== c.slug);

  const ctaWa = whatsappCtaCiudadTipo(c.slug, c.nombre, t.slug, t.nombre);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="bg-gradient-to-br from-gray-50 to-white min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
          <Breadcrumbs
            variant="light"
            className="mb-6"
            items={[
              { label: "Inicio", href: "/" },
              { label: `Arriendo en ${c.nombre}`, href: `/arriendo-en/${c.slug}` },
              { label: t.nombre },
            ]}
          />

          {/* H1 + intro */}
          <header className="mb-8">
            <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
              Arriendo en {c.region}
            </p>
            <h1 className="text-3xl md:text-5xl font-bold text-navy-950 leading-tight mb-4">
              Arriendo de {t.nombre} en {c.nombre}
            </h1>
            <p className="text-lg text-gray-700 max-w-3xl">
              {t.descripcionLarga}
            </p>
          </header>

          {/* Contexto local + CTA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                ¿Por qué arrendar en {c.nombre}?
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">{c.contextoLocal}</p>
              <p className="text-gray-700 leading-relaxed">
                Estamos a <strong>{DISTANCIAS_CONSTRUCTORA[c.slug].km} km</strong> de tu obra ({DISTANCIAS_CONSTRUCTORA[c.slug].tiempo} de
                despacho desde nuestra base en Curicó). Trabajamos habitualmente con{' '}
                {c.rubroLocal.slice(0, 3).join(', ')} en la zona.
              </p>
              <div className="mt-4 text-sm text-gray-500">
                <strong>Comunas cubiertas cerca:</strong>{' '}
                {[c.nombre, ...c.comunasVecinas].join(' · ')}
              </div>
            </div>

            <aside className="bg-navy-950 text-white rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <p className="text-yellow-400 text-xs uppercase tracking-wider mb-2 font-semibold">
                  Disponibilidad
                </p>
                <p className="text-2xl font-bold mb-1">
                  {maquinarias.filter((m) => m.estado === 'disponible').length} unidades
                </p>
                <p className="text-sm text-gray-300 mb-4">
                  disponibles ahora en {c.nombre}
                </p>
              </div>
              <a
                href={ctaWa}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Cotizar por WhatsApp →
              </a>
              <Link
                href={`/cotizar-arriendo?tipo=${t.slug}`}
                className="block w-full text-center bg-white text-navy-950 font-semibold py-2.5 rounded-xl mt-2 hover:bg-gray-100 transition-colors text-sm"
              >
                Cotización online
              </Link>
            </aside>
          </div>

          {/* Casos de uso */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-navy-950 mb-4">
              Trabajos típicos con {t.nombre.toLowerCase()} en {c.nombre}
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {t.casosDeUso.map((caso) => (
                <li
                  key={caso}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-start gap-2"
                >
                  <span className="text-orange-500 font-bold shrink-0">→</span>
                  <span className="text-gray-700">{caso}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Maquinarias reales disponibles */}
          {maquinarias.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-navy-950 mb-4">
                {t.nombrePlural} disponibles para {c.nombre}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {maquinarias.slice(0, 6).map((m) => {
                  const precioDesde = precioPublicoDesde({
                    tarifa_neta: m.tarifa_neta,
                    unidad_tarifa: m.unidad_tarifa,
                    minimo_unidades: m.minimo_unidades,
                  });
                  return (
                    <Link
                      key={m.id}
                      href={maquinariaHref(m)}
                      className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-orange-300 transition"
                    >
                      <p className="font-bold text-navy-950 group-hover:text-orange-600">
                        {m.nombre}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {m.estado === 'disponible' ? '✓ Disponible' : 'Bajo demanda'}
                      </p>
                      {precioDesde && (
                        <p className="mt-3 text-sm text-gray-700">
                          Desde <strong>{formatCLP(precioDesde)}</strong> /{m.unidad_tarifa}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Especificaciones técnicas */}
          <section className="mb-10 bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-navy-950 mb-4">
              Especificaciones técnicas
            </h2>
            <ul className="space-y-2">
              {t.especificacionesClave.map((spec) => (
                <li key={spec} className="text-gray-700 flex items-start gap-2">
                  <span className="text-orange-500 shrink-0">•</span>
                  <span>{spec}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* FAQs adaptados a la ciudad */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-navy-950 mb-4">
              Preguntas frecuentes ({t.nombre} en {c.nombre})
            </h2>
            <div className="space-y-3">
              {t.preguntasFrecuentes.map((faq, i) => (
                <details
                  key={i}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 group"
                >
                  <summary className="cursor-pointer font-semibold text-navy-950 group-open:text-orange-600">
                    {faq.q.replace('Curicó', c.nombre)}
                  </summary>
                  <p className="mt-3 text-gray-700 leading-relaxed">
                    {faq.a.replace('Curicó', c.nombre)}
                  </p>
                </details>
              ))}
            </div>
          </section>

          {/* Internal linking: otros tipos en esta ciudad */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-navy-950 mb-4">
              Otras máquinas para arrendar en {c.nombre}
            </h2>
            <div className="flex flex-wrap gap-2">
              {otrosTipos.map((ot) => (
                <Link
                  key={ot.slug}
                  href={`/arriendo-en/${c.slug}/${ot.slug}`}
                  className="px-4 py-2 bg-white border border-gray-200 hover:border-orange-300 text-gray-700 rounded-full text-sm transition"
                >
                  {ot.nombre} en {c.nombre} →
                </Link>
              ))}
            </div>
          </section>

          {/* Internal linking: este tipo en otras ciudades */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-navy-950 mb-4">
              {t.nombrePlural} también en otras ciudades del Maule
            </h2>
            <div className="flex flex-wrap gap-2">
              {otrasCiudades.map((oc) => (
                <Link
                  key={oc.slug}
                  href={`/arriendo-en/${oc.slug}/${t.slug}`}
                  className="px-4 py-2 bg-white border border-gray-200 hover:border-orange-300 text-gray-700 rounded-full text-sm transition"
                >
                  {t.nombre} en {oc.nombre}
                </Link>
              ))}
            </div>
          </section>

          {/* CTA final */}
          <section className="bg-navy-950 text-white rounded-3xl p-8 md:p-10 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              ¿Necesitas {t.nombre.toLowerCase()} en {c.nombre} esta semana?
            </h2>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Despacho en {DISTANCIAS_CONSTRUCTORA[c.slug].tiempo} desde Curicó.{' '}
              {t.operadorIncluido
                ? t.tipoDb === 'camion'
                  ? 'Conductor incluido en la tarifa.'
                  : 'Operador incluido en la tarifa.'
                : operaElCliente(t.tipoDb)
                  ? 'Equipo listo para operar por tu equipo.'
                  : 'Equipo con mantención al día.'}{' '}
              Cotiza ahora y nos contactamos en menos de 1 hora hábil.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={ctaWa}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
              >
                📲 WhatsApp ahora
              </a>
              <Link
                href={`/cotizar-arriendo?tipo=${t.slug}`}
                className="inline-block bg-white text-navy-950 font-semibold px-8 py-3 rounded-xl hover:bg-gray-100 transition-colors"
              >
                Cotización online
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
