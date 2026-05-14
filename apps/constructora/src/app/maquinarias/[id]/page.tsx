import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabasePublic } from "@jurmaq/shared/supabase";
import AnimatedSection from "@/components/animations/AnimatedSection";
import { formatCLP } from "@jurmaq/shared/format";
import { precioPublicoDesde } from "@/lib/pricing-arriendo";

interface Maquinaria {
  id: number;
  nombre: string;
  tipo: string;
  descripcion: string | null;
  especificaciones: string | null;
  tarifa_neta: number | null;
  unidad_tarifa: 'hora' | 'dia' | null;
  minimo_unidades: number | null;
  estado: string;
  imagen: string | null;
  created_at: string;
}

function formatPrice(price: number): string {
  return `${formatCLP(price)}`;
}

function getStatusLabel(estado: string): string {
  const labels: Record<string, string> = {
    disponible: "Disponible",
    arrendada: "Arrendada",
    mantencion: "En Mantencion",
  };
  return labels[estado] || estado;
}

function getStatusColor(estado: string): string {
  const colors: Record<string, string> = {
    disponible: "bg-green-100 text-green-700",
    arrendada: "bg-blue-100 text-blue-700",
    mantencion: "bg-yellow-100 text-yellow-700",
  };
  return colors[estado] || "bg-gray-100 text-gray-700";
}

function getTipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    retroexcavadora: "Retroexcavadora",
    miniexcavadora: "Miniexcavadora",
    brazo_articulado: "Brazo Articulado",
    grua: "Grua",
    camion: "Camion",
    rodillo: "Rodillo",
    otro: "Otro",
  };
  return labels[tipo] || tipo;
}

