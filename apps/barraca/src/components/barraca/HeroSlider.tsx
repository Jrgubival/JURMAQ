"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
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

export default function HeroSlider({ precios = {} }: { precios?: PreciosHero }) {
  const slides = useMemo(
    () => [
      {
        eyebrow: "Nuestra promesa",
        title: "Te mejoramos el precio en 2 horas",
        sub: "Sube tu cotización de Sodimac, Easy o Construmart y te respondemos con un precio mejor. Sin registro, sin vueltas.",
        precio: null as number | null,
        precioNota: "",
        cta: { label: "Subir mi cotización", href: "/te-mejoramos-el-precio" },
        image: "/images/barraca/hero/hero-fachada.webp",
        alt: "Fachada de Barraca JURMAQ en Molina",
      },
      {
        eyebrow: "Fierro de construcción",
        title: "Fierro estriado A63, la barra de 6 metros",
        sub: "Desde 8 mm hasta 25 mm. Despacho desde una barra a toda la Región del Maule.",
        precio: precios.fierro ?? null,
        precioNota: "la barra de 8 mm",
        cta: { label: "Ver fierros", href: "/categorias/fierros-construccion" },
        image: "/images/barraca/hero/hero-fierros.webp",
        alt: "Barras de fierro estriado apiladas",
      },
      {
        eyebrow: "Perfiles y planchas",
        title: "Tubos, ángulos y canales en todas las medidas",
        sub: "Más de 120 medidas de tubo en stock, cortados a medida en el local.",
        precio: precios.tubo ?? null,
        precioNota: "el tubo de 6 metros",
        cta: { label: "Ver perfiles", href: "/categorias/perfiles-y-planchas" },
        image: "/images/barraca/hero/barraca-galpon.jpg",
        alt: "Galpón de perfiles de acero de la barraca",
      },
    ],
    [precios.fierro, precios.tubo],
  );

  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const next = useCallback(() => setCurrent((c) => (c + 1) % slides.length), [slides.length]);
  useEffect(() => {
    if (isPaused || prefersReducedMotion) return;
    const t = setInterval(next, 6000);
    return () => clearInterval(t);
  }, [isPaused, prefersReducedMotion, next]);

  const s = slides[current];

  return (
    <section
      className="relative bg-navy-950 overflow-hidden h-[440px]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Ofertas destacadas"
      aria-roledescription="carrusel"
    >
      <Image
        key={s.image}
        src={s.image}
        alt={s.alt}
        fill
        priority={current === 0}
        sizes="100vw"
        className="object-cover object-center"
      />
      {/* Scrim: sólido sólo donde va el texto. Nada de oscurecer la foto entera. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(8,20,40,0.92) 0%, rgba(8,20,40,0.85) 38%, rgba(8,20,40,0.35) 62%, rgba(8,20,40,0.05) 100%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
        <div className="max-w-2xl" key={current}>
          <p className="text-[11px] font-bold text-marca-400 uppercase tracking-[0.16em] mb-3">{s.eyebrow}</p>
          <h2 className="text-white text-[34px] lg:text-[40px] font-extrabold leading-[1.08] tracking-tight mb-3">
            {s.title}
          </h2>
          <p className="text-[15px] text-white/80 leading-relaxed mb-5 max-w-lg">{s.sub}</p>

          {s.precio ? (
            <p className="mb-6 flex items-baseline gap-2">
              <span className="text-sm text-white/70">desde</span>
              <span className="text-[38px] lg:text-[44px] font-extrabold text-white leading-none tabular-nums">
                {formatCLP(s.precio)}
              </span>
              <span className="text-sm text-white/70">{s.precioNota}</span>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={s.cta.href}
              className="inline-flex items-center gap-2 h-12 px-6 bg-marca-600 hover:bg-marca-700 text-white text-[15px] font-bold rounded-md transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]"
            >
              {s.cta.label}
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <span className="text-xs text-white/60">Precios con IVA · Retiro en Molina o despacho al Maule</span>
          </div>
        </div>
      </div>

      {/* Indicadores */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2" role="tablist" aria-label="Diapositivas">
        {slides.map((sl, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            role="tab"
            aria-selected={i === current}
            aria-label={`${sl.title} (${i + 1} de ${slides.length})`}
            className="w-11 h-8 flex items-center justify-center"
          >
            <span
              className={`block h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out ${
                i === current ? "w-7 bg-marca-500" : "w-2.5 bg-white/50 hover:bg-white/80"
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
