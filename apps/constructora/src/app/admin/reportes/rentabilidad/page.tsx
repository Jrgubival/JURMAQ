'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCLP } from '@jurmaq/shared/format';

/**
 * Tier 5 E4: Reporte de rentabilidad por máquina.
 *
 * Filtros: desde / hasta. Tabla con ingresos, costos mantención, utilidad
 * neta, margen %, conversión. Ordenada por utilidad descendente para que
 * el dueño identifique las máquinas más/menos rentables del período.
 */

interface MaquinaReporte {
  maquinaria_id: number;
  nombre: string;
  tipo: string;
  estado: string;
  tarifa_neta: number | null;
  unidad_tarifa: 'hora' | 'dia' | null;
  ingresos_brutos: number;
  ingresos_neto: number;
  reserva_mantencion_cobrada: number;
  utilidad_real_estimada: number;
  costo_mantenciones: number;
  total_mantenciones: number;
  utilidad_neta: number;
  margen_porcentaje: number;
  total_cotizaciones: number;
  cotizaciones_aceptadas: number;
  cotizaciones_canceladas: number;
  conversion_porcentaje: number;
  unidades_arrendadas: number;
}

interface Resumen {
  ingresos_brutos: number;
  ingresos_neto: number;
  costo_mantenciones: number;
  utilidad_neta: number;
  total_cotizaciones: number;
  total_aceptadas: number;
}

const PRESETS: Array<{ label: string; days: number }> = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '6 meses', days: 180 },
  { label: 'YTD', days: 0 },
  { label: '1 año', days: 365 },
];

function fechaISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function RentabilidadPage() {
  const today = new Date();
  const [desde, setDesde] = useState(fechaISO(new Date(Date.now() - 365 * 24 * 3600 * 1000)));
  const [hasta, setHasta] = useState(fechaISO(today));
  const [maquinas, setMaquinas] = useState<MaquinaReporte[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/reportes/rentabilidad?desde=${desde}&hasta=${hasta}`);
    if (res.ok) {
      const data = await res.json();
      setMaquinas(data.maquinas || []);
      setResumen(data.resumen || null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta]);

  function aplicarPreset(days: number) {
    if (days === 0) {
      // YTD
      setDesde(`${today.getFullYear()}-01-01`);
      setHasta(fechaISO(today));
    } else {
      setDesde(fechaISO(new Date(Date.now() - days * 24 * 3600 * 1000)));
      setHasta(fechaISO(today));
    }
  }

  function exportCSV() {
    const headers = [
      'Máquina',
      'Tipo',
      'Estado',
      'Ingresos brutos',
      'Ingresos netos',
      'Costo mantención',
      'Utilidad neta',
      'Margen %',
      'Cotizaciones total',
      'Aceptadas',
      'Conversión %',
      'Unidades arrendadas',
    ];
    const rows = maquinas.map((m) => [
      m.nombre,
      m.tipo,
      m.estado,
      m.ingresos_brutos,
      m.ingresos_neto,
      m.costo_mantenciones,
      m.utilidad_neta,
      `${m.margen_porcentaje}%`,
      m.total_cotizaciones,
      m.cotizaciones_aceptadas,
      `${m.conversion_porcentaje}%`,
      m.unidades_arrendadas,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rentabilidad_${desde}_${hasta}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const margenColor = (margen: number) => {
    if (margen >= 30) return 'text-green-700 bg-green-50';
    if (margen >= 15) return 'text-blue-700 bg-blue-50';
    if (margen >= 0) return 'text-amber-700 bg-amber-50';
    return 'text-red-700 bg-red-50';
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/admin" className="hover:text-gray-900">
          ← Admin
        </Link>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-950">Rentabilidad por máquina</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ingresos confirmados (cotizaciones aceptadas/pagadas + contratos) vs costos de mantención
          en el período. Ordenado por utilidad descendente.
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-col md:flex-row items-start md:items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-700">Desde:</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-700">Hasta:</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => aplicarPreset(p.days)}
              className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={exportCSV}
          disabled={maquinas.length === 0}
          className="ml-auto px-4 py-2 bg-navy-950 hover:bg-navy-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          📊 Exportar CSV
        </button>
      </div>

      {/* Resumen KPIs */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Ingresos netos totales</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCLP(resumen.ingresos_neto)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {formatCLP(resumen.ingresos_brutos)} con IVA
            </p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-xs text-red-700">Costo mantenciones</p>
            <p className="text-2xl font-bold text-red-900 mt-1">
              {formatCLP(resumen.costo_mantenciones)}
            </p>
          </div>
          <div
            className={`border rounded-xl p-4 ${
              resumen.utilidad_neta >= 0
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <p className={`text-xs ${resumen.utilidad_neta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              Utilidad neta
            </p>
            <p
              className={`text-2xl font-bold mt-1 ${
                resumen.utilidad_neta >= 0 ? 'text-green-900' : 'text-red-900'
              }`}
            >
              {formatCLP(resumen.utilidad_neta)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {resumen.ingresos_neto > 0
                ? `${Math.round((resumen.utilidad_neta / resumen.ingresos_neto) * 100)}% margen`
                : 'sin ingresos'}
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-700">Conversión cotizaciones</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">
              {resumen.total_cotizaciones > 0
                ? `${Math.round((resumen.total_aceptadas / resumen.total_cotizaciones) * 100)}%`
                : '—'}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {resumen.total_aceptadas} de {resumen.total_cotizaciones}
            </p>
          </div>
        </div>
      )}

      {/* Tabla por máquina */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Cargando…</div>
        ) : maquinas.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Sin máquinas registradas.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Máquina</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-600">Ingresos</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-600">Mantención</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-600">Utilidad</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-600">Margen</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-600">Conv.</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-600">Uds. arrend.</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {maquinas.map((m) => (
                <tr key={m.maquinaria_id}>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/maquinarias/${m.maquinaria_id}`}
                      className="font-semibold text-gray-900 hover:text-orange-600"
                    >
                      {m.nombre}
                    </Link>
                    <div className="text-xs text-gray-500">{m.tipo}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCLP(m.ingresos_neto)}
                    {m.ingresos_brutos !== m.ingresos_neto && (
                      <div className="text-[10px] text-gray-400">
                        {formatCLP(m.ingresos_brutos)} c/IVA
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={m.costo_mantenciones > 0 ? 'text-red-600' : 'text-gray-400'}>
                      {formatCLP(m.costo_mantenciones)}
                    </span>
                    {m.total_mantenciones > 0 && (
                      <div className="text-[10px] text-gray-400">
                        {m.total_mantenciones} servicio{m.total_mantenciones !== 1 ? 's' : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    <span className={m.utilidad_neta >= 0 ? 'text-green-700' : 'text-red-700'}>
                      {formatCLP(m.utilidad_neta)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${margenColor(
                        m.margen_porcentaje,
                      )}`}
                    >
                      {m.margen_porcentaje}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-gray-700">
                    {m.conversion_porcentaje}%
                    <div className="text-[10px] text-gray-400">
                      {m.cotizaciones_aceptadas}/{m.total_cotizaciones}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-gray-700">
                    {m.unidades_arrendadas}
                    {m.unidad_tarifa && (
                      <span className="text-gray-400 ml-1">{m.unidad_tarifa}s</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/maquinarias/${m.maquinaria_id}`}
                      className="text-xs text-orange-600 hover:underline whitespace-nowrap"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        💡 <strong>Notas:</strong> los ingresos consideran cotizaciones en estado
        <em> aceptada, contrato_creado, finalizada, pagada</em>. La utilidad neta se calcula como
        ingresos netos (sin IVA) menos costo de mantenciones en el período. La &ldquo;utilidad real
        estimada&rdquo; del cotizador (reserva + ganancia) NO se cruza con los costos reales — esta
        tabla los compara.
      </p>
    </div>
  );
}
