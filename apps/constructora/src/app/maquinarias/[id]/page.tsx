import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabasePublic } from "@jurmaq/shared/supabase";
import AnimatedSection from "@/components/animations/AnimatedSection";
import { formatCLP } from "@jurmaq/shared/format";
import { precioPublicoDesde } from "@/lib/pricing-arriendo";
import DisponibilidadCalendario from "@/components/maquinarias/DisponibilidadCalendario";
import { whatsappCtaMaquinaria } from "@jurmaq/shared/whatsapp";
import PricingTiers from "@/components/public/PricingTiers";
import ObraCompletaCTA from "@/components/public/ObraCompletaCTA";
import RelatedMachines from "@/components/public/RelatedMachines";

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
            <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
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
              {/* Pricing Tiers — tabs día/semana/mes con desglose IVA + CTAs */}
              {desdePrecio !== null && machine.tarifa_neta ? (
                <PricingTiers
                  maquinariaId={machine.id}
                  maquinariaNombre={machine.nombre}
                  tarifaNeta={Number(machine.tarifa_neta)}
                  unidadTarifa={machine.unidad_tarifa || 'dia'}
                  minimoUnidades={Number(machine.minimo_unidades) || 1}
                />
              ) : (
                /* Fallback cuando no hay tarifa configurada */
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-navy-950 mb-2">Consultar precio</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Este equipo requiere cotización personalizada. Te respondemos en menos de 2 horas.
                  </p>
                  <div className="flex flex-col gap-3">
                    <Link
                      href={`/cotizar-arriendo?maquinariaId=${machine.id}`}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-sm rounded-xl transition-colors"
                    >
                      Cotizar precio final →
                    </Link>
                    <a
                      href={whatsappCtaMaquinaria(machine.id, machine.nombre)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border-2 border-navy-950 hover:bg-navy-950 hover:text-white text-navy-950 font-bold text-sm rounded-xl transition-colors"
                    >
                      Consultar por WhatsApp
                    </a>
                  </div>
                </div>
              )}

              {/* Mejora-precio para obras completas + multi-arriendo (diferenciador único) */}
              <ObraCompletaCTA source={`maquinaria_${machine.id}_${machine.tipo}`} />

              {/* Calendario de disponibilidad (próximos 30 días) */}
              <DisponibilidadCalendario maquinariaId={machine.id} />

              {/* Trust badges */}
              <div className="bg-navy-950 rounded-2xl p-6">
                <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
                  Incluye sin costo
                </h4>
                <ul className="space-y-3">
                  {[
                    'Mantención al día garantizada',
                    'Asesoría técnica por WhatsApp',
                    'Coordinación de traslado',
                    'Contrato digital firmado por OTP',
                  ].map((it) => (
                    <li key={it} className="flex items-start gap-3 text-sm text-gray-300">
                      <svg className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 pt-5 border-t border-navy-800 text-center">
                  <p className="text-xs text-gray-500 mb-1">Consultas directas</p>
                  <a
                    href="tel:+56976673577"
                    className="text-gold-500 text-base font-bold hover:text-gold-400 transition-colors"
                  >
                    +56 9 7667 3577
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Machines — server component con fallback inteligente */}
      <RelatedMachines currentId={machine.id} tipo={machine.tipo} />

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
