import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PROYECTOS, getProyectosStats } from "@/lib/proyectos-data";
import { getTestimoniosDestacados } from "@/lib/testimonios-data";
import TestimoniosGrid from "@/components/public/TestimoniosGrid";
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';

/**
 * /proyectos — Hub público de case studies B2B.
 *
 * Diferenciador: ningún competidor en Chile (Sodimac, Easy, Construmart,
 * Prodalam, Rendalomaq, MTS) muestra obras reales con cliente identificado.
 * Cada card linkea a `/proyectos/[slug]` con el detail page completo.
 *
 * Las fuentes de datos viven en `@/lib/proyectos-data` y `@/lib/testimonios-data`
 * para reusar en el sitemap y la home.
 */

export const metadata: Metadata = {
  title: "Proyectos JURMAQ · 27 años construyendo en el Maule",
  description:
    "Casos reales: silos Nestlé Teno, bodega de cubas Miguel Torres, mantención industrial Iansagro, bodega refrigerada Surfrut, modernización CBB. Mira las máquinas usadas, materiales aplicados y testimonios del cliente en cada obra.",
  alternates: { canonical: "https://constructora.jurmaq.cl/proyectos" },
  openGraph: {
    title: "Proyectos JURMAQ · Obras reales en el Maule",
    description:
      "Casos reales documentados: Nestlé, Miguel Torres, Iansagro, Surfrut, CBB. Maquinaria + materiales en cada obra.",
    url: "https://constructora.jurmaq.cl/proyectos",
    type: "website",
  },
};

