import Link from "next/link";
import Foto from "@/components/Foto";
import type { Obra } from "@/data/obras";

export default function FilaObra({ obra }: { obra: Obra }) {
  const foto = obra.fotos[0];
  return (
    <Link href={`/proyectos/${obra.slug}`} className={foto ? "fila" : "fila fila-sin-foto"}>
      {foto && <Foto foto={foto} sizes="(max-width: 860px) 112px, 200px" />}
      <div>
        <h3>{obra.titulo}</h3>
        <p>{obra.resumen}</p>
      </div>
      <div className="fila-dato">
        {obra.mandante}
        <br />
        {obra.comuna}
        {obra.periodo ? ` · ${obra.periodo}` : ""}
      </div>
    </Link>
  );
}
