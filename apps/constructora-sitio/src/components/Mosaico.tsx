import { logoDe } from "@/components/LogosClientes";
import Tarjetas from "@/components/Tarjetas";
import type { Obra } from "@/data/obras";

/** Obras como tarjetas: foto, cliente y comuna, título y enlace a la ficha. */
export default function Mosaico({ obras }: { obras: Obra[]; portada?: boolean }) {
  return (
    <Tarjetas
      items={obras.map((o) => ({
        href: `/proyectos/${o.slug}`,
        titulo: o.titulo,
        meta: `${o.mandante} · ${o.comuna}`,
        cta: "Ver obra",
        foto: o.fotos[0],
        logo: o.fotos[0] ? undefined : logoDe(o.mandante),
      }))}
    />
  );
}
