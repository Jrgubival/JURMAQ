import type { Metadata } from "next";
import CabezaPagina from "@/components/CabezaPagina";
import Cierre from "@/components/Cierre";
import Cifras from "@/components/Cifras";
import Mosaico from "@/components/Mosaico";
import { url } from "@/data/empresa";
import { OBRAS_CON_FOTO, OBRAS_SIN_FOTO, OTRAS_OBRAS, OTROS_CLIENTES } from "@/data/obras";

const TITULO = "Proyectos de obra civil e industrial";
const DESCRIPCION =
  "Fichas de obras para Nestlé, Miguel Torres, Cementos Biobío, Iansagro y Surfrut: fundaciones, montaje, bodegas y mantención en la Región del Maule.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: url("/proyectos") },
  openGraph: { title: TITULO, description: DESCRIPCION, url: url("/proyectos") },
};

export default function Proyectos() {
  return (
    <>
      <CabezaPagina
        migas={[{ nombre: "Experiencia", ruta: "/proyectos" }]}
        titulo="Experiencia en obras industriales"
        bajada="Obras ejecutadas por JURMAQ dentro de plantas en operación."
        foto={{ nombre: "silos-fundacion", alt: "Armadura circular de una fundación junto a tres silos" }}
      />
      <section className="seccion">
        <div className="contenedor">
          <Mosaico obras={OBRAS_CON_FOTO} />
        </div>
      </section>
      <Cifras />
      <section className="seccion">
        <div className="contenedor">
          <h2 className="sub">Otros clientes y obras</h2>
          <Mosaico obras={OBRAS_SIN_FOTO} />
          <div className="texto otras">
            {OTRAS_OBRAS.map((t) => (
              <p key={t}>{t}</p>
            ))}
            <p>También han trabajado con nosotros: {OTROS_CLIENTES.join(", ")}.</p>
          </div>
        </div>
      </section>
      <Cierre />
    </>
  );
}
