import type { Metadata } from 'next';
import Link from 'next/link';
import { supabasePublic } from '@jurmaq/shared/supabase';

/**
 * /maestros — Ranking público de Maestros JURMAQ.
 *
 * Diferenciador: ningún competidor (Sodimac, Easy, Construmart, Prodalam, MTS)
 * tiene un sistema de afiliados / community con ranking público de obreros.
 * Esto convierte a los maestros en mini-influencers locales que comparten su
 * código a clientes, ganan comisión, y suben en el ranking público.
 */

export const metadata: Metadata = {
  title: 'Ranking de Maestros · JURMAQ Barraca',
  description:
    'Conoce a los maestros constructores de la Región del Maule que recomiendan JURMAQ Barraca. Ranking público con perfiles verificados, número de obras referidas y reviews de clientes reales.',
  alternates: { canonical: 'https://barraca.jurmaq.cl/maestros' },
  openGraph: {
    title: 'Ranking de Maestros JURMAQ',
    description:
      'Los maestros constructores top de la Región del Maule. Si te recomendaron por un maestro, ingresa su código en checkout para apoyarlo.',
    url: 'https://barraca.jurmaq.cl/maestros',
  },
};

interface MaestroRow {
  codigo: string;
  nombre: string;
  porcentaje_comision: number;
  created_at: string;
  // Conteos derivados (subselect)
  total_referidos?: number;
  total_comisiones?: number;
}

async function getTopMaestros(limit = 20): Promise<MaestroRow[]> {
  // Trae maestros activos. El conteo de referidos requiere agregación, así
  // que hacemos query custom. Si la tabla no existe aún (deploy temprano),
  // devolvemos array vacío y la page muestra el empty state CTA "Sé tú el
  // primer maestro registrado".
  try {
    const { data, error } = await supabasePublic
      .from('maestros')
      .select('codigo, nombre, porcentaje_comision, created_at')
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];

    // Para cada maestro, contar comisiones devengadas + pagadas (= obras concretadas)
    const enriched = await Promise.all(
      data.map(async (m: any) => {
        const { count } = await supabasePublic
          .from('comisiones_maestro')
          .select('id', { count: 'exact', head: true })
          .eq('maestro_id', m.id)
          .in('estado', ['devengada', 'pagada']);
        return { ...m, total_referidos: count || 0 };
      }),
    );
    // Re-order by total_referidos desc
    return enriched.sort((a, b) => (b.total_referidos || 0) - (a.total_referidos || 0));
  } catch {
    return [];
  }
}

function ordinalBadge(pos: number): string {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return `#${pos}`;
}

