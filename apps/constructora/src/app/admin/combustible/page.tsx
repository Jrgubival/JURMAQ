'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { tiposCombustibleLabels, estadosLabels, formatCLP, type EstadoFactura, type TipoCombustible } from '@/lib/combustible-utils';
import { useConfirmDialog } from "@jurmaq/shared/ui/useConfirmDialog";

interface Item {
  id: number;
  maquinaria_id: number | null;
  contrato_id: number | null;
  tipo_combustible: string;
  litros: number;
  monto: number;
  precio_por_litro: number | null;
  observaciones?: string | null;
  maquinarias?: { id: number; nombre: string } | null;
  contratos?: { id: number; numero: string } | null;
}

interface Factura {
  id: number;
  fecha: string;
  proveedor_nombre: string;
  proveedor_rut: string | null;
  folio: string;
  tipo_documento: string;
  monto_total: number;
  monto_iec: number | null;
  recuperable: boolean;
  mes_tributario: string;
  estado: EstadoFactura;
  archivo_signed_url?: string | null;
  items: Item[];
}

interface Resumen {
  totalFacturas: number;
  totalMonto: number;
  totalIecRecuperable: number;
  totalLitros: number;
  byTipo: { tipo: string; litros: number; monto: number }[];
  byMaquinaria: { id: string; nombre: string; litros: number; monto: number }[];
}

const estadoColor: Record<string, string> = {
  registrada: 'bg-gray-100 text-gray-700',
  validada: 'bg-blue-100 text-blue-700',
  recuperada: 'bg-green-100 text-green-700',
  anulada: 'bg-red-100 text-red-700',
};

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatLitros = (n: number | null | undefined) => (n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 }) + ' L';

