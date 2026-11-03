import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CabezaPagina from "@/components/CabezaPagina";
import Cierre from "@/components/Cierre";
import JsonLd from "@/components/JsonLd";
import Mosaico from "@/components/Mosaico";
import { ORGANIZACION_ID, url } from "@/data/empresa";
import { obrasDeServicio } from "@/data/obras";
import { getServicio, SERVICIOS } from "@/data/servicios";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return SERVICIOS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = getServicio((await params).slug);
  if (!s) return {};
  const ruta = `/servicios/${s.slug}`;
  return {
    title: s.tituloSeo,
    description: s.descripcion,
    alternates: { canonical: url(ruta) },
    openGraph: { title: s.tituloSeo, description: s.descripcion, url: url(ruta) },
  };
}

export default async function PaginaServicio({ params }: Props) {
  const s = getServicio((await params).slug);
  if (!s) notFound();
  const ruta = `/servicios/${s.slug}`;
  const obras = obrasDeServicio(s.slug);
  return (
    <>
      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: s.nombre,
          description: s.descripcion,
          url: url(ruta),
          provider: { "@id": ORGANIZACION_ID },
          areaServed: { "@type": "AdministrativeArea", name: "Región del Maule" },
        }}
      />
      <CabezaPagina
        migas={[
          { nombre: "Servicios", ruta: "/servicios" },
          { nombre: s.corto, ruta },
        ]}
        titulo={s.nombre}
        bajada={s.intro}
        foto={{ nombre: s.foto, alt: "" }}
      />
      <section className="servicios">
        <div className="contenedor servicios-grilla">
          <h2>Qué incluye</h2>
          <ul>
            {s.incluye.map((i) => (
              <li key={i}>
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      {obras.length > 0 && (
        <section className="seccion">
          <div className="contenedor">
            <h2 className="sub">Obras de este servicio</h2>
            <Mosaico obras={obras} />
          </div>
        </section>
      )}
      <Cierre />
    </>
  );
}
