import type { Metadata } from "next";
import Link from "next/link";
import { supabasePublic } from "@jurmaq/shared/supabase";
import { MaquinariaFilters } from "@/components/public/MaquinariaFilters";
import { formatCLP } from "@jurmaq/shared/format";
import { precioPublicoDesde } from "@/lib/pricing-arriendo";
import CategoriasShowcase, { type TipoCategoria } from "@/components/public/CategoriasShowcase";
import MaquinariaSort from "@/components/public/MaquinariaSort";
import { maquinariaHref } from "@/lib/maquinaria-slug";


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
  searchParams: Promise<{ tipo?: string; q?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const { data: allMachines } = await supabasePublic.from('maquinarias').select('*');
  const machines = allMachines || [];

  // 1. Filtrar por tipo
  let filteredMachines = params.tipo
    ? machines.filter((m: any) => m.tipo === params.tipo)
    : machines;

  // 2. Filtrar por texto de búsqueda
  if (params.q && params.q.trim()) {
    const q = params.q.trim().toLowerCase();
    filteredMachines = filteredMachines.filter(
      (m: any) =>
        (m.nombre || '').toLowerCase().includes(q) ||
        (m.descripcion || '').toLowerCase().includes(q) ||
        getTipoLabel(m.tipo).toLowerCase().includes(q),
    );
  }

  // 3. Ordenar
  const sortKey = params.sort || 'destacado';
  filteredMachines = [...filteredMachines].sort((a: any, b: any) => {
    if (sortKey === 'precio_asc' || sortKey === 'precio_desc') {
      const pa = precioPublicoDesde(a) ?? Number.MAX_SAFE_INTEGER;
      const pb = precioPublicoDesde(b) ?? Number.MAX_SAFE_INTEGER;
      return sortKey === 'precio_asc' ? pa - pb : pb - pa;
    }
    if (sortKey === 'nombre') {
      return (a.nombre || '').localeCompare(b.nombre || '');
    }
    if (sortKey === 'recientes') {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    }
    // destacado: disponibles primero, luego por nombre
    if (a.estado === 'disponible' && b.estado !== 'disponible') return -1;
    if (a.estado !== 'disponible' && b.estado === 'disponible') return 1;
    return (a.nombre || '').localeCompare(b.nombre || '');
  });

  const types = [...new Set(machines.map((m: any) => m.tipo))];

  // Conteos por tipo para CategoriasShowcase
  const counts: Partial<Record<TipoCategoria, number>> = {};
  for (const m of machines) {
    const t = m.tipo as TipoCategoria;
    counts[t] = (counts[t] || 0) + 1;
  }

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
        offers: (() => {
          const desde = precioPublicoDesde(m);
          return {
            "@type": "Offer",
            priceCurrency: "CLP",
            ...(desde !== null ? { price: desde } : {}),
            availability:
              m.estado === "disponible"
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            seller: {
              "@type": "Organization",
              name: "Constructora Jorge Ubilla Rivera E.I.R.L.",
            },
          };
        })(),
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
      {/* Hero Header — editorial */}
      <section className="bg-navy-950 py-20 lg:py-28 border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-white/55 mb-6 flex-wrap">
            <Link href="/" className="hover:text-gold-400 transition-colors">
              Inicio
            </Link>
            <svg className="w-3.5 h-3.5 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-white/85 font-medium">Maquinarias</span>
          </nav>
          <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-[0.22em] mb-6">
            Flota propia JURMAQ · Curicó · Molina · Maule
          </p>
          <h1
            className="text-white leading-[1.05] mb-6 max-w-4xl"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 4rem)', fontWeight: 500, letterSpacing: '-0.015em' }}
          >
            Arriendo de{' '}
            <span className="font-[var(--font-serif)] italic text-gold-400" style={{ fontWeight: 400 }}>
              maquinaria
            </span>
            <br />
            con o sin operador.
          </h1>
          <p className="text-base lg:text-lg text-white/75 max-w-2xl leading-relaxed">
            {machines.length}+ equipos en flota propia para obras de Curicó, Molina, Teno, Talca y toda la Región del Maule.
            Cotización por escrito en menos de 2 horas hábiles.
          </p>
        </div>
      </section>

      {/* Categorías visuales */}
      <CategoriasShowcase
        counts={counts}
        variant="light"
        title="Por categoría"
        subtitle="Cinco tipos de equipo · flota propia con mantención al día."
      />

      {/* Catalog */}
      <section className="pt-2 pb-12 lg:pb-20 bg-gray-50" id="catalogo">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filters */}
          <MaquinariaFilters
            types={types}
            currentType={params.tipo || ""}
          />

          {/* Results count + Sort */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-navy-950">{filteredMachines.length}</span>{" "}
              {filteredMachines.length === 1 ? "equipo encontrado" : "equipos encontrados"}
              {params.q ? <> para "<span className="text-navy-950 font-medium">{params.q}</span>"</> : null}
            </p>
            <MaquinariaSort current={sortKey} />
          </div>

          {/* Machine Grid */}
          {filteredMachines.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {filteredMachines.map((machine) => (
                <div
                  key={machine.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Image (clickable → detalle) */}
                  <Link
                    href={maquinariaHref(machine)}
                    aria-label={`Ver detalle de ${machine.nombre}`}
                    className="relative h-52 bg-gradient-to-br from-navy-900 to-navy-800 flex items-center justify-center overflow-hidden block"
                  >
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
                  </Link>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-navy-950 mb-2">
                      <Link
                        href={maquinariaHref(machine)}
                        className="hover:text-gold-600 transition-colors"
                      >
                        {machine.nombre}
                      </Link>
                    </h3>
                    <p className="text-sm text-gray-600 mb-5 line-clamp-3 leading-relaxed">
                      {machine.descripcion || "Consulta por especificaciones técnicas."}
                    </p>

                    {/* Pricing — neto (sin IVA) + flete aproximado */}
                    {(() => {
                      const desde = precioPublicoDesde(machine);
                      // Flete estimado: $30k Curicó-Molina, ~$60k Teno/Romeral, ~$100k Talca.
                      // Mostramos el rango más común (Curicó/Molina) como referencia editorial.
                      const fleteAprox = 30000;
                      return (
                        <div className="mb-5 border-t border-b border-[#EAEAEA] py-4">
                          {desde !== null ? (
                            <>
                              <div className="flex items-baseline justify-between mb-1">
                                <span className="text-[10px] uppercase tracking-[0.18em] text-[#787774] font-semibold">Desde</span>
                                <span
                                  className="text-navy-950 tabular-nums"
                                  style={{ fontSize: 'clamp(1.25rem, 1.6vw, 1.625rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
                                >
                                  {formatPrice(desde)}
                                  <span className="text-sm text-[#787774] font-normal ml-1">/ día</span>
                                </span>
                              </div>
                              <p className="text-[11px] text-[#787774] leading-tight">
                                Valor neto · sin IVA · {machine.unidad_tarifa === 'hora' ? '8 hrs mín.' : 'jornada base'}
                              </p>
                              <p className="text-[11px] text-[#787774] leading-tight mt-1">
                                Flete aprox.{' '}
                                <span className="text-navy-950 font-medium tabular-nums">
                                  {formatCLP(fleteAprox)}
                                </span>{' '}
                                desde Curicó/Molina · ida y vuelta
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-[#787774] text-center py-2">
                              <span className="font-[var(--font-serif)] italic text-navy-950" style={{ fontWeight: 400 }}>Cotizar</span> precio
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* CTA */}
                    <Link
                      href={`/contacto?servicio=arriendo&maquinaria=${encodeURIComponent(machine.nombre)}`}
                      className="block w-full text-center px-5 py-3 bg-navy-950 hover:bg-[#111111] text-white text-sm font-medium tracking-[0.02em] rounded-lg transition-colors"
                    >
                      Pedir cotización
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

      {/* P0 SEO fix: ItemList JSON-LD ya emitido al inicio del componente (itemListJsonLd).
          El bloque duplicado que estaba acá fue removido para evitar doble emisión. */}
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
