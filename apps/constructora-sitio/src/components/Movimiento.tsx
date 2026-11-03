"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Animaciones de entrada con GSAP. Carga después de pintar: la portada no espera
 * por este código, y sin él la página se ve completa. Quien pide menos movimiento
 * no ve ninguna.
 */
export default function Movimiento() {
  const ruta = usePathname();

  useEffect(() => {
    let cancelado = false;
    let revertir: (() => void) | undefined;

    async function iniciar() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelado) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Las fotos se descubren de abajo hacia arriba: es lo único que se mueve mucho.
        ScrollTrigger.batch(".obra, .galeria-foto", {
          start: "top 88%",
          once: true,
          onEnter: (fotos) =>
            gsap.fromTo(
              fotos,
              { clipPath: "inset(14% 0 0 0)", y: 28 },
              { clipPath: "inset(0% 0 0 0)", y: 0, duration: 0.9, ease: "power3.out", stagger: 0.08, clearProps: "clipPath,transform" },
            ),
        });

        ScrollTrigger.batch(".especialidades li, .lista li, .roles > div, .montos li", {
          start: "top 92%",
          once: true,
          onEnter: (filas) =>
            gsap.fromTo(filas, { x: -14 }, { x: 0, duration: 0.5, ease: "power2.out", stagger: 0.05, clearProps: "transform" }),
        });

        gsap.utils.toArray<HTMLElement>(".seccion h2, .destacada-panel > *").forEach((el) => {
          gsap.fromTo(
            el,
            { y: 18 },
            {
              y: 0,
              duration: 0.6,
              ease: "power2.out",
              clearProps: "transform",
              scrollTrigger: { trigger: el, start: "top 90%", once: true },
            },
          );
        });

        // Las cifras cuentan una sola vez; el HTML ya trae el valor final.
        gsap.utils.toArray<HTMLElement>(".montos strong").forEach((el) => {
          const final = Number(el.textContent?.replace(/\D/g, ""));
          if (!final) return;
          const texto = el.textContent ?? "";
          const cuenta = { valor: 0 };
          gsap.to(cuenta, {
            valor: final,
            duration: 1.2,
            ease: "power2.out",
            snap: { valor: 100 },
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
            onUpdate: () => {
              el.textContent = `UF ${cuenta.valor.toLocaleString("es-CL")}+`;
            },
            onComplete: () => {
              el.textContent = texto;
            },
          });
        });

        const portada = document.querySelector<HTMLElement>(".hero > img");
        if (portada) {
          gsap.fromTo(
            portada,
            { yPercent: 0, scale: 1.08 },
            {
              yPercent: 6,
              scale: 1.08,
              ease: "none",
              scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.4 },
            },
          );
        }
      });

      document.fonts?.ready.then(() => ScrollTrigger.refresh());
      revertir = () => mm.revert();
    }

    const pedir = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 200));
    pedir(() => void iniciar());

    return () => {
      cancelado = true;
      revertir?.();
    };
  }, [ruta]);

  return null;
}
