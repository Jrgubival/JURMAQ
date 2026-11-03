import type { Metadata } from "next";
import Link from "next/link";
import Cierre from "@/components/Cierre";
import FilaObra from "@/components/FilaObra";
import Foto from "@/components/Foto";
import JsonLd from "@/components/JsonLd";
import LogosClientes from "@/components/LogosClientes";
import { EMPRESA, ORGANIZACION_ID, SITIO_URL, url } from "@/data/empresa";
import { OBRAS, OBRAS_CON_FOTO } from "@/data/obras";
import { SERVICIOS } from "@/data/servicios";
import { ZONAS } from "@/data/zonas";

export const metadata: Metadata = {
  title: { absolute: "Constructora industrial en Curicó y Maule | JURMAQ" },
  alternates: { canonical: url("/") },
  openGraph: { title: "Constructora industrial en Curicó y Maule | JURMAQ", url: url("/") },
};

export default function Inicio() {
  const principal = OBRAS_CON_FOTO[0];
  return (
    <>
      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@type": "GeneralContractor",
          "@id": ORGANIZACION_ID,
          name: EMPRESA.nombre,
          legalName: EMPRESA.razonSocial,
          taxID: EMPRESA.rut,
          url: SITIO_URL,
          telephone: EMPRESA.telefono,
          email: EMPRESA.correo,
          image: url("/og.jpg"),
          address: {
            "@type": "PostalAddress",
            streetAddress: EMPRESA.streetAddress,
            addressLocality: EMPRESA.comuna,
            addressRegion: EMPRESA.region,
            addressCountry: EMPRESA.pais,
          },
          areaServed: [
            { "@type": "AdministrativeArea", name: "Región del Maule" },
            { "@type": "AdministrativeArea", name: "Región de O'Higgins" },
          ],
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Servicios de construcción industrial",
            itemListElement: SERVICIOS.map((s) => ({
              "@type": "Offer",
              itemOffered: { "@type": "Service", name: s.nombre, url: url(`/servicios/${s.slug}`) },
            })),
          },
        }}
      />
      <section className="portada">
        <div className="contenedor">
          <div className="portada-texto">
            <h1>Constructora industrial en Curicó y la Región del Maule</h1>
            <p className="bajada">
              Desde 2000, obras civiles, maestranza y montaje dentro de plantas que siguen operando. Equipos con
              prevencionista de riesgos, supervisores y administrador de obra.
            </p>
            <div className="acciones">
              <Link href="/proyectos" className="boton">
                Ver proyectos
              </Link>
              <Link href="/cotizar-obra" className="boton boton-linea">
                Cotizar obra
              </Link>
            </div>
          </div>
          <figure className="portada-foto" style={{ margin: 0 }}>
            <Foto foto={principal.fotos[0]} sizes="(max-width: 1212px) 100vw, 1180px" prioridad />
            <figcaption className="pie-foto">
              {principal.titulo}, {principal.mandante}, {principal.comuna}
            </figcaption>
          </figure>
          <dl className="tira">
            <div>
              <dt>Miguel Torres</dt>
              <dd>Clientes desde 2000</dd>
            </div>
            <div>
              <dt>Cementos Biobío</dt>
              <dd>Clientes desde 2002</dd>
            </div>
            <div>
              <dt>Nestlé Chile</dt>
              <dd>Clientes desde 2017</dd>
            </div>
          </dl>
          <LogosClientes />
        </div>
      </section>

      <section className="seccion">
        <div className="contenedor">
          <div className="seccion-cabeza">
            <h2>Proyectos</h2>
            <Link href="/proyectos" className="enlace">
              Ver las {OBRAS.length} fichas
            </Link>
          </div>
          <div className="filas">
            {OBRAS_CON_FOTO.map((o) => (
              <FilaObra key={o.slug} obra={o} />
            ))}
          </div>
        </div>
      </section>

      <section className="seccion">
        <div className="contenedor">
          <div className="seccion-cabeza">
            <h2>Servicios</h2>
          </div>
          <div className="indice">
            {SERVICIOS.map((s) => (
              <Link key={s.slug} href={`/servicios/${s.slug}`}>
                <strong>{s.nombre}</strong>
              </Link>
            ))}
          </div>
          <p className="pie-foto" style={{ marginTop: 16 }}>
            Obras en{" "}
            {ZONAS.map((z, i) => (
              <span key={z.slug}>
                {i > 0 && ", "}
                <Link href={`/obras-civiles-en/${z.slug}`}>{z.nombre}</Link>
              </span>
            ))}{" "}
            y otras comunas del Maule y O&apos;Higgins.
          </p>
        </div>
      </section>
      <Cierre />
    </>
  );
}
