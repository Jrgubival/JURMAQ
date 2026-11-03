import Link from "next/link";

export default function Cabecera() {
  return (
    <header className="cabecera">
      <div className="contenedor">
        <Link href="/" className="marca">
          <strong>JURMAQ</strong>
          <span>Constructora</span>
        </Link>
        <nav className="nav" aria-label="Principal">
          <Link href="/servicios">Servicios</Link>
          <Link href="/proyectos">Proyectos</Link>
          <Link href="/nosotros">Nosotros</Link>
          <Link href="/cotizar-obra" className="boton">
            Cotizar obra
          </Link>
        </nav>
      </div>
    </header>
  );
}
