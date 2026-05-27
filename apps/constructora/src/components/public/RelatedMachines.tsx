import Link from 'next/link';
import Image from 'next/image';
import { supabasePublic } from '@jurmaq/shared/supabase';
import { formatCLP } from '@jurmaq/shared/format';
import { precioPublicoDesde } from '@/lib/pricing-arriendo';
import { maquinariaHref } from '@/lib/maquinaria-slug';

interface Props {
  currentId: number;
  tipo: string;
}

function getTipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    retroexcavadora: 'Retroexcavadora',
    miniexcavadora: 'Miniexcavadora',
    brazo_articulado: 'Brazo Articulado',
    grua: 'Grúa',
    camion: 'Camión',
    rodillo: 'Rodillo',
    otro: 'Otro',
  };
  return labels[tipo] || tipo;
}

export default async function RelatedMachines({ currentId, tipo }: Props) {
  // 1. Mismo tipo, excluyendo la actual
  const { data: sameType } = await supabasePublic
    .from('maquinarias')
    .select('*')
    .eq('tipo', tipo)
    .neq('id', currentId)
    .eq('estado', 'disponible')
    .limit(3);

  // 2. Si hay menos de 3, completar con otras disponibles de cualquier tipo
  let related = sameType || [];
  if (related.length < 3) {
    const ids = [currentId, ...related.map((m) => m.id)];
    const { data: fallback } = await supabasePublic
      .from('maquinarias')
      .select('*')
      .eq('estado', 'disponible')
      .not('id', 'in', `(${ids.join(',')})`)
      .limit(3 - related.length);
    related = [...related, ...(fallback || [])];
  }

  if (related.length === 0) return null;

  return (
    <section className="py-12 lg:py-16 bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-navy-950 mb-2">
              Otras máquinas que podrían servirte
            </h2>
            <p className="text-gray-600">
              Equipos similares disponibles para arriendo inmediato.
            </p>
          </div>
          <Link
            href="/maquinarias"
            className="hidden lg:inline-flex items-center gap-2 text-sm font-semibold text-gold-600 hover:text-gold-700 transition-colors"
          >
            Ver todo el catálogo
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {related.map((m) => {
            const desde = precioPublicoDesde(m);
            return (
              <Link
                key={m.id}
                href={maquinariaHref(m)}
                className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-gold-500/60 hover:shadow-md transition-all"
              >
                <div className="relative h-44 bg-gradient-to-br from-navy-900 to-navy-800 flex items-center justify-center overflow-hidden">
                  {m.imagen ? (
                    <Image
                      src={m.imagen}
                      alt={m.nombre}
                      width={500}
                      height={176}
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <svg className="w-16 h-16 text-navy-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  <div className="absolute bottom-3 left-3">
                    <span className="px-2.5 py-1 text-xs font-medium text-white bg-navy-950/70 backdrop-blur-sm rounded-lg">
                      {getTipoLabel(m.tipo)}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-base font-bold text-navy-950 mb-2 group-hover:text-gold-600 transition-colors line-clamp-1">
                    {m.nombre}
                  </h3>
                  <div className="flex items-baseline justify-between">
                    {desde !== null ? (
                      <>
                        <span className="text-xs text-gray-500">Desde</span>
                        <span className="text-lg font-extrabold text-navy-950">
                          {formatCLP(desde)}<span className="text-xs font-medium text-gray-500">/día</span>
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-500">Consultar precio</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 lg:hidden text-center">
          <Link
            href="/maquinarias"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gold-600"
          >
            Ver todo el catálogo
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
