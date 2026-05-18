'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCLP } from '@jurmaq/shared/format';

interface CotArriendo {
  id: number;
  numero: string;
  cliente_nombre: string;
  cliente_email: string;
  fecha_servicio: string;
  ubicacion_servicio: string;
  unidades_solicitadas: number;
  unidad: string;
  total: number;
  estado: string;
  created_at: string;
  maquinarias?: { nombre: string };
}

const ESTADO_COLORS: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  enviada: 'bg-blue-100 text-blue-700',
  aceptada: 'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-700',
  contrato_creado: 'bg-purple-100 text-purple-700',
  finalizada: 'bg-emerald-100 text-emerald-700',
  cancelada: 'bg-gray-100 text-gray-500',
};

const FILTER_TABS = [
  { key: 'all', label: 'Todas' },
  { key: 'enviada', label: 'Nuevas' },
  { key: 'aceptada', label: 'Aceptadas' },
  { key: 'contrato_creado', label: 'En contrato' },
  { key: 'finalizada', label: 'Finalizadas' },
  { key: 'rechazada', label: 'Rechazadas' },
];

export default function CotizacionesArriendoListPage() {
  const [cotizaciones, setCotizaciones] = useState<CotArriendo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/cotizaciones-arriendo')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCotizaciones(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = cotizaciones.filter((c) => {
    if (filter !== 'all' && c.estado !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !c.numero.toLowerCase().includes(q) &&
        !c.cliente_nombre.toLowerCase().includes(q) &&
        !c.cliente_email.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const totalSum = filtered.reduce((s, c) => s + c.total, 0);

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy-950">Cotizaciones de arriendo</h1>
        <p className="text-sm text-gray-600 mt-1">
          {filtered.length} cotizaciones · Total filtrado: <strong>{formatCLP(totalSum)}</strong>
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 rounded text-sm font-semibold ${
              filter === t.key ? 'bg-navy-950 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs opacity-70">
              ({t.key === 'all' ? cotizaciones.length : cotizaciones.filter((c) => c.estado === t.key).length})
            </span>
          </button>
        ))}
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por número, cliente, email..."
        className="w-full md:w-80 border rounded px-3 py-2 mb-4 text-sm"
      />

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">Sin cotizaciones.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Máquina</th>
                <th className="px-4 py-3">Fecha servicio</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/cotizaciones-arriendo/${c.id}`}
                      className="font-mono text-sm text-blue-600 hover:underline"
                    >
                      {c.numero}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {new Date(c.created_at).toLocaleDateString('es-CL')}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold">{c.cliente_nombre}</p>
                    <p className="text-xs text-gray-500">{c.cliente_email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{c.maquinarias?.nombre || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(c.fecha_servicio).toLocaleDateString('es-CL')}
                    <p className="text-xs text-gray-500">
                      {c.unidades_solicitadas} {c.unidad}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-semibold">{formatCLP(c.total)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        ESTADO_COLORS[c.estado] || 'bg-gray-100'
                      }`}
                    >
                      {c.estado.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
