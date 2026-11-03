import type { Metadata } from "next";
import CabezaPagina from "@/components/CabezaPagina";
import FormularioObra from "@/components/FormularioObra";
import { EMPRESA, url } from "@/data/empresa";

const TITULO = "Cotizar obra civil o industrial";
const DESCRIPCION =
  "Cuéntanos el alcance de tu obra civil o industrial en la Región del Maule y te contactamos para revisar antecedentes y coordinar una visita.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: url("/cotizar-obra") },
  openGraph: { title: TITULO, description: DESCRIPCION, url: url("/cotizar-obra") },
};

export default function CotizarObra() {
  return (
    <>
      <CabezaPagina
        migas={[{ nombre: "Enviar proyecto", ruta: "/cotizar-obra" }]}
        titulo="Enviar proyecto"
        bajada="Indícanos ubicación, planos disponibles, alcance y plazos previstos."
      />
      <section className="seccion">
        <div className="contenedor ficha-grilla">
          <FormularioObra />
          <dl className="ficha">
            <div>
              <dt>Teléfono</dt>
              <dd>
                <a href={`tel:${EMPRESA.telefono}`}>{EMPRESA.telefonoVisible}</a>
              </dd>
            </div>
            <div>
              <dt>WhatsApp</dt>
              <dd>
                <a href={EMPRESA.whatsapp} className="boton">
                  Escribir por WhatsApp
                </a>
              </dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>
                <a href={`mailto:${EMPRESA.correo}`}>{EMPRESA.correo}</a>
              </dd>
            </div>
            <div>
              <dt>Dirección</dt>
              <dd>{EMPRESA.direccion}</dd>
            </div>
          </dl>
        </div>
      </section>
    </>
  );
}
