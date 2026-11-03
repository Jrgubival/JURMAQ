import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Cierre from "@/components/Cierre";
import Foto from "@/components/Foto";
import JsonLd from "@/components/JsonLd";
import Migas from "@/components/Migas";
import { ORGANIZACION_ID, url } from "@/data/empresa";
import medidas from "@/data/fotos.json";
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
    description: `${o.resumen} ${o.mandante}, ${o.comuna}.`.slice(0, 160),
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
      <div className="contenedor cabeza-pagina">
        <Migas
          items={[
            { nombre: "Proyectos", ruta: "/proyectos" },
            { nombre: o.titulo, ruta },
          ]}
        />
        <h1>{o.titulo}</h1>
        <p className="bajada">{o.resumen}</p>
      </div>
      <section className="seccion" style={{ paddingTop: 0 }}>
        <div className="contenedor dos-columnas">
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
            <div>
              <dt>Contratos con el cliente</dt>
              <dd>{o.montoCliente} aprox., acumulado</dd>
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
              <dt>Alcance</dt>
              <dd>
                <ul>
                  {o.alcance.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
          <div>
            <h2 style={{ fontSize: "1.3rem", marginBottom: 10 }}>Servicios</h2>
            <ul>
              {servicios.map((s) => (
                <li key={s.slug} style={{ paddingBlock: 3 }}>
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
          <div className="contenedor galeria">
            {o.fotos.map((f, i) => {
              const { w, h } = medidas[f.nombre];
              return (
                <figure key={f.nombre} className={i > 0 && h > w ? "vertical" : undefined}>
                  <Foto foto={f} sizes={i === 0 ? "(max-width: 1212px) 100vw, 1180px" : "(max-width: 860px) 100vw, 590px"} prioridad={i === 0} />
                </figure>
              );
            })}
          </div>
        </section>
      )}
      <Cierre />
    </>
  );
}
