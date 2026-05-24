"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

const slides = [
  {
    image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80",
    title: "Construcción Industrial",
  },
  {
    image: "https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=1920&q=80",
    title: "Arriendo de Maquinaria",
  },
  {
    image: "https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=1920&q=80",
    title: "Maestranza",
  },
  {
    image: "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=1920&q=80",
    title: "Barraca de Fierros",
  },
];

export default function HeroSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Respect prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const goTo = useCallback((nextIndex: number) => {
    setCurrentIndex((prev) => {
      if (nextIndex === prev) return prev;
      setPrevIndex(prev);
      return nextIndex;
    });
  }, []);

  // Clear prevIndex after crossfade completes
  useEffect(() => {
    if (prevIndex === null) return;
    const timeout = setTimeout(() => setPrevIndex(null), 1000);
    return () => clearTimeout(timeout);
  }, [prevIndex]);

  // Auto-advance (skip if user prefers reduced motion)
  useEffect(() => {
    if (prefersReducedMotion) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % slides.length;
        setPrevIndex(prev);
        return next;
      });
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [prefersReducedMotion]);

  const handleIndicatorClick = useCallback(
    (i: number) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      goTo(i);
    },
    [goTo]
  );

  return (
    <div className="absolute inset-0 overflow-hidden hero-grain" role="region" aria-label="Presentacion de imagenes" aria-roledescription="carrusel">
      {slides.map((slide, i) => {
        const isActive = i === currentIndex;
        const isPrev = i === prevIndex;
        const isVisible = isActive || isPrev;

        return (
          <div
            key={i}
            className="absolute inset-0"
            style={{
              opacity: isActive ? 1 : 0,
              transition: prefersReducedMotion ? "none" : "opacity 1s ease-in-out",
              zIndex: isActive ? 2 : isPrev ? 1 : 0,
              willChange: isVisible ? "opacity" : "auto",
              visibility: isVisible ? "visible" : "hidden",
            }}
            aria-hidden={!isActive}
          >
            <img
              src={slide.image}
              alt=""
              aria-hidden="true"
              role="presentation"
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
              decoding={i === 0 ? "sync" : "async"}
              width={1920}
              height={1080}
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                animation: isActive && !prefersReducedMotion ? "kenburns 7s ease-out forwards" : "none",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-navy-950/95 via-navy-950/90 to-navy-950/70" />
          </div>
        );
      })}

      {/* Indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1 z-10" role="tablist" aria-label="Diapositivas">
        {slides.map((slide, i) => (
          <button
            key={i}
            onClick={() => handleIndicatorClick(i)}
            className="flex items-center justify-center w-11 h-11 cursor-pointer"
            role="tab"
            aria-selected={i === currentIndex}
            aria-label={`Ir a ${slide.title} (${i + 1} de ${slides.length})`}
          >
            <span
              className="block h-3 rounded-full"
              style={{
                width: i === currentIndex ? 48 : 12,
                backgroundColor:
                  i === currentIndex ? "#e6b422" : "rgba(255,255,255,0.4)",
                transition: prefersReducedMotion ? "none" : "width 0.4s ease, background-color 0.4s ease",
              }}
            />
          </button>
        ))}
      </div>

      {/* Current label */}
      <div className="absolute bottom-8 right-8 z-10 hidden lg:block">
        <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
          {slides[currentIndex]?.title}
        </span>
      </div>
    </div>
  );
}
