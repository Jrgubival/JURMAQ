import Image from "next/image";
import Link from "next/link";
import type { ConstructoraTestimonio } from "@/lib/testimonios-data";

/**
 * Grid público de testimonios B2B.
 *
 * Renderiza cards Editorial Luxury con quote serif italic, rating gold,
 * autor + empresa, y link opcional al case study referenciado.
 *
 * Inserta JSON-LD `Review` schema individual por testimonio dentro del
 * mismo bloque `<script>` para que Google Rich Results lo capture en la
 * página donde se monte el componente.
 *
 * Uso:
 *   <TestimoniosGrid
 *     testimonios={getTestimoniosDestacados(3)}
 *     variant="light"
 *     title="Empresas que confían"
 *     subtitle="..."
 *   />
 */

interface TestimoniosGridProps {
  testimonios: ConstructoraTestimonio[];
  variant?: "light" | "dark";
  title?: string;
  subtitle?: string;
  /** Texto del eyebrow encima del título. Default: "Testimonios". */
  eyebrow?: string;
  /** Mostrar link "Ver todos los proyectos" al final. */
  ctaLink?: { label: string; href: string };
}

function StarRating({ value, dark }: { value: number; dark: boolean }) {
  const filledColor = dark ? "text-gold-400" : "text-gold-500";
  const emptyColor = dark ? "text-white/15" : "text-[#EAEAEA]";
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`Calificación: ${value} de 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i <= value ? filledColor : emptyColor}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.366 2.446a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.366-2.446a1 1 0 00-1.176 0l-3.366 2.446c-.784.57-1.838-.197-1.539-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.05 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
      ))}
    </div>
  );
}

export default function TestimoniosGrid({
  testimonios,
  variant = "light",
  title = "Lo que dicen quienes confiaron",
  subtitle = "Empresas agroindustriales y constructoras que llevan años trabajando con JURMAQ.",
  eyebrow = "Testimonios",
  ctaLink,
}: TestimoniosGridProps) {
  if (!testimonios.length) return null;

  const dark = variant === "dark";

  // JSON-LD Review array — Google admite múltiples Review schemas en la página
  // sin requerir AggregateRating (eso lo dejamos para cuando la BD esté seedeada).
  const jsonLd = testimonios.map((t) => ({
    "@context": "https://schema.org",
    "@type": "Review",
    reviewRating: {
      "@type": "Rating",
      ratingValue: t.rating,
      bestRating: 5,
    },
    author: {
      "@type": "Organization",
      name: t.autorEmpresa,
    },
    reviewBody: t.texto,
    datePublished: t.fecha,
    itemReviewed: {
      "@type": "Organization",
      name: "JURMAQ Constructora",
      url: "https://jurmaq.cl",
    },
  }));

  const bgClass = dark ? "bg-navy-950" : "bg-[#FBFBFA]";
  const eyebrowClass = dark ? "text-gold-400" : "text-[#787774]";
  const titleClass = dark ? "text-white" : "text-[#111111]";
  const subtitleClass = dark ? "text-white/75" : "text-[#5A5A57]";

  return (
    <section
      className={`py-24 lg:py-32 ${bgClass} content-auto border-y ${dark ? "border-navy-800" : "border-[#EAEAEA]"}`}
      aria-labelledby="testimonios-heading"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-14 lg:mb-20 max-w-3xl">
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.22em] mb-4 ${eyebrowClass}`}
          >
            {eyebrow}
          </p>
          <h2
            id="testimonios-heading"
            className={`leading-[1.1] mb-4 ${titleClass}`}
            style={{
              fontSize: "clamp(1.875rem, 3.5vw, 3rem)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            {title.split(" ").length > 1 ? (
              <>
                {title.split(" ").slice(0, -1).join(" ")}{" "}
                <span
                  className={`font-[var(--font-serif)] italic ${dark ? "text-gold-400" : "text-gold-600"}`}
                  style={{ fontWeight: 400 }}
                >
                  {title.split(" ").slice(-1)[0]}
                </span>
                .
              </>
            ) : (
              title
            )}
          </h2>
          {subtitle && (
            <p
              className={`text-base lg:text-lg max-w-[55ch] leading-relaxed ${subtitleClass}`}
            >
              {subtitle}
            </p>
          )}
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 list-none">
          {testimonios.map((t) => (
            <li key={t.id}>
              <article
                className={
                  dark
                    ? "h-full flex flex-col bg-white/[0.03] border border-white/10 rounded-2xl p-7 lg:p-8 hover:border-gold-500/30 transition-colors"
                    : "h-full flex flex-col bg-white border border-[#EAEAEA] rounded-2xl p-7 lg:p-8 hover:border-gold-500/40 transition-colors"
                }
              >
                {/* Top: rating + decorative quote glyph */}
                <header className="flex items-start justify-between gap-4 mb-5">
                  <StarRating value={t.rating} dark={dark} />
                  <span
                    aria-hidden="true"
                    className={`font-[var(--font-serif)] italic leading-none select-none ${
                      dark ? "text-gold-500/30" : "text-gold-500/40"
                    }`}
                    style={{ fontSize: "2.5rem", fontWeight: 400 }}
                  >
                    &ldquo;
                  </span>
                </header>

                {/* Quote — serif italic for editorial feel */}
                <blockquote
                  className={`flex-1 mb-6 leading-relaxed ${dark ? "text-white/90" : "text-[#333333]"}`}
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "clamp(1rem, 1.1vw, 1.0625rem)",
                    fontStyle: "italic",
                    fontWeight: 400,
                  }}
                >
                  {t.texto}
                </blockquote>

                {/* Author block */}
                <footer
                  className={`pt-5 border-t ${dark ? "border-white/10" : "border-[#EAEAEA]"}`}
                >
                  <div className="flex items-center gap-3">
                    {t.empresaLogo && (
                      <div
                        className={`shrink-0 h-10 w-10 rounded-lg overflow-hidden flex items-center justify-center ${
                          dark
                            ? "bg-white/5 border border-white/10"
                            : "bg-[#FBFBFA] border border-[#EAEAEA]"
                        }`}
                      >
                        <Image
                          src={t.empresaLogo}
                          alt={`Logo ${t.autorEmpresa}`}
                          width={40}
                          height={40}
                          className="max-h-7 max-w-7 object-contain grayscale opacity-80"
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${dark ? "text-white" : "text-[#111111]"}`}
                      >
                        {t.autorNombre}
                      </p>
                      <p
                        className={`text-xs truncate ${dark ? "text-white/55" : "text-[#787774]"}`}
                      >
                        {t.autorCargo} · {t.autorEmpresa}
                      </p>
                    </div>
                  </div>

                  {t.proyectoSlug && (
                    <Link
                      href={`/proyectos/${t.proyectoSlug}`}
                      className={`mt-4 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                        dark
                          ? "text-gold-400 hover:text-gold-300"
                          : "text-gold-600 hover:text-gold-700"
                      }`}
                    >
                      Ver caso de obra
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
                    </Link>
                  )}
                </footer>
              </article>
            </li>
          ))}
        </ul>

        {ctaLink && (
          <div className="mt-12 lg:mt-16 flex justify-center">
            <Link
              href={ctaLink.href}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium tracking-[0.02em] transition-colors ${
                dark
                  ? "bg-white text-[#111111] hover:bg-white/90"
                  : "bg-navy-950 text-white hover:bg-[#111111]"
              }`}
            >
              {ctaLink.label}
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
        )}
      </div>
    </section>
  );
}
