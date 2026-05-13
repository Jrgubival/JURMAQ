import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@jurmaq/shared/supabase";
import { MaquinariaFilters } from "@/components/public/MaquinariaFilters";
import { formatCLP } from "@jurmaq/shared/format";


export const metadata: Metadata = {
  title:
    "Arriendo Maquinaria Pesada en Curicó · Molina · Teno · Talca · JURMAQ",
  description:
    "Arriendo de retroexcavadora, miniexcavadora, minicargador, brazo articulado, plataforma elevadora y camión tolva en Curicó, Teno, Molina, Romeral, Sagrada Familia, Talca y toda la Región del Maule. Con o sin operador. JURMAQ +25 años. Cotiza por WhatsApp.",
  keywords: [
    "arriendo maquinaria Curicó",
    "arriendo maquinaria Maule",
    "arriendo maquinaria Talca",
    "arriendo maquinaria Teno",
    "arriendo maquinaria Molina",
    "arriendo maquinaria Rancagua",
    "arriendo retroexcavadora Curicó",
    "arriendo retroexcavadora Maule",
    "arriendo retroexcavadora Teno",
    "arriendo retroexcavadora Molina",
    "arriendo retroexcavadora Talca",
    "arriendo miniexcavadora Curicó",
    "arriendo miniexcavadora Maule",
    "arriendo miniexcavadora Molina",
    "arriendo miniexcavadora Teno",
    "arriendo minicargador Curicó",
    "arriendo minicargador Maule",
    "arriendo brazo articulado Curicó",
    "arriendo brazo articulado Maule",
    "arriendo plataforma elevadora Curicó",
    "arriendo plataforma elevadora Maule",
    "arriendo camión tolva Curicó",
    "arriendo alzahombre Curicó",
    "arriendo alzahombre Maule",
    "maquinaria pesada Curicó",
    "maquinaria pesada Maule",
    "maquinaria construcción Curicó",
    "maquinaria construcción Maule",
    "arriendo equipos construcción Curicó",
    "retroexcavadora precio arriendo Curicó",
    "miniexcavadora precio arriendo Maule",
    "JURMAQ maquinaria",
    "Romeral",
    "Sagrada Familia",
    "Hualañé",
    "Licantén",
    "Vichuquén",
    "Rauco",
    "Talca",
    "Linares",
    "Constitución",
  ],
  openGraph: {
    title:
      "Arriendo de Maquinaria Pesada en Curicó y Región del Maule | JURMAQ.cl",
    description:
      "Flota de maquinaria pesada para arriendo: retroexcavadoras, miniexcavadoras, brazos articulados, camiones tolva y más. Con o sin operador en toda la Región del Maule.",
    url: "https://jurmaq.cl/maquinarias",
    siteName: "JURMAQ.cl",
    locale: "es_CL",
    type: "website",
  },
  alternates: {
    canonical: "https://jurmaq.cl/maquinarias",
  },
};

function formatPrice(price: number): string {
  return `${formatCLP(price)}`;
}

function getStatusLabel(estado: string): string {
  const labels: Record<string, string> = {
    disponible: "Disponible",
    arrendada: "Arrendada",
    mantencion: "En Mantención",
  };
  return labels[estado] || estado;
}

function getTipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    retroexcavadora: "Retroexcavadora",
    miniexcavadora: "Miniexcavadora",
    brazo_articulado: "Brazo Articulado",
    grua: "Grúa",
    camion: "Camión",
    rodillo: "Rodillo",
    otro: "Otro",
  };
  return labels[tipo] || tipo;
}

