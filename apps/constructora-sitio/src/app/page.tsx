import type { Metadata } from "next";
import Link from "next/link";
import Cierre from "@/components/Cierre";
import Cifras from "@/components/Cifras";
import Foto from "@/components/Foto";
import JsonLd from "@/components/JsonLd";
import LogosClientes from "@/components/LogosClientes";
import Mosaico from "@/components/Mosaico";
import { EMPRESA, ORGANIZACION_ID, SITIO_URL, url } from "@/data/empresa";
import { OBRAS_CON_FOTO } from "@/data/obras";
import { SERVICIOS } from "@/data/servicios";

const TITULO = "Constructora industrial en Curicó y Maule | JURMAQ";

export const metadata: Metadata = {
  title: { absolute: TITULO },
  alternates: { canonical: url("/") },
  openGraph: { title: TITULO, url: url("/") },
};

const EQUIPO = ["Prevencionista de riesgos", "Supervisores de terreno", "Administrador de obra"];

export default function Inicio() {
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

      <section className="hero foto-fondo">
        <Foto
          foto={{ nombre: "silos-general", alt: "Armadura de fundación junto a tres silos en la planta de Teno" }}
          sizes="100vw"
          prioridad
        />
        <div className="contenedor hero-texto">
          <h1>Constructora industrial en Curicó y el Maule</h1>
          <p className="bajada">Obras civiles, maestranza y montaje dentro de plantas que siguen operando.</p>
          <div className="acciones">
            <Link href="/proyectos" className="boton">
              Ver proyectos
            </Link>
            <Link href="/cotizar-obra" className="boton boton-claro">
              Cotizar obra
            </Link>
          </div>
        </div>
      </section>

      <section className="banda-logos">
        <div className="contenedor">
          <LogosClientes />
        </div>
      </section>

      <Cifras />

      <section className="seccion">
        <div className="contenedor">
          <div className="seccion-cabeza">
            <h2>Proyectos</h2>
            <Link href="/proyectos" className="enlace">
              Ver todos los proyectos
            </Link>
          </div>
          <Mosaico obras={OBRAS_CON_FOTO} portada />
        </div>
      </section>

      <section className="servicios">
        <div className="contenedor servicios-grilla">
          <h2>Servicios</h2>
          <ul>
            {SERVICIOS.map((s) => (
              <li key={s.slug}>
                <Link href={`/servicios/${s.slug}`}>{s.nombre}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="equipo">
        <div className="equipo-foto">
          <Foto
            foto={{ nombre: "revestimiento-brazo", alt: "Brazo articulado junto a la fachada de una ampliación" }}
            sizes="(max-width: 860px) 100vw, 50vw"
          />
        </div>
        <div className="equipo-texto">
          <h2>Equipos completos en cada obra</h2>
          <ul>
            {EQUIPO.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <Link href="/nosotros" className="enlace">
            Cómo trabajamos
          </Link>
        </div>
      </section>

      <Cierre />
    </>
  );
}
