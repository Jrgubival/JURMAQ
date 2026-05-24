'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCLP } from '@jurmaq/shared/format';

type Periodo = 'hoy' | '7d' | '30d' | 'mes';

interface KpiDelta {
  actual: number;
  anterior: number;
  delta_pct: number | null;
}

interface DashboardData {
  periodo: Periodo;
  ventana: { desde: string; hasta: string };
  kpis: {
    ventas: KpiDelta;
    cotizaciones: KpiDelta;
    pedidos_pagados: KpiDelta;
    aov: number;
    conversion_pct: number;
    carritos_abandonados: number;
  };
  top_productos: Array<{ nombre: string; cantidad: number; revenue: number }>;
  top_cupones: Array<{ codigo: string; usos: number }>;
  generated_at: string;
}

const periodos: Array<{ key: Periodo; label: string }> = [
  { key: 'hoy', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: 'mes', label: 'Este mes' },
];

export default function DashboardBarracaPage() {
  const [periodo, setPeriodo] = useState<Periodo>('7d');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/dashboard?periodo=${periodo}`);
        if (!res.ok) {
          setError(`Error ${res.status}`);
          return;
        }
        const json = (await res.json()) as DashboardData;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [periodo]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard ventas</h1>
          <p className="text-sm text-gray-500 mt-1">KPIs reales con comparativa al período anterior.</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {periodos.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                periodo === p.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Cargando…</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard
              label="Ventas"
              value={formatCLP(data.kpis.ventas.actual)}
              delta={data.kpis.ventas.delta_pct}
              accent="text-green-700"
            />
            <KpiCard
              label="Cotizaciones"
              value={String(data.kpis.cotizaciones.actual)}
              delta={data.kpis.cotizaciones.delta_pct}
              accent="text-blue-700"
            />
            <KpiCard
              label="Pedidos pagados"
              value={String(data.kpis.pedidos_pagados.actual)}
              delta={data.kpis.pedidos_pagados.delta_pct}
              accent="text-purple-700"
            />
            <KpiCard
              label="Ticket promedio (AOV)"
              value={formatCLP(data.kpis.aov)}
              accent="text-orange-700"
            />
            <KpiCard
              label="Conversión"
              value={`${data.kpis.conversion_pct}%`}
              accent="text-teal-700"
            />
            <KpiCard
              label="Carritos abandonados"
              value={String(data.kpis.carritos_abandonados)}
              accent={data.kpis.carritos_abandonados > 0 ? 'text-amber-700' : 'text-gray-500'}
            />
          </div>

          {/* Top productos */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Top 5 productos por revenue</h2>
            </div>
            {data.top_productos.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">
                Sin ventas en este período.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-gray-600">Producto</th>
                    <th className="text-right px-4 py-2 font-semibold text-gray-600">Cantidad</th>
                    <th className="text-right px-4 py-2 font-semibold text-gray-600">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.top_productos.map((p, i) => (
                    <tr key={`${p.nombre}-${i}`}>
                      <td className="px-4 py-3 text-gray-900">
                        <span className="text-xs text-gray-500 mr-2">#{i + 1}</span>
                        {p.nombre}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.cantidad}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatCLP(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Top cupones */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Top 5 cupones usados</h2>
              <Link
                href="/admin/cupones"
                className="text-xs text-orange-600 hover:underline"
              >
                Gestionar cupones →
              </Link>
            </div>
            {data.top_cupones.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">
                Sin cupones usados en este período.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-gray-600">Código</th>
                    <th className="text-right px-4 py-2 font-semibold text-gray-600">Usos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.top_cupones.map((c) => (
                    <tr key={c.codigo}>
                      <td className="px-4 py-3 font-mono font-medium text-gray-900">{c.codigo}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.usos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <p className="text-xs text-gray-500 text-right">
            Período: {new Date(data.ventana.desde).toLocaleDateString('es-CL')} →{' '}
            {new Date(data.ventana.hasta).toLocaleDateString('es-CL')} · Generado:{' '}
            {new Date(data.generated_at).toLocaleString('es-CL')}
          </p>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  accent,
}: {
  label: string;
  value: string;
  delta?: number | null;
  accent: string;
}) {
  const showDelta = typeof delta === 'number';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold tabular-nums ${accent}`}>{value}</div>
      {showDelta && delta !== null && (
        <div
          className={`mt-1 text-xs font-medium ${
            delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-500'
          }`}
        >
          {delta > 0 ? '↗' : delta < 0 ? '↘' : '→'} {delta}% vs período anterior
        </div>
      )}
    </div>
  );
}
