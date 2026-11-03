import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Cierre from "@/components/Cierre";
import FilaObra from "@/components/FilaObra";
import JsonLd from "@/components/JsonLd";
import Migas from "@/components/Migas";
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
      <div className="contenedor cabeza-pagina">
        <Migas
          items={[
            { nombre: "Servicios", ruta: "/servicios" },
            { nombre: s.corto, ruta },
          ]}
        />
        <h1>{s.nombre}</h1>
        <p className="bajada">{s.intro}</p>
      </div>
      <section className="seccion" style={{ paddingTop: 0 }}>
        <div className="contenedor">
          <h2 style={{ marginBottom: 14 }}>Qué incluye</h2>
          <ul className="lista">
            {s.incluye.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      </section>
      {obras.length > 0 && (
        <section className="seccion">
          <div className="contenedor">
            <h2 style={{ marginBottom: 14 }}>Obras de este servicio</h2>
            <div className="filas">
              {obras.map((o) => (
                <FilaObra key={o.slug} obra={o} />
              ))}
            </div>
          </div>
        </section>
      )}
      <Cierre />
    </>
  );
}
