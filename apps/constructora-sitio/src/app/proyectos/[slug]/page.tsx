import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CabezaPagina from "@/components/CabezaPagina";
import Cierre from "@/components/Cierre";
import GaleriaObra from "@/components/GaleriaObra";
import JsonLd from "@/components/JsonLd";
import { ORGANIZACION_ID, url } from "@/data/empresa";
import { getObra, OBRAS } from "@/data/obras";
import { getServicio } from "@/data/servicios";
import { getZona } from "@/data/zonas";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return OBRAS.map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const o = getObra((await params).slug);
  if (!o) return {};
  const ruta = `/proyectos/${o.slug}`;
  const portada = o.fotos[0] ? [{ url: `/obras/${o.fotos[0].nombre}-1280.webp`, alt: o.fotos[0].alt }] : undefined;
  return {
    title: o.tituloSeo,
    description: o.resumen.slice(0, 160),
    alternates: { canonical: url(ruta) },
    openGraph: {
      title: o.tituloSeo,
      description: o.resumen,
      url: url(ruta),
      type: "article",
      ...(portada && { images: portada }),
    },
  };
}

export default async function PaginaObra({ params }: Props) {
  const o = getObra((await params).slug);
  if (!o) notFound();
  const ruta = `/proyectos/${o.slug}`;
  const servicios = o.servicios.flatMap((s) => getServicio(s) ?? []);
  const zona = o.zona ? getZona(o.zona) : undefined;
  const indice = OBRAS.indexOf(o);
  const siguiente = OBRAS[(indice + 1) % OBRAS.length];
  return (
    <>
      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          name: o.titulo,
          description: o.resumen,
          url: url(ruta),
          creator: { "@id": ORGANIZACION_ID },
          about: { "@type": "Organization", name: o.mandante },
          locationCreated: {
            "@type": "Place",
            address: { "@type": "PostalAddress", addressLocality: o.comuna, addressRegion: o.region, addressCountry: "CL" },
          },
          ...(o.fotos.length > 0 && { image: o.fotos.map((f) => url(`/obras/${f.nombre}-1280.webp`)) }),
        }}
      />
      <CabezaPagina
        migas={[
          { nombre: "Proyectos", ruta: "/proyectos" },
          { nombre: o.titulo, ruta },
        ]}
        titulo={o.titulo}
        bajada={o.resumen}
        foto={o.fotos[0]}
      />
      <section className="seccion">
        <div className="contenedor ficha-grilla">
          <dl className="ficha">
            <div>
              <dt>Mandante</dt>
              <dd>{o.mandante}</dd>
            </div>
            <div>
              <dt>Ubicación</dt>
              <dd>
                {zona ? <Link href={`/obras-civiles-en/${zona.slug}`}>{o.comuna}</Link> : o.comuna}, {o.region}
              </dd>
            </div>
            {o.periodo && (
              <div>
                <dt>Periodo</dt>
                <dd>{o.periodo}</dd>
              </div>
            )}
            {o.m2 && (
              <div>
                <dt>Superficie</dt>
                <dd>{o.m2.toLocaleString("es-CL")} m²</dd>
              </div>
            )}
            <div>
              <dt>Contratos con el cliente</dt>
              <dd>{o.montoCliente} aprox., acumulado</dd>
            </div>
          </dl>
          <div>
            <h2 className="sub sub-chica">Alcance</h2>
            <ul className="alcance">
              {o.alcance.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <h2 className="sub sub-chica">Servicios</h2>
            <ul>
              {servicios.map((s) => (
                <li key={s.slug} className="item-enlace">
                  <Link className="enlace" href={`/servicios/${s.slug}`}>
                    {s.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      {o.fotos.length > 0 && (
        <section className="seccion">
          <div className="contenedor">
            <GaleriaObra fotos={o.fotos} titulo={o.titulo} />
          </div>
        </section>
      )}
      <section className="seccion">
        <div className="contenedor seccion-cabeza">
          <Link className="enlace enlace-grande" href={`/proyectos/${siguiente.slug}`}>
            Siguiente obra: {siguiente.titulo}
          </Link>
        </div>
      </section>
      <Cierre />
    </>
  );
}
