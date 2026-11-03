import Link from "next/link";
import Foto from "@/components/Foto";
import { EMPRESA } from "@/data/empresa";

export default function Cierre() {
  return (
    <section className="cierre foto-fondo">
      <Foto foto={{ nombre: "alero-bodega", alt: "" }} sizes="100vw" />
      <div className="contenedor cierre-texto">
        <h2>¿Tienes una obra en planta?</h2>
        <p>Cuéntanos el alcance y coordinamos la visita.</p>
        <div className="acciones">
          <Link href="/cotizar-obra" className="boton">
            Cotizar obra
          </Link>
          <a href={EMPRESA.whatsapp} className="boton boton-claro">
            WhatsApp
          </a>
          <a href={`tel:${EMPRESA.telefono}`} className="boton boton-claro">
            {EMPRESA.telefonoVisible}
          </a>
        </div>
      </div>
    </section>
  );
}
