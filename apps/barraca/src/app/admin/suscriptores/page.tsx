'use client';

import { useState, useEffect } from 'react';

interface Suscriptor {
  id: number;
  email: string;
  nombre: string | null;
  activo: boolean;
  created_at: string;
}

export default function BarracaSuscriptoresPage() {
  const [suscriptores, setSuscriptores] = useState<Suscriptor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/suscriptores');
      if (res.ok) {
        const data = await res.json();
        setSuscriptores(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Error fetching suscriptores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleActivo = async (sub: Suscriptor) => {
    try {
      await fetch(`/api/suscriptores/${sub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !sub.activo }),
      });
      fetchData();
    } catch (err) {
      console.error('Error toggling:', err);
    }
  };

  const exportCSV = () => {
    const headers = ['Email', 'Nombre', 'Fecha', 'Estado'];
    const rows = suscriptores.map((s) => [
      s.email,
      s.nombre || '',
      formatDate(s.created_at),
      s.activo ? 'Activo' : 'Inactivo',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `suscriptores_barraca_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#e6b422' }} />
      </div>
    );
  }

  const activos = suscriptores.filter((s) => s.activo).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suscriptores</h1>
          <p className="text-sm text-gray-500 mt-1">
            {suscriptores.length} suscriptores ({activos} activos)
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={suscriptores.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: '#0c1d3a' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Fecha</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody>
              {suscriptores.map((sub) => (
                <tr key={sub.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{sub.email}</td>
                  <td className="px-4 py-3 text-gray-600">{sub.nombre || '-'}</td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs">{formatDate(sub.created_at)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActivo(sub)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 ${
                        sub.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {sub.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                </tr>
              ))}
              {suscriptores.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                    No hay suscriptores registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
