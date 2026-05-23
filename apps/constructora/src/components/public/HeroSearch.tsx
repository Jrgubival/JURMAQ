'use client';

import { useRouter } from 'next/navigation';
import { useState, FormEvent } from 'react';

/**
 * Barra de búsqueda destacada para hero del home.
 * Combina input libre + selector de tipo + CTA. Al submit redirige a
 * /maquinarias con query params.
 */

const TIPOS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'retroexcavadora', label: 'Retroexcavadora' },
  { value: 'miniexcavadora', label: 'Miniexcavadora' },
  { value: 'brazo_articulado', label: 'Brazo articulado' },
  { value: 'grua', label: 'Grúa' },
  { value: 'camion', label: 'Camión tolva' },
  { value: 'rodillo', label: 'Rodillo' },
];

export default function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (tipo) params.set('tipo', tipo);
    if (q.trim()) params.set('q', q.trim());
    const qs = params.toString();
    router.push(`/maquinarias${qs ? `?${qs}` : ''}`);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white/95 backdrop-blur-sm rounded-2xl p-2 lg:p-3 shadow-2xl flex flex-col lg:flex-row gap-2 lg:gap-3 max-w-3xl"
    >
      {/* Input texto */}
      <div className="flex-1 flex items-center gap-3 px-4 py-3 lg:py-0">
        <svg
          className="w-5 h-5 text-gray-400 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="¿Qué máquina necesitas? Ej: retro, mini, brazo…"
          className="w-full bg-transparent text-navy-950 placeholder-gray-400 text-sm lg:text-base focus:outline-none"
          aria-label="Buscar maquinaria"
        />
      </div>

      {/* Separator */}
      <div className="hidden lg:block w-px bg-gray-200" />

      {/* Select tipo */}
      <div className="flex items-center px-3 py-2 lg:py-0">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="w-full lg:w-48 bg-transparent text-navy-950 text-sm lg:text-base focus:outline-none cursor-pointer"
          aria-label="Filtrar por tipo"
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-sm lg:text-base rounded-xl transition-colors"
      >
        Buscar
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M17 8l4 4m0 0l-4 4m4-4H3"
          />
        </svg>
      </button>
    </form>
  );
}
