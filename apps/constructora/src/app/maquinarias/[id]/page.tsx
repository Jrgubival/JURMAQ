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
import WhatsappLink from "@/components/public/WhatsappLink";
import StickyMobileCTA from "@/components/public/StickyMobileCTA";
import ObraCompletaCTA from "@/components/public/ObraCompletaCTA";
import RelatedMachines from "@/components/public/RelatedMachines";
import ViewItemTracker from "@jurmaq/shared/ui/ViewItemTracker";
import Breadcrumbs from "@jurmaq/shared/ui/Breadcrumbs";
import { getMaquinariaDescripcion } from "@jurmaq/shared/seo/maquinaria-descripciones";
import {
  tieneOperadorIncluido,
  TIPOS_DB_OPERA_CLIENTE as TIPOS_OPERA_CLIENTE,
} from "@jurmaq/shared/seo/operador";
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';

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
    alzahombre: "Plataforma elevadora",
    minicargador: "Minicargador",
    camion: "Camión tolva",
    otro: "Otro",
  };
  return labels[tipo] || tipo;
}

/**
 * Frase verídica de operador según tipo (para metadata/OG).
 * Movimiento de tierra y camión tolva van SIEMPRE con operador/conductor
 * incluido en la tarifa; plataformas de elevación las opera el cliente.
 */
function fraseOperador(tipo: string): string {
  if (tieneOperadorIncluido(tipo)) {
    return tipo === "camion" ? " con conductor incluido" : " con operador incluido";
  }
  if (TIPOS_OPERA_CLIENTE.has(tipo)) {
    return " con operación por el cliente (curso vigente)";
  }
  return "";
}

/**
 * Slugify nombre → URL slug.
 * "Minicargador CAT 246C" → "minicargador-cat-246c"
 */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Lookup maquinaria por slug O por id numérico legacy.
 * Acepta:
 *   - "9" → buscar por id=9 (backward compat)
 *   - "minicargador-cat-246c-9" → buscar por id=9 (tail-id pattern, SEO-friendly)
 *   - "minicargador-cat-246c" → fallback slug match (más lento)
 */
async function findMaquinariaBySlug(slug: string): Promise<Maquinaria | null> {
  // Caso 1: solo dígitos → buscar por id directo
  if (/^\d+$/.test(slug)) {
    const { data } = await supabasePublic.from('maquinarias').select('*').eq('id', Number(slug)).maybeSingle();
    return (data as Maquinaria) ?? null;
  }
  // Caso 2: termina con -<id> → extraer id final
  const tailMatch = slug.match(/-(\d+)$/);
  if (tailMatch) {
    const id = Number(tailMatch[1]);
    const { data } = await supabasePublic.from('maquinarias').select('*').eq('id', id).maybeSingle();
    if (data) return data as Maquinaria;
  }
  // Caso 3: slug puro → matchear contra nombre (último recurso)
  const { data: all } = await supabasePublic.from('maquinarias').select('*');
  const found = (all as Maquinaria[] | null)?.find((m) => slugify(m.nombre) === slug);
  return found ?? null;
}

