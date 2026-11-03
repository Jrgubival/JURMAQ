import Link from "next/link";
import Foto from "@/components/Foto";
import type { Obra } from "@/data/obras";

/** Obras como galería grande. Con `portada`, la primera toma media página. */
export default function Mosaico({ obras, portada = false }: { obras: Obra[]; portada?: boolean }) {
  return (
    <div className={portada ? "mosaico mosaico-portada" : "mosaico"}>
      {obras.map((o, i) => (
        <Link key={o.slug} href={`/proyectos/${o.slug}`} className={o.fotos[0] ? "obra" : "obra obra-sin-foto"}>
          {o.fotos[0] && (
            <Foto
              foto={o.fotos[0]}
              sizes={portada && i === 0 ? "(max-width: 860px) 100vw, 66vw" : "(max-width: 860px) 100vw, 50vw"}
            />
          )}
          <span className="obra-texto">
            <span className="obra-cliente">
              {o.mandante}, {o.comuna}
            </span>
            <span className="obra-titulo">{o.titulo}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
