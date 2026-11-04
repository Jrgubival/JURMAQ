import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { COMUNAS } from '@/data/comunas';
import { distanciaDesdeBase } from '@/lib/landings';

const GRUPOS = [
  { titulo: 'Cerca de la base', detalle: 'Hasta 30 km', desde: 0, hasta: 30 },
  { titulo: 'Distancia media', detalle: 'Entre 30 y 100 km', desde: 30, hasta: 100 },
  { titulo: 'Más lejos', detalle: 'Sobre 100 km', desde: 100, hasta: Infinity },
];

/** Comunas agrupadas por distancia desde Maquehua, Curicó. */
export default function TarjetasComunas() {
  const conKm = COMUNAS.map((c) => ({ ...c, km: distanciaDesdeBase(c.slug)?.km ?? null })).sort((a, b) => (a.km ?? 999) - (b.km ?? 999));
  return (
    <div className="space-y-12">
      {GRUPOS.map((g) => {
        const lista = conKm.filter((c) => c.km !== null && c.km >= g.desde && c.km < g.hasta);
        if (lista.length === 0) return null;
        return (
          <div key={g.titulo}>
            <h3 className="text-2xl">{g.titulo}</h3>
            <p className="mt-1 text-[0.9375rem] text-ink-muted">{g.detalle}</p>
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((c) => (
                <li key={c.slug}>
                  <Link href={`/arriendo-en/${c.slug}`} prefetch={false} className="tarjeta presionable fila-trabajo flex h-full flex-col p-6 md:p-8">
                    <span className="flex items-start justify-between gap-4">
                      <span className="font-titulo text-2xl">{c.nombre}</span>
                      <span className="shrink-0 rounded-full bg-[#f4f5f7] px-3 py-1 text-sm font-medium text-ink-soft">a {c.km} km</span>
                    </span>
                    <span className="mt-2 line-clamp-2 text-[0.9375rem] text-ink-soft">{c.trabajos[0]}</span>
                    <span className="mt-auto flex items-center gap-2 pt-6 text-[0.9375rem] font-semibold text-acento-texto">Ver arriendo en {c.nombre} <ArrowRight size={18} weight="bold" className="flecha" aria-hidden /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
