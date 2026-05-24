'use client';

import { useState, useEffect } from 'react';
import { formatCLP } from "@jurmaq/shared/format";

interface DashboardStats {
  maquinariasDisponibles: number;
  solicitudesPendientes: number;
  proyectosActivos: number;
  cotizacionesAbiertas: number;
}

interface Solicitud {
  id: number;
  cliente_nombre?: string;
  servicio: string;
  estado: string;
  created_at?: string;
}

interface Proyecto {
  id: number;
  nombre: string;
  // The DB column is `cliente` (text) AND optionally `cliente_id` (FK).
  // Older API revisions returned the joined `cliente_nombre`; current
  // returns the flat `cliente`. Read both for safety.
  cliente?: string | null;
  cliente_nombre?: string | null;
  tipo: string;
  estado: string;
  created_at?: string;
  fecha_inicio?: string;
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-CL');
};

const statusBadge = (estado: string) => {
  const colors: Record<string, string> = {
    pendiente: 'bg-gray-100 text-gray-700',
    en_progreso: 'bg-blue-100 text-blue-700',
    completado: 'bg-green-100 text-green-700',
    cancelado: 'bg-red-100 text-red-700',
    aprobada: 'bg-green-100 text-green-700',
    rechazada: 'bg-red-100 text-red-700',
    disponible: 'bg-green-100 text-green-700',
  };
  return colors[estado] || 'bg-gray-100 text-gray-700';
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, solRes, proyRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/solicitudes?limit=5'),
          fetch('/api/proyectos?limit=5'),
        ]);

        if (statsRes.ok) {
          const d = await statsRes.json();
          setStats({
            maquinariasDisponibles: d.maquinarias?.disponibles ?? 0,
            solicitudesPendientes: d.solicitudes?.pendientes ?? 0,
            proyectosActivos: d.proyectos?.activos ?? 0,
            cotizacionesAbiertas: d.cotizaciones?.pendientes ?? 0,
          });
        }
        if (solRes.ok) {
          const solData = await solRes.json();
          setSolicitudes(Array.isArray(solData) ? solData : solData.data || []);
        }
        if (proyRes.ok) {
          const proyData = await proyRes.json();
          setProyectos(Array.isArray(proyData) ? proyData : proyData.data || []);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#e6b422' }} />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Maquinarias Disponibles',
      value: stats?.maquinariasDisponibles ?? 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      color: '#e6b422',
    },
    {
      label: 'Solicitudes Pendientes',
      value: stats?.solicitudesPendientes ?? 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      color: '#3b82f6',
    },
    {
      label: 'Proyectos Activos',
      value: stats?.proyectosActivos ?? 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
      color: '#10b981',
    },
    {
      label: 'Cotizaciones Abiertas',
      value: stats?.cotizacionesAbiertas ?? 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
        </svg>
      ),
      color: '#8b5cf6',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: card.color + '15', color: card.color }}
              >
                {card.icon}
              </div>
              <span className="text-3xl font-bold text-gray-900">{card.value}</span>
            </div>
            <p className="text-sm text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Solicitudes */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Ultimas Solicitudes</h3>
            <a href="/admin/solicitudes" className="text-sm hover:underline" style={{ color: '#e6b422' }}>
              Ver todas
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider bg-gray-50">
                  <th className="px-6 py-3">#</th>
                  <th className="px-6 py-3">Cliente</th>
                  <th className="px-6 py-3">Servicio</th>
                  <th className="px-6 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {solicitudes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 text-sm">
                      No hay solicitudes recientes
                    </td>
                  </tr>
                ) : (
                  solicitudes.map((sol, idx) => (
                    <tr key={sol.id || idx} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-600">{sol.id || idx + 1}</td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{sol.cliente_nombre || '-'}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{sol.servicio}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusBadge(sol.estado)}`}>
                          {sol.estado}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Proyectos */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Ultimos Proyectos</h3>
            <a href="/admin/proyectos" className="text-sm hover:underline" style={{ color: '#e6b422' }}>
              Ver todos
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider bg-gray-50">
                  <th className="px-6 py-3">Nombre</th>
                  <th className="px-6 py-3">Cliente</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {proyectos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 text-sm">
                      No hay proyectos recientes
                    </td>
                  </tr>
                ) : (
                  proyectos.map((proy, idx) => (
                    <tr key={proy.id || idx} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{proy.nombre}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{proy.cliente_nombre || proy.cliente || '-'}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusBadge(proy.estado)}`}>
                          {proy.estado}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">
                        {proy.fecha_inicio ? formatDate(proy.fecha_inicio) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
