import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { supabasePublic } from "@jurmaq/shared/supabase";
import { CIUDADES, TIPOS_MAQUINA, HQ, LEGAL_INFO, DISTANCIAS_CONSTRUCTORA } from "@jurmaq/shared/seo";
import { formatCLP } from "@jurmaq/shared/format";
import { precioPublicoDesde } from "@/lib/pricing-arriendo";
import { whatsappCtaCiudad } from "@jurmaq/shared/whatsapp";
import WhatsappLink from "@/components/public/WhatsappLink";
import { maquinariaHref } from "@/lib/maquinaria-slug";
import CrossLinksGrid from "@jurmaq/shared/ui/CrossLinksGrid";
import Breadcrumbs from "@jurmaq/shared/ui/Breadcrumbs";
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';

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

export async function generateStaticParams() {
  return CIUDADES.map((c) => ({ ciudad: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ciudad: string }>;
}): Promise<Metadata> {
  const { ciudad } = await params;
  const c = CIUDADES.find((x) => x.slug === ciudad);
  if (!c) return { title: "Ciudad no encontrada" };

  return {
    title: `Arriendo de Maquinaria en ${c.nombre} · JURMAQ ${c.region}`,
    description: `Arriendo de retroexcavadora, miniexcavadora, minicargador, brazo articulado y maquinaria pesada en ${c.nombre} (${c.region}). Despacho desde Curicó en ${DISTANCIAS_CONSTRUCTORA[c.slug].tiempo}. Servicio para ${c.rubroLocal.slice(0, 2).join(" y ")}. JURMAQ +25 años.`,
    keywords: [
      `arriendo maquinaria ${c.nombre}`,
      `arriendo retroexcavadora ${c.nombre}`,
      `arriendo miniexcavadora ${c.nombre}`,
      `arriendo minicargador ${c.nombre}`,
      `arriendo brazo articulado ${c.nombre}`,
      `arriendo plataforma elevadora ${c.nombre}`,
      `maquinaria pesada ${c.nombre}`,
      `arriendo maquinaria con operador ${c.nombre}`,
      `arriendo maquinaria ${c.region}`,
      ...c.comunasVecinas.map((cv) => `arriendo maquinaria ${cv}`),
      "JURMAQ",
    ],
    openGraph: {
      title: `Arriendo de Maquinaria en ${c.nombre} · JURMAQ`,
      description: `Maquinaria pesada en ${c.nombre} con despacho en ${DISTANCIAS_CONSTRUCTORA[c.slug].tiempo} desde nuestra base en Curicó. Cotiza por WhatsApp.`,
      url: `https://jurmaq.cl/arriendo-en/${c.slug}`,
      siteName: "JURMAQ",
      locale: "es_CL",
      type: "website",
      images: [
        { url: "/icon-512.png", width: 512, height: 512, alt: `JURMAQ — Arriendo de Maquinaria en ${c.nombre}` },
      ],
    },
    alternates: {
      canonical: `https://jurmaq.cl/arriendo-en/${c.slug}`,
    },
  };
}

function formatPrice(price: number): string {
  return `${formatCLP(price)}/día`;
}

export default async function ArriendoEnCiudadPage({
  params,
}: {
  params: Promise<{ ciudad: string }>;
}) {
  const { ciudad } = await params;
  const c = CIUDADES.find((x) => x.slug === ciudad);
  if (!c) notFound();

  const { data: machinesRaw } = await supabasePublic
    .from("maquinarias")
    .select("id, nombre, tipo, tarifa_neta, unidad_tarifa, minimo_unidades, estado, imagen")
    .eq("estado", "disponible")
    .limit(12);
  const machines: Maquinaria[] = (machinesRaw || []) as Maquinaria[];

  // Comunas vecinas que tambien tienen landing — para cluster SEO local.
  const vecinasConLanding = c.comunasVecinas
    .map((nombre) => CIUDADES.find((x) => x.nombre === nombre))
    .filter((x): x is NonNullable<typeof x> => !!x && x.slug !== c.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `https://jurmaq.cl/arriendo-en/${c.slug}#business`,
        name: `JURMAQ — Arriendo de Maquinaria en ${c.nombre}`,
        description: `Arriendo de retroexcavadora, miniexcavadora, minicargador, brazo articulado y maquinaria pesada en ${c.nombre}. Despacho en ${DISTANCIAS_CONSTRUCTORA[c.slug].tiempo} desde Curicó.`,
        url: `https://jurmaq.cl/arriendo-en/${c.slug}`,
        telephone: HQ.telefono,
        priceRange: "$$",
        areaServed: {
          "@type": "City",
          name: c.nombre,
          containedInPlace: { "@type": "AdministrativeArea", name: c.region },
        },
        // Coordenadas de la ciudad atendida — mejora SEO local (Maps Pack).
        geo: {
          "@type": "GeoCoordinates",
          latitude: c.lat,
          longitude: c.lng,
        },
        address: {
          "@type": "PostalAddress",
          streetAddress: LEGAL_INFO.brands.constructora.streetAddress,
          addressLocality: LEGAL_INFO.brands.constructora.addressLocality,
          addressRegion: LEGAL_INFO.brands.constructora.addressRegion,
          addressCountry: LEGAL_INFO.brands.constructora.addressCountry,
        },
      },
      {
        "@type": "Service",
        "@id": `https://jurmaq.cl/arriendo-en/${c.slug}#service`,
        name: `Arriendo de Maquinaria en ${c.nombre}`,
        serviceType: "Arriendo de maquinaria pesada",
        description: `Arriendo de retroexcavadora, miniexcavadora, minicargador, brazo articulado y maquinaria pesada en ${c.nombre}. Despacho en ${DISTANCIAS_CONSTRUCTORA[c.slug].tiempo} desde Curicó.`,
        provider: { "@id": `https://jurmaq.cl/arriendo-en/${c.slug}#business` },
        areaServed: { "@type": "City", name: c.nombre, containedInPlace: { "@type": "AdministrativeArea", name: c.region } },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `¿Cuánto cuesta arrendar maquinaria en ${c.nombre}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `El valor de arriendo varía según el tipo de maquinaria (retroexcavadora, miniexcavadora, minicargador, brazo articulado) y la duración del trabajo. Cotiza por WhatsApp y te enviamos precio personalizado para tu obra en ${c.nombre}.`,
            },
          },
          {
            "@type": "Question",
            name: `¿Incluye operador?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: "Depende del equipo. Retroexcavadora, miniexcavadora y minicargador se arriendan siempre con operador certificado incluido en la tarifa, y el camión tolva con conductor incluido — no pagas extra. Estas máquinas las opera únicamente personal de JURMAQ: no se arriendan solas. Las plataformas de elevación (brazo articulado, plataforma tijera y alzahombre) se entregan listas para operar por tu equipo, con curso de operación vigente.",
            },
          },
          {
            "@type": "Question",
            name: `¿Cuánto demora el despacho a ${c.nombre}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `Despachamos desde Curicó en ${DISTANCIAS_CONSTRUCTORA[c.slug].tiempo} (${DISTANCIAS_CONSTRUCTORA[c.slug].km} km). Para urgencias y obras programadas coordinamos horarios específicos.`,
            },
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: "https://jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: "Arriendo en " + c.nombre, item: `https://jurmaq.cl/arriendo-en/${c.slug}` },
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

      <article className="bg-white">
        <header className="bg-navy-950 text-white py-20 lg:py-28 border-b border-navy-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumbs
              variant="dark"
              className="mb-6"
              items={[
                { label: "Inicio", href: "/" },
                { label: `Arriendo en ${c.nombre}` },
              ]}
            />
            <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-[0.22em] mb-6">
              {c.nombre} · {DISTANCIAS_CONSTRUCTORA[c.slug].km} km de Curicó · {DISTANCIAS_CONSTRUCTORA[c.slug].tiempo}
            </p>
            <h1
              className="text-white leading-[1.05] mb-6 max-w-3xl"
              style={{ fontSize: 'clamp(2.25rem, 5vw, 4rem)', fontWeight: 500, letterSpacing: '-0.015em' }}
            >
              Arriendo de maquinaria en{' '}
              <span className="font-[var(--font-serif)] italic text-gold-400" style={{ fontWeight: 400 }}>
                {c.nombre}
              </span>.
            </h1>
            <p className="text-base lg:text-lg text-white/75 max-w-3xl mb-3 leading-relaxed">
              Servicio para {c.rubroLocal.join(", ")}.
            </p>
            <p className="text-sm lg:text-base text-white/65 max-w-3xl mb-10 leading-relaxed">{c.contextoLocal}</p>
            <div className="flex flex-wrap gap-3">
              <WhatsappLink
                href={whatsappCtaCiudad(c.slug, c.nombre)}
                source={`arriendo_ciudad_${c.slug}_hero`}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Cotizar por WhatsApp
              </WhatsappLink>
              <Link
                href="/maquinarias"
                className="inline-flex items-center gap-2 bg-white text-navy-950 hover:bg-gray-100 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Ver flota completa
              </Link>
            </div>
          </div>
        </header>

        {/* Tipos de máquina disponibles para esta ciudad — CrossLinksGrid editorial */}
        <CrossLinksGrid
          eyebrow={`Maquinaria · ${c.nombre} y comunas vecinas`}
          title={`Tipos disponibles para arriendo en ${c.nombre}`}
          subtitle="Flota propia con mantención al día. Despacho coordinado desde nuestra base en Curicó."
          items={TIPOS_MAQUINA.map((t) => ({
            label: `${t.nombre} en ${c.nombre}`,
            href: `/arriendo/${t.slug}`,
          }))}
        />

        {/* Logística */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
              Despacho desde Curicó a {c.nombre}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-3xl font-bold text-gold-600 mb-2">{DISTANCIAS_CONSTRUCTORA[c.slug].km} km</div>
                <p className="text-gray-700">Distancia desde nuestra base en Curicó</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-3xl font-bold text-gold-600 mb-2">{DISTANCIAS_CONSTRUCTORA[c.slug].tiempo}</div>
                <p className="text-gray-700">Tiempo estimado de despacho</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-lg font-bold text-navy-950 mb-2">Comunas vecinas servidas</div>
                <p className="text-gray-700">{c.comunasVecinas.join(", ")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Sectores */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-4">
              Sectores donde trabajamos en {c.nombre}
            </h2>
            <p className="text-gray-700 mb-6">
              Hemos prestado servicio en proyectos de {c.rubroLocal.join(", ")} dentro de la
              comuna de {c.comuna} y alrededores.
            </p>
            <div className="flex flex-wrap gap-3">
              {c.rubroLocal.map((r) => (
                <span key={r} className="px-4 py-2 bg-navy-950 text-white rounded-full text-sm font-medium capitalize">
                  {r}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Flota destacada */}
        {machines.length > 0 && (
          <section className="py-16 bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
                Equipos disponibles ahora
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {machines.map((m) => (
                  <Link
                    key={m.id}
                    href={maquinariaHref(m)}
                    className="block bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow overflow-hidden border border-gray-200"
                  >
                    {m.imagen && (
                      <Image src={m.imagen} alt={`${m.nombre} arriendo en ${c.nombre}`} loading="lazy" width={400} height={160} sizes="(max-width: 768px) 50vw, 33vw" className="w-full h-40 object-cover" />
                    )}
                    <div className="p-4">
                      <h3 className="text-base font-bold text-navy-950 mb-1">{m.nombre}</h3>
                      {(() => {
                        const d = precioPublicoDesde(m);
                        return d !== null ? (
                          <p className="text-gold-600 font-semibold text-sm">desde {formatPrice(d)}/día</p>
                        ) : null;
                      })()}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ visible — apoya el FAQPage schema con texto crawlable */}
        <section className="py-16 bg-white border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
              Preguntas frecuentes — Arriendo en {c.nombre}
            </h2>
            <dl className="space-y-6">
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cuánto cuesta arrendar maquinaria?</dt>
                <dd className="text-gray-700 text-sm">
                  Varía según tipo de máquina (retroexcavadora, miniexcavadora, minicargador, brazo articulado)
                  y duración del trabajo. Cotiza por WhatsApp y te enviamos precio personalizado para tu obra
                  en {c.nombre}.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Incluye operador?</dt>
                <dd className="text-gray-700 text-sm">
                  Depende del equipo. Retroexcavadora, miniexcavadora y minicargador se arriendan siempre con
                  operador certificado incluido en la tarifa, y el camión tolva con conductor incluido — no
                  pagas extra. Estas máquinas las opera únicamente personal de JURMAQ: no se arriendan solas.
                  Las plataformas de elevación (brazo articulado, plataforma tijera y alzahombre) se entregan
                  listas para operar por tu equipo, con curso de operación vigente.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cuánto demora el despacho a {c.nombre}?</dt>
                <dd className="text-gray-700 text-sm">
                  Despachamos desde Curicó en {DISTANCIAS_CONSTRUCTORA[c.slug].tiempo} ({DISTANCIAS_CONSTRUCTORA[c.slug].km} km). Para urgencias y obras
                  programadas coordinamos horarios específicos.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Cluster SEO local: comunas vecinas con landing propia */}
        {vecinasConLanding.length > 0 && (
          <section className="py-12 bg-gray-50 border-t border-gray-200">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-xl font-bold text-navy-950 mb-4">
                Arriendo en comunas vecinas
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Misma flota, mismo despacho desde Curicó.
              </p>
              <div className="flex flex-wrap gap-3">
                {vecinasConLanding.map((v) => (
                  <Link
                    key={v.slug}
                    href={`/arriendo-en/${v.slug}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:border-orange-500 rounded-full text-sm font-medium text-navy-950 transition-colors"
                  >
                    Arriendo en {v.nombre}
                    <span className="text-xs text-gray-500">{DISTANCIAS_CONSTRUCTORA[v.slug].km} km</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA final */}
        <section className="py-16 bg-navy-950 text-white text-center">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              ¿Tienes una obra en {c.nombre}?
            </h2>
            <p className="text-gray-200 mb-8">
              Cotiza por WhatsApp y te confirmamos disponibilidad + traslado en el día.
            </p>
            <WhatsappLink
              href={whatsappCtaCiudad(c.slug, c.nombre)}
              source={`arriendo_ciudad_${c.slug}_footer`}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
            >
              Cotizar +56 9 7667 3577
            </WhatsappLink>
          </div>
        </section>
      </article>
    </>
  );
}
