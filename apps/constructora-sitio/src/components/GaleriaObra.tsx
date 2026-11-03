"use client";

import { useRef, useState } from "react";
import Foto from "@/components/Foto";
import type { FotoObra } from "@/data/obras";

/** Galería de la ficha. Cada foto abre el visor a pantalla completa. */
export default function GaleriaObra({ fotos, titulo }: { fotos: FotoObra[]; titulo: string }) {
  const visor = useRef<HTMLDialogElement>(null);
  const pista = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);

  function ir(indice: number, suave = true) {
    const destino = (indice + fotos.length) % fotos.length;
    setActual(destino);
    pista.current?.children[destino]?.scrollIntoView({ behavior: suave ? "smooth" : "instant", inline: "center" });
  }

  function abrir(indice: number) {
    visor.current?.showModal();
    ir(indice, false);
  }

  function alDeslizar() {
    const p = pista.current;
    if (p) setActual(Math.round(p.scrollLeft / p.clientWidth));
  }

  return (
    <>
      <div className="galeria">
        {fotos.map((f, i) => (
          <button key={f.nombre} type="button" className="galeria-foto" onClick={() => abrir(i)}>
            <Foto foto={f} sizes="(max-width: 860px) 100vw, 50vw" />
            <span className="sr">Ampliar: {f.alt}</span>
          </button>
        ))}
      </div>
      <dialog
        ref={visor}
        className="visor"
        aria-label={`Fotos de ${titulo}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") ir(actual + 1);
          if (e.key === "ArrowLeft") ir(actual - 1);
        }}
      >
        <div className="visor-pista" ref={pista} onScrollEnd={alDeslizar}>
          {fotos.map((f) => (
            <figure key={f.nombre}>
              <Foto foto={f} sizes="100vw" />
              <figcaption>{f.alt}</figcaption>
            </figure>
          ))}
        </div>
        {fotos.length > 1 && (
          <div className="visor-controles">
            <button type="button" onClick={() => ir(actual - 1)}>
              Anterior
            </button>
            <button type="button" onClick={() => ir(actual + 1)}>
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
