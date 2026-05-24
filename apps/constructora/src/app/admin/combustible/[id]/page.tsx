'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { tiposCombustibleLabels, estadosLabels, type EstadoFactura, type TipoCombustible } from '@/lib/combustible-utils';
import { formatCLP as sharedFormatCLP } from "@jurmaq/shared/format";
import { useConfirmDialog } from "@jurmaq/shared/ui/useConfirmDialog";

export default function FacturaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [factura, setFactura] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { confirm, ConfirmDialogPortal } = useConfirmDialog();

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/combustible/facturas/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setFactura(d))
      .catch(() => setError('No se pudo cargar la factura'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  const updateEstado = async (estado: EstadoFactura) => {
    setSaving(true);
    try {
      await fetch(`/api/admin/combustible/facturas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      load();
    } finally {
      setSaving(false);
    }
  };

  const deleteFactura = async () => {
    const ok = await confirm({
      title: '¿Eliminar esta factura?',
      message: 'Esto borra la factura del libro de compras IVA. Si ya disparó el trigger F29, queda en el histórico igualmente.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/combustible/facturas/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin/combustible');
    else {
      const d = await res.json();
      alert(d.error || 'No se pudo eliminar');
    }
  };

  if (loading) return <div className="p-8 text-sm text-gray-500">Cargando...</div>;
  if (error) return <div className="p-8 text-sm text-red-600">{error}</div>;
  if (!factura) return null;

  const formatCLP = (n: number | null | undefined) => sharedFormatCLP(Math.round(Number(n) || 0));
  const formatLitros = (n: number | null | undefined) => (n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 }) + ' L';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin/combustible" className="text-sm text-gray-500 hover:text-gray-700">&larr; Volver al listado</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Factura {factura.folio}</h1>
          <p className="text-sm text-gray-500">{factura.proveedor_nombre} · {factura.fecha}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {factura.archivo_signed_url && (
            <a href={factura.archivo_signed_url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-sm rounded-xl bg-gray-100 hover:bg-gray-200">
              Ver archivo
            </a>
          )}
          {factura.estado === 'registrada' && (
            <button onClick={() => updateEstado('validada')} disabled={saving} className="px-3 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              Validar
            </button>
          )}
          {factura.estado === 'validada' && (
            <button onClick={() => updateEstado('recuperada')} disabled={saving} className="px-3 py-2 text-sm rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
              Marcar recuperada
            </button>
          )}
          {factura.estado !== 'anulada' && factura.estado !== 'recuperada' && (
            <button onClick={() => updateEstado('anulada')} disabled={saving} className="px-3 py-2 text-sm rounded-xl bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">
              Anular
            </button>
          )}
          {factura.estado !== 'recuperada' && (
            <button onClick={deleteFactura} className="px-3 py-2 text-sm rounded-xl bg-red-50 text-red-600 hover:bg-red-100">
              Eliminar
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Info label="Estado" value={estadosLabels[factura.estado as EstadoFactura] || factura.estado} />
        <Info label="Mes tributario" value={factura.mes_tributario} />
        <Info label="Tipo documento" value={factura.tipo_documento} />
        <Info label="Proveedor" value={factura.proveedor_nombre} />
        <Info label="RUT proveedor" value={factura.proveedor_rut || '-'} />
        <Info label="Dirección" value={factura.proveedor_direccion || '-'} />
        <Info label="Monto neto" value={formatCLP(factura.monto_neto)} />
        <Info label="IVA" value={formatCLP(factura.monto_iva)} />
        <Info label="Total" value={formatCLP(factura.monto_total)} bold />
        <Info label="IEC recuperable" value={factura.recuperable ? formatCLP(factura.monto_iec) : 'No recuperable'} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Detalle de consumo</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className="py-2">Maquinaria</th>
              <th className="py-2">Contrato</th>
              <th className="py-2">Tipo</th>
              <th className="py-2 text-right">Litros</th>
              <th className="py-2 text-right">Monto</th>
              <th className="py-2 text-right">Precio/L</th>
              <th className="py-2">Obs.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(factura.items || []).map((it: any) => (
              <tr key={it.id}>
                <td className="py-2">{it.maquinarias?.nombre || <span className="text-gray-500">sin asignar</span>}</td>
                <td className="py-2">{it.contratos?.numero || '-'}</td>
                <td className="py-2">{tiposCombustibleLabels[it.tipo_combustible as TipoCombustible] || it.tipo_combustible}</td>
                <td className="py-2 text-right">{formatLitros(Number(it.litros))}</td>
                <td className="py-2 text-right">{formatCLP(Number(it.monto))}</td>
                <td className="py-2 text-right">{it.precio_por_litro ? '$' + Number(it.precio_por_litro).toFixed(1) : '-'}</td>
                <td className="py-2 text-xs text-gray-600">{it.observaciones || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {factura.notas && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-2">Notas</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{factura.notas}</p>
        </div>
      )}
      <ConfirmDialogPortal />
    </div>
  );
}

function Info({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`${bold ? 'font-bold text-lg' : 'font-medium'} text-gray-900 mt-0.5`}>{value}</div>
    </div>
  );
}