export default async function MaestrosIndexPage() {
  const maestros = await getTopMaestros(20);
  const hasMaestros = maestros.length > 0;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Ranking de Maestros JURMAQ',
    description: 'Maestros constructores recomendados de la Región del Maule.',
    numberOfItems: maestros.length,
    itemListElement: maestros.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Person',
        name: m.nombre,
        url: `https://barraca.jurmaq.cl/maestros/${m.codigo}`,
        identifier: m.codigo,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/10 border border-orange-500/30 rounded-full mb-6">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-orange-300 uppercase tracking-wider">
              Único en Chile
            </span>
          </div>
          <h1 className="text-4xl lg:text-6xl font-extrabold text-white mb-4 leading-tight">
            Maestros que recomiendan <span className="text-orange-500">JURMAQ</span>
          </h1>
          <p className="text-lg lg:text-xl text-gray-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            Conoce a los maestros constructores de la Región del Maule que confían en nosotros.
            Cuando compras por su código, ellos ganan comisión y tú apoyas a tu maestro de confianza.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://wa.me/56976673577?text=Hola%2C%20quiero%20registrarme%20como%20maestro%20de%20JURMAQ"
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-colors"
            >
              💬 Quiero ser Maestro JURMAQ
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
            <Link
              href="/maestros#como-funciona"
              className="inline-flex items-center gap-2 px-7 py-3.5 border-2 border-white/30 hover:border-orange-500 text-white hover:text-orange-400 font-semibold rounded-xl transition-colors"
            >
              ¿Cómo funciona?
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-orange-500 py-8">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-3 gap-4 text-center text-navy-950">
          <div>
            <div className="text-3xl lg:text-4xl font-extrabold tabular-nums">{maestros.length}</div>
            <div className="text-xs uppercase tracking-wider font-semibold">Maestros activos</div>
          </div>
          <div>
            <div className="text-3xl lg:text-4xl font-extrabold tabular-nums">1%</div>
            <div className="text-xs uppercase tracking-wider font-semibold">Comisión por obra</div>
          </div>
          <div>
            <div className="text-3xl lg:text-4xl font-extrabold tabular-nums">$0</div>
            <div className="text-xs uppercase tracking-wider font-semibold">Costo para inscribirse</div>
          </div>
        </div>
      </section>

      {/* Ranking */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 lg:mb-12">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-navy-950 mb-2">
              Ranking público
            </h2>
            <p className="text-gray-600">
              Ordenados por número de obras referidas. Los top 3 reciben kit JURMAQ trimestral.
            </p>
          </div>

          {hasMaestros ? (
            <div className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {maestros.map((m, i) => (
                <Link
                  key={m.codigo}
                  href={`/maestros/${m.codigo}`}
                  className="group flex items-center gap-4 lg:gap-6 px-4 lg:px-6 py-4 hover:bg-orange-50 transition-colors"
                >
                  <div className="text-2xl lg:text-3xl font-extrabold w-12 lg:w-16 text-center shrink-0">
                    {ordinalBadge(i + 1)}
                  </div>
                  <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-navy-900 to-navy-700 flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {m.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base lg:text-lg font-bold text-navy-950 group-hover:text-orange-600 transition-colors truncate">
                      {m.nombre}
                    </h3>
                    <p className="text-xs lg:text-sm text-gray-500 font-mono">{m.codigo}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl lg:text-2xl font-extrabold text-orange-600 tabular-nums">
                      {m.total_referidos || 0}
                    </div>
                    <div className="text-[10px] lg:text-xs text-gray-500 uppercase tracking-wider">
                      obras
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-orange-600 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-dashed border-orange-300 rounded-2xl p-8 lg:p-12 text-center">
              <div className="text-6xl mb-4">👷</div>
              <h3 className="text-2xl font-bold text-navy-950 mb-3">
                ¡Sé el primer Maestro JURMAQ!
              </h3>
              <p className="text-gray-700 max-w-lg mx-auto mb-6 leading-relaxed">
                Aún no tenemos maestros registrados en esta lista. Si construyes obras y quieres
                ganar el 1% de cada compra que refieras a tus clientes, escríbenos por WhatsApp.
              </p>
              <a
                href="https://wa.me/56976673577?text=Hola%2C%20quiero%20ser%20el%20primer%20maestro%20JURMAQ"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-colors"
              >
                💬 Inscribirme primero
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="py-16 lg:py-20 bg-gray-50 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-navy-950 mb-3 text-center">
            ¿Cómo funciona el programa?
          </h2>
          <p className="text-lg text-gray-600 text-center max-w-2xl mx-auto mb-12">
            En 3 pasos te conviertes en Maestro JURMAQ y empiezas a ganar comisiones.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                n: '01',
                title: 'Te registras gratis',
                desc: 'Envías tus datos (nombre, RUT, cuenta bancaria) por WhatsApp. Te aprobamos en 24h y te asignamos tu código MAE-2026-XXX.',
                icon: '📝',
              },
              {
                n: '02',
                title: 'Compartes tu código',
                desc: 'Tu link personal: barraca.jurmaq.cl/maestros/MAE-2026-XXX. Lo compartes con tus clientes. Cuando pagan, ingresan el código y listo.',
                icon: '🔗',
              },
              {
                n: '03',
                title: 'Cobras tu 1%',
                desc: 'Recibes el 1% del neto de cada compra. Pagos mensuales a tu cuenta bancaria. Sin tope. Sin letra chica. Sin compras mínimas.',
                icon: '💰',
              },
            ].map((step) => (
              <div
                key={step.n}
                className="relative bg-white border border-gray-200 rounded-2xl p-6 lg:p-8 hover:border-orange-500/50 transition-colors"
              >
                <span className="absolute top-4 right-4 text-6xl font-black text-navy-950/5 leading-none select-none">
                  {step.n}
                </span>
                <div className="text-5xl mb-4">{step.icon}</div>
                <h3 className="text-xl font-bold text-navy-950 mb-3">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ + CTA final */}
      <section className="py-16 lg:py-20 bg-navy-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-4">
            ¿Eres maestro? Esto es para ti.
          </h2>
          <p className="text-lg text-gray-300 mb-8 leading-relaxed">
            Ningún competidor en Chile le paga a los maestros por recomendar. Nosotros sí.
            Porque sabemos que tú eres quien decide qué se compra en la obra.
          </p>
          <a
            href="https://wa.me/56976673577?text=Hola%2C%20quiero%20registrarme%20como%20maestro%20JURMAQ"
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-2 px-8 py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-base lg:text-lg rounded-xl transition-colors"
          >
            💬 Registrarme ahora
          </a>
          <p className="text-sm text-gray-400 mt-4">
            Te respondemos en menos de 2 horas en horario hábil
          </p>
        </div>
      </section>
    </>
  );
}
