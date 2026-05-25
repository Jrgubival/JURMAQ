import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { supabasePublic } from "@jurmaq/shared/supabase";
import StaggeredGrid from "@/components/animations/StaggeredGrid";
import HeroSlideshow from "@/components/animations/HeroSlideshow";
import { formatCLP } from "@jurmaq/shared/format";
import { precioPublicoDesde } from "@/lib/pricing-arriendo";
import { whatsappCtaHome } from "@jurmaq/shared/whatsapp";
import { IconWhatsapp, IconBolt } from "@jurmaq/shared/icons";
import HeroSearch from "@/components/public/HeroSearch";
import CategoriasShowcase, { type TipoCategoria } from "@/components/public/CategoriasShowcase";


export const metadata: Metadata = {
  title:
    "JURMAQ · Arriendo Retroexcavadora, Minicargador y Maquinaria en Curicó",
  description:
    "Arriendo de retroexcavadora, miniexcavadora, minicargador y maquinaria pesada en Curicó, Teno, Molina, Romeral, Talca y toda la Región del Maule. Constructora, maestranza y barraca de fierros JURMAQ. +25 años. Para barraca: súbenos tu cotización y en menos de 2 horas te mejoramos el precio.",
  keywords: [
    "arriendo maquinaria Curicó",
    "arriendo maquinaria Maule",
    "arriendo maquinaria Talca",
    "arriendo maquinaria Teno",
    "arriendo maquinaria Molina",
    "arriendo retroexcavadora Curicó",
    "arriendo retroexcavadora Maule",
    "arriendo retroexcavadora Teno",
    "arriendo retroexcavadora Molina",
    "arriendo miniexcavadora Curicó",
    "arriendo miniexcavadora Maule",
    "arriendo minicargador Curicó",
    "arriendo brazo articulado Curicó",
    "arriendo plataforma elevadora Curicó",
    "arriendo camión tolva Curicó",
    "arriendo alzahombre Curicó",
    "maquinaria pesada Curicó",
    "maquinaria pesada Maule",
    "constructora Curicó",
    "constructora Maule",
    "constructora Teno",
    "constructora Molina",
    "construcción industrial Curicó",
    "construcción industrial Maule",
    "maestranza Curicó",
    "maestranza Maule",
    "barraca de fierros Curicó",
    "barraca fierros Maule",
    "fierros construcción Curicó",
    "movimiento de tierras Curicó",
    "fundaciones industriales Maule",
    "montaje estructural Curicó",
    "JURMAQ",
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
      "Arriendo de Maquinaria en Curicó y Maule | JURMAQ Constructora, Maestranza y Barraca de Fierros",
    description:
      "Arriendo de retroexcavadoras, miniexcavadoras, minicargadores y maquinaria pesada en Curicó, Teno, Molina y toda la Región del Maule. Construcción industrial, maestranza y barraca de fierros. +25 años.",
    url: "https://jurmaq.cl",
    siteName: "JURMAQ.cl",
    locale: "es_CL",
    type: "website",
  },
  alternates: {
    canonical: "https://jurmaq.cl",
  },
};

const divisions = [
  {
    title: "Constructora",
    description:
      "Obras civiles e industriales, fundaciones, montajes estructurales, pavimentos y movimiento de tierras para grandes empresas del sector agroindustrial.",
    number: "01",
    href: "/contacto?servicio=constructora",
    cta: "Consultar",
  },
  {
    title: "Arriendo de Maquinaria",
    description:
      "Flota de maquinaria pesada disponible para arriendo: retroexcavadoras, miniexcavadoras, brazos articulados y más, con operador o sin operador.",
    number: "02",
    href: "/maquinarias",
    cta: "Ver equipos",
  },
  {
    title: "Maestranza",
    description:
      "Fabricación y reparación de piezas metálicas, estructuras, mantención de equipos industriales, soldadura especializada y mecanizado de precisión.",
    number: "03",
    href: "/contacto?servicio=maestranza",
    cta: "Consultar",
  },
  {
    title: "Barraca de Fierros",
    description:
      "Venta de fierros de construcción, perfiles metálicos, planchas, tubos y materiales de acero para proyectos de construcción e industria.",
    number: "04",
    href: "/barraca",
    cta: "Ver catálogo",
  },
];

