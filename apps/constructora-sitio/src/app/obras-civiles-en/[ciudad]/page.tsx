import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Cierre from "@/components/Cierre";
import FilaObra from "@/components/FilaObra";
import Migas from "@/components/Migas";
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
  return (
    <>
      <div className="contenedor cabeza-pagina">
        <Migas
          items={[
            { nombre: "Servicios", ruta: "/servicios" },
            { nombre: `Obras en ${z.nombre}`, ruta: `/obras-civiles-en/${z.slug}` },
          ]}
        />
        <h1>Obras civiles e industriales en {z.nombre}</h1>
        <p className="bajada">{z.intro}</p>
      </div>
      <section className="seccion">
        <div className="contenedor">
          <h2 className="sub">Obras en {z.nombre}</h2>
          <div className="filas">
            {obras.map((o) => (
              <FilaObra key={o.slug} obra={o} />
            ))}
          </div>
        </div>
      </section>
      <section className="seccion">
        <div className="contenedor">
          <h2 className="sub">Servicios ejecutados en {z.nombre}</h2>
          <div className="indice">
            {servicios.map((s) => (
              <Link key={s.slug} href={`/servicios/${s.slug}`}>
                <strong>{s.nombre}</strong>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <Cierre />
    </>
  );
}
