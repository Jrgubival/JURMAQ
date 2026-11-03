import type { Metadata } from "next";
import Cierre from "@/components/Cierre";
import FilaObra from "@/components/FilaObra";
import Migas from "@/components/Migas";
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
      <div className="contenedor cabeza-pagina">
        <Migas items={[{ nombre: "Proyectos", ruta: "/proyectos" }]} />
        <h1>Proyectos</h1>
        <p className="bajada">Obras ejecutadas por JURMAQ dentro de plantas en operación.</p>
      </div>
      <section className="seccion" style={{ paddingTop: 0 }}>
        <div className="contenedor filas">
          {OBRAS_CON_FOTO.map((o) => (
            <FilaObra key={o.slug} obra={o} />
          ))}
        </div>
      </section>
      <section className="seccion">
        <div className="contenedor">
          <h2 style={{ marginBottom: 14 }}>Otros clientes y obras</h2>
          <div className="filas">
            {OBRAS_SIN_FOTO.map((o) => (
              <FilaObra key={o.slug} obra={o} />
            ))}
          </div>
          <ul className="lista" style={{ marginTop: 28 }}>
            {OTRAS_OBRAS.map((t) => (
              <li key={t}>{t}</li>
            ))}
            <li>También han trabajado con nosotros: {OTROS_CLIENTES.join(", ")}.</li>
          </ul>
        </div>
      </section>
      <Cierre />
    </>
  );
}
