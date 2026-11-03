import type { Metadata } from "next";
import FormularioObra from "@/components/FormularioObra";
import Migas from "@/components/Migas";
import { EMPRESA, url } from "@/data/empresa";

const TITULO = "Cotizar obra civil o industrial";
const DESCRIPCION =
  "Cuéntanos el alcance de tu obra en la Región del Maule y te contactamos para revisar antecedentes y coordinar visita.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: url("/cotizar-obra") },
  openGraph: { title: TITULO, description: DESCRIPCION, url: url("/cotizar-obra") },
};

export default function CotizarObra() {
  return (
    <>
      <div className="contenedor cabeza-pagina">
        <Migas items={[{ nombre: "Cotizar obra", ruta: "/cotizar-obra" }]} />
        <h1>Cotiza tu obra</h1>
        <p className="bajada">
          Cuéntanos qué necesitas ejecutar. También puedes llamar al{" "}
          <a href={`tel:${EMPRESA.telefono}`}>{EMPRESA.telefonoVisible}</a> o escribir por{" "}
          <a href={EMPRESA.whatsapp}>WhatsApp</a>.
        </p>
      </div>
      <section className="seccion" style={{ paddingTop: 0 }}>
        <div className="contenedor">
          <FormularioObra />
        </div>
      </section>
    </>
  );
}
