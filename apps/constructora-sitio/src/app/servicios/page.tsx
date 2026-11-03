import type { Metadata } from "next";
import Link from "next/link";
import CabezaPagina from "@/components/CabezaPagina";
import Cierre from "@/components/Cierre";
import Foto from "@/components/Foto";
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
      <CabezaPagina
        migas={[{ nombre: "Servicios", ruta: "/servicios" }]}
        titulo="Servicios"
        bajada="Obras civiles, maestranza y montaje para plantas en operación."
        foto={{ nombre: "batcheo-interior", alt: "Interior de una planta en obra con plataforma de tijera" }}
      />
      <section className="seccion">
        <div className="contenedor mosaico">
          {SERVICIOS.map((s) => (
            <Link key={s.slug} href={`/servicios/${s.slug}`} className="obra">
              <Foto foto={{ nombre: s.foto, alt: "" }} sizes="(max-width: 860px) 100vw, 50vw" />
              <span className="obra-texto">
                <span className="obra-titulo">{s.nombre}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
      <Cierre />
    </>
  );
}
