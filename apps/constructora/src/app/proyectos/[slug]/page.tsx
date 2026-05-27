import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  PROYECTOS,
  getProyectoBySlug,
  getProyectoUrl,
  PROVEEDOR_JSONLD,
} from "@/lib/proyectos-data";
import { LEGAL_INFO } from "@jurmaq/shared/seo";

/**
 * Detail page de un case study de obra.
 *
 * Renderiza una página por slug declarado en `PROYECTOS`. `generateStaticParams`
 * pre-genera todas las páginas en build time — útil para SEO y para que el
 * sitemap conozca las URLs sin requerir DB.
 *
 * JSON-LD: `Article` + `BreadcrumbList` + opcionalmente `Review` embebido si
 * el proyecto tiene `testimonio`.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return PROYECTOS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const proyecto = getProyectoBySlug(slug);
  if (!proyecto) {
    return { title: "Proyecto no encontrado · JURMAQ" };
  }
  return {
    title: `${proyecto.titulo} · Caso de obra JURMAQ`,
    description: proyecto.descripcionCorta,
    alternates: { canonical: getProyectoUrl(slug) },
    openGraph: {
      title: `${proyecto.titulo} · JURMAQ`,
      description: proyecto.descripcionCorta,
      url: getProyectoUrl(slug),
      type: "article",
      ...(proyecto.imagenHero
        ? {
            images: [
              {
                url: proyecto.imagenHero,
                width: 1200,
                height: 630,
                alt: `${proyecto.titulo} — JURMAQ`,
              },
            ],
          }
        : {}),
    },
  };
}

export default async function ProyectoCaseStudyPage({ params }: PageProps) {
  const { slug } = await params;
  const proyecto = getProyectoBySlug(slug);
  if (!proyecto) notFound();

  const url = getProyectoUrl(slug);

  // JSON-LD: Article + BreadcrumbList (+ Review si hay testimonio).
  const jsonLdGraph: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `${url}#article`,
      headline: proyecto.titulo,
      description: proyecto.descripcionCorta,
      datePublished: proyecto.fechaPublicacion,
      author: PROVEEDOR_JSONLD,
      publisher: PROVEEDOR_JSONLD,
      url,
      ...(proyecto.imagenHero
        ? { image: `https://jurmaq.cl${proyecto.imagenHero}` }
        : {}),
      about: {
        "@type": "Organization",
        name: proyecto.cliente,
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
    },
    {
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
          name: "Proyectos",
          item: "https://jurmaq.cl/proyectos",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: proyecto.titulo,
          item: url,
        },
      ],
    },
  ];

  if (proyecto.testimonio) {
    jsonLdGraph.push({
      "@context": "https://schema.org",
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: proyecto.testimonio.rating,
        bestRating: 5,
      },
      author: {
        "@type": "Organization",
        name: proyecto.cliente,
      },
      reviewBody: proyecto.testimonio.texto,
      datePublished: proyecto.fechaPublicacion,
      itemReviewed: PROVEEDOR_JSONLD,
    });
  }

  // Otros proyectos para sección "ver más".
  const otrosProyectos = PROYECTOS.filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
      />

      {/* ===== HERO ===== */}
      <section className="bg-navy-950 pt-12 pb-16 lg:pt-16 lg:pb-24 border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav
            aria-label="Migas de pan"
            className="flex items-center gap-2 text-sm text-white/55 mb-8 flex-wrap"
          >
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
            <Link
              href="/proyectos"
              className="hover:text-gold-400 transition-colors"
            >
              Proyectos
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
            <span className="text-white/85 font-medium truncate max-w-xs">
              {proyecto.titulo}
            </span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
            {/* Left: Title + meta */}
            <div className="lg:col-span-7">
              {/* Cliente bloque */}
              <div className="flex items-center gap-4 mb-8">
                {proyecto.clienteLogo && (
                  <div className="h-12 w-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    <Image
                      src={proyecto.clienteLogo}
                      alt={`Logo ${proyecto.cliente}`}
                      width={48}
                      height={48}
                      className="max-h-8 max-w-8 object-contain grayscale opacity-90"
                    />
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-[0.22em]">
                    Cliente
                  </p>
                  <p className="text-base font-semibold text-white mt-0.5">
                    {proyecto.cliente}
                  </p>
                </div>
              </div>

              <h1
                className="text-white leading-[1.05] mb-6"
                style={{
                  fontSize: "clamp(2.25rem, 5vw, 4rem)",
                  fontWeight: 500,
                  letterSpacing: "-0.015em",
                }}
              >
                {proyecto.titulo.includes("·") ? (
                  <>
                    {proyecto.titulo.split("·")[0]}
                    <span
                      className="font-[var(--font-serif)] italic text-gold-400"
                      style={{ fontWeight: 400 }}
                    >
                      ·{proyecto.titulo.split("·")[1]}
                    </span>
                  </>
                ) : (
                  proyecto.titulo
                )}
              </h1>

              <p className="flex items-center gap-2 text-base text-white/75 mb-6">
                <svg
                  className="w-4 h-4 text-gold-400"
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
                {proyecto.ubicacion}
              </p>

              <p className="text-base lg:text-lg text-white/85 leading-relaxed max-w-[58ch] mb-8">
                {proyecto.descripcionCorta}
              </p>

              {/* Servicios chips */}
              <div className="flex flex-wrap gap-2 mb-2">
                {proyecto.servicios.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white/85 bg-white/5 border border-white/10 rounded-full"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Stats panel */}
            <aside className="lg:col-span-5">
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-7 lg:p-8 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-[0.22em]">
                    Resumen de obra
                  </p>
                  {proyecto.estado === "en_curso" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[10px] font-bold uppercase tracking-wider rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                      En curso
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/15 border border-green-500/30 text-green-300 text-[10px] font-bold uppercase tracking-wider rounded-full">
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

                <dl className="grid grid-cols-2 gap-6">
                  {proyecto.montoUF !== undefined && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.22em] text-white/55 font-semibold mb-2">
                        Monto
                      </dt>
                      <dd
                        className="font-[var(--font-serif)] italic text-gold-400 tabular-nums leading-none"
                        style={{
                          fontSize: "clamp(1.5rem, 2vw, 2rem)",
                          fontWeight: 500,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        UF {proyecto.montoUF.toLocaleString("es-CL")}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.22em] text-white/55 font-semibold mb-2">
                      Duración
                    </dt>
                    <dd
                      className="font-[var(--font-serif)] italic text-white tabular-nums leading-none"
                      style={{
                        fontSize: "clamp(1.25rem, 1.5vw, 1.625rem)",
                        fontWeight: 500,
                        letterSpacing: "-0.005em",
                      }}
                    >
                      {proyecto.duracion}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.22em] text-white/55 font-semibold mb-2">
                      Año de inicio
                    </dt>
                    <dd
                      className="font-[var(--font-serif)] italic text-white tabular-nums leading-none"
                      style={{
                        fontSize: "clamp(1.25rem, 1.5vw, 1.625rem)",
                        fontWeight: 500,
                      }}
                    >
                      {proyecto.anoInicio}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.22em] text-white/55 font-semibold mb-2">
                      Servicios
                    </dt>
                    <dd
                      className="font-[var(--font-serif)] italic text-white tabular-nums leading-none"
                      style={{
                        fontSize: "clamp(1.25rem, 1.5vw, 1.625rem)",
                        fontWeight: 500,
                      }}
                    >
                      {proyecto.servicios.length}
                    </dd>
                  </div>
                </dl>

                <div className="mt-7 pt-6 border-t border-white/10">
                  <Link
                    href="/contacto?servicio=constructora"
                    className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-gold-500 hover:bg-gold-400 text-navy-950 font-semibold text-sm rounded-lg transition-colors"
                  >
                    Cotizar una obra similar
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ===== HERO IMAGE (placeholder hasta tener foto real) ===== */}
      <section className="bg-[#FBFBFA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 lg:-mt-16 relative z-10">
          <div className="relative aspect-[16/9] lg:aspect-[21/9] rounded-2xl overflow-hidden bg-gradient-to-br from-navy-900 to-navy-950 shadow-2xl shadow-black/10">
            {proyecto.imagenHero ? (
              <Image
                src={proyecto.imagenHero}
                alt={`${proyecto.titulo} — Obra JURMAQ`}
                fill
                sizes="(max-width: 1024px) 100vw, 1280px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="absolute inset-0 opacity-15"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.15) 25%, transparent 25%)",
                    backgroundSize: "40px 40px",
                  }}
                />
                <div className="relative text-center">
                  <p className="text-gold-500/40 text-xs font-semibold uppercase tracking-[0.22em] mb-3">
                    Foto de obra
                  </p>
                  <p
                    className="font-[var(--font-serif)] italic text-white/20"
                    style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 400 }}
                  >
                    {proyecto.cliente}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== DESCRIPCION LARGA + DESAFIOS + RESULTADOS ===== */}
      <section className="py-20 lg:py-28 bg-[#FBFBFA]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-12 lg:space-y-16">
            {/* Descripción larga */}
            <div>
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">
                Sobre esta obra
              </p>
              <h2
                className="text-[#111111] leading-[1.15] mb-6"
                style={{
                  fontSize: "clamp(1.5rem, 2.5vw, 2.25rem)",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                Lo que{" "}
                <span
                  className="font-[var(--font-serif)] italic"
                  style={{ fontWeight: 400 }}
                >
                  ejecutamos
                </span>
                .
              </h2>
              <div className="prose prose-lg max-w-none">
                {proyecto.descripcionLarga.split("\n\n").map((parrafo, i) => (
                  <p
                    key={i}
                    className="text-base lg:text-lg text-[#333333] leading-relaxed mb-5 max-w-[68ch]"
                  >
                    {parrafo}
                  </p>
                ))}
              </div>
            </div>

            {/* Desafíos técnicos */}
            <div>
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">
                Desafíos técnicos
              </p>
              <h2
                className="text-[#111111] leading-[1.15] mb-8"
                style={{
                  fontSize: "clamp(1.5rem, 2.5vw, 2.25rem)",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                Cómo lo{" "}
                <span
                  className="font-[var(--font-serif)] italic"
                  style={{ fontWeight: 400 }}
                >
                  resolvimos
                </span>
                .
              </h2>
              <ol className="space-y-5">
                {proyecto.desafiosTecnicos.map((d, i) => (
                  <li key={i} className="flex gap-5">
                    <span
                      className="shrink-0 font-[var(--font-serif)] italic text-gold-500 tabular-nums leading-none mt-0.5"
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 500,
                      }}
                    >
                      0{i + 1}
                    </span>
                    <p className="text-base text-[#333333] leading-relaxed">
                      {d}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Resultados */}
            <div>
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">
                Resultados
              </p>
              <h2
                className="text-[#111111] leading-[1.15] mb-8"
                style={{
                  fontSize: "clamp(1.5rem, 2.5vw, 2.25rem)",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                Lo que{" "}
                <span
                  className="font-[var(--font-serif)] italic"
                  style={{ fontWeight: 400 }}
                >
                  entregamos
                </span>
                .
              </h2>
              <ul className="space-y-4">
                {proyecto.resultados.map((r, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-gold-500 shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <p className="text-base text-[#333333] leading-relaxed">
                      {r}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MAQUINARIA UTILIZADA (con links a /arriendo) ===== */}
      <section className="py-20 lg:py-24 bg-white border-y border-[#EAEAEA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            <div>
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">
                Maquinaria utilizada
              </p>
              <h2
                className="text-[#111111] leading-[1.15] mb-6"
                style={{
                  fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                Flota{" "}
                <span
                  className="font-[var(--font-serif)] italic"
                  style={{ fontWeight: 400 }}
                >
                  propia
                </span>{" "}
                en obra.
              </h2>
              <p className="text-base text-[#5A5A57] leading-relaxed mb-8 max-w-[55ch]">
                Cada máquina utilizada en esta obra está disponible para arriendo.
                Si tu obra requiere equipos similares, cotiza directo.
              </p>
              <ul className="space-y-3">
                {proyecto.maquinariaUsada.map((m, i) => {
                  const inner = (
                    <span className="flex items-center justify-between gap-4 px-4 py-3 bg-[#FBFBFA] border border-[#EAEAEA] rounded-xl hover:border-gold-500/40 transition-colors group">
                      <span className="flex items-center gap-3 text-base text-[#111111]">
                        <span className="text-gold-500" aria-hidden="true">
                          ›
                        </span>
                        {m.nombre}
                      </span>
                      {m.tipoSlug && (
                        <span className="text-xs text-gold-600 font-semibold group-hover:text-gold-700 flex items-center gap-1">
                          Ver
                          <svg
                            className="w-3 h-3"
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
                      )}
                    </span>
                  );
                  return (
                    <li key={i}>
                      {m.tipoSlug ? (
                        <Link href={`/arriendo/${m.tipoSlug}`}>{inner}</Link>
                      ) : (
                        inner
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">
                Materiales principales
              </p>
              <h2
                className="text-[#111111] leading-[1.15] mb-6"
                style={{
                  fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                Acero y{" "}
                <span
                  className="font-[var(--font-serif)] italic"
                  style={{ fontWeight: 400 }}
                >
                  materiales
                </span>{" "}
                aplicados.
              </h2>
              <p className="text-base text-[#5A5A57] leading-relaxed mb-8 max-w-[55ch]">
                Materiales principales suministrados desde nuestra barraca o
                adquiridos por el equipo de obra.
              </p>
              <ul className="space-y-3">
                {proyecto.materialesPrincipales.map((mat, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 bg-[#FBFBFA] border border-[#EAEAEA] rounded-xl"
                  >
                    <span className="text-gold-500" aria-hidden="true">
                      ›
                    </span>
                    <span className="text-base text-[#111111]">{mat}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="https://barraca.jurmaq.cl"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-600 hover:text-gold-700 transition-colors"
              >
                Ver catálogo completo en JURMAQ Barraca
                <svg
                  className="w-3.5 h-3.5"
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
            </div>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIO EMBEDDED (si existe) ===== */}
      {proyecto.testimonio && (
        <section className="py-20 lg:py-28 bg-navy-950">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-[0.22em] mb-6 text-center">
              Testimonio del cliente
            </p>
            <blockquote
              className="text-white text-center leading-relaxed mb-8 max-w-3xl mx-auto"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(1.25rem, 2.5vw, 1.875rem)",
                fontStyle: "italic",
                fontWeight: 400,
                letterSpacing: "-0.005em",
              }}
            >
              &ldquo;{proyecto.testimonio.texto}&rdquo;
            </blockquote>
            <footer className="text-center">
              <p className="text-base font-semibold text-white">
                {proyecto.testimonio.autor}
              </p>
              <p className="text-sm text-white/55 mt-1">
                {proyecto.testimonio.cargo} · {proyecto.cliente}
              </p>
            </footer>
          </div>
        </section>
      )}

      {/* ===== GALERÍA ===== */}
      {proyecto.galeria && proyecto.galeria.length > 0 && (
        <section className="py-20 lg:py-28 bg-[#FBFBFA]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">
              Galería
            </p>
            <h2
              className="text-[#111111] leading-[1.15] mb-10"
              style={{
                fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              Avance{" "}
              <span
                className="font-[var(--font-serif)] italic"
                style={{ fontWeight: 400 }}
              >
                de obra
              </span>
              .
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {proyecto.galeria.map((img, i) => (
                <div
                  key={i}
                  className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gradient-to-br from-navy-900 to-navy-950"
                >
                  <Image
                    src={img}
                    alt={`${proyecto.titulo} — etapa ${i + 1}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== OTROS PROYECTOS ===== */}
      {otrosProyectos.length > 0 && (
        <section className="py-20 lg:py-24 bg-white border-y border-[#EAEAEA]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
              <div>
                <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
                  Más casos de obra
                </p>
                <h2
                  className="text-[#111111] leading-[1.15]"
                  style={{
                    fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Otros{" "}
                  <span
                    className="font-[var(--font-serif)] italic"
                    style={{ fontWeight: 400 }}
                  >
                    proyectos
                  </span>
                  .
                </h2>
              </div>
              <Link
                href="/proyectos"
                className="inline-flex items-center gap-2 text-sm font-semibold text-navy-950 hover:text-gold-600 transition-colors"
              >
                Ver todos
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
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {otrosProyectos.map((p) => (
                <Link
                  key={p.slug}
                  href={`/proyectos/${p.slug}`}
                  className="group block bg-[#FBFBFA] border border-[#EAEAEA] rounded-2xl overflow-hidden hover:border-gold-500/40 hover:shadow-lg transition-all"
                >
                  <div className="aspect-[4/3] bg-gradient-to-br from-navy-900 to-navy-950 relative overflow-hidden">
                    {p.imagenHero ? (
                      <Image
                        src={p.imagenHero}
                        alt={p.titulo}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p
                          className="font-[var(--font-serif)] italic text-white/20"
                          style={{ fontSize: "2rem", fontWeight: 400 }}
                        >
                          {p.cliente}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="text-[10px] font-semibold text-gold-600 uppercase tracking-[0.18em] mb-2">
                      {p.cliente}
                    </p>
                    <h3 className="text-base font-semibold text-[#111111] leading-snug group-hover:text-gold-600 transition-colors line-clamp-2">
                      {p.titulo}
                    </h3>
                    {p.montoUF !== undefined && (
                      <p
                        className="font-[var(--font-serif)] italic text-[#111111] tabular-nums mt-3"
                        style={{ fontSize: "1.125rem", fontWeight: 500 }}
                      >
                        UF {p.montoUF.toLocaleString("es-CL")}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== CTA ===== */}
      <section className="py-20 lg:py-28 bg-navy-950 border-t border-navy-800">
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
            ¿Tu obra necesita un{" "}
            <span
              className="font-[var(--font-serif)] italic"
              style={{ fontWeight: 400 }}
            >
              partner
            </span>{" "}
            como este?
          </h2>
          <p className="text-base lg:text-lg text-white/75 mb-10 max-w-2xl mx-auto leading-relaxed">
            Construimos para Nestlé, Miguel Torres, Iansagro, Surfrut y CBB.
            Cotiza tu obra con {LEGAL_INFO.nombreComercial}.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contacto?servicio=constructora"
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
            <a
              href={LEGAL_INFO.brands.constructora.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/25 text-white text-sm font-medium tracking-[0.02em] rounded-lg hover:bg-white/10 transition-colors"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
