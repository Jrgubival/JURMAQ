"use client";

import { useRouter } from "next/navigation";

/**
 * "Ordenar por" como desplegable compacto, alineado a la derecha de la barra
 * de resultados. Antes eran cuatro píldoras que se partían en dos líneas al
 * lado del título de la categoría; el dueño lo vio y lo rechazó. Sodimac,
 * Easy y Prodalam usan un <select> de una línea, y con razón: es un control
 * que se toca una vez por visita y no merece 40% del ancho de la cabecera.
 */
const OPCIONES = [
  { value: "nombre", label: "Nombre (A-Z)" },
  { value: "precio_asc", label: "Precio: menor a mayor" },
  { value: "precio_desc", label: "Precio: mayor a menor" },
  { value: "stock_desc", label: "Mayor disponibilidad" },
];

export default function OrdenarSelect({
  actual,
  slug,
  extra,
}: {
  actual: string;
  slug: string;
  /** Filtros vigentes que hay que conservar al cambiar el orden. */
  extra: { min?: string; max?: string; stock?: string };
}) {
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
      <span className="whitespace-nowrap">Ordenar por</span>
      <select
        value={actual}
        onChange={(e) => {
          const q = new URLSearchParams();
          q.set("sort", e.target.value);
          if (extra.min) q.set("min", extra.min);
          if (extra.max) q.set("max", extra.max);
          if (extra.stock) q.set("stock", extra.stock);
          router.push(`/categorias/${slug}?${q.toString()}`);
        }}
        className="h-10 pl-3 pr-8 text-sm font-medium text-navy-950 bg-white border border-gray-300 rounded-md hover:border-navy-950 focus:outline-none focus:ring-2 focus:ring-marca-500 transition-colors duration-150 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23111%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-no-repeat bg-[right_0.6rem_center]"
      >
        {OPCIONES.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
