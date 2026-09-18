"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { whatsappCtaBarracaCotizar } from "@jurmaq/shared/whatsapp";
import SearchBar from "@/components/barraca/SearchBar";

/**
 * HeroSlider — Editorial Luxury retrofit.
 *
 * Cambios skill-driven (impeccable, design-taste-frontend, web-typography,
 * minimalist-ui, high-end-visual-design):
 * - Sin em dash en headlines ("—" baneado por impeccable).
 * - Newsreader italic en los accent words (no más texto naranja chillón).
 * - font-extrabold (gritón) → font-semibold con tracking ajustado.
 * - Eyebrow uppercase 0.18em por slide (categoría editorial).
 * - Background gradient más sutil (less orange spillover).
 * - SearchBar mantiene su contraste; CTA primario navy con borde claro,
 *   secundario outline.
 */
const slides = [
  {
    // La fachada real de Avda. Poniente 2157. Es lo único de esta página que
    // ningún competidor puede copiar, y estaba tapada al 95% por un degradado
    // navy parejo (from-navy-950/95 via-/75 to-/55).
    //
    // El scrim nuevo es DIRECCIONAL: sólido a la izquierda, donde va el texto,
    // y casi transparente a la derecha, que es justo donde está el letrero
    // "JURMAQ · BARRACA DE FIERROS" en la foto. Así el titular se lee y el
    // local se ve. Un scrim parejo obliga a elegir entre las dos cosas.
    eyebrow: "BARRACA DE FIERROS · MOLINA",
    title: "Avda. Poniente 2157",
    titleAccent: "Molina",
    subtitle:
      "Fierro, perfiles, planchas y herramientas con precio en pantalla. Retiro en el local o despacho propio a toda la Región del Maule.",
    cta: { label: "Ver catálogo", href: "/categorias" },
    showSearch: true,
    bg: "from-navy-950 from-15% via-navy-950/80 via-55% to-navy-950/15",
    image: "/images/barraca/hero/hero-fachada.webp",
  },
  {
    eyebrow: "FIERROS DE CONSTRUCCIÓN",
    title: "Barras de acero",
    titleAccent: "para tu obra",
    subtitle: "Estriados, lisos y trefilados. Todos los diámetros, despacho desde 1 barra.",
    cta: { label: "Ver fierros", href: "/categorias/fierros-construccion" },
    showSearch: false,
    bg: "from-navy-950 from-15% via-navy-950/80 via-55% to-navy-950/15",
    image: "/images/barraca/hero/hero-fierros.webp",
  },
  {
    // Antes: "Precios especiales en productos seleccionados · Stock limitado,
    // despacho mismo día. Revisá antes que se acaben" sobre una foto de
    // terciado, en una barraca de FIERROS. Tres muletillas de urgencia
    // encadenadas, cero datos, y un voseo que no es de acá.
    // Ahora: perfiles y ángulos, que es lo que efectivamente se vende, con la
    // foto real del galpón.
    eyebrow: "PERFILES Y ESTRUCTURA",
    title: "Perfiles, tubos",
    titleAccent: "y ángulos",
    subtitle: "Cortados a medida en el local. Consulta por largos y espesores disponibles.",
    cta: { label: "Ver perfiles", href: "/categorias" },
    showSearch: false,
    bg: "from-navy-950 from-15% via-navy-950/80 via-55% to-navy-950/15",
    image: "/images/barraca/hero/barraca-galpon.jpg",
  },
];

export default function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % slides.length);
  }, []);

  useEffect(() => {
    if (isPaused || prefersReducedMotion) return;
    const timer = setInterval(next, 5500);
    return () => clearInterval(timer);
  }, [isPaused, prefersReducedMotion, next]);

  const slide = slides[current];

  return (
    <section
      className="relative bg-navy-950 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Categorías destacadas"
      aria-roledescription="carrusel"
    >
      {/* Foto del slide.
          `transition-[background-image]` NO existe: background-image no es una
          propiedad animable, así que la foto cambiaba de golpe. El scrim, en
          cambio, sí tenía `transition-colors duration-1000`. Resultado: durante
          un segundo entero en cada cambio de slide el titular quedaba sobre la
          foto nueva con el degradado todavía en transición, y se volvía
          ilegible. Ambas transiciones fuera: el cruce es instantáneo y el texto
          se lee siempre. */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${slide.image})` }}
        aria-hidden="true"
      />
      {/* Scrim direccional: sólido donde va el texto, casi transparente a la
          derecha, que es donde está el letrero del local en la foto.

          En rgba explícito y no con las clases `from-/via-/to-` de Tailwind:
          la v4 interpola los degradados en espacio lab, y al hacerlo hacia un
          color con alfa el resultado sale bastante más claro de lo que sugiere
          el porcentaje. El titular quedaba lavado sobre la parte brillante de
          la foto. Con rgba en sRGB el resultado es el que se calcula. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(8,20,40,0.97) 0%, rgba(8,20,40,0.92) 30%, rgba(8,20,40,0.55) 62%, rgba(8,20,40,0.15) 100%)',
        }}
      />
      {/* hairline divider top — Editorial frame */}
      <div className="absolute inset-x-0 top-0 h-px bg-white/10" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="max-w-2xl hero-slide-enter" key={current}>
          <p className="text-[10px] font-semibold text-white/55 uppercase tracking-[0.22em] mb-6">
            {slide.eyebrow}
          </p>
          <p
            className="text-white mb-6 leading-[1.05]"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 4rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
            role="heading"
            aria-level={2}
          >
            {slide.title}
            <br />
            <span className="font-[var(--font-serif)] italic text-white/95" style={{ fontWeight: 400 }}>
              {slide.titleAccent}
            </span>
          </p>
          <p className="text-base lg:text-lg text-white/75 mb-10 max-w-xl leading-relaxed">
            {slide.subtitle}
          </p>

          {slide.showSearch && (
            <div className="max-w-lg mb-8">
              <SearchBar size="lg" />
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Link
              href={slide.cta.href}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#111111] text-sm font-medium tracking-[0.02em] rounded-lg hover:bg-white/90 transition-colors"
            >
              {slide.cta.label}
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href={whatsappCtaBarracaCotizar('productos', 'hero_slider')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 border border-white/25 text-white text-sm font-medium tracking-[0.02em] rounded-lg hover:bg-white/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Cotizar por WhatsApp
            </a>
          </div>
        </div>

        {/* Dots */}
        <div className="flex items-center gap-1 mt-14" role="tablist" aria-label="Diapositivas">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="flex items-center justify-center w-11 h-11"
              role="tab"
              aria-selected={i === current}
              aria-label={`${s.title} ${s.titleAccent} (${i + 1} de ${slides.length})`}
            >
              <span className={`block h-px transition-[width,background-color] duration-300 ease-out ${
                i === current ? "w-10 bg-white" : "w-6 bg-white/30 hover:bg-white/50"
              }`} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
