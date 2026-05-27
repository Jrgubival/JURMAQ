"use client"

import { useRouter, useSearchParams } from 'next/navigation';

const SORT_OPTIONS = [
  { value: 'destacado', label: 'Destacados primero' },
  { value: 'precio_asc', label: 'Precio: menor a mayor' },
  { value: 'precio_desc', label: 'Precio: mayor a menor' },
  { value: 'nombre', label: 'Nombre (A-Z)' },
  { value: 'recientes', label: 'Más recientes' },
];

interface Props {
  current: string;
}

export default function MaquinariaSort({ current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (value && value !== 'destacado') {
      params.set('sort', value);
    } else {
      params.delete('sort');
    }
    const qs = params.toString();
    router.push(`/maquinarias${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort-select" className="text-sm text-gray-600 hidden sm:inline">
        Ordenar por:
      </label>
      <div className="relative">
        <select
          id="sort-select"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none pl-3 pr-9 py-2 text-sm font-medium text-navy-950 bg-white border border-gray-200 rounded-lg hover:border-navy-950 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 cursor-pointer"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
