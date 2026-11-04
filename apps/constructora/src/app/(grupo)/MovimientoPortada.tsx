'use client';

import { useEffect } from 'react';

/**
 * Movimiento al hacer scroll en la portada. La entrada de las tarjetas es CSS
 * (no depende de que cargue este archivo); GSAP se pide después, así que no
 * pesa en la primera carga, y sólo toca elementos fuera de la primera vista.
 * Con prefers-reduced-motion no se carga.
 */
export default function MovimientoPortada() {
  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;

    let cancelado = false;
    let limpiar: (() => void) | undefined;

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        if (cancelado) return;
        gsap.registerPlugin(ScrollTrigger);

        const ctx = gsap.context(() => {
          // Nada parte oculto: si esto no corre, todo sigue a la vista.
          gsap.from('.h-grupo__foto', {
            y: 14,
            duration: 0.5,
            ease: 'power3.out',
            clearProps: 'all',
            scrollTrigger: { trigger: '.h-grupo', start: 'top 72%', once: true },
          });

          gsap.from('.h-grupo__texto > *', {
            y: 14,
            duration: 0.45,
            ease: 'power3.out',
            stagger: 0.07,
            clearProps: 'all',
            scrollTrigger: { trigger: '.h-grupo', start: 'top 72%', once: true },
          });

          gsap.from('.h-llamar__botones > li', {
            y: 12,
            duration: 0.4,
            ease: 'power3.out',
            stagger: 0.06,
            clearProps: 'all',
            scrollTrigger: { trigger: '.h-llamar__botones', start: 'top 88%', once: true },
          });
        });

        limpiar = () => ctx.revert();
      },
    );

    return () => {
      cancelado = true;
      limpiar?.();
    };
  }, []);

  return null;
}
