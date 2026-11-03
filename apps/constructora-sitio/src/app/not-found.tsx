import Link from "next/link";

export default function NoEncontrada() {
  return (
    <div className="contenedor cabeza-pagina">
      <h1>No encontramos esta página</h1>
      <p className="bajada">
        Revisa <Link href="/proyectos">los proyectos</Link> o <Link href="/servicios">los servicios</Link>.
      </p>
    </div>
  );
}
