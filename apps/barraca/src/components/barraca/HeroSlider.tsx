"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "@/components/barraca/Enlace";
import Image from "next/image";
import { formatCLP } from "@jurmaq/shared/format";

/**
 * Banner de portada, al modo de un retail: una OFERTA por slide, con el
 * precio real como protagonista y un botón rojo.
 *
 * Lo que había era una portada de revista: la dirección del local como
 * titular ("Avda. Poniente 2157 / Molina"), en serif itálica, sobre una foto
 * oscurecida al 90%. Se veía cuidado y no vendía nada — y el dueño lo dijo con
 * todas sus letras: quiere la esencia de Sodimac, Easy y Prodalam. En esos
 * tres, el banner mide ~480px, tiene una promoción con precio, y el resto de
 * la pantalla ya son productos.
 *
 * Los precios NO están escritos acá: llegan del servidor (el mínimo real de
 * cada familia) para que el banner nunca prometa un precio que la base ya no
 * tiene.
 */

export interface PreciosHero {
  fierro?: number | null;
  tubo?: number | null;
  zinc?: number | null;
}

const SLIDES_FIJAS = {
  ferreteria: {
    eyebrow: "Ferretería",
    title: "Todo para la obra en un solo lugar",
    sub: "Fijaciones, herramientas, pinturas, electricidad y más, con precio y stock a la vista.",
    cta: { label: "Ver categorías", href: "/categorias" },
    image: "/images/barraca/hero/local-ferreteria.webp",
    alt: "Mesón y estanterías de ferretería de la Barraca JURMAQ en Molina",
  },
  despacho: {
    eyebrow: "Despacho",
    title: "Despacho a domicilio",
    sub: "Te llamamos para coordinar el día según tu comuna.",
    cta: { label: "Ver productos", href: "/categorias" },
    image: "/images/barraca/hero/local-despacho.webp",
    alt: "Camión de despacho de la Barraca JURMAQ en el galpón",
  },
  fachada: {
    eyebrow: "Barraca de Fierros JURMAQ · Molina",
    title: "Fierro, perfiles y materiales, ahora en línea",
    sub: "Compra desde el celular y retira en el local o te lo llevamos.",
    cta: { label: "Ver productos", href: "/categorias" },
    image: "/images/barraca/hero/local-fachada.webp",
    alt: "Fachada de la Barraca de Fierros JURMAQ en Molina",
  },
};

/**
 * Carrusel de portada con fotos reales del local (oct-2026: el dueño lo
 * encontró pobre con dos láminas). Es un riel con scroll-snap: en celular se
 * desliza con el dedo como en las apps de las tiendas grandes, y avanza solo
 * cada 6 s mientras nadie lo toca. Los puntos siguen al scroll.
 */
export default function HeroSlider({ precios = {} }: { precios?: PreciosHero }) {
  const slides = useMemo(
    () => [
      // Primero el local: el dueño prefiere que la portada abra con la barraca
      // y no con una lámina de producto (oct-2026).
      { ...SLIDES_FIJAS.fachada, precio: null, precioNota: "" },
      {
        eyebrow: "Perfiles y planchas",
        title: "Tubos, ángulos, canales y planchas",
        sub: "Todas las medidas en stock en nuestra bodega de Molina.",
        precio: precios.tubo ?? null,
        precioNota: "el tubo de 6 metros",
        cta: { label: "Ver perfiles", href: "/categorias/perfiles-y-planchas" },
        image: "/images/barraca/hero/local-bodega.webp",
        alt: "Bodega de planchas y tubos de la Barraca JURMAQ",
      },
      { ...SLIDES_FIJAS.ferreteria, precio: null, precioNota: "" },
      { ...SLIDES_FIJAS.despacho, precio: null, precioNota: "" },
    ],
    [precios.tubo],
  );

  const riel = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [pausado, setPausado] = useState(false);

  // El punto activo sale de la posición real del riel (dedo, flechas o autoavance).
  useEffect(() => {
    const el = riel.current;
    if (!el) return;
    const alMover = () => setCurrent(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", alMover, { passive: true });
    return () => el.removeEventListener("scroll", alMover);
  }, []);

  const ir = useCallback((i: number) => {
    const el = riel.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (pausado || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => ir((current + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [pausado, current, ir, slides.length]);

  return (
    <section
      className="relative bg-navy-950"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onTouchStart={() => setPausado(true)}
      aria-label="Destacados de la barraca"
      aria-roledescription="carrusel"
    >
      <div ref={riel} className="riel flex overflow-x-auto snap-x snap-mandatory h-[300px] sm:h-[360px] lg:h-[440px]">
        {slides.map((s, i) => (
          <div
            key={s.image}
            className="relative shrink-0 w-full h-full snap-start"
            role="group"
            aria-roledescription="lámina"
            aria-label={`${i + 1} de ${slides.length}`}
          >
            <Image
              src={s.image}
              alt={s.alt}
              fill
              priority={i === 0}
              loading={i === 0 ? undefined : "lazy"}
              sizes="100vw"
              className="object-cover object-center"
            />
            {/* Oscurece sólo donde va el texto: abajo en celular, a la izquierda en escritorio. */}
            <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/75 via-45% to-navy-950/10 lg:bg-gradient-to-r lg:from-navy-950/95 lg:via-navy-950/65 lg:to-navy-950/0" />
            <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-end lg:items-center pb-10 lg:pb-0">
              <div className="max-w-xl text-white">
                <p className="text-xs font-semibold text-white/75 mb-1.5">{s.eyebrow}</p>
                <h2 className="text-[26px] sm:text-[32px] lg:text-[42px] font-extrabold leading-[1.08] tracking-tight">
                  {s.title}
                </h2>
                <p className="hidden sm:block text-[15px] text-white/80 leading-relaxed mt-2 max-w-md">{s.sub}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Link
                    href={s.cta.href}
                    className="inline-flex items-center gap-2 h-11 px-5 bg-marca-600 hover:bg-marca-700 text-white text-[15px] font-semibold rounded-xl transition-colors duration-150"
                  >
                    {s.cta.label}
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </Link>
                  {s.precio ? (
                    <p className="flex items-baseline gap-1.5 tabular-nums">
                      <span className="text-sm text-white/75">desde</span>
                      <span className="text-2xl lg:text-3xl font-extrabold">{formatCLP(s.precio)}</span>
                      <span className="text-xs text-white/70">{s.precioNota}</span>
                    </p>
                  ) : (
                    <span className="sm:hidden text-sm text-white/80">{s.sub}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1" role="tablist" aria-label="Láminas">
        {slides.map((sl, i) => (
          <button
            key={i}
            type="button"
            onClick={() => ir(i)}
            role="tab"
            aria-selected={i === current}
            aria-label={`${sl.title} (${i + 1} de ${slides.length})`}
            className="w-8 h-8 flex items-center justify-center"
          >
            <span className={`block h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out ${i === current ? "w-6 bg-white" : "w-1.5 bg-white/55"}`} />
          </button>
        ))}
      </div>
    </section>
  );
}
