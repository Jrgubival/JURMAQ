'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

type Estado =
  | 'borrador'
  | 'pendiente_firma'
  | 'firmado'
  | 'vigente'
  | 'vencido'
  | 'anulado';

interface Contrato {
  id: number | string;
  numero: string | null;
  estado: Estado;
  maquinaria_id: number | null;
  maquinaria_nombre?: string | null;
  arrendatario_nombre: string | null;
  arrendatario_rut: string | null;
  fecha_inicio: string | null;
  fecha_termino: string | null;
  created_at?: string;
}

const estadoConfig: Record<Estado, { bg: string; text: string; label: string }> = {
  borrador: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Borrador' },
  pendiente_firma: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendiente de firma' },
  firmado: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Firmado' },
  vigente: { bg: 'bg-green-100', text: 'text-green-700', label: 'Vigente' },
  vencido: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Vencido' },
  anulado: { bg: 'bg-red-100', text: 'text-red-700', label: 'Anulado' },
};

const filterChips: { key: string; label: string; estados: Estado[] }[] = [
  { key: 'todos', label: 'Todos', estados: [] },
  { key: 'borrador', label: 'Borradores', estados: ['borrador'] },
  { key: 'pendiente_firma', label: 'Pendientes de firma', estados: ['pendiente_firma'] },
  { key: 'firmado', label: 'Firmados', estados: ['firmado'] },
  { key: 'vigente', label: 'Vigentes', estados: ['vigente'] },
  { key: 'vencido', label: 'Vencidos', estados: ['vencido'] },
  { key: 'anulado', label: 'Anulados', estados: ['anulado'] },
];

const formatDate = (s?: string | null) => {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-CL');
};

export default function ContratosListPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await fetch('/api/admin/contratos');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al cargar contratos');
      }
      const data = await res.json();
      setContratos(Array.isArray(data) ? data : data.data || []);
    } catch (err: any) {
      setFetchError(err?.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    const chip = filterChips.find((c) => c.key === filter);
    const byEstado = chip && chip.estados.length > 0
      ? contratos.filter((c) => chip.estados.includes(c.estado))
      : contratos;
    const q = search.trim().toLowerCase();
    if (!q) return byEstado;
    return byEstado.filter((c) => {
      return (
        (c.numero || '').toLowerCase().includes(q) ||
        (c.arrendatario_nombre || '').toLowerCase().includes(q) ||
        (c.arrendatario_rut || '').toLowerCase().includes(q)
      );
    });
  }, [contratos, filter, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: '#e6b422' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {contratos.length} contratos registrados
          </p>
        </div>
        <Link
          href="/admin/contratos/nuevo"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium text-sm transition hover:opacity-90"
          style={{ backgroundColor: '#0c1d3a' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Contrato
        </Link>
      </div>

      {fetchError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {fetchError}
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {filterChips.map((chip) => {
          const active = filter === chip.key;
          const count =
            chip.estados.length === 0
              ? contratos.length
              : contratos.filter((c) => chip.estados.includes(c.estado)).length;
          return (
            <button
              key={chip.key}
              onClick={() => setFilter(chip.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                active
                  ? 'text-white border-transparent'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
              style={active ? { backgroundColor: '#0c1d3a' } : {}}
            >
              {chip.label}
              <span className={`ml-1.5 text-[10px] ${active ? 'opacity-75' : 'text-gray-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <svg
            className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, RUT o numero..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
          />
        </div>
      </div>

      {/* Table (desktop) / Cards (mobile) */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Numero</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Maquinaria</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Arrendatario</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha inicio</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha termino</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const est = estadoConfig[c.estado] || estadoConfig.borrador;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900">
                      {c.numero || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.maquinaria_nombre || `#${c.maquinaria_id ?? '?'}`}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {c.arrendatario_nombre || '—'}
                      </div>
                      {c.arrendatario_rut && (
                        <div className="text-xs text-gray-500 font-mono">
                          {c.arrendatario_rut}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(c.fecha_inicio)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(c.fecha_termino)}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${est.bg} ${est.text}`}
                      >
                        {est.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/admin/contratos/${c.id}`}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                        >
                          Ver
                        </Link>
                        <a
                          href={`/api/admin/contratos/${c.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition inline-flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                    {contratos.length === 0
                      ? 'No hay contratos todavia — crea el primero'
                      : 'No se encontraron contratos con esos filtros'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            {contratos.length === 0
              ? 'No hay contratos todavia — crea el primero'
              : 'No se encontraron contratos'}
          </div>
        ) : (
          filtered.map((c) => {
            const est = estadoConfig[c.estado] || estadoConfig.borrador;
            return (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-gray-200 p-4 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-mono text-gray-500">{c.numero || '—'}</div>
                    <div className="font-semibold text-gray-900">
                      {c.arrendatario_nombre || '—'}
                    </div>
                    {c.arrendatario_rut && (
                      <div className="text-xs font-mono text-gray-500">
                        {c.arrendatario_rut}
                      </div>
                    )}
                  </div>
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${est.bg} ${est.text}`}
                  >
                    {est.label}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {c.maquinaria_nombre || `Maquinaria #${c.maquinaria_id ?? '?'}`}
                </div>
                <div className="text-xs text-gray-500">
                  {formatDate(c.fecha_inicio)} → {formatDate(c.fecha_termino)}
                </div>
                <div className="flex gap-2 pt-2">
                  <Link
                    href={`/admin/contratos/${c.id}`}
                    className="flex-1 text-center px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                  >
                    Ver
                  </Link>
                  <a
                    href={`/api/admin/contratos/${c.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                  >
                    PDF
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
