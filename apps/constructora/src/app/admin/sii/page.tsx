'use client';

import { useState, useEffect } from 'react';
import { formatCLP } from '@jurmaq/shared/format';

interface ResumenMensual {
  periodo: string;
  ventas_count: number;
  ventas_neto: number;
  iva_debito: number;
  compras_count: number;
  compras_neto: number;
  iva_credito: number;
  f29_a_pagar: number;
}

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function SiiDashboard() {
  const [resumenes, setResumenes] = useState<ResumenMensual[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<string>(thisMonth());

  useEffect(() => {
    fetch('/api/admin/sii/libro-ventas/resumenes')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setResumenes(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const periodoActual = resumenes.find((r) => r.periodo === periodoSeleccionado) || {
    periodo: periodoSeleccionado,
    ventas_count: 0,
    ventas_neto: 0,
    iva_debito: 0,
    compras_count: 0,
    compras_neto: 0,
    iva_credito: 0,
    f29_a_pagar: 0,
  };

  function downloadF29() {
    window.open(`/api/admin/sii/f29?periodo=${periodoSeleccionado}&download=true`, '_blank');
  }

  return (
    <div className="p-6 max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy-950">SII / Tributario</h1>
        <p className="text-sm text-gray-600">F29 — Libros IVA débito / crédito y export Excel</p>
      </header>

      {/* Selector de período */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold">Período:</label>
        <input
          type="month"
          value={periodoSeleccionado}
          onChange={(e) => setPeriodoSeleccionado(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={downloadF29}
          className="bg-orange-500 text-white px-4 py-1.5 rounded font-semibold hover:bg-orange-600 text-sm"
        >
          📊 Descargar F29.xlsx
        </button>
      </div>

      {/* KPIs período actual */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Ventas netas"
          value={formatCLP(periodoActual.ventas_neto)}
          subtitle={`${periodoActual.ventas_count} documentos`}
          color="green"
        />
        <KpiCard
          label="IVA Débito"
          value={formatCLP(periodoActual.iva_debito)}
          subtitle="lo que cobramos por IVA"
          color="blue"
        />
        <KpiCard
          label="Compras netas"
          value={formatCLP(periodoActual.compras_neto)}
          subtitle={`${periodoActual.compras_count} documentos`}
          color="orange"
        />
        <KpiCard
          label="IVA Crédito"
          value={formatCLP(periodoActual.iva_credito)}
          subtitle="lo que pagamos por IVA"
          color="purple"
        />
      </div>

      <div className="bg-navy-950 text-white rounded-lg p-6 mb-6">
        <p className="text-sm uppercase tracking-wide opacity-80 mb-1">F29 a pagar al SII</p>
        <p className="text-3xl font-bold">{formatCLP(periodoActual.f29_a_pagar)}</p>
        <p className="text-sm opacity-80 mt-2">
          {periodoActual.f29_a_pagar > 0
            ? '= IVA Débito − IVA Crédito (debes pagar)'
            : periodoActual.f29_a_pagar < 0
              ? '= IVA Crédito mayor (saldo a favor próximo mes)'
              : 'Sin actividad en el período'}
        </p>
      </div>

      {/* Histórico */}
      <h2 className="text-lg font-bold mb-3 text-navy-950">Histórico mensual</h2>
      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : resumenes.length === 0 ? (
        <p className="text-gray-500 bg-white rounded p-4">
          Aún no hay actividad registrada. Las cotizaciones de arriendo que pasen a
          &quot;contrato_creado&quot; o &quot;finalizada&quot; aparecerán automáticamente acá.
        </p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Período</th>
                <th className="px-4 py-3 text-right">Ventas neto</th>
                <th className="px-4 py-3 text-right">IVA débito</th>
                <th className="px-4 py-3 text-right">Compras neto</th>
                <th className="px-4 py-3 text-right">IVA crédito</th>
                <th className="px-4 py-3 text-right">F29 a pagar</th>
                <th className="px-4 py-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {resumenes.map((r) => (
                <tr key={r.periodo} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-semibold">{r.periodo}</td>
                  <td className="px-4 py-3 text-right">{formatCLP(r.ventas_neto)}</td>
                  <td className="px-4 py-3 text-right text-blue-600">{formatCLP(r.iva_debito)}</td>
                  <td className="px-4 py-3 text-right">{formatCLP(r.compras_neto)}</td>
                  <td className="px-4 py-3 text-right text-purple-600">{formatCLP(r.iva_credito)}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatCLP(r.f29_a_pagar)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setPeriodoSeleccionado(r.periodo);
                        setTimeout(() => downloadF29(), 100);
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Descargar
                    </button>
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

function KpiCard({ label, value, subtitle, color }: {
  label: string;
  value: string;
  subtitle: string;
  color: 'green' | 'blue' | 'orange' | 'purple';
}) {
  const colors = {
    green: 'border-green-200 text-green-700',
    blue: 'border-blue-200 text-blue-700',
    orange: 'border-orange-200 text-orange-700',
    purple: 'border-purple-200 text-purple-700',
  };
  return (
    <div className={`bg-white rounded-lg border-l-4 ${colors[color]} p-4 shadow-sm`}>
      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">{label}</p>
      <p className={`text-xl font-bold mt-1 ${colors[color]}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}
