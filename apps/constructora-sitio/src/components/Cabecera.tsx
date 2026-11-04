"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CabeceraGrupo } from "@jurmaq/shared/ui/grupo";

const ENLACES = [
  { href: "/nosotros", texto: "Empresa" },
  { href: "/servicios", texto: "Especialidades" },
  { href: "/proyectos", texto: "Experiencia" },
  { href: "#contacto", texto: "Contacto" },
];

/** Cabecera del grupo. Elegir un enlace cierra el menú celular, que es un <details>. */
export default function Cabecera() {
  const ruta = usePathname();
  const actual = ENLACES.find((e) => ruta.startsWith(e.href))?.href;
  return (
    <div
      className="cabecera"
      onClick={(e) => {
        const menu = (e.target as HTMLElement).closest("a")?.closest("details");
        menu?.removeAttribute("open");
      }}
    >
      <CabeceraGrupo negocio="Constructora" enlaces={ENLACES} actual={actual} Enlace={Link}>
        <Link href="/cotizar-obra" className="boton boton-chico">
          Enviar proyecto
        </Link>
      </CabeceraGrupo>
    </div>
  );
}