export async function generateStaticParams() {
  const { data: machines } = await supabasePublic
    .from('maquinarias')
    .select('id, nombre');
  return (machines || []).map((m) => ({
    id: `${slugify(m.nombre)}-${m.id}`,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const machine = await findMaquinariaBySlug(id);

  if (!machine) {
    return { title: "Maquinaria no encontrada | JURMAQ" };
  }

  const desdePrecio = precioPublicoDesde(machine);
  // Etiqueta de unidad real de la tarifa (hora / día). Antes se hardcodeaba
  // "/día" aunque la máquina cobrara por hora — confundía y NO calzaba con la
  // intención de búsqueda "valor hora retroexcavadora" (rankea #1–4.5 con 0
  // clics). Ahora el título lidera con precio/valor en la unidad correcta.
  const unidadLbl = machine.unidad_tarifa === "hora" ? "hora" : "día";
  const priceText = desdePrecio !== null
    ? `Desde ${formatCLP(desdePrecio)}/${unidadLbl}`
    : "Consultar precio";
  // Frase de precio que lidera el título y el primer ~120 chars del description.
  // Para tarifa por hora usamos el literal "Valor hora desde…" para capturar
  // la consulta de intención de precio. Para día, "Valor día desde…".
  const valorText = desdePrecio !== null
    ? (machine.unidad_tarifa === "hora"
        ? `Valor hora desde ${formatCLP(desdePrecio)}`
        : `Valor día desde ${formatCLP(desdePrecio)}`)
    : "Consulta el valor";
  const tipoLbl = getTipoLabel(machine.tipo);
  const operadorTxt = fraseOperador(machine.tipo);

  return {
    title: `Arriendo ${machine.nombre} · ${valorText} · Curicó y Maule`,
    description: `${valorText} (neto). Arriendo de ${machine.nombre} (${tipoLbl})${operadorTxt} en Curicó, Molina, Teno, Talca, Linares y toda la Región del Maule. ${machine.descripcion || "Equipo en operación, mantención al día."} Cotiza por WhatsApp y recibe respuesta el mismo día.`,
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
      // "con operador" solo para tipos donde el operador va incluido en la
      // tarifa (100% verídico). Nada de "sin operador" para esos tipos.
      ...(tieneOperadorIncluido(machine.tipo)
        ? [`${tipoLbl} con operador Curicó`, `${tipoLbl} con operador Maule`]
        : []),
      `${machine.nombre} precio arriendo`,
      `precio ${tipoLbl} día Curicó`,
      // Intención de precio/hora — capturada por el título "Valor hora desde…".
      `valor hora ${tipoLbl.toLowerCase()}`,
      `valor ${tipoLbl.toLowerCase()} por hora`,
      `${tipoLbl.toLowerCase()} precio hora`,
      "arriendo maquinaria Curicó",
      "arriendo maquinaria Molina",
      "arriendo maquinaria Teno",
      "arriendo maquinaria Talca",
      "arriendo maquinaria Region del Maule",
      "JURMAQ",
    ],
    openGraph: {
      title: `Arriendo ${machine.nombre} en Curicó y Maule · ${priceText} · JURMAQ`,
      description: `${machine.nombre} (${tipoLbl}) disponible para arriendo${operadorTxt} en Curicó, Molina, Teno, Talca y Región del Maule. ${priceText}.`,
      url: `https://jurmaq.cl/maquinarias/${slugify(machine.nombre)}-${machine.id}`,
      siteName: "JURMAQ",
      locale: "es_CL",
      type: "website",
      images: machine.imagen
        ? [
            {
              url: machine.imagen,
              width: 1200,
              height: 630,
              alt: `${machine.nombre} en arriendo · JURMAQ Curicó`,
            },
          ]
        : [
            // Fallback al OG default de constructora cuando no hay foto de la máquina.
            { url: "/og-image-1200x630.png", width: 1200, height: 630, alt: "JURMAQ" },
            { url: "/icon-512.png", width: 512, height: 512, alt: "JURMAQ" },
          ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Arriendo ${machine.nombre} · JURMAQ Curicó`,
      description: `${tipoLbl} en arriendo · ${priceText} · Despacho a toda la Región del Maule.`,
    },
    alternates: {
      canonical: `https://jurmaq.cl/maquinarias/${slugify(machine.nombre)}-${machine.id}`,
    },
  };
}

export default async function MaquinariaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const machine = await findMaquinariaBySlug(id);

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
        name: `Arriendo por ${machine.unidad_tarifa === "hora" ? "hora" : "día"}${tieneOperadorIncluido(machine.tipo) ? (machine.tipo === "camion" ? " con conductor incluido" : " con operador incluido") : ""} (desde, neto)`,
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
      {/* GA4 view_item — server passes data, client mounts and fires */}
      <ViewItemTracker
        id={machine.id}
        nombre={machine.nombre}
        precio={machine.tarifa_neta ?? 0}
        categoria={machine.tipo}
      />
      {/* Breadcrumb + Hero */}
      <section className="bg-navy-950 py-10 lg:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fadeUp">
            <Breadcrumbs
              variant="dark"
              className="mb-6"
              items={[
                { label: "Inicio", href: "/" },
                { label: "Maquinarias", href: "/maquinarias" },
                { label: machine.nombre },
              ]}
            />

            <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-[0.22em] mb-4">
              {getTipoLabel(machine.tipo)} · Flota propia
            </p>
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              <h1
                className="text-white leading-[1.05]"
                style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 500, letterSpacing: '-0.015em' }}
              >
                {(() => {
                  // Split nombre to italicize the model number/brand portion
                  // e.g. "Minicargador Bobcat S650" → "Minicargador" + italic "Bobcat S650"
                  const parts = machine.nombre.split(' ');
                  if (parts.length < 2) return machine.nombre;
                  const head = parts[0];
                  const tail = parts.slice(1).join(' ');
                  return (
                    <>
                      {head}{' '}
                      <span className="font-[var(--font-serif)] italic text-gold-400" style={{ fontWeight: 400 }}>
                        {tail}
                      </span>
                    </>
                  );
                })()}
              </h1>
              <span
                className={`inline-flex items-center px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] rounded-full whitespace-nowrap ${getStatusColor(machine.estado)}`}
              >
                {getStatusLabel(machine.estado)}
              </span>
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

              {/* Description — intro + casos de uso + características + incluye */}
              {(() => {
                const desc = getMaquinariaDescripcion(machine.tipo, machine.descripcion);
                return (
                  <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 lg:p-8 space-y-6">
                    <div>
                      <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
                        Descripción del equipo
                      </p>
                      <p className="text-base text-[#5A5A57] leading-relaxed">
                        {desc.intro}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#EAEAEA]">
                      <div>
                        <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
                          Usos típicos
                        </p>
                        <ul className="space-y-1.5">
                          {desc.usos.map((u) => (
                            <li key={u} className="flex items-start gap-2 text-sm text-[#5A5A57]">
                              <svg className="w-3.5 h-3.5 text-[#956400] shrink-0 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="m5 12 5 5L20 7" />
                              </svg>
                              <span>{u}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
                          Características técnicas
                        </p>
                        <ul className="space-y-1.5">
                          {desc.caracteristicas.map((c) => (
                            <li key={c} className="flex items-start gap-2 text-sm text-[#5A5A57]">
                              <svg className="w-3.5 h-3.5 text-[#956400] shrink-0 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M9 12h6M12 9v6" />
                              </svg>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#EAEAEA]">
                      <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
                        Incluye sin costo
                      </p>
                      <ul className="flex flex-wrap gap-x-6 gap-y-2">
                        {desc.incluye.map((i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-[#5A5A57]">
                            <svg className="w-3.5 h-3.5 text-[#2F7F4E] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="m5 12 5 5L20 7" />
                            </svg>
                            <span>{i}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })()}

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

            {/* Right: Pricing + CTA — gaps comprimidos (audit feedback) */}
            <div className="space-y-4">
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
                    <WhatsappLink
                      href={whatsappCtaMaquinaria(machine.id, machine.nombre)}
                      source="maquinaria_detail_fallback"
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border-2 border-navy-950 hover:bg-navy-950 hover:text-white text-navy-950 font-bold text-sm rounded-xl transition-colors"
                    >
                      Consultar por WhatsApp
                    </WhatsappLink>
                  </div>
                </div>
              )}

              {/* Operador — indicador verídico por tipo, junto a la tarifa.
                  Movimiento de tierra y camión tolva: operador/conductor incluido.
                  Plataformas de elevación: las opera el equipo del cliente. */}
              {(() => {
                const badge = tieneOperadorIncluido(machine.tipo)
                  ? {
                      titulo: machine.tipo === "camion" ? "Siempre con conductor" : "Siempre con operador",
                      detalle:
                        machine.tipo === "camion"
                          ? "incluido en la tarifa — lo conduce personal de JURMAQ, no se arrienda solo"
                          : "incluido en la tarifa — la opera personal de JURMAQ, no se arrienda sola",
                    }
                  : TIPOS_OPERA_CLIENTE.has(machine.tipo)
                    ? { titulo: "La opera tu equipo", detalle: "(curso de operación vigente)" }
                    : null;
                if (!badge) return null;
                return (
                  <div className="flex items-center gap-2.5 bg-white rounded-2xl border border-[#EAEAEA] px-5 py-3.5">
                    <svg className="w-5 h-5 text-[#2F7F4E] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm text-navy-950 leading-snug">
                      <span className="font-bold">{badge.titulo}</span>{" "}
                      <span className="text-[#6F6F6C]">{badge.detalle}</span>
                    </p>
                  </div>
                );
              })()}

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
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      {/* Breadcrumb JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
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

      {/* Espaciador para que la barra sticky móvil no tape el último contenido */}
      <div className="h-20 lg:hidden" aria-hidden="true" />

      {/* CTA sticky móvil — Cotizar online + WhatsApp siempre visibles */}
      <StickyMobileCTA maquinariaId={machine.id} maquinariaNombre={machine.nombre} />
    </>
  );
}
