import type { Metadata } from "next";
import Link from "next/link";
import Cifras from "@/components/Cifras";
import Flecha from "@/components/Flecha";
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

const ANTECEDENTES = ["Ubicación", "Planos disponibles", "Alcance", "Plazos previstos"];

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
          sameAs: ["https://www.instagram.com/jurmaq.cl"],
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
          <h1>
            Obras civiles e industriales <span>Curicó, Región del Maule</span>
          </h1>
        </div>
      </section>

      <section className="seccion">
        <div className="contenedor dos-columnas">
          <h2>La empresa</h2>
          <div className="texto">
            <p>
              Constructora JURMAQ ejecuta obras industriales, civiles y metalmecánicas para el sector agroindustrial,
              alimenticio y productivo.
            </p>
            <p>
              Desde 2000 trabajamos dentro de plantas en operación en O&apos;Higgins y el Maule, con prevencionista de
              riesgos, supervisores y administrador de obra.
            </p>
            <Link href="/nosotros" className="enlace">
              Conocer la empresa <Flecha />
            </Link>
          </div>
        </div>
      </section>

      <section className="banda-logos">
        <div className="contenedor">
          <LogosClientes />
        </div>
      </section>

      <section className="seccion">
        <div className="contenedor">
          <h2 className="sub">Especialidades</h2>
          <ol className="especialidades">
            {SERVICIOS.map((s, i) => (
              <li key={s.slug}>
                <Link href={`/servicios/${s.slug}`}>
                  <span className="numero">{String(i + 1).padStart(2, "0")}</span>
                  <strong>{s.nombre}</strong>
                  <span className="detalle">{s.resumen}</span>
                  <Flecha />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="destacada">
        <div className="destacada-foto">
          <Foto
            foto={{ nombre: "silos-armadura", alt: "Trabajadores amarrando la armadura circular de una fundación" }}
            sizes="(max-width: 860px) 100vw, 60vw"
          />
        </div>
        <div className="destacada-panel">
          <h2>Obras industriales en Teno</h2>
          <p>Fundaciones para silos, expansión de batcheo y molienda, montaje de equipos y pavimentos.</p>
          <dl>
            <div>
              <dt>Mandante</dt>
              <dd>Nestlé Chile S.A.</dd>
            </div>
            <div>
              <dt>Ubicación</dt>
              <dd>Teno, Región del Maule</dd>
            </div>
          </dl>
          <Link href="/obras-civiles-en/teno" className="enlace">
            Ver obras en Teno <Flecha />
          </Link>
        </div>
      </section>

      <section className="seccion">
        <div className="contenedor">
          <div className="seccion-cabeza">
            <h2>Experiencia</h2>
            <Link href="/proyectos" className="enlace">
              Ver todas las obras <Flecha />
            </Link>
          </div>
          <Mosaico obras={OBRAS_CON_FOTO} portada />
        </div>
      </section>

      <Cifras />

      <section className="seccion">
        <div className="contenedor recursos">
          <div>
            <h2 className="sub">Recursos propios</h2>
            <p>Lo que usamos en nuestras obras viene de la empresa y del grupo.</p>
            <ul className="lista">
              <li>Maestranza en Curicó para fabricación y soldadura</li>
              <li>Flota de maquinaria para movimiento de tierras y altura</li>
              <li>Barraca de Fierros JURMAQ en Molina para materiales</li>
            </ul>
          </div>
          <div>
            <h2 className="sub">Evaluación de proyectos</h2>
            <p>Partimos con una reunión técnica y preparamos la propuesta con ingeniería.</p>
            <ul className="lista">
              {ANTECEDENTES.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <div className="acciones">
              <Link href="/cotizar-obra" className="boton">
                Enviar proyecto <Flecha />
              </Link>
              <a href={EMPRESA.whatsapp} className="boton boton-linea">
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
