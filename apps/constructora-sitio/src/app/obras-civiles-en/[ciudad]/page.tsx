import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CabezaPagina from "@/components/CabezaPagina";
import Cierre from "@/components/Cierre";
import Mosaico from "@/components/Mosaico";
import { url } from "@/data/empresa";
import { obrasDeZona } from "@/data/obras";
import { SERVICIOS } from "@/data/servicios";
import { getZona, ZONAS } from "@/data/zonas";

type Props = { params: Promise<{ ciudad: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return ZONAS.map((z) => ({ ciudad: z.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const z = getZona((await params).ciudad);
  if (!z) return {};
  const ruta = `/obras-civiles-en/${z.slug}`;
  return {
    title: z.tituloSeo,
    description: z.descripcion,
    alternates: { canonical: url(ruta) },
    openGraph: { title: z.tituloSeo, description: z.descripcion, url: url(ruta) },
  };
}

export default async function PaginaZona({ params }: Props) {
  const z = getZona((await params).ciudad);
  if (!z) notFound();
  const obras = obrasDeZona(z.slug);
  const servicios = SERVICIOS.filter((s) => obras.some((o) => o.servicios.includes(s.slug)));
  const portada = obras.find((o) => o.fotos[0])?.fotos[0];
  return (
    <>
      <CabezaPagina
        migas={[
          { nombre: "Especialidades", ruta: "/servicios" },
          { nombre: `Obras en ${z.nombre}`, ruta: `/obras-civiles-en/${z.slug}` },
        ]}
        titulo={`Obras civiles e industriales en ${z.nombre}`}
        bajada={z.intro}
        foto={portada}
      />
      <section className="seccion">
        <div className="contenedor">
          <h2 className="sub">Obras en {z.nombre}</h2>
          <Mosaico obras={obras} />
        </div>
      </section>
      <section className="servicios">
        <div className="contenedor servicios-grilla">
          <h2>Especialidades en {z.nombre}</h2>
          <ul>
            {servicios.map((s) => (
              <li key={s.slug}>
                <Link href={`/servicios/${s.slug}`}>{s.nombre}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <Cierre />
    </>
  );
}
