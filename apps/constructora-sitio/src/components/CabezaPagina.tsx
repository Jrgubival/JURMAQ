import type { ReactNode } from "react";
import Foto, { anchoMaximo } from "@/components/Foto";
import Migas, { type Miga } from "@/components/Migas";
import type { FotoObra } from "@/data/obras";

/** Cabecera oscura de las páginas internas, con foto si la hay. */
export default function CabezaPagina({
  migas,
  titulo,
  bajada,
  foto,
  children,
}: {
  migas: Miga[];
  titulo: string;
  bajada: string;
  foto?: FotoObra;
  children?: ReactNode;
}) {
  return (
    <section className={foto ? `cabeza foto-fondo${anchoMaximo(foto.nombre) < 1600 ? " foto-baja" : ""}` : "cabeza"}>
      {foto && <Foto foto={foto} sizes="100vw" prioridad />}
      <div className="contenedor cabeza-texto">
        <Migas items={migas} />
        <h1>{titulo}</h1>
        <p className="bajada">{bajada}</p>
        {children}
      </div>
    </section>
  );
}