export default async function MaquinariasPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const params = await searchParams;
  const { data: allMachines } = await supabaseAdmin.from('maquinarias').select('*');
  const machines = allMachines || [];

  const filteredMachines = params.tipo
    ? machines.filter((m: any) => m.tipo === params.tipo)
    : machines;

  const types = [...new Set(machines.map((m: any) => m.tipo))];

  // JSON-LD ItemList for machinery catalog
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Catálogo de Maquinaria para Arriendo - JURMAQ",
    description:
      "Flota completa de maquinaria pesada disponible para arriendo en Curicó y Región del Maule.",
    numberOfItems: machines.length,
    itemListElement: machines.map((m: any, i: number) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: m.nombre,
        url: `https://jurmaq.cl/maquinarias/${m.id}`,
        image: m.imagen || undefined,
        description: m.descripcion || undefined,
        offers: {
          "@type": "Offer",
          priceCurrency: "CLP",
          ...(m.precio_dia ? { price: m.precio_dia } : {}),
          availability:
            m.estado === "disponible"
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          seller: {
            "@type": "Organization",
            name: "Constructora Jorge Ubilla Rivera E.I.R.L.",
          },
        },
      },
    })),
  };

  // JSON-LD LocalBusiness for machinery rental
  const machineryBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "JURMAQ Arriendo de Maquinaria",
    description:
      "Arriendo de maquinaria pesada: retroexcavadoras, miniexcavadoras, brazos articulados, camiones tolva, plataformas elevadoras. Con o sin operador.",
    url: "https://jurmaq.cl/maquinarias",
    telephone: "+56976673577",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Curicó",
      addressRegion: "Maule",
      addressCountry: "CL",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: -34.9833,
      longitude: -71.2333,
    },
    areaServed: [
      { "@type": "City", name: "Curicó" },
      { "@type": "City", name: "Teno" },
      { "@type": "City", name: "Molina" },
      { "@type": "City", name: "Romeral" },
      { "@type": "City", name: "Sagrada Familia" },
      { "@type": "City", name: "Hualañé" },
      { "@type": "City", name: "Licantén" },
      { "@type": "City", name: "Vichuquén" },
      { "@type": "City", name: "Rauco" },
      { "@type": "City", name: "Talca" },
      { "@type": "City", name: "Linares" },
      { "@type": "City", name: "Constitución" },
      { "@type": "City", name: "Rancagua" },
    ],
    parentOrganization: {
      "@type": "Organization",
      name: "Constructora Jorge Ubilla Rivera E.I.R.L.",
      url: "https://jurmaq.cl",
    },
    priceRange: "$$$",
    currenciesAccepted: "CLP",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(machineryBusinessJsonLd),
        }}
      />
      {/* Hero Header */}
      <section className="bg-navy-950 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
              <Link href="/" className="hover:text-gold-500 transition-colors">
                Inicio
              </Link>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <span className="text-gray-300">Maquinarias</span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white mb-3">
              Arriendo de <span className="text-gold-500">Maquinaria</span>
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl">
              Equipos disponibles para arriendo, con o sin operador.
            </p>
          </div>
        </div>
      </section>

      {/* Catalog */}
      <section className="py-10 lg:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filters */}
          <MaquinariaFilters
            types={types}
            currentType={params.tipo || ""}
          />

          {/* Results count */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-gray-600">
              {filteredMachines.length}{" "}
              {filteredMachines.length === 1 ? "equipo encontrado" : "equipos encontrados"}
            </p>
          </div>

          {/* Machine Grid */}
          {filteredMachines.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {filteredMachines.map((machine) => (
                <div
                  key={machine.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Image */}
                  <div className="relative h-52 bg-gradient-to-br from-navy-900 to-navy-800 flex items-center justify-center overflow-hidden">
                    {machine.imagen ? (
                      <img
                        src={machine.imagen}
                        alt={machine.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg
                        className="w-20 h-20 text-navy-700"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    )}

                    {/* Status badge overlay */}
                    <div className="absolute top-3 right-3">
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full badge-${machine.estado}`}
                      >
                        {getStatusLabel(machine.estado)}
                      </span>
                    </div>

                    {/* Type label */}
                    <div className="absolute bottom-3 left-3">
                      <span className="px-2.5 py-1 text-xs font-medium text-white bg-navy-950/70 backdrop-blur-sm rounded-lg">
                        {getTipoLabel(machine.tipo)}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-navy-950 mb-2">
                      {machine.nombre}
                    </h3>
                    <p className="text-sm text-gray-600 mb-5 line-clamp-3 leading-relaxed">
                      {machine.descripcion || "Consulta por especificaciones técnicas."}
                    </p>

                    {/* Pricing */}
                    <div className="space-y-2 mb-5 p-4 bg-gray-50 rounded-xl">
                      {machine.precio_dia && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Precio / día</span>
                          <span className="font-bold text-navy-950">
                            {formatPrice(machine.precio_dia)}
                          </span>
                        </div>
                      )}
                      {machine.precio_semana && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Precio / semana</span>
                          <span className="font-semibold text-gray-700">
                            {formatPrice(machine.precio_semana)}
                          </span>
                        </div>
                      )}
                      {machine.precio_mes && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Precio / mes</span>
                          <span className="font-semibold text-gray-700">
                            {formatPrice(machine.precio_mes)}
                          </span>
                        </div>
                      )}
                      {!machine.precio_dia &&
                        !machine.precio_semana &&
                        !machine.precio_mes && (
                          <p className="text-sm text-gray-500 text-center">
                            Consultar precio
                          </p>
                        )}
                    </div>

                    {/* CTA */}
                    <Link
                      href={`/contacto?servicio=arriendo&maquinaria=${encodeURIComponent(machine.nombre)}`}
                      className="block w-full text-center px-5 py-3 bg-navy-950 hover:bg-navy-800 text-white font-semibold rounded-xl transition-colors"
                    >
                      Pedir presupuesto
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <svg
                className="w-16 h-16 mx-auto text-gray-300 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No se encontraron equipos
              </h3>
              <p className="text-gray-500 mb-4">
                No hay maquinaria disponible con el filtro seleccionado.
              </p>
              <Link
                href="/maquinarias"
                className="inline-flex items-center gap-2 text-sm font-semibold text-gold-600 hover:text-gold-500 transition-colors"
              >
                Ver todos los equipos
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-navy-950 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">
            ¿No encuentras el equipo que necesitas?
          </h2>
          <p className="text-gray-300 mb-6">
            Escríbenos y te lo conseguimos. Respondemos en menos de 2 horas.
          </p>
          <Link
            href="/contacto"
            className="inline-flex items-center gap-2 text-gold-500 hover:text-gold-400 font-semibold transition-colors"
          >
            Pedir presupuesto gratis
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>
        </div>
      </section>

      {/* JSON-LD Structured Data for Machines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Maquinaria Pesada en Arriendo - JURMAQ",
            description:
              "Catálogo de maquinaria pesada disponible para arriendo en Curicó, Teno, Molina, Romeral, Sagrada Familia y toda la Provincia de Curicó, Región del Maule.",
            url: "https://jurmaq.cl/maquinarias",
            numberOfItems: machines.length,
            itemListElement: machines.map((machine: any, index: number) => ({
              "@type": "ListItem",
              position: index + 1,
              item: {
                "@type": "Product",
                name: machine.nombre,
                description:
                  machine.descripcion ||
                  `${machine.nombre} disponible para arriendo en Curicó y Provincia de Curicó.`,
                category: getTipoLabel(machine.tipo),
                brand: {
                  "@type": "Brand",
                  name: "JURMAQ",
                },
                offers: {
                  "@type": "Offer",
                  priceCurrency: "CLP",
                  price: machine.precio_dia || undefined,
                  availability:
                    machine.estado === "disponible"
                      ? "https://schema.org/InStock"
                      : "https://schema.org/OutOfStock",
                  seller: {
                    "@type": "Organization",
                    name: "Constructora Jorge Ubilla Rivera E.I.R.L.",
                  },
                  areaServed: {
                    "@type": "Place",
                    name: "Provincia de Curicó, Región del Maule, Chile",
                  },
                },
              },
            })),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Inicio", item: "https://jurmaq.cl" },
              { "@type": "ListItem", position: 2, name: "Maquinarias", item: "https://jurmaq.cl/maquinarias" },
            ],
          }),
        }}
      />
    </>
  );
}
