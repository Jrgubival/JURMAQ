import Link from "next/link";
import { EMPRESA } from "@/data/empresa";

export default function Cierre() {
  return (
    <section className="cierre">
      <div className="contenedor">
        <div>
          <h2>¿Tienes una obra en planta?</h2>
          <p>Cuéntanos el alcance y coordinamos la visita. También por teléfono: {EMPRESA.telefonoVisible}</p>
        </div>
        <Link href="/cotizar-obra" className="boton">
          Cotizar obra
        </Link>
      </div>
    </section>
  );
}
