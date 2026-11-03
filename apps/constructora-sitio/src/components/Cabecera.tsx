"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { ruta: "/servicios", nombre: "Servicios" },
  { ruta: "/proyectos", nombre: "Proyectos" },
  { ruta: "/nosotros", nombre: "Nosotros" },
];

export default function Cabecera() {
  const ruta = usePathname();
  return (
    <header className="cabecera">
      <div className="contenedor cabecera-fila">
        <Link href="/" className="marca">
          <strong>JURMAQ</strong>
          <span>Constructora</span>
        </Link>
        <nav className="nav" aria-label="Principal">
          {ENLACES.map((e) => (
            <Link key={e.ruta} href={e.ruta} aria-current={ruta.startsWith(e.ruta) ? "page" : undefined}>
              {e.nombre}
            </Link>
          ))}
        </nav>
        <Link href="/cotizar-obra" className="boton boton-chico">
          Cotizar obra
        </Link>
        {/* Sin JavaScript: el menú celular es un <details> y sus enlaces recargan para cerrarlo. */}
        <details className="menu">
          <summary>Menú</summary>
          <nav aria-label="Menú">
            {ENLACES.map((e) => (
              <a key={e.ruta} href={e.ruta}>
                {e.nombre}
              </a>
            ))}
            <a href="/cotizar-obra">Cotizar obra</a>
          </nav>
        </details>
      </div>
    </header>
  );
}
