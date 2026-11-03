import Link from "next/link";
import { SERVICIOS } from "@/data/servicios";
import { ZONAS } from "@/data/zonas";
import { EMPRESA } from "@/data/empresa";

export default function Pie() {
  return (
    <footer className="pie">
      <div className="contenedor">
        <div className="pie-columnas">
          <div>
            <h2>{EMPRESA.nombre}</h2>
            <p>{EMPRESA.direccion}</p>
            <p>
              <a href={`tel:${EMPRESA.telefono}`}>{EMPRESA.telefonoVisible}</a> ·{" "}
              <a href={`mailto:${EMPRESA.correo}`}>{EMPRESA.correo}</a>
            </p>
          </div>
          <div>
            <h2>Servicios</h2>
            <ul>
              {SERVICIOS.slice(0, 4).map((s) => (
                <li key={s.slug}>
                  <Link href={`/servicios/${s.slug}`}>{s.corto}</Link>
                </li>
              ))}
              <li>
                <Link href="/servicios">Ver todos</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>Grupo JURMAQ</h2>
            <ul>
              <li>
                <a href="https://jurmaq.cl">jurmaq.cl</a>
              </li>
              <li>
                <a href="https://barraca.jurmaq.cl">Barraca de Fierros</a>
              </li>
              <li>
                <a href="https://jurmaq.cl/maquinarias">Arriendo de maquinaria</a>
              </li>
            </ul>
            <h2 style={{ marginTop: 16 }}>Zonas</h2>
            <ul>
              {ZONAS.map((z) => (
                <li key={z.slug}>
                  <Link href={`/obras-civiles-en/${z.slug}`}>{z.nombre}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="legal">
          © {new Date().getFullYear()} {EMPRESA.razonSocial} · RUT {EMPRESA.rut} ·{" "}
          <a href="https://jurmaq.cl/privacidad">Privacidad</a> · <a href="https://jurmaq.cl/terminos">Términos</a>
        </p>
      </div>
    </footer>
  );
}
