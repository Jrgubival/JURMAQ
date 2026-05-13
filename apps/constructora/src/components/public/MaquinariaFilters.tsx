"use client";

import { useRouter } from "next/navigation";

const TIPO_LABELS: Record<string, string> = {
  retroexcavadora: "Retroexcavadoras",
  miniexcavadora: "Miniexcavadora",
  brazo_articulado: "Brazo Articulado",
  alzahombre: "Alzahombres",
  minicargador: "Minicargadores",
  camion: "Camiones",
  grua: "Grúa",
  rodillo: "Rodillo",
  otro: "Otro",
};

interface MaquinariaFiltersProps {
  types: string[];
  currentType: string;
}

export function MaquinariaFilters({
  types,
  currentType,
}: MaquinariaFiltersProps) {
  const router = useRouter();

  function handleFilter(tipo: string) {
    if (tipo === "") {
      router.push("/maquinarias");
    } else {
      router.push(`/maquinarias?tipo=${tipo}`);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 mb-8">
      <button
        onClick={() => handleFilter("")}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          currentType === ""
            ? "bg-navy-950 text-white"
            : "bg-white text-gray-600 border border-gray-200 hover:border-navy-950 hover:text-navy-950"
        }`}
      >
        Todos
      </button>
      {types.map((tipo) => (
        <button
          key={tipo}
          onClick={() => handleFilter(tipo)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            currentType === tipo
              ? "bg-navy-950 text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:border-navy-950 hover:text-navy-950"
          }`}
        >
          {TIPO_LABELS[tipo] || tipo}
        </button>
      ))}
    </div>
  );
}
