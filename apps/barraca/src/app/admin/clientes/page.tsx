"use client"

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Cliente {
  id: number;
  nombre: string | null;
  email: string;
  telefono: string | null;
  empresa: string | null;
  rut: string | null;
  created_at: string;
  total_cotizaciones: number;
  total_pagadas: number;
  ltv: number;
  ultima_compra_at: string | null;
  ultima_actividad_at: string | null;
}

interface Resumen {
  total: number;
  ltv_total: number;
  promedio_ltv: number;
}

/**
 * /admin/clientes — Customer 360 lista (Tier 4 D4).
 *
 * Búsqueda + segmentos (todos / activos / nuevos / inactivos) + tabla
 * ordenada por LTV. Cada fila linkea a /admin/clientes/[id] con el 360.
 */
export default function ClientesAdminPage() {
  const [items, setItems] = useState<Cliente[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [q, setQ] = useState('');
  const [segmento, setSegmento] = useState<'todos' | 'activos' | 'nuevos' | 'inactivos'>('todos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, segmento]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim().length >= 2) params.set('q', q.trim());
    params.set('segmento', segmento);

    const res = await fetch(`/api/admin/clientes?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      setResumen(data.resumen || null);
    }
    setLoading(false);
  }

  const fmt = (n: number) => `$${Number(n).toLocaleString('es-CL')}`;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clientes — Customer 360</h1>
        <p className="text-sm text-gray-500">
          Vista agregada por cliente registrado: LTV, historial de compras, productos favoritos,
          reviews. Ordenado por LTV descendente.
        </p>
      </div>

      {/* KPIs */}
      {resumen && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Clientes</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{resumen.total}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-700">LTV total acumulado</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{fmt(resumen.ltv_total)}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs text-green-700">LTV promedio</p>
            <p className="text-2xl font-bold text-green-900 mt-1">{fmt(resumen.promedio_ltv)}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, email, RUT o empresa…"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm"
        />
        <div className="flex gap-2 overflow-x-auto">
          {(['todos', 'activos', 'nuevos', 'inactivos'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSegmento(s)}
              className={`px-3 py-2 text-sm rounded-xl whitespace-nowrap ${
                segmento === s
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Sin clientes en este segmento.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Cliente</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Contacto</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">LTV</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Compras</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Última</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Desde</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{c.nombre || '(sin nombre)'}</p>
                    {c.empresa && <p className="text-xs text-gray-500">{c.empresa}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {c.email}
                    {c.telefono && <div className="text-gray-500">{c.telefono}</div>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmt(c.ltv)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className="text-green-700">{c.total_pagadas}</span>
                    <span className="text-gray-500"> / {c.total_cotizaciones}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {c.ultima_compra_at
                      ? new Date(c.ultima_compra_at).toLocaleDateString('es-CL')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {new Date(c.created_at).toLocaleDateString('es-CL')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/clientes/${c.id}`}
                      className="text-xs text-orange-600 hover:underline whitespace-nowrap"
                    >
                      Ver 360 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
