import type { Metadata } from "next";
import Link from "next/link";
import Cierre from "@/components/Cierre";
import Migas from "@/components/Migas";
import { url } from "@/data/empresa";
import { SERVICIOS } from "@/data/servicios";

const TITULO = "Servicios de construcción industrial";
const DESCRIPCION =
  "Fundaciones, maestranza, montaje e izado, bodegas, pavimentos, cubiertas y mantención para plantas industriales en la Región del Maule.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: url("/servicios") },
  openGraph: { title: TITULO, description: DESCRIPCION, url: url("/servicios") },
};

export default function Servicios() {
  return (
    <>
      <div className="contenedor cabeza-pagina">
        <Migas items={[{ nombre: "Servicios", ruta: "/servicios" }]} />
        <h1>Servicios</h1>
        <p className="bajada">Obras civiles, maestranza y montaje para plantas en operación.</p>
      </div>
      <section className="seccion">
        <div className="contenedor indice">
          {SERVICIOS.map((s) => (
            <Link key={s.slug} href={`/servicios/${s.slug}`}>
              <strong>{s.nombre}</strong>
              <span>{s.intro}</span>
            </Link>
          ))}
        </div>
      </section>
      <Cierre />
    </>
  );
}
