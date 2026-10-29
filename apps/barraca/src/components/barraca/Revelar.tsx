"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Aparición suave al hacer scroll: los hijos marcados con `data-revelar`
 * suben 16 px y se aclaran, en cascada, cuando entran a la pantalla.
 *
 * Sólo se animan los que todavía están bajo el borde de la pantalla al
 * cargar: lo que ya se ve no parpadea (nada se oculta antes de hidratar) y,
 * si el JS no llega, todo queda visible. Con "reducir movimiento" no se anima.
 */
export default function Revelar({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  const raiz = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const bajoElBorde = gsap.utils
          .toArray<HTMLElement>("[data-revelar]", raiz.current)
          .filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.92);
        if (!bajoElBorde.length) return;
        gsap.set(bajoElBorde, { autoAlpha: 0, y: 16 });
        ScrollTrigger.batch(bajoElBorde, {
          start: "top 92%",
          once: true,
          onEnter: (lote) =>
            gsap.to(lote, { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.06, overwrite: true }),
        });
      });
    },
    { scope: raiz },
  );

  return (
    <Tag ref={raiz} className={className}>
      {children}
    </Tag>
  );
}
