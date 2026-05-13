import Link from "next/link";

/**
 * Compact hero banner for the barraca homepage on mobile.
 * Replaces the desktop HeroSlider on screens < lg.
 *
 * Design:
 *  - Single dark card with cement-bag image on the right (no slider)
 *  - Big value-prop text on left: "+1.900 productos · con precios en línea · cotiza al instante"
 *  - Tap anywhere → /categorias
 *  - Sized so it fills ~30% of the viewport without pushing content below the fold
 */
export default function MobileHero() {
  return (
    <Link
      href="/categorias"
      aria-label="Ver catálogo completo"
      className="lg:hidden block mx-4 mt-3 mb-4 rounded-2xl overflow-hidden bg-navy-950 relative shadow-md active:scale-[0.99] transition-transform"
    >
      <div className="relative grid grid-cols-[1.4fr_1fr] min-h-[160px]">
        {/* Text side */}
        <div className="relative z-10 px-5 py-5 flex flex-col justify-center">
          <p className="text-orange-500 font-extrabold text-lg leading-tight">
            +1.900 PRODUCTOS
          </p>
          <p className="text-white font-extrabold text-2xl leading-tight mt-1">
            CON PRECIOS<br />EN LÍNEA
          </p>
          <p className="text-white/90 font-semibold text-sm mt-2 inline-flex items-center gap-1">
            COTIZA AL INSTANTE
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </p>
        </div>

        {/* Image side: cement bags / construction materials */}
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/barraca/categorias/morteros.webp"
            alt=""
            aria-hidden="true"
            width={400}
            height={300}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Soft dark gradient on the left edge so text stays readable */}
          <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/40 to-transparent" />
        </div>
      </div>
    </Link>
  );
}
