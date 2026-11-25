"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "@/components/barraca/Enlace";
import { formatCLP } from "@jurmaq/shared/format";
import type { SlideConfig } from "@/lib/contenido/tipos";

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
 * Las láminas (textos, fotos de escritorio y celular, botón, vigencia) vienen
 * del contenido editable (D1); el respaldo en código es
 * lib/contenido/respaldo.ts (las mismas cuatro láminas de siempre). El servidor
 * ya filtra por activa y vigencia antes de pasarlas.
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

/**
 * Carrusel de portada con fotos reales del local (oct-2026: el dueño lo
 * encontró pobre con dos láminas). Es un riel con scroll-snap: en celular se
 * desliza con el dedo como en las apps de las tiendas grandes, y avanza solo
 * cada 6 s mientras nadie lo toca. Los puntos siguen al scroll.
 */
/** Versiones de 640 y 960 px junto a la de 1600 (public/images/barraca/hero/<nombre>-640.webp). */
const CON_VARIANTES = new Set(["local-fachada", "local-bodega", "local-ferreteria", "local-despacho"]);
function srcSetHero(src: string): string | undefined {
  const m = src.match(/^(.*\/)([a-z-]+)\.webp$/);
  if (!m || !CON_VARIANTES.has(m[2])) return undefined;
  return `${m[1]}${m[2]}-640.webp 640w, ${m[1]}${m[2]}-960.webp 960w, ${src} 1600w`;
}

/** La <img> de una lámina (la primera es la imagen LCP: prioridad alta). */
function imagen(s: { image: string; alt: string }, i: number) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={s.image}
      srcSet={srcSetHero(s.image)}
      sizes="100vw"
      alt={s.alt}
      width={1600}
      height={1200}
      fetchPriority={i === 0 ? "high" : "low"}
      loading={i === 0 ? "eager" : "lazy"}
      decoding={i === 0 ? "sync" : "async"}
      className="absolute inset-0 w-full h-full object-cover object-center"
    />
  );
}

export default function HeroSlider({ slides: config, precios = {} }: { slides: SlideConfig[]; precios?: PreciosHero }) {
  const slides = useMemo(
    () =>
      config.map((c) => {
        const precio = c.precio ? (precios[c.precio.familia] ?? null) : null;
        return {
          id: c.id,
          eyebrow: c.eyebrow,
          title: c.titulo,
          sub: c.subtitulo,
          precio,
          precioNota: c.precio?.nota ?? "",
          cta: c.boton ? { label: c.boton.texto, href: c.boton.enlace } : null,
          image: c.imagenDesktop,
          imageMobile: c.imagenMovil,
          alt: c.alt,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, precios.fierro, precios.tubo, precios.zinc],
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

  if (slides.length === 0) return null;

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
            key={s.id}
            className="relative shrink-0 w-full h-full snap-start"
            role="group"
            aria-roledescription="lámina"
            aria-label={`${i + 1} de ${slides.length}`}
          >
            {/* <img> con srcset propio: el optimizador de imágenes está apagado
                (next.config, images.unoptimized), así que next/image mandaría
                la foto de 1600 px también al celular. La primera es la imagen
                LCP de la portada: carga con prioridad alta. */}
            {s.imageMobile ? (
              <picture>
                <source media="(max-width: 639px)" srcSet={s.imageMobile} />
                {imagen(s, i)}
              </picture>
            ) : (
              imagen(s, i)
            )}
            {/* Oscurece sólo donde va el texto: abajo en celular, a la izquierda en escritorio. */}
            <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/75 via-45% to-navy-950/10 lg:bg-gradient-to-r lg:from-navy-950/95 lg:via-navy-950/65 lg:to-navy-950/0" />
            <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-end lg:items-center pb-10 lg:pb-0">
              <div className="max-w-xl text-white">
                {s.eyebrow && <p className="text-xs font-semibold text-white/75 mb-1.5">{s.eyebrow}</p>}
                <h2 className="text-[26px] sm:text-[32px] lg:text-[42px] font-extrabold leading-[1.08] tracking-tight">
                  {s.title}
                </h2>
                <p className="hidden sm:block text-[15px] text-white/80 leading-relaxed mt-2 max-w-md">{s.sub}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {s.cta && (
                    <Link
                      href={s.cta.href}
                      className="inline-flex items-center gap-2 h-11 px-5 bg-marca-600 hover:bg-marca-700 text-white text-[15px] font-semibold rounded-xl transition-colors duration-150"
                    >
                      {s.cta.label}
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M13 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
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
