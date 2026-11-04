import Link from "next/link";
import { NEGOCIOS, PieGrupo } from "@jurmaq/shared/ui/grupo";
import { EMPRESA } from "@/data/empresa";
import { SERVICIOS } from "@/data/servicios";
import { ZONAS } from "@/data/zonas";

const COLUMNAS = [
  {
    titulo: "Especialidades",
    enlaces: [
      ...SERVICIOS.slice(0, 4).map((s) => ({ href: `/servicios/${s.slug}`, texto: s.corto })),
      { href: "/servicios", texto: "Ver todas" },
    ],
  },
  {
    titulo: "Zonas y contacto",
    enlaces: [
      ...ZONAS.map((z) => ({ href: `/obras-civiles-en/${z.slug}`, texto: `Obras en ${z.nombre}` })),
      { href: EMPRESA.whatsapp, texto: "WhatsApp" },
    ],
  },
  {
    titulo: "Grupo JURMAQ",
    enlaces: [
      { href: "https://jurmaq.cl", texto: "jurmaq.cl" },
      { href: NEGOCIOS.barraca.url, texto: "Barraca de Fierros" },
      { href: "https://jurmaq.cl/maquinarias", texto: "Arriendo de maquinaria" },
    ],
  },
];

export default function Pie() {
  return (
    <div id="contacto">
      <PieGrupo
        negocio="Constructora"
        texto="Obras civiles e industriales en Curicó y la Región del Maule."
        telefono={EMPRESA.telefono}
        telefonoDisplay={EMPRESA.telefonoVisible}
        correo={EMPRESA.correo}
        direccion={EMPRESA.direccion}
        columnas={COLUMNAS}
        legal={[`© ${new Date().getFullYear()} ${EMPRESA.razonSocial}`, `RUT ${EMPRESA.rut}`]}
        enlacesLegales={[
          { href: "https://jurmaq.cl/privacidad", texto: "Privacidad" },
          { href: "https://jurmaq.cl/terminos", texto: "Términos" },
        ]}
        Enlace={Link}
      />
    </div>
  );
}
