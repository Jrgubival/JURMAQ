import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabasePublic } from "@jurmaq/shared/supabase";
import { TIPOS_MAQUINA, CIUDADES, HQ } from "@jurmaq/shared/seo";
import { formatCLP } from "@jurmaq/shared/format";
import { precioPublicoDesde } from "@/lib/pricing-arriendo";
import { whatsappCtaTipo } from "@jurmaq/shared/whatsapp";
import WhatsappLink from "@/components/public/WhatsappLink";
import CrossLinksGrid from "@jurmaq/shared/ui/CrossLinksGrid";
import Breadcrumbs from "@jurmaq/shared/ui/Breadcrumbs";

interface Maquinaria {
  id: number;
  nombre: string;
  tipo: string;
  descripcion: string | null;
  tarifa_neta: number | null;
  unidad_tarifa: 'hora' | 'dia' | null;
  minimo_unidades: number | null;
  estado: string;
  imagen: string | null;
}

export async function generateStaticParams() {
  return TIPOS_MAQUINA.map((t) => ({ tipo: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tipo: string }>;
}): Promise<Metadata> {
  const { tipo } = await params;
  const tipoData = TIPOS_MAQUINA.find((t) => t.slug === tipo);
  if (!tipoData) return { title: "Tipo de maquinaria no encontrado" };

  const cities = CIUDADES.slice(0, 6).map((c) => c.nombre).join(", ");

  // Marca/modelo real de la flota por tipo, en el TÍTULO visible (no solo en
  // keywords). Captura consultas de marca con alta intención: "arriendo
  // excavadora xcmg" (78 impr, pos 10, 0 clics — mayor oportunidad única),
  // "bobcat s650", "arriendo minicargador".
  const marcaTitulo: Record<string, string> = {
    miniexcavadora: " XCMG XE35U",
    retroexcavadora: " Hidromek HMK 102B",
    minicargador: " Bobcat S650",
  };
  const marcaSuffix = marcaTitulo[tipoData.slug] ?? "";

  return {
    title: `Arriendo de ${tipoData.nombrePlural}${marcaSuffix} en Curicó y Maule · JURMAQ`,
    description: `Arriendo de ${tipoData.nombre.toLowerCase()}${marcaSuffix ? ` (${marcaSuffix.trim()})` : ""} con o sin operador en ${cities} y toda la Región del Maule. ${tipoData.descripcionCorta} JURMAQ +25 años. Cotiza por WhatsApp.`,
    keywords: [
      `arriendo ${tipoData.nombre.toLowerCase()}`,
      ...CIUDADES.map((c) => `arriendo ${tipoData.nombre.toLowerCase()} ${c.nombre}`),
      `${tipoData.nombre.toLowerCase()} con operador Curicó`,
      `${tipoData.nombre.toLowerCase()} sin operador Curicó`,
      `${tipoData.nombre.toLowerCase()} precio Maule`,
      // Marcas en flota (refuerza búsquedas tipo "arriendo excavadora xcmg")
      ...(tipoData.slug === "miniexcavadora"
        ? ["arriendo excavadora XCMG", "arriendo XCMG XE35U", "miniexcavadora XCMG Curicó", "miniexcavadora XCMG Molina"]
        : []),
      ...(tipoData.slug === "retroexcavadora"
        ? ["arriendo retroexcavadora HMK", "retroexcavadora HMK 102B Curicó"]
        : []),
      ...(tipoData.slug === "minicargador"
        ? ["arriendo Bobcat S650", "Bobcat Curicó", "minicargador Bobcat Maule"]
        : []),
      "JURMAQ",
    ],
    openGraph: {
      title: `Arriendo ${tipoData.nombrePlural} en Curicó y Región del Maule · JURMAQ`,
      description: `${tipoData.descripcionCorta} Disponible para arriendo en toda la Región del Maule. Despacho rápido desde Curicó.`,
      url: `https://jurmaq.cl/arriendo/${tipoData.slug}`,
      siteName: "JURMAQ",
      locale: "es_CL",
      type: "website",
      images: [
        {
          url: "/icon-512.png",
          width: 512,
          height: 512,
          alt: `${tipoData.nombre} en arriendo · JURMAQ`,
        },
      ],
    },
    alternates: {
      canonical: `https://jurmaq.cl/arriendo/${tipoData.slug}`,
    },
  };
}

function formatPrice(price: number): string {
  return `${formatCLP(price)}/día`;
}

export default async function ArriendoTipoPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const { tipo } = await params;
  const tipoData = TIPOS_MAQUINA.find((t) => t.slug === tipo);
  if (!tipoData) notFound();

  const { data: machines } = await supabasePublic
    .from("maquinarias")
    .select("id, nombre, tipo, descripcion, tarifa_neta, unidad_tarifa, minimo_unidades, estado, imagen")
    .eq("tipo", tipoData.tipoDb)
    .order("estado", { ascending: true });

  const flota: Maquinaria[] = (machines || []) as Maquinaria[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `https://jurmaq.cl/arriendo/${tipoData.slug}#service`,
        name: `Arriendo de ${tipoData.nombrePlural} en Región del Maule`,
        serviceType: `Arriendo de ${tipoData.nombre}`,
        description: tipoData.descripcionLarga,
        provider: {
          "@type": "Organization",
          "@id": "https://jurmaq.cl/#organization",
          name: "JURMAQ",
          url: "https://jurmaq.cl",
        },
        areaServed: CIUDADES.map((c) => ({ "@type": "City", name: c.nombre })),
        offers: flota
          .map((m) => {
            const d = precioPublicoDesde(m);
            return d !== null ? {
              "@type": "Offer",
              name: m.nombre,
              priceCurrency: "CLP",
              price: d,
              url: `https://jurmaq.cl/maquinarias/${m.id}`,
              availability:
                m.estado === "disponible"
                  ? "https://schema.org/InStock"
                  : "https://schema.org/OutOfStock",
            } : null;
          })
          .filter((o): o is NonNullable<typeof o> => o !== null),
      },
      {
        "@type": "FAQPage",
        mainEntity: tipoData.preguntasFrecuentes.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: "https://jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: "Arriendo de Maquinaria", item: "https://jurmaq.cl/maquinarias" },
          { "@type": "ListItem", position: 3, name: tipoData.nombrePlural, item: `https://jurmaq.cl/arriendo/${tipoData.slug}` },
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
        {/* Hero — editorial */}
        <header className="bg-navy-950 text-white py-20 lg:py-28 border-b border-navy-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumbs
              variant="dark"
              className="mb-6"
              items={[
                { label: "Inicio", href: "/" },
                { label: "Maquinaria", href: "/maquinarias" },
                { label: tipoData.nombrePlural },
              ]}
            />
            <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-[0.22em] mb-6">
              Curicó · Molina · Talca · Linares · Región del Maule
            </p>
            <h1
              className="text-white leading-[1.05] mb-6 max-w-3xl"
              style={{ fontSize: 'clamp(2.25rem, 5vw, 4rem)', fontWeight: 500, letterSpacing: '-0.015em' }}
            >
              Arriendo de{' '}
              <span className="font-[var(--font-serif)] italic text-gold-400" style={{ fontWeight: 400 }}>
                {tipoData.nombrePlural.toLowerCase()}
              </span>.
            </h1>
            <p className="text-base lg:text-lg text-white/75 max-w-3xl mb-10 leading-relaxed">
              {tipoData.descripcionLarga}
            </p>
            <div className="flex flex-wrap gap-3">
              <WhatsappLink
                href={whatsappCtaTipo(tipoData.slug, tipoData.nombre)}
                source={`arriendo_tipo_${tipoData.slug}_hero`}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Cotizar por WhatsApp
              </WhatsappLink>
              <Link
                href="/contacto"
                className="inline-flex items-center gap-2 bg-white text-navy-950 hover:bg-gray-100 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Cotizar por correo
              </Link>
            </div>
          </div>
        </header>

        {/* Casos de uso */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
              ¿Para qué se usa una {tipoData.nombre.toLowerCase()}?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tipoData.casosDeUso.map((caso, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 bg-gold-500 text-navy-950 rounded-full flex items-center justify-center font-bold">
                    {i + 1}
                  </div>
                  <p className="text-gray-700 leading-relaxed">{caso}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Flota disponible */}
        {flota.length > 0 && (
          <section className="py-16 bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
                {tipoData.nombrePlural} disponibles en JURMAQ
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {flota.map((m) => (
                  <Link
                    key={m.id}
                    href={`/maquinarias/${m.id}`}
                    className="block bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow overflow-hidden border border-gray-200"
                  >
                    {m.imagen && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.imagen}
                        alt={`${m.nombre} en arriendo · JURMAQ Curicó`}
                        loading="lazy"
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <div className="p-5">
                      <h3 className="text-lg font-bold text-navy-950 mb-2">{m.nombre}</h3>
                      {(() => {
                        const d = precioPublicoDesde(m);
                        return d !== null ? (
                          <p className="text-gold-600 font-semibold mb-2">desde {formatPrice(d)}/día</p>
                        ) : null;
                      })()}
                      <p className="text-sm text-gray-600 line-clamp-2">{m.descripcion}</p>
                      <span
                        className={`inline-block mt-3 px-3 py-1 text-xs font-semibold rounded-full ${
                          m.estado === "disponible"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {m.estado === "disponible" ? "Disponible" : "Consultar"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Especificaciones técnicas */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
              Especificaciones técnicas típicas
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tipoData.especificacionesClave.map((spec, i) => (
                <li key={i} className="flex items-start gap-3 bg-gray-50 p-4 rounded-lg">
                  <span className="text-gold-500 font-bold">›</span>
                  <span className="text-gray-700">{spec}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Ciudades servidas — CrossLinksGrid editorial estilo barraca */}
        <CrossLinksGrid
          eyebrow="Cobertura · 12 ciudades del Maule"
          title={`También en otras ciudades del Maule`}
          subtitle={`Operamos desde nuestra base en Curicó y llevamos la máquina a toda la Región del Maule. Coordinamos el traslado contigo al confirmar.`}
          items={CIUDADES.map((c) => ({
            label: `Arriendo en ${c.nombre}`,
            href: `/arriendo-en/${c.slug}`,
          }))}
        />

        {/* Deep-links city×type para reforzar demanda real en Talca/Linares
            (139 + impresiones, rankeando pos 7–13). Enlaza este tipo de máquina
            en las ciudades con mayor búsqueda → sube esas landings vía enlazado
            interno hacia la consulta "[tipo] en [ciudad]". */}
        <CrossLinksGrid
          eyebrow="Demanda · Talca · Linares"
          title={`${tipoData.nombrePlural} por ciudad`}
          subtitle={`Páginas específicas de arriendo de ${tipoData.nombre.toLowerCase()} en las principales ciudades que servimos.`}
          items={["talca", "linares", "curico", "molina"].map((slug) => {
            const c = CIUDADES.find((x) => x.slug === slug);
            return {
              label: `${tipoData.nombre} en ${c?.nombre ?? slug}`,
              href: `/arriendo-en/${slug}/${tipoData.slug}`,
            };
          })}
        />

        {/* FAQ */}
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
              Preguntas frecuentes
            </h2>
            <div className="space-y-6">
              {tipoData.preguntasFrecuentes.map((faq, i) => (
                <div key={i} className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-bold text-navy-950 mb-2">{faq.q}</h3>
                  <p className="text-gray-700 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-16 bg-navy-950 text-white text-center">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              ¿Listo para arrendar tu {tipoData.nombre.toLowerCase()}?
            </h2>
            <p className="text-gray-200 mb-8">
              Cotiza por WhatsApp y recibe disponibilidad + valor el mismo día.
            </p>
            <WhatsappLink
              href={whatsappCtaTipo(tipoData.slug, tipoData.nombre)}
              source={`arriendo_tipo_${tipoData.slug}_footer`}
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
