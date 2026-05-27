import Link from "next/link";

/**
 * MobileHero — Editorial Luxury retrofit.
 *
 * Replaces el HeroSlider en mobile (< lg). Card dark con imagen a la derecha.
 *
 * Cambios skill-driven (impeccable, design-taste-frontend, web-typography):
 * - Sin "+1.900 PRODUCTOS" hero-metric template (impeccable ban).
 * - Sin font-extrabold shouted (uppercase + heavy weight = ruido visual).
 * - Eyebrow tracking 0.22em + serif italic accent (consistente con desktop).
 * - Hairline divider y CTA arrow refinada (stroke 1.5).
 */
export default function MobileHero() {
  return (
    <Link
      href="/categorias"
      aria-label="Ver catálogo completo"
      className="lg:hidden block mx-4 mt-3 mb-4 rounded-2xl overflow-hidden bg-navy-950 relative active:scale-[0.99] transition-transform"
    >
      <div className="relative grid grid-cols-[1.5fr_1fr] min-h-[160px]">
        {/* Text side */}
        <div className="relative z-10 px-5 py-5 flex flex-col justify-center">
          <p className="text-[10px] font-semibold text-white/55 uppercase tracking-[0.22em] mb-2">
            Barraca · Maule
          </p>
          <h1
            className="text-white leading-[1.1]"
            style={{ fontSize: 'clamp(1.5rem, 6vw, 1.875rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            Fierros y materiales
            <br />
            <span className="font-[var(--font-serif)] italic text-white/90" style={{ fontWeight: 400 }}>
              a precio justo
            </span>
          </h1>
          <p className="text-xs text-white/65 mt-3 inline-flex items-center gap-1.5">
            Ver catálogo
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </p>
        </div>

        {/* Image side: cement bags / construction materials */}
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/barraca/categorias/morteros.webp"
            alt="Cementos, morteros y materiales de construcción en Barraca JURMAQ Molina"
            width={400}
            height={300}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Soft dark gradient on the left edge so text stays readable */}
          <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/55 to-transparent" />
        </div>
      </div>
    </Link>
  );
}
