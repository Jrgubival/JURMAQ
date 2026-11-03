'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Animación de scroll con GSAP. Se carga cuando el navegador queda libre, para
 * no competir con la foto del hero, y sólo oculta lo que está bajo la pantalla:
 * sin JavaScript o con movimiento reducido todo se ve normal.
 */
export default function Movimiento() {
  const ruta = usePathname();

  useEffect(() => {
    let revertir: (() => void) | undefined;
    let cancelado = false;

    async function iniciar() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
      if (cancelado) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      revertir = () => mm.revert();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const bloques = gsap.utils
          .toArray<HTMLElement>('main section h2, main .tile, main [data-revela]')
          .filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.92);
        gsap.set(bloques, { autoAlpha: 0, y: 26 });
        ScrollTrigger.batch(bloques, {
          start: 'top 92%',
          once: true,
          onEnter: (grupo) =>
            gsap.to(grupo, { autoAlpha: 1, y: 0, duration: 0.65, ease: 'power3.out', stagger: 0.06, overwrite: true, clearProps: 'transform,visibility,opacity' }),
        });
      });

      // La foto del hero baja un poco más lento que la página.
      mm.add('(prefers-reduced-motion: no-preference) and (min-width: 768px)', () => {
        const foto = document.querySelector<HTMLElement>('main .foto-hero');
        if (!foto?.parentElement) return;
        gsap.set(foto, { scale: 1.08 });
        gsap.to(foto, {
          yPercent: 5,
          ease: 'none',
          scrollTrigger: { trigger: foto.parentElement, start: 'top top', end: 'bottom top', scrub: true },
        });
      });
    }

    // Safari no tiene requestIdleCallback.
    const conIdle = typeof window.requestIdleCallback === 'function';
    const espera = conIdle
      ? window.requestIdleCallback(() => void iniciar(), { timeout: 1500 })
      : setTimeout(() => void iniciar(), 300);

    return () => {
      cancelado = true;
      if (conIdle) window.cancelIdleCallback(espera as number);
      else clearTimeout(espera);
      revertir?.();
    };
  }, [ruta]);

  return null;
}
