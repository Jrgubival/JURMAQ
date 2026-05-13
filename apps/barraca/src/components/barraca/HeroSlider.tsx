"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import SearchBar from "@/components/barraca/SearchBar";

const slides = [
  {
    title: "Fierros, herramientas y materiales —",
    titleAccent: "a precio justo",
    subtitle: "Amplio stock con despacho en Curicó y toda la Región del Maule.",
    cta: { label: "Ver catálogo", href: "/categorias" },
    showSearch: true,
    bg: "from-navy-950 via-navy-950/95 to-navy-900/80",
  },
  {
    title: "Fierros de",
    titleAccent: "construcción",
    subtitle: "Barras de acero, fierros estriados, lisos y trefilados. Todos los diámetros.",
    cta: { label: "Ver fierros", href: "/categorias/fierros-construccion" },
    showSearch: false,
    bg: "from-navy-950 via-navy-900/95 to-orange-950/30",
  },
  {
    title: "Ofertas del",
    titleAccent: "mes",
    subtitle: "Precios especiales en productos seleccionados. Stock limitado.",
    cta: { label: "Ver ofertas", href: "/categorias" },
    showSearch: false,
    bg: "from-navy-950 via-navy-950/90 to-orange-900/20",
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
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [isPaused, prefersReducedMotion, next]);

  const slide = slides[current];

  return (
    <section
      className="relative bg-navy-950 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Ofertas destacadas"
      aria-roledescription="carrusel"
    >
      <div className={`absolute inset-0 bg-gradient-to-r ${slide.bg} transition-all duration-700`} />
      <div className="absolute inset-0 opacity-15">
        <div className="w-full h-full bg-[url('/images/barraca-hero.jpg')] bg-cover bg-center" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-28">
        <div className="max-w-2xl hero-slide-enter" key={current}>
          <p className="text-4xl lg:text-6xl font-extrabold text-white mb-4" role="heading" aria-level={2}>
            {slide.title}{" "}
            <span className="text-orange-500">{slide.titleAccent}</span>
          </p>
          <p className="text-lg text-gray-300 mb-8">
            {slide.subtitle}
          </p>

          {slide.showSearch && (
            <div className="max-w-lg mb-6">
              <SearchBar size="lg" />
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Link
              href={slide.cta.href}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors"
            >
              {slide.cta.label}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <a
              href="https://wa.me/56976673577?text=Hola%2C%20necesito%20cotizar%20productos"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-white/20 text-white hover:bg-white/10 font-semibold rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Cotizar por WhatsApp
            </a>
          </div>
        </div>

        {/* Dots */}
        <div className="flex items-center gap-1 mt-10" role="tablist" aria-label="Diapositivas">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="flex items-center justify-center w-11 h-11"
              role="tab"
              aria-selected={i === current}
              aria-label={`${s.title} ${s.titleAccent} (${i + 1} de ${slides.length})`}
            >
              <span className={`block h-2 rounded-full transition-all duration-300 ${
                i === current ? "w-8 bg-orange-500" : "w-2 bg-white/30 hover:bg-white/50"
              }`} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
