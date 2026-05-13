'use client';

import { useState, useEffect, Fragment } from 'react';

interface Solicitud {
  id: number | string;
  cliente_nombre: string | null;
  cliente_empresa?: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
  servicio: string | null;
  maquinaria_id?: number | null;
  maquinaria_nombre: string | null;
  mensaje: string | null;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  created_at: string;
  notas?: string | null;
}

const estadoColors: Record<string, { bg: string; text: string }> = {
  pendiente: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  aprobada: { bg: 'bg-green-100', text: 'text-green-700' },
  rechazada: { bg: 'bg-red-100', text: 'text-red-700' },
};

const tabs = [
  { label: 'Todas', value: 'todas' },
  { label: 'Pendientes', value: 'pendiente' },
  { label: 'Aprobadas', value: 'aprobada' },
  { label: 'Rechazadas', value: 'rechazada' },
];

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('es-CL');
};

export default function SolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('todas');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/solicitudes');
      if (res.ok) {
        const data = await res.json();
        setSolicitudes(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Error fetching solicitudes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async (id: string, estado: 'aprobada' | 'rechazada') => {
    try {
      const res = await fetch(`/api/solicitudes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Error updating solicitud:', err);
    }
  };

  const filtered = activeTab === 'todas' ? solicitudes : solicitudes.filter((s) => s.estado === activeTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#e6b422' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Solicitudes</h1>
        <p className="text-sm text-gray-500 mt-1">{solicitudes.length} solicitudes en total</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.value !== 'todas' && (
              <span className="ml-1.5 text-xs">
                ({solicitudes.filter((s) => s.estado === tab.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase bg-gray-50">
                <th className="px-6 py-3">#</th>
                <th className="px-6 py-3">Cliente</th>
                <th className="px-6 py-3">Servicio</th>
                <th className="px-6 py-3">Maquinaria</th>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-sm">
                    No hay solicitudes {activeTab !== 'todas' ? `con estado "${activeTab}"` : ''}
                  </td>
                </tr>
              ) : (
                filtered.map((sol) => {
                  const est = estadoColors[sol.estado] || estadoColors.pendiente;
                  const isExpanded = expanded === String(sol.id);
                  return (
                    <Fragment key={sol.id}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpanded(isExpanded ? null : String(sol.id))}
                      >
                        <td className="px-6 py-4 text-sm text-gray-600 font-mono">#{sol.id}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{sol.cliente_nombre || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{sol.servicio || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{sol.maquinaria_nombre || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(sol.created_at)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${est.bg} ${est.text}`}>
                            {sol.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {sol.estado === 'pendiente' && (
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleAction(String(sol.id), 'aprobada')}
                                className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition"
                              >
                                Aprobar
                              </button>
                              <button
                                onClick={() => handleAction(String(sol.id), 'rechazada')}
                                className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition"
                              >
                                Rechazar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500 mb-1">Email</p>
                                <p className="text-gray-900">{sol.cliente_email || '-'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 mb-1">Teléfono</p>
                                <p className="text-gray-900">{sol.cliente_telefono || '-'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 mb-1">Maquinaria</p>
                                <p className="text-gray-900">{sol.maquinaria_nombre || '-'}</p>
                              </div>
                              {sol.cliente_empresa && (
                                <div>
                                  <p className="text-gray-500 mb-1">Empresa</p>
                                  <p className="text-gray-900">{sol.cliente_empresa}</p>
                                </div>
                              )}
                              <div className="md:col-span-3">
                                <p className="text-gray-500 mb-1">Mensaje</p>
                                <p className="text-gray-900 whitespace-pre-wrap">{sol.mensaje || '-'}</p>
                              </div>
                              {sol.notas && (
                                <div className="md:col-span-3">
                                  <p className="text-gray-500 mb-1">Notas</p>
                                  <p className="text-gray-900">{sol.notas}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
