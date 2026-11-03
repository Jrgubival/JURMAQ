import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { url } from "@/data/empresa";

export interface Miga {
  nombre: string;
  ruta: string;
}

/** Migas visibles y su BreadcrumbList. La página actual va última, sin enlace. */
export default function Migas({ items }: { items: Miga[] }) {
  const todas = [{ nombre: "Inicio", ruta: "/" }, ...items];
  return (
    <nav className="migas" aria-label="Migas de pan">
      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: todas.map((m, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: m.nombre,
            item: url(m.ruta),
          })),
        }}
      />
      <ol>
        {todas.map((m, i) => (
          <li key={m.ruta}>
            {i < todas.length - 1 ? <Link href={m.ruta}>{m.nombre}</Link> : <span aria-current="page">{m.nombre}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