export async function generateStaticParams() {
  const { data: machines } = await supabasePublic
    .from('maquinarias')
    .select('id');
  return (machines || []).map((m: any) => ({ id: String(m.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { data: machine } = await supabasePublic
    .from('maquinarias')
    .select('*')
    .eq('id', Number(id))
    .single();

  if (!machine) {
    return { title: "Maquinaria no encontrada | JURMAQ" };
  }

  const desdePrecio = precioPublicoDesde(machine);
  const priceText = desdePrecio !== null
    ? `Desde ${formatCLP(desdePrecio)}/día`
    : "Consultar precio";
  const tipoLbl = getTipoLabel(machine.tipo);

  return {
    title: `Arriendo ${machine.nombre} en Curicó · Molina · Talca · ${priceText}`,
    description: `Arriendo de ${machine.nombre} (${tipoLbl}) en Curicó, Teno, Molina, Romeral, Talca y toda la Región del Maule. ${machine.descripcion || "Equipo en operación con o sin operador, mantención al día."} ${priceText}. Cotiza por WhatsApp y recibe respuesta el mismo día.`,
    keywords: [
      `arriendo ${machine.nombre}`,
      `arriendo ${machine.nombre} Curicó`,
      `arriendo ${machine.nombre} Molina`,
      `arriendo ${machine.nombre} Teno`,
      `arriendo ${machine.nombre} Talca`,
      `arriendo ${tipoLbl} Curicó`,
      `arriendo ${tipoLbl} Molina`,
      `arriendo ${tipoLbl} Teno`,
      `arriendo ${tipoLbl} Talca`,
      `arriendo ${tipoLbl} Maule`,
      `${tipoLbl} con operador Curicó`,
      `${tipoLbl} sin operador Curicó`,
      `${machine.nombre} precio arriendo`,
      `precio ${tipoLbl} día Curicó`,
      "arriendo maquinaria Curicó",
      "arriendo maquinaria Molina",
      "arriendo maquinaria Teno",
      "arriendo maquinaria Talca",
      "arriendo maquinaria Region del Maule",
      "JURMAQ",
    ],
    openGraph: {
      title: `Arriendo ${machine.nombre} en Curicó y Maule · ${priceText} · JURMAQ`,
      description: `${machine.nombre} (${tipoLbl}) disponible para arriendo con o sin operador en Curicó, Molina, Teno, Talca y Región del Maule. ${priceText}.`,
      url: `https://jurmaq.cl/maquinarias/${machine.id}`,
      siteName: "JURMAQ",
      locale: "es_CL",
      type: "website",
      images: machine.imagen
        ? [{ url: machine.imagen, alt: `${machine.nombre} en arriendo · JURMAQ Curicó` }]
        : [{ url: "/icon-512.png", width: 512, height: 512, alt: "JURMAQ" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Arriendo ${machine.nombre} · JURMAQ Curicó`,
      description: `${tipoLbl} en arriendo · ${priceText} · Despacho a toda la Región del Maule.`,
    },
    alternates: {
      canonical: `https://jurmaq.cl/maquinarias/${machine.id}`,
    },
  };
}

export default async function MaquinariaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: machine } = await supabasePublic
    .from('maquinarias')
    .select('*')
    .eq('id', Number(id))
    .single();

  if (!machine) {
    notFound();
  }

  // Related machines (same type, excluding current)
  const { data: related } = await supabasePublic
    .from('maquinarias')
    .select('*')
    .eq('tipo', machine.tipo)
    .neq('id', machine.id)
    .limit(3);

  // Parse specifications
  let specs: Record<string, string> = {};
  if (machine.especificaciones) {
    try {
      specs = JSON.parse(machine.especificaciones);
    } catch {
      // ignore invalid JSON
    }
  }

  const desdePrecio = precioPublicoDesde(machine);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: machine.nombre,
    description:
      machine.descripcion ||
      `${machine.nombre} disponible para arriendo en Curicó y Región del Maule.`,
    category: getTipoLabel(machine.tipo),
    image: machine.imagen || undefined,
    brand: {
      "@type": "Brand",
      name: "JURMAQ",
    },
    offers: desdePrecio !== null ? [
      {
        "@type": "Offer",
        priceCurrency: "CLP",
        price: desdePrecio,
        name: "Arriendo por dia (desde, IVA incl., sin traslado)",
        availability:
          machine.estado === "disponible"
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        seller: {
          "@type": "Organization",
          name: "Constructora Jorge Ubilla Rivera E.I.R.L.",
        },
        areaServed: [
          { "@type": "City", name: "Curicó" },
          { "@type": "City", name: "Teno" },
          { "@type": "City", name: "Molina" },
          { "@type": "AdministrativeArea", name: "Región del Maule" },
        ],
      },
    ] : [],
  };

  return (
    <>
      {/* Breadcrumb + Hero */}
      <section className="bg-navy-950 py-10 lg:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fadeUp">
            <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
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
              <Link
                href="/maquinarias"
                className="hover:text-gold-500 transition-colors"
              >
                Maquinarias
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
              <span className="text-gray-300">{machine.nombre}</span>
            </nav>

            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <h1 className="text-3xl lg:text-4xl font-extrabold text-white">
                {machine.nombre}
              </h1>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(machine.estado)}`}
                >
                  {getStatusLabel(machine.estado)}
                </span>
                <span className="px-2.5 py-1 text-xs font-medium text-white bg-navy-800 rounded-lg">
                  {getTipoLabel(machine.tipo)}
                </span>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-10 lg:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            {/* Left: Image + Description */}
            <div className="lg:col-span-2 space-y-8">
              {/* Image */}
              <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-navy-900 to-navy-800 aspect-video flex items-center justify-center">
                {machine.imagen ? (
                  <img
                    src={machine.imagen}
                    alt={machine.nombre}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg
                    className="w-24 h-24 text-navy-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </div>

              {/* Description */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:p-8">
                <h2 className="text-xl font-bold text-navy-950 mb-4">
                  Descripcion
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  {machine.descripcion ||
                    "Consulte por especificaciones técnicas de este equipo. Disponible para arriendo con o sin operador."}
                </p>
              </div>

              {/* Specifications */}
              {Object.keys(specs).length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:p-8">
                  <h2 className="text-xl font-bold text-navy-950 mb-4">
                    Especificaciones Tecnicas
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(specs).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                      >
                        <span className="text-sm text-gray-500 capitalize">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm font-semibold text-navy-950">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Pricing + CTA */}
            <div className="space-y-6">
              {/* Price Cards */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-navy-950 mb-4">
                  Tarifa de Arriendo
                </h3>
                <div className="space-y-3">
                  {/* Desde X/día — derivado de tarifa_neta (fuente del cotizador) */}
                  <div className="p-4 bg-gold-500/10 border border-gold-500/20 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">
                          Desde
                        </p>
                        <p className="text-2xl font-extrabold text-navy-950">
                          {desdePrecio !== null ? `${formatPrice(desdePrecio)}/día` : "Consultar"}
                        </p>
                      </div>
                      <div className="w-10 h-10 bg-gold-500 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-navy-950"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 leading-relaxed">
                    IVA incluido · No incluye traslado, peajes ni operario adicional.
                    Para precio final usa el cotizador online — toma 1 minuto.
                  </p>

                  <Link
                    href={`/cotizar-arriendo?maquinariaId=${machine.id}`}
                    className="block w-full text-center px-4 py-3 bg-navy-950 hover:bg-navy-800 text-white font-semibold rounded-xl transition-colors text-sm"
                  >
                    Cotizar precio final →
                  </Link>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="space-y-3">
                <Link
                  href={`/contacto?servicio=arriendo&maquinaria=${encodeURIComponent(machine.nombre)}`}
                  className="block w-full text-center px-6 py-4 bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold rounded-xl transition-colors"
                >
                  Cotizar este equipo — Sin compromiso
                </Link>
                <a
                  href={`https://wa.me/56976673577?text=${encodeURIComponent(`Hola, me interesa arrendar: ${machine.nombre}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-6 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  WhatsApp
                </a>
              </div>

              {/* Contact Info */}
              <div className="bg-navy-950 rounded-2xl p-6 text-center">
                <p className="text-gray-400 text-sm mb-2">
                  Consultas directas
                </p>
                <a
                  href="tel:+56976673577"
                  className="text-gold-500 text-lg font-bold hover:text-gold-400 transition-colors"
                >
                  +56 9 7667 3577
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Machines */}
      {(related || []).length > 0 && (
        <section className="py-12 lg:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-8">
              Maquinaria Relacionada
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(related || []).map((m: any) => (
                <Link
                  key={m.id}
                  href={`/maquinarias/${m.id}`}
                  className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  <div className="h-44 bg-gradient-to-br from-navy-900 to-navy-800 flex items-center justify-center overflow-hidden">
                    {m.imagen ? (
                      <img
                        src={m.imagen}
                        alt={m.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg
                        className="w-16 h-16 text-navy-700"
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
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-navy-950 group-hover:text-gold-600 transition-colors">
                      {m.nombre}
                    </h3>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-500">
                        {getTipoLabel(m.tipo)}
                      </span>
                      {(() => {
                        const d = precioPublicoDesde(m);
                        return d !== null && (
                          <span className="text-sm font-bold text-gold-600">
                            desde {formatPrice(d)}/día
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Banner */}
      <section className="bg-navy-950 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">
            ¿Necesitas una maquina que no esta en el catalogo?
          </h2>
          <p className="text-gray-300 mb-6">
            Escribenos y te conseguimos el equipo que necesitas. Respondemos en menos de 2 horas.
          </p>
          <Link
            href="/contacto"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold rounded-xl transition-colors"
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

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Inicio",
                item: "https://jurmaq.cl",
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Maquinarias",
                item: "https://jurmaq.cl/maquinarias",
              },
              {
                "@type": "ListItem",
                position: 3,
                name: machine.nombre,
                item: `https://jurmaq.cl/maquinarias/${machine.id}`,
              },
            ],
          }),
        }}
      />
    </>
  );
}
