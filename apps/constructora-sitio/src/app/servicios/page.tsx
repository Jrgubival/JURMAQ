import type { Metadata } from "next";
import CabezaPagina from "@/components/CabezaPagina";
import Cierre from "@/components/Cierre";
import Tarjetas from "@/components/Tarjetas";
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
        migas={[{ nombre: "Especialidades", ruta: "/servicios" }]}
        titulo="Especialidades en construcción industrial"
        bajada="Obras civiles, maestranza y montaje para plantas en operación."
        foto={{ nombre: "batcheo-interior", alt: "Interior de una planta en obra con plataforma de tijera" }}
      />
      <section className="seccion">
        <div className="contenedor">
          <Tarjetas
            items={SERVICIOS.map((s) => ({
              href: `/servicios/${s.slug}`,
              titulo: s.nombre,
              texto: s.resumen,
              cta: "Ver especialidad",
              foto: { nombre: s.foto, alt: "" },
            }))}
          />
        </div>
      </section>
      <Cierre />
    </>
  );
}