export default function CombustiblePage() {
  const { confirm, ConfirmDialogPortal } = useConfirmDialog();
  const [mes, setMes] = useState(currentMonth());
  const [estado, setEstado] = useState('');
  const [buscar, setBuscar] = useState('');
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ mes, ...(estado && { estado }), ...(buscar && { buscar }) });
        const [fRes, rRes] = await Promise.all([
          fetch(`/api/admin/combustible/facturas?${qs}`),
          fetch(`/api/admin/combustible/resumen?mes=${mes}`),
        ]);
        if (fRes.ok) setFacturas(await fRes.json());
        if (rRes.ok) setResumen(await rRes.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [mes, estado, buscar]);

  const updateEstado = async (id: number, nuevo: EstadoFactura) => {
    const res = await fetch(`/api/admin/combustible/facturas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevo }),
    });
    if (res.ok) {
      setFacturas((prev) => prev.map((f) => (f.id === id ? { ...f, estado: nuevo } : f)));
    }
  };

  const deleteFactura = async (id: number) => {
    const ok = await confirm({
      title: '¿Eliminar esta factura?',
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/combustible/facturas/${id}`, { method: 'DELETE' });
    if (res.ok) setFacturas((prev) => prev.filter((f) => f.id !== id));
    else {
      const d = await res.json();
      alert(d.error || 'Error al eliminar');
    }
  };

  const exportUrl = useMemo(() => `/api/admin/combustible/export?mes=${mes}`, [mes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Combustible</h1>
          <p className="text-sm text-gray-500">
            Registro de facturas para recuperación del Impuesto Específico (Ley 18.502)
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={exportUrl}
            className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar Excel
          </a>
          <Link
            href="/admin/combustible/nueva"
            className="px-4 py-2.5 rounded-xl text-white font-medium text-sm hover:opacity-90 inline-flex items-center gap-2"
            style={{ backgroundColor: '#0c1d3a' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Factura
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Mes tributario</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Estado</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="registrada">Registrada</option>
            <option value="validada">Validada</option>
            <option value="recuperada">Recuperada</option>
            <option value="anulada">Anulada</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Buscar (folio, proveedor, RUT)</label>
          <input
            type="text"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Ej: 12345 o Copec"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Summary cards */}
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Facturas" value={String(resumen.totalFacturas)} color="gray" />
          <SummaryCard label="Total monto" value={formatCLP(resumen.totalMonto)} color="blue" />
          <SummaryCard label="Total litros" value={formatLitros(resumen.totalLitros)} color="orange" />
          <SummaryCard label="IEC recuperable" value={formatCLP(resumen.totalIecRecuperable)} color="green" />
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Cargando...</div>
        ) : facturas.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay facturas en {mes}. <Link href="/admin/combustible/nueva" className="text-orange-600 font-medium">Registra la primera</Link>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs text-gray-600 uppercase">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Folio</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">IEC</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturas.map((f) => (
                  <>
                    <tr key={f.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === f.id ? null : f.id)}>
                      <td className="px-4 py-3 text-gray-700">{f.fecha}</td>
                      <td className="px-4 py-3 font-mono text-xs">{f.folio}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <div className="font-medium">{f.proveedor_nombre}</div>
                        {f.proveedor_rut && <div className="text-xs text-gray-500">{f.proveedor_rut}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {f.items.length} ítem{f.items.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCLP(f.monto_total)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{f.recuperable ? formatCLP(f.monto_iec) : '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${estadoColor[f.estado]}`}>
                          {estadosLabels[f.estado] || f.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/admin/combustible/${f.id}`}
                            className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
                          >
                            Ver
                          </Link>
                          {f.archivo_signed_url && (
                            <a
                              href={f.archivo_signed_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
                            >
                              Archivo
                            </a>
                          )}
                          {f.estado === 'registrada' && (
                            <button
                              onClick={() => updateEstado(f.id, 'validada')}
                              className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                            >
                              Validar
                            </button>
                          )}
                          {f.estado === 'validada' && (
                            <button
                              onClick={() => updateEstado(f.id, 'recuperada')}
                              className="px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100"
                            >
                              Recuperar
                            </button>
                          )}
                          {f.estado !== 'recuperada' && (
                            <button
                              onClick={() => deleteFactura(f.id)}
                              className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === f.id && (
                      <tr key={`${f.id}-detail`} className="bg-gray-50">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="text-xs text-gray-600 mb-2 font-medium">Detalle de consumo</div>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-gray-500">
                                <th className="px-2 py-1">Maquinaria</th>
                                <th className="px-2 py-1">Contrato</th>
                                <th className="px-2 py-1">Tipo</th>
                                <th className="px-2 py-1 text-right">Litros</th>
                                <th className="px-2 py-1 text-right">Monto</th>
                                <th className="px-2 py-1 text-right">Precio/L</th>
                              </tr>
                            </thead>
                            <tbody>
                              {f.items.map((it) => (
                                <tr key={it.id} className="border-t border-gray-100">
                                  <td className="px-2 py-1">{it.maquinarias?.nombre || <span className="text-gray-400">(sin asignar)</span>}</td>
                                  <td className="px-2 py-1">{it.contratos?.numero || '-'}</td>
                                  <td className="px-2 py-1">{tiposCombustibleLabels[it.tipo_combustible as TipoCombustible] || it.tipo_combustible}</td>
                                  <td className="px-2 py-1 text-right">{formatLitros(Number(it.litros))}</td>
                                  <td className="px-2 py-1 text-right">{formatCLP(Number(it.monto))}</td>
                                  <td className="px-2 py-1 text-right">{it.precio_por_litro ? '$' + Number(it.precio_por_litro).toFixed(1) : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ConfirmDialogPortal />
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: 'gray' | 'blue' | 'orange' | 'green' }) {
  const bg = {
    gray: 'bg-gray-50 text-gray-700',
    blue: 'bg-blue-50 text-blue-700',
    orange: 'bg-orange-50 text-orange-700',
    green: 'bg-green-50 text-green-700',
  }[color];
  return (
    <div className={`${bg} rounded-xl p-4`}>
      <div className="text-xs uppercase font-medium opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
