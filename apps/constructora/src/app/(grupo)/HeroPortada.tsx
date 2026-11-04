'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type Lamina = {
  marca: 'barraca' | 'arriendo' | 'constructora';
  negocio: string;
  /** Base sin ancho: se sirven -960, -1600 y -2400.webp. */
  foto: string;
};

const INTERVALO = 6000;

/**
 * Portada con carrusel de fondo (sólo fotos; el título queda fijo), como el de barraca.jurmaq.cl: una foto real por
 * negocio, crossfade cada 6 s, pausa con el mouse o el foco, puntos y flechas,
 * swipe en celular. Con prefers-reduced-motion no avanza solo.
 * El título y las tarjetas no se mueven: sólo cambia la foto.
 */
export default function HeroPortada({
  laminas,
  encabezado,
  children,
}: {
  laminas: Lamina[];
  encabezado: React.ReactNode;
  children: React.ReactNode;
}) {
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [reducido, setReducido] = useState(true);
  const toque = useRef<number | null>(null);
  const total = laminas.length;

  const ir = useCallback((i: number) => setActual(((i % total) + total) % total), [total]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducido(mq.matches);
    const cambio = () => setReducido(mq.matches);
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, []);

  useEffect(() => {
    if (reducido || pausado || total < 2) return;
    const t = window.setTimeout(() => ir(actual + 1), INTERVALO);
    return () => window.clearTimeout(t);
  }, [actual, pausado, reducido, total, ir]);

  return (
    <section
      className="h-portada"
      data-tema="marino"
      aria-roledescription="carrusel"
      aria-label="Negocios JURMAQ"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPausado(false); }}
      onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (toque.current === null) return;
        const dx = e.changedTouches[0].clientX - toque.current;
        toque.current = null;
        if (Math.abs(dx) > 48) { setPausado(true); ir(actual + (dx < 0 ? 1 : -1)); }
      }}
    >
      <div className="h-portada__fondo">
        {laminas.map((l, i) => (
          <div key={l.foto} className="h-lamina__foto" data-activa={i === actual} aria-hidden={i !== actual}>
            {/* next/image está sin optimizar en este sitio: el srcset va a mano. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${l.foto}-1600.webp`}
              srcSet={`${l.foto}-960.webp 960w, ${l.foto}-1600.webp 1600w, ${l.foto}-2400.webp 2400w`}
              sizes="100vw"
              alt=""
              decoding="async"
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : 'low'}
            />
          </div>
        ))}
      </div>

      <div className="h-portada__ancho">
        {encabezado}

        <div className="h-carrusel" role="group" aria-label="Fotos de la portada">
          <div className="h-carrusel__controles">
            <button type="button" className="h-carrusel__flecha" onClick={() => ir(actual - 1)} aria-label="Lámina anterior">
              <span aria-hidden="true">←</span>
            </button>
            <div className="h-carrusel__puntos">
              {laminas.map((l, i) => (
                <button
                  key={l.marca}
                  type="button"
                  className="h-carrusel__punto"
                  data-marca={l.marca}
                  aria-label={`Mostrar ${l.negocio}`}
                  aria-current={i === actual ? 'true' : undefined}
                  onClick={() => ir(i)}
                >
                  <span />
                </button>
              ))}
            </div>
            <button type="button" className="h-carrusel__flecha" onClick={() => ir(actual + 1)} aria-label="Lámina siguiente">
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>

        {children}
      </div>
    </section>
  );
}
