import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { supabasePublic } from "@jurmaq/shared/supabase";
import { CIUDADES, TIPOS_MAQUINA, HQ } from "@jurmaq/shared/seo";
import { formatCLP } from "@jurmaq/shared/format";
import { precioPublicoDesde } from "@/lib/pricing-arriendo";
import { whatsappCtaCiudad } from "@jurmaq/shared/whatsapp";
import { maquinariaHref } from "@/lib/maquinaria-slug";

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
    description: `Arriendo de retroexcavadora, miniexcavadora, minicargador, brazo articulado y maquinaria pesada en ${c.nombre} (${c.region}). Despacho desde Molina en ${c.tiempoDespacho}. Servicio para ${c.rubroLocal.slice(0, 2).join(" y ")}. JURMAQ +25 años.`,
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
      description: `Maquinaria pesada en ${c.nombre} con despacho en ${c.tiempoDespacho} desde nuestra base en Molina. Cotiza por WhatsApp.`,
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
        description: `Arriendo de retroexcavadora, miniexcavadora, minicargador, brazo articulado y maquinaria pesada en ${c.nombre}. Despacho en ${c.tiempoDespacho} desde Molina.`,
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
          streetAddress: "Av. Poniente 2157",
          addressLocality: "Molina",
          addressRegion: "Región del Maule",
          addressCountry: "CL",
        },
      },
      {
        "@type": "Service",
        "@id": `https://jurmaq.cl/arriendo-en/${c.slug}#service`,
        name: `Arriendo de Maquinaria en ${c.nombre}`,
        serviceType: "Arriendo de maquinaria pesada",
        description: `Arriendo de retroexcavadora, miniexcavadora, minicargador, brazo articulado y maquinaria pesada en ${c.nombre}. Despacho en ${c.tiempoDespacho} desde Molina.`,
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
              text: "Sí. Todas nuestras máquinas se arriendan con operador certificado incluido. Si tienes equipo propio operativo, también podemos arrendar sin operador (consulta condiciones).",
            },
          },
          {
            "@type": "Question",
            name: `¿Cuánto demora el despacho a ${c.nombre}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `Despachamos desde Molina en ${c.tiempoDespacho} (${c.distanciaKm} km). Para urgencias y obras programadas coordinamos horarios específicos.`,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="bg-white">
        <header className="bg-navy-950 text-white py-20 lg:py-28 border-b border-navy-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-white/55 mb-6 flex-wrap">
              <Link href="/" className="hover:text-gold-400 transition-colors">Inicio</Link>
              <svg className="w-3.5 h-3.5 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-white/85 font-medium">Arriendo en {c.nombre}</span>
            </nav>
            <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-[0.22em] mb-6">
              {c.nombre} · {c.distanciaKm} km de Molina · {c.tiempoDespacho}
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
              <a
                href={whatsappCtaCiudad(c.slug, c.nombre)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Cotizar por WhatsApp
              </a>
              <Link
                href="/maquinarias"
                className="inline-flex items-center gap-2 bg-white text-navy-950 hover:bg-gray-100 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Ver flota completa
              </Link>
            </div>
          </div>
        </header>

        {/* Tipos de máquina disponibles para esta ciudad */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
              Maquinaria disponible para arriendo en {c.nombre}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TIPOS_MAQUINA.map((t) => (
                <Link
                  key={t.slug}
                  href={`/arriendo/${t.slug}`}
                  className="block bg-white border border-gray-200 hover:border-gold-500 rounded-xl p-5 transition-colors"
                >
                  <h3 className="text-lg font-bold text-navy-950 mb-2">
                    {t.nombre}
                  </h3>
                  <p className="text-sm text-gray-600">{t.descripcionCorta}</p>
                  <span className="inline-block mt-3 text-sm text-gold-600 font-semibold">
                    Ver detalle →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Logística */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
              Despacho desde Molina a {c.nombre}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-3xl font-bold text-gold-600 mb-2">{c.distanciaKm} km</div>
                <p className="text-gray-700">Distancia desde nuestra base en Molina</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-3xl font-bold text-gold-600 mb-2">{c.tiempoDespacho}</div>
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
                  Sí. Todas nuestras máquinas se arriendan con operador certificado. Si tienes equipo propio,
                  también podemos arrendar sin operador (consulta condiciones).
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cuánto demora el despacho a {c.nombre}?</dt>
                <dd className="text-gray-700 text-sm">
                  Despachamos desde Molina en {c.tiempoDespacho} ({c.distanciaKm} km). Para urgencias y obras
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
                Misma flota, mismo despacho desde Molina.
              </p>
              <div className="flex flex-wrap gap-3">
                {vecinasConLanding.map((v) => (
                  <Link
                    key={v.slug}
                    href={`/arriendo-en/${v.slug}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:border-orange-500 rounded-full text-sm font-medium text-navy-950 transition-colors"
                  >
                    Arriendo en {v.nombre}
                    <span className="text-xs text-gray-500">{v.distanciaKm} km</span>
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
            <a
              href={whatsappCtaCiudad(c.slug, c.nombre)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
            >
              Cotizar +56 9 7667 3577
            </a>
          </div>
        </section>
      </article>
    </>
  );
}
