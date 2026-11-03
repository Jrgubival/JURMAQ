import type { Metadata } from "next";
import Cierre from "@/components/Cierre";
import FilaObra from "@/components/FilaObra";
import Migas from "@/components/Migas";
import { url } from "@/data/empresa";
import { MONTOS_POR_CLIENTE, OBRAS_CON_FOTO, OBRAS_SIN_FOTO, OTRAS_OBRAS, OTROS_CLIENTES } from "@/data/obras";

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
      <section className="seccion">
        <div className="contenedor filas">
          {OBRAS_CON_FOTO.map((o) => (
            <FilaObra key={o.slug} obra={o} />
          ))}
        </div>
      </section>
      <section className="seccion">
        <div className="contenedor">
          <h2 className="sub">Otros clientes y obras</h2>
          <div className="filas">
            {OBRAS_SIN_FOTO.map((o) => (
              <FilaObra key={o.slug} obra={o} />
            ))}
          </div>
          <ul className="lista lista-separada">
            {OTRAS_OBRAS.map((t) => (
              <li key={t}>{t}</li>
            ))}
            <li>También han trabajado con nosotros: {OTROS_CLIENTES.join(", ")}.</li>
          </ul>
        </div>
      </section>
      <section className="seccion">
        <div className="contenedor">
          <h2 className="sub">Contratos por cliente</h2>
          <table className="tabla">
            <caption>Montos aproximados acumulados por cliente</caption>
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Trabajos</th>
                <th scope="col">Monto</th>
              </tr>
            </thead>
            <tbody>
              {MONTOS_POR_CLIENTE.map((m) => (
                <tr key={m.cliente}>
                  <th scope="row">{m.cliente}</th>
                  <td>{m.trabajos}</td>
                  <td>{m.monto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Cierre />
    </>
  );
}
