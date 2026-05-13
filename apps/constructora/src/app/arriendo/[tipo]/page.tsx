import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabasePublic } from "@jurmaq/shared/supabase";
import { TIPOS_MAQUINA, CIUDADES, HQ } from "@jurmaq/shared/seo";
import { formatCLP } from "@jurmaq/shared/format";

interface Maquinaria {
  id: number;
  nombre: string;
  tipo: string;
  descripcion: string | null;
  precio_dia: number | null;
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

  return {
    title: `Arriendo de ${tipoData.nombrePlural} en Curicó y Maule · JURMAQ`,
    description: `Arriendo de ${tipoData.nombre.toLowerCase()} con o sin operador en ${cities} y toda la Región del Maule. ${tipoData.descripcionCorta} JURMAQ +25 años. Cotiza por WhatsApp.`,
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
      description: `${tipoData.descripcionCorta} Disponible para arriendo en toda la Región del Maule. Despacho rápido desde Molina.`,
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
    .select("id, nombre, tipo, descripcion, precio_dia, estado, imagen")
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
          .filter((m) => m.precio_dia)
          .map((m) => ({
            "@type": "Offer",
            name: m.nombre,
            priceCurrency: "CLP",
            price: m.precio_dia,
            url: `https://jurmaq.cl/maquinarias/${m.id}`,
            availability:
              m.estado === "disponible"
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
          })),
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
        {/* Hero */}
        <header className="bg-navy-950 text-white py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label="Breadcrumb" className="text-sm text-gray-400 mb-4">
              <Link href="/" className="hover:text-white">Inicio</Link>
              <span className="mx-2">›</span>
              <Link href="/maquinarias" className="hover:text-white">Maquinaria</Link>
              <span className="mx-2">›</span>
              <span className="text-white">{tipoData.nombrePlural}</span>
            </nav>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
              Arriendo de {tipoData.nombrePlural} en Curicó y Región del Maule
            </h1>
            <p className="text-lg text-gray-200 max-w-3xl mb-8">
              {tipoData.descripcionLarga}
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={HQ.whatsapp + `?text=Hola%2C%20quiero%20cotizar%20arriendo%20de%20${encodeURIComponent(tipoData.nombre)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Cotizar por WhatsApp
              </a>
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
                      {m.precio_dia && (
                        <p className="text-gold-600 font-semibold mb-2">{formatPrice(m.precio_dia)}</p>
                      )}
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

        {/* Ciudades servidas */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-4">
              Ciudades donde llegamos con tu {tipoData.nombre.toLowerCase()}
            </h2>
            <p className="text-gray-600 mb-8">
              Operamos desde Molina y despachamos a toda la Región del Maule.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {CIUDADES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/arriendo-en/${c.slug}`}
                  className="px-4 py-3 bg-white rounded-lg border border-gray-200 hover:border-gold-500 hover:bg-gold-50 transition-colors text-sm font-medium text-navy-950"
                >
                  {c.nombre}
                </Link>
              ))}
            </div>
          </div>
        </section>

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
            <a
              href={HQ.whatsapp + `?text=Hola%2C%20quiero%20cotizar%20arriendo%20de%20${encodeURIComponent(tipoData.nombre)}`}
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
