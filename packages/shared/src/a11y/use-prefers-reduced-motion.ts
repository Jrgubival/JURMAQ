"use client";

import { useEffect, useState } from "react";

/**
 * Hook que respeta `prefers-reduced-motion: reduce` del SO.
 *
 * WCAG 2.2 SC 2.3.3: si el usuario indica que prefiere movimiento reducido,
 * cualquier animación NO esencial debe deshabilitarse o sustituirse por
 * transición suave (max 5s, sin parpadeos > 3 Hz, sin paralax extremo).
 *
 * Uso:
 *   const reduced = usePrefersReducedMotion();
 *   if (reduced) return <div>contenido sin animar</div>;
 *   return <AnimatedDiv>...</AnimatedDiv>;
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    if (media.addEventListener) {
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
    // legacy Safari
    media.addListener(handler);
    return () => media.removeListener(handler);
  }, []);

  return reduced;
}