const clients = [
  { name: "Nestlé Chile", logo: "/images/clientes/nestle.png" },
  { name: "Vinícola Miguel Torres", logo: "/images/clientes/miguel-torres.png" },
  { name: "Cementos Biobío", logo: "/images/clientes/cbb-cementos.png" },
  { name: "Iansagro S.A.", logo: "/images/clientes/iansa.webp" },
  { name: "Surfrut Romeral", logo: "/images/clientes/surfrut.svg" },
];

function formatPrice(price: number): string {
  return formatCLP(price);
}

function getStatusLabel(estado: string): string {
  const labels: Record<string, string> = {
    disponible: "Disponible",
    arrendada: "Arrendada",
    mantencion: "En Mantención",
  };
  return labels[estado] || estado;
}

export default async function HomePage() {
  const { data: featuredMachines } = await supabasePublic
    .from('maquinarias')
    .select('*')
    .limit(3);

  // Conteos por tipo para CategoriasShowcase
  const { data: allMachines } = await supabasePublic
    .from('maquinarias')
    .select('tipo');
  const categoryCounts: Partial<Record<TipoCategoria, number>> = {};
  for (const m of allMachines || []) {
    const t = (m as any).tipo as TipoCategoria;
    categoryCounts[t] = (categoryCounts[t] || 0) + 1;
  }

  return (
    <>
      <main id="main-content">
        {/* ===== HERO SECTION =====
            Retrofit Editorial Luxury (skills: design-taste anti-center bias,
            web-typography editorial serif, impeccable no hero-metric template,
            responsive-design 100dvh, minimalist-ui eyebrow + Newsreader italic). */}
        <section className="relative bg-navy-950 overflow-hidden min-h-[100dvh] flex items-center">
        {/* Slideshow Background */}
        <HeroSlideshow />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-36 reveal-on-load">
          <div className="max-w-3xl">
            <p className="eyebrow text-gold-400 mb-6">
              Curicó · Maule · desde 1998
            </p>

            <h1
              className="editorial-h1 text-white mb-6"
              style={{ fontSize: 'clamp(2.75rem, 5vw + 1rem, 5.25rem)' }}
              data-text-reveal
            >
              Tu obra avanza sin parar con{' '}
              <span className="font-[var(--font-serif)] italic text-gold-500" style={{ fontWeight: 500 }}>
                JURMAQ
              </span>
            </h1>

            <p className="text-lg lg:text-xl text-gray-300 mb-8 leading-relaxed max-w-[55ch]">
              Obras, arriendo, maestranza y barraca de fierros. 27 años en el Maule.
            </p>

            {/* Hero Search Bar — estilo Rendalomaq */}
            <div className="mb-4">
              <HeroSearch />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/como-funciona"
                className="inline-flex items-center gap-2 text-sm font-medium text-white/80 hover:text-gold-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Cómo funciona
              </Link>
              <a
                href={whatsappCtaHome()}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-2 text-sm font-medium text-white/80 hover:text-gold-400 transition-colors"
              >
                <IconWhatsapp className="w-4 h-4" />
                Cotizar por WhatsApp
              </a>
            </div>
            <p className="inline-flex items-center gap-2 text-sm text-gray-500 mt-4">
              <IconBolt className="w-3.5 h-3.5 text-gold-500" />
              Respuesta en menos de 2 horas · Mejoramos cotizaciones de la competencia
            </p>
            </div>

          {/* Trayectoria — KPIs editoriales en lista divisible + prose limpio abajo.
              Reemplaza la versión anterior con números inline text-[1.45em] que
              rompía baseline. Números en serif italic gold como KPI dedicado. */}
          <div className="mt-14 lg:mt-20 pt-10 border-t border-navy-800">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8 max-w-2xl">
              <div>
                <dd
                  className="font-[var(--font-serif)] italic text-gold-500 tabular-nums leading-none"
                  style={{ fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', fontWeight: 500, letterSpacing: '-0.02em' }}
                >
                  27
                </dd>
                <dt className="text-[10px] font-semibold text-white/55 uppercase tracking-[0.22em] mt-3">
                  Años en el Maule
                </dt>
              </div>
              <div>
                <dd
                  className="font-[var(--font-serif)] italic text-gold-500 tabular-nums leading-none"
                  style={{ fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', fontWeight: 500, letterSpacing: '-0.02em' }}
                >
                  UF 139K
                </dd>
                <dt className="text-[10px] font-semibold text-white/55 uppercase tracking-[0.22em] mt-3">
                  En proyectos documentados
                </dt>
              </div>
            </dl>
            <p className="mt-8 max-w-[58ch] text-base lg:text-lg text-gray-200 leading-relaxed">
              Construimos obras industriales para Nestlé, Miguel Torres, Iansagro, Surfrut
              y Cementos Biobío. Desde plantas industriales hasta ampliaciones, con
              presupuesto cerrado y plazos cumplidos.
            </p>
          </div>
        </div>
      </section>

      {/* ===== DIVISIONS SECTION =====
          high-end-visual-design: section padding py-24 lg:py-32.
          design-taste: eyebrow + editorial H2 con Newsreader italic accent.
          minimalist-ui: bg warm-bone variant for breathing. */}
        <section id="divisiones" className="py-24 lg:py-32 bg-white content-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-14 lg:mb-20 max-w-3xl">
            <p className="eyebrow mb-4">Cuatro áreas, un equipo</p>
            <h2 className="editorial-h1 text-navy-950 mb-4" style={{ fontSize: 'clamp(2rem, 3vw + 1rem, 3.5rem)' }}>
              Todo lo que necesitas para tu obra,{' '}
              <span className="font-[var(--font-serif)] italic text-gold-600" style={{ fontWeight: 500 }}>en un solo lugar</span>.
            </h2>
            <p className="text-lg text-gray-700 max-w-[55ch] leading-relaxed">
              Constructora, arriendo de maquinaria, maestranza y barraca de fierros.
              Un solo proveedor responde por todo el ciclo de tu obra.
            </p>
          </div>

          {/* Featured: Constructora (first item, full width) */}
          <div className="mb-6 lg:mb-8">
            {(() => {
              const division = divisions[0];
              const content = (
                <div className="group relative bg-navy-950 rounded-2xl p-8 lg:p-10">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    <span className="font-[var(--font-serif)] italic text-gold-500/60 leading-none shrink-0 select-none" style={{ fontSize: 'clamp(2rem, 3vw, 2.75rem)', fontWeight: 400 }}>
                      {division.number}
                    </span>
                    <div>
                      <h3 className="text-xl lg:text-2xl font-bold text-white mb-3">
                        {division.title}
                      </h3>
                      <p className="text-gray-500 leading-relaxed max-w-2xl">
                        {division.description}
                      </p>
                      {division.href && (
                        <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-gold-500">
                          {division.cta}
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
              return division.href ? <Link href={division.href}>{content}</Link> : content;
            })()}
          </div>

          {/* Remaining 3 divisions in a 3-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {divisions.slice(1).map((division) => {
              const content = (
                <div className="group relative bg-gray-50 border border-gray-200 rounded-2xl p-8 hover:border-gold-500/30 transition-colors">
                  <span className="text-3xl font-black text-navy-950/10 leading-none select-none">
                    {division.number}
                  </span>
                  <h3 className="text-xl font-bold text-navy-950 mt-3 mb-3">
                    {division.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {division.description}
                  </p>
                  {division.href && (
                    <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-gold-600">
                      {division.cta}
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
                    </div>
                  )}
                </div>
              );

              return (
                <div key={division.title}>
                  {division.href ? (
                    <Link href={division.href}>
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== CATEGORIAS DE MAQUINARIA ===== */}
      <CategoriasShowcase
        counts={categoryCounts}
        variant="light"
        title="Nuestras máquinas"
        subtitle="Flota propia con mantención al día: retros, miniexcavadoras, brazos articulados, plataformas elevadoras y minicargadores."
      />

      {/* ===== FEATURED MACHINERY ===== */}
        {(featuredMachines || []).length > 0 && (
          <section className="py-16 lg:py-24 bg-gray-50 content-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-14 lg:mb-16">
              <div>
                <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">
                  Maquinaria disponible
                </p>
                <h2
                  className="text-[#111111] leading-[1.1]"
                  style={{ fontSize: 'clamp(1.875rem, 3.5vw, 3rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
                >
                  Equipos{' '}
                  <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>destacados</span>.
                </h2>
              </div>
              <Link
                href="/maquinarias"
                className="inline-flex items-center gap-2 text-sm font-semibold text-navy-900 hover:text-gold-600 transition-colors"
              >
                Ver todos
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

            <StaggeredGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {(featuredMachines || []).map((machine) => (
                <div
                  key={machine.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="h-48 bg-gradient-to-br from-navy-900 to-navy-800 overflow-hidden">
                    {machine.imagen ? (
                      <img
                        src={machine.imagen}
                        alt={`Maquinaria ${machine.nombre} disponible para arriendo en JURMAQ`}
                        loading="lazy"
                        decoding="async"
                        width={400}
                        height={192}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-16 h-16 text-navy-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="text-lg font-bold text-navy-950">
                        {machine.nombre}
                      </h3>
                      <span
                        className={`shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full badge-${machine.estado}`}
                      >
                        {getStatusLabel(machine.estado)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {machine.descripcion}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div>
                        <span className="text-xs text-gray-500">
                          Desde
                        </span>
                        <div className="text-lg font-bold text-gold-600">
                          {(() => {
                            const d = precioPublicoDesde(machine);
                            return d !== null ? `${formatPrice(d)}/día` : "Consultar";
                          })()}
                        </div>
                      </div>
                      <Link
                        href={`/cotizar-arriendo?maquinariaId=${machine.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy-950 hover:bg-[#111111] text-white text-sm font-medium tracking-[0.02em] rounded-lg transition-colors"
                      >
                        Cotizar online
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12h14M13 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </StaggeredGrid>
          </div>
          </section>
        )}

      {/* ===== CLIENTS SECTION ===== */}
        <section className="py-20 lg:py-24 bg-white border-y border-[#EAEAEA] content-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
              Clientes
            </p>
            <h2
              className="text-[#111111] leading-[1.1]"
              style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.25rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
            >
              Empresas que <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>confían</span> en JURMAQ.
            </h2>
          </div>

          <div data-scroll-x className="overflow-hidden">
            <div data-scroll-x-inner className="flex gap-6 lg:gap-8 w-max">
              {clients.map((client) => (
                <div
                  key={client.name}
                  className="flex items-center justify-center h-24 bg-white border border-gray-200 rounded-xl px-6 min-w-[180px]"
                >
                  <Image
                    src={client.logo}
                    alt={`Logo de ${client.name} - cliente de JURMAQ`}
                    width={140}
                    height={48}
                    loading="lazy"
                    className="h-12 max-w-[140px] object-contain grayscale opacity-60"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== PROJECTS PREVIEW ===== */}
        <section id="proyectos" className="py-24 lg:py-32 bg-[#FBFBFA] content-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-14 lg:mb-16 max-w-3xl">
            <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">
              Proyectos · 27 años
            </p>
            <h2
              className="text-[#111111] leading-[1.1] mb-4"
              style={{ fontSize: 'clamp(1.875rem, 3.5vw, 3rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
            >
              Obras que <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>hablan</span> por nosotros.
            </h2>
            <p className="text-base lg:text-lg text-[#5A5A57] max-w-[55ch] leading-relaxed">
              Construyendo para las principales empresas agroindustriales de la zona central.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Main project - visually distinct */}
            <div className="bg-navy-950 rounded-2xl p-6 lg:p-8 md:col-span-2 lg:col-span-1 lg:row-span-1">
              <span className="text-xs font-semibold text-gold-500 uppercase tracking-wider">
                Nestlé Chile
              </span>
              <h3 className="text-lg font-bold text-white mt-2 mb-2">
                Fundaciones Silos - Nestlé Teno
              </h3>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                Fundaciones silos de granos, expansión batcheo y molienda, montaje equipos, pavimentos, movimiento de tierras.
              </p>
              <div className="pt-3 border-t border-navy-800">
                <span className="text-3xl font-black text-gold-500">UF 76.000+</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <span className="text-xs font-semibold text-gold-600 bg-gold-500/10 px-2.5 py-1 rounded-full">
                Vinícola Miguel Torres
              </span>
              <h3 className="text-lg font-bold text-navy-950 mt-3 mb-2">
                Bodega de Cubas - Miguel Torres
              </h3>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                Bodega de cubas, traslado de cubas de 50.000 lts., portería central, obras civiles.
              </p>
              <div className="pt-3 border-t border-gray-100">
                <span className="text-sm text-gray-500">Monto aprox:</span>
                <span className="ml-2 font-bold text-navy-950">UF 21.000+</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <span className="text-xs font-semibold text-gold-600 bg-gold-500/10 px-2.5 py-1 rounded-full">
                Iansagro S.A.
              </span>
              <h3 className="text-lg font-bold text-navy-950 mt-3 mb-2">
                Mantención Industrial - Iansagro
              </h3>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                Mantención permanente de estructuras, pavimentos, cubierta silos y obras complementarias.
              </p>
              <div className="pt-3 border-t border-gray-100">
                <span className="text-sm text-gray-500">Monto aprox:</span>
                <span className="ml-2 font-bold text-navy-950">UF 6.000+</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
        <section className="bg-navy-950 py-20 lg:py-28 border-t border-navy-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-[0.22em] mb-6">
            Respuesta en 2 horas hábiles
          </p>
          <h2
            className="text-white leading-[1.1] mb-6"
            style={{ fontSize: 'clamp(1.875rem, 3.5vw, 3rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            Cotiza ahora y recibe <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>respuesta hoy</span>.
          </h2>
          <p className="text-base lg:text-lg text-white/75 mb-10 max-w-2xl mx-auto leading-relaxed">
            Escríbenos por WhatsApp o llena el formulario. Respondemos en menos de 2 horas hábiles.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a
              href={whatsappCtaHome()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-base rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </a>
            <Link
              href="/contacto"
              className="text-gray-500 hover:text-white font-medium transition-colors"
            >
              o pide presupuesto por formulario
            </Link>
          </div>
        </div>
        </section>
      </main>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: "Constructora Jorge Ubilla Rivera E.I.R.L.",
            description:
              "Empresa de construcción industrial, arriendo de maquinaria pesada, maestranza y barraca de fierros con más de 25 años de experiencia en la Provincia de Curicó, Región del Maule, Chile. Atendemos Curicó, Teno, Molina, Romeral, Sagrada Familia, Hualañé, Licantén, Vichuquén y Rauco.",
            url: "https://jurmaq.cl",
            telephone: "+56976673577",
            email: "contacto@jurmaq.cl",
            image: "https://jurmaq.cl/logo.png",
            address: {
              "@type": "PostalAddress",
              streetAddress: "Av. Poniente 2157",
              addressLocality: "Molina",
              addressRegion: "Maule",
              postalCode: "3560000",
              addressCountry: "CL",
            },
            geo: {
              "@type": "GeoCoordinates",
              latitude: -35.1167,
              longitude: -71.2833,
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
            ],
            openingHoursSpecification: [
              {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: [
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                ],
                opens: "08:30",
                closes: "18:30",
              },
              {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: "Saturday",
                opens: "09:00",
                closes: "14:00",
              },
            ],
            priceRange: "$$",
            foundingDate: "2000",
            hasOfferCatalog: {
              "@type": "OfferCatalog",
              name: "Servicios JURMAQ",
              itemListElement: [
                {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: "Construcción Industrial",
                    description:
                      "Obras civiles e industriales, fundaciones, montajes estructurales, pavimentos y movimiento de tierras.",
                  },
                },
                {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: "Arriendo de Maquinaria Pesada",
                    description:
                      "Retroexcavadoras, miniexcavadoras, brazos articulados y más equipos con o sin operador.",
                  },
                },
                {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: "Maestranza",
                    description:
                      "Fabricación y reparación de piezas metálicas, soldadura especializada y mecanizado de precisión.",
                  },
                },
                {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: "Barraca de Fierros",
                    description:
                      "Venta de fierros de construcción, perfiles metálicos, planchas, tubos y materiales de acero.",
                  },
                },
              ],
            },
            sameAs: ["https://wa.me/56976673577"],
          }),
        }}
      />
    </>
  );
}
