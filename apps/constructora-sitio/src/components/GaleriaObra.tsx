"use client";

import { useRef, type KeyboardEvent } from "react";
import Foto from "@/components/Foto";
import type { FotoObra } from "@/data/obras";

/** Galería de la ficha. Cada foto abre el visor a pantalla completa. */
export default function GaleriaObra({ fotos, titulo }: { fotos: FotoObra[]; titulo: string }) {
  const visor = useRef<HTMLDialogElement>(null);
  const pista = useRef<HTMLDivElement>(null);
  // Ref y no estado: varias pulsaciones seguidas no deben leer un índice viejo.
  const actual = useRef(0);

  function ir(indice: number, suave = true) {
    const destino = (indice + fotos.length) % fotos.length;
    actual.current = destino;
    pista.current?.children[destino]?.scrollIntoView({ behavior: suave ? "smooth" : "instant", inline: "center" });
  }

  function abrir(indice: number) {
    visor.current?.showModal();
    ir(indice, false);
  }

  function alDeslizar() {
    const p = pista.current;
    if (p) actual.current = Math.round(p.scrollLeft / p.clientWidth);
  }

  function alPulsarTecla(e: KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    // Sin esto, la pista se desplaza sola y pelea con el cambio de foto.
    e.preventDefault();
    ir(actual.current + (e.key === "ArrowRight" ? 1 : -1));
  }

  return (
    <>
      <div className="galeria">
        {fotos.map((f, i) => (
          <button
            key={f.nombre}
            type="button"
            className="galeria-foto"
            aria-label={`Ampliar foto: ${f.alt}`}
            onClick={() => abrir(i)}
          >
            <Foto foto={f} sizes="(max-width: 860px) 100vw, 50vw" />
          </button>
        ))}
      </div>
      <dialog
        ref={visor}
        className="visor"
        aria-label={`Fotos de ${titulo}`}
        onKeyDown={alPulsarTecla}
      >
        <div className="visor-pista" ref={pista} tabIndex={-1} onScrollEnd={alDeslizar}>
          {fotos.map((f) => (
            <figure key={f.nombre}>
              <Foto foto={f} sizes="100vw" />
              <figcaption>{f.alt}</figcaption>
            </figure>
          ))}
        </div>
        {fotos.length > 1 && (
          <div className="visor-controles">
            <button type="button" onClick={() => ir(actual.current - 1)}>
              Anterior
            </button>
            <button type="button" onClick={() => ir(actual.current + 1)}>
              Siguiente
            </button>
          </div>
        )}
        <button type="button" className="visor-cerrar" onClick={() => visor.current?.close()}>
          Cerrar
        </button>
      </dialog>
    </>
  );
}