export default function ProyectosPage() {
  const { totalUF, totalObras, clientesUnicos } = getProyectosStats();
  const testimonios = getTestimoniosDestacados(3);

  // JSON-LD: ItemList de proyectos para que Google entienda la página como
  // listado de obras (similar a un CollectionPage).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Obras destacadas JURMAQ",
    description:
      "Proyectos reales de construcción industrial en la Región del Maule.",
    numberOfItems: PROYECTOS.length,
    itemListElement: PROYECTOS.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://constructora.jurmaq.cl/proyectos/${p.slug}`,
      name: p.titulo,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      {/* ===== HERO ===== */}
      <section className="bg-navy-950 py-20 lg:py-28 border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-white/55 mb-6 flex-wrap">
            <Link href="/" className="hover:text-gold-400 transition-colors">
              Inicio
            </Link>
            <svg
              className="w-3.5 h-3.5 text-white/30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-white/85 font-medium">Proyectos</span>
          </nav>
          <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-[0.22em] mb-6">
            27 años · plantas industriales · Maule
          </p>
          <h1
            className="text-white leading-[1.05] mb-6 max-w-4xl"
            style={{
              fontSize: "clamp(2.25rem, 5vw, 4rem)",
              fontWeight: 500,
              letterSpacing: "-0.015em",
            }}
          >
            Proyectos JURMAQ · 27 años{" "}
            <span
              className="font-[var(--font-serif)] italic text-gold-400"
              style={{ fontWeight: 400 }}
            >
              construyendo
            </span>{" "}
            en el Maule.
          </h1>
          <p className="text-base lg:text-lg text-white/75 max-w-2xl mb-10 leading-relaxed">
            Construyendo para las principales empresas agroindustriales del Maule.
            Cada obra con máquinas, materiales y plazos documentados.
          </p>

          {/* Stats narrativos (prose-form, no hero-metric template) */}
          <div className="pt-8 border-t border-navy-800 max-w-[58ch] space-y-4 text-base lg:text-lg text-gray-200 leading-relaxed">
            <p>
              <span
                className="font-[var(--font-serif)] italic text-gold-500 text-[1.45em] align-baseline tabular-nums"
                style={{ fontWeight: 500 }}
              >
                {totalObras}
              </span>{" "}
              obras documentadas, ejecutadas para{" "}
              <span
                className="font-[var(--font-serif)] italic text-gold-500 text-[1.45em] align-baseline tabular-nums"
                style={{ fontWeight: 500 }}
              >
                {clientesUnicos}
              </span>{" "}
              empresas distintas en la Región del Maule.
            </p>
            <p>
              Monto agregado documentado:{" "}
              <span
                className="font-[var(--font-serif)] italic text-gold-500 text-[1.45em] align-baseline tabular-nums"
                style={{ fontWeight: 500 }}
              >
                UF {(totalUF / 1000).toFixed(0)}K
              </span>
              . Suma neta sin descuentos, verificable en cada caso de obra abajo.
            </p>
          </div>
        </div>
      </section>

      {/* ===== GRID DE PROYECTOS ===== */}
      <section className="py-16 lg:py-24 bg-[#FBFBFA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {PROYECTOS.map((p, i) => (
              <Link
                key={p.slug}
                href={`/proyectos/${p.slug}`}
                className={`group flex flex-col bg-white rounded-2xl overflow-hidden border transition-all hover:shadow-xl ${
                  p.destacado
                    ? "border-gold-500/50 shadow-lg shadow-gold-500/10 lg:row-span-1"
                    : "border-[#EAEAEA] hover:border-gold-500/40"
                }`}
              >
                {/* Visual */}
                <div className="relative aspect-[16/10] bg-gradient-to-br from-navy-900 to-navy-950 overflow-hidden">
                  {p.imagenHero ? (
                    <Image
                      src={p.imagenHero}
                      alt={`${p.titulo} — Obra JURMAQ`}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
                    />
                  ) : (
                    <>
                      <div
                        className="absolute inset-0 opacity-15"
                        style={{
                          backgroundImage:
                            "linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.15) 25%, transparent 25%)",
                          backgroundSize: "30px 30px",
                        }}
                      />
                      <div className="absolute top-5 left-5 text-white text-7xl font-black opacity-15 leading-none">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                    </>
                  )}
                  {/* Badge estado */}
                  <div className="absolute top-5 right-5">
                    {p.estado === "en_curso" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        En curso
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                        <svg
                          className="w-3 h-3"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m5 12 5 5L20 7" />
                        </svg>
                        Completado
                      </span>
                    )}
                  </div>
                  {/* Cliente badge bottom */}
                  <div className="absolute bottom-5 left-5 right-5">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-gold-400 font-semibold">
                      {p.cliente}
                    </p>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col p-6 lg:p-7">
                  <h2
                    className="text-[#111111] mb-3 group-hover:text-gold-600 transition-colors leading-tight tracking-[-0.005em]"
                    style={{
                      fontSize: "clamp(1.125rem, 1.5vw, 1.375rem)",
                      fontWeight: 500,
                    }}
                  >
                    {p.titulo}
                  </h2>
                  <p className="text-sm text-[#787774] mb-4 flex items-center gap-1.5">
                    <svg
                      className="w-3.5 h-3.5 text-gold-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {p.ubicacion}
                  </p>
                  <p className="text-sm text-[#5A5A57] leading-relaxed mb-5 line-clamp-3 flex-1">
                    {p.descripcionCorta}
                  </p>

                  <div className="mt-auto pt-5 border-t border-[#EAEAEA] flex items-center justify-between gap-3">
                    <div>
                      {p.montoUF !== undefined ? (
                        <>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[#787774] font-semibold mb-1">
                            Monto
                          </p>
                          <p
                            className="font-[var(--font-serif)] italic text-[#111111] tabular-nums leading-none"
                            style={{
                              fontSize: "1.25rem",
                              fontWeight: 500,
                              letterSpacing: "-0.005em",
                            }}
                          >
                            UF {p.montoUF.toLocaleString("es-CL")}
                          </p>
                        </>
                      ) : (
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[#787774] font-semibold">
                          Caso documentado
                        </p>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-600 group-hover:text-gold-700 transition-colors">
                      Ver caso
                      <svg
                        className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14M13 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIOS ===== */}
      <TestimoniosGrid
        testimonios={testimonios}
        variant="light"
        title="Lo que dicen quienes confiaron"
        subtitle="Empresas agroindustriales y constructoras que llevan años trabajando con JURMAQ."
        eyebrow="Testimonios"
      />

      {/* ===== CTA ===== */}
      <section className="py-20 lg:py-28 bg-navy-950 text-white border-t border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-[0.22em] mb-6">
            Cotización en 2 horas
          </p>
          <h2
            className="text-white leading-[1.1] mb-6"
            style={{
              fontSize: "clamp(1.875rem, 3.5vw, 3rem)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            ¿Tu obra es la{" "}
            <span
              className="font-[var(--font-serif)] italic"
              style={{ fontWeight: 400 }}
            >
              próxima
            </span>
            ?
          </h2>
          <p className="text-base lg:text-lg text-white/75 mb-10 max-w-2xl mx-auto leading-relaxed">
            Construimos, arrendamos y abastecemos en una sola marca. Cotiza el
            proyecto completo y coordina con un solo proveedor.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/cotizar-obra"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#111111] text-sm font-medium tracking-[0.02em] rounded-lg hover:bg-white/90 transition-colors"
            >
              Cotizar mi obra
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="https://jurmaq.cl/maquinarias"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/25 text-white text-sm font-medium tracking-[0.02em] rounded-lg hover:bg-white/10 transition-colors"
            >
              Ver flota de máquinas
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
