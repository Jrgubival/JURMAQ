"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Carrusel continuo de los fabricantes con los que trabaja la barraca.
 *
 * Antes era una lista de nombres separados por puntos. Funcionaba, pero un
 * listado de texto no comunica respaldo: el logo de Cintac o de Polpaico sí,
 * porque el maestro los reconoce del saco y de la barra.
 *
 * Tres decisiones que importan:
 *
 * 1. La animación es CSS puro sobre una pista duplicada. No hay librería de
 *    carrusel ni JS por frame: el track se duplica y se desplaza exactamente
 *    la mitad de su ancho, así el salto al reiniciar cae en un punto idéntico
 *    y el loop no se ve. Las reglas están en app/globals.css y no en un
 *    <style jsx> acá: styled-jsx renombra los @keyframes al alcance del
 *    componente y el animation-name quedaba apuntando a nada.
 * 2. Se detiene al pasar el mouse y al enfocar con teclado. Un logo que huye
 *    cuando lo quieres mirar es una animación que estorba.
 * 3. Con `prefers-reduced-motion` no se mueve nada: queda como una grilla
 *    estática y legible. Lo mismo ve quien tenga el sistema así configurado.
 *
 * Si falta el archivo de un logo, esa marca se dibuja como texto en vez de
 * dejar un hueco — el carrusel nunca queda cojo mientras se completan.
 */

export interface MarcaProveedor {
  nombre: string;
  /** Ruta del logo en /public. Si no existe, se muestra el nombre. */
  logo?: string;
}

export default function MarcasCarrusel({
  marcas,
  duracionSegundos = 40,
}: {
  marcas: MarcaProveedor[];
  duracionSegundos?: number;
}) {
  const [rotos, setRotos] = useState<Record<string, boolean>>({});

  if (!marcas.length) return null;

  // La pista se recorre dos veces: la animación desplaza -50%, que es
  // exactamente el largo de la primera copia.
  const pista = [...marcas, ...marcas];

  return (
    <div
      className="marcas-carrusel relative overflow-hidden"
      // Máscara a los costados: los logos entran y salen desvaneciéndose en vez
      // de cortarse contra el borde.
      style={{
        maskImage:
          'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
      }}
    >
      <ul
        className="marcas-pista flex w-max items-center gap-x-12 sm:gap-x-16"
        style={{ animationDuration: `${duracionSegundos}s` }}
      >
        {pista.map((m, i) => {
          const sinLogo = !m.logo || rotos[m.nombre];
          return (
            <li
              key={`${m.nombre}-${i}`}
              className="shrink-0"
              // La segunda copia es decorativa: para un lector de pantalla la
              // lista son 10 marcas, no 20.
              aria-hidden={i >= marcas.length ? true : undefined}
            >
              {sinLogo ? (
                <span
                  className="text-base sm:text-lg text-[#111111] tracking-tight whitespace-nowrap"
                  style={{ fontWeight: 500 }}
                >
                  {m.nombre}
                </span>
              ) : (
                <Image
                  src={m.logo as string}
                  alt={m.nombre}
                  width={160}
                  height={56}
                  className="h-8 sm:h-10 w-auto object-contain opacity-70 transition-opacity duration-200 hover:opacity-100"
                  onError={() => setRotos((r) => ({ ...r, [m.nombre]: true }))}
                  unoptimized
                />
              )}
            </li>
          );
        })}
      </ul>

    </div>
  );
}
