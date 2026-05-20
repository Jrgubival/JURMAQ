'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatCLP } from '@jurmaq/shared/format';
import { useConfirmDialog } from "@jurmaq/shared/ui/useConfirmDialog";

interface Cotizacion {
  id: number;
  numero: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono?: string;
  cliente_rut?: string;
  cliente_empresa?: string;
  fecha_servicio: string;
  ubicacion_servicio: string;
  distancia_km: number;
  unidades_solicitadas: number;
  unidad: string;
  peajes: number;
  operarios: number;
  horas_operario_estimadas: number;
  notas_cliente?: string;
  precio_uso: number;
  traslado_combustible: number;
  traslado_carga: number;
  traslado_operario: number;
  subtotal_neto: number;
  iva: number;
  total: number;
  reserva_mantencion: number;
  utilidad_real: number;
  estado: string;
  created_at: string;
  maquinarias?: { id: number; nombre: string };
}

const ESTADOS_DISPONIBLES = [
  'borrador',
  'enviada',
  'aceptada',
  'rechazada',
  'contrato_creado',
  'finalizada',
  'cancelada',
] as const;

export default function CotArriendoDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { confirm, ConfirmDialogPortal } = useConfirmDialog();
  const [cot, setCot] = useState<Cotizacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showInternal, setShowInternal] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/cotizaciones-arriendo/${id}`)
      .then((r) => r.json())
      .then((data) => setCot(data))
      .finally(() => setLoading(false));
  }, [id]);

  async function changeEstado(nuevo: string) {
    if (!cot) return;
    setUpdating(true);
    const res = await fetch(`/api/admin/cotizaciones-arriendo/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevo }),
    });
    if (res.ok) setCot({ ...cot, estado: nuevo });
    setUpdating(false);
  }

  async function convertirAContrato() {
    if (!cot) return;
    const ok = await confirm({
      title: '¿Convertir esta cotización a contrato?',
      message: 'Se pre-rellena el wizard de contrato con los datos de esta cotización.',
      confirmLabel: 'Convertir',
    });
    if (!ok) return;
    // Redirige al wizard de contrato con query string que pre-rellena
    router.push(`/admin/contratos/nuevo?fromCotArriendo=${cot.id}`);
  }

  if (loading) return <div className="p-6">Cargando...</div>;
  if (!cot) return <div className="p-6">Cotización no encontrada</div>;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <Link href="/admin/cotizaciones-arriendo" className="text-sm text-blue-600 hover:underline">
            ← Volver al listado
          </Link>
          <h1 className="text-2xl font-bold text-navy-950 mt-2">{cot.numero}</h1>
          <p className="text-sm text-gray-500">
            Creada el {new Date(cot.created_at).toLocaleString('es-CL')}
          </p>
        </div>
        <select
          value={cot.estado}
          onChange={(e) => changeEstado(e.target.value)}
          disabled={updating}
          className="border rounded px-3 py-1.5 text-sm"
        >
          {ESTADOS_DISPONIBLES.map((e) => (
            <option key={e} value={e}>
              {e.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Cliente */}
        <section className="bg-white rounded-xl shadow p-5">
          <h2 className="font-bold mb-3 text-navy-950">Cliente</h2>
          <dl className="text-sm space-y-2">
            <div><dt className="text-gray-500 inline">Nombre:</dt> <dd className="font-semibold inline">{cot.cliente_nombre}</dd></div>
            <div><dt className="text-gray-500 inline">Email:</dt> <dd className="inline">{cot.cliente_email}</dd></div>
            {cot.cliente_telefono && <div><dt className="text-gray-500 inline">Teléfono:</dt> <dd className="inline">{cot.cliente_telefono}</dd></div>}
            {cot.cliente_rut && <div><dt className="text-gray-500 inline">RUT:</dt> <dd className="inline">{cot.cliente_rut}</dd></div>}
            {cot.cliente_empresa && <div><dt className="text-gray-500 inline">Empresa:</dt> <dd className="inline">{cot.cliente_empresa}</dd></div>}
          </dl>
        </section>

        {/* Servicio */}
        <section className="bg-white rounded-xl shadow p-5">
          <h2 className="font-bold mb-3 text-navy-950">Servicio</h2>
          <dl className="text-sm space-y-2">
            <div><dt className="text-gray-500 inline">Máquina:</dt> <dd className="font-semibold inline">{cot.maquinarias?.nombre || '—'}</dd></div>
            <div><dt className="text-gray-500 inline">Fecha:</dt> <dd className="inline">{new Date(cot.fecha_servicio).toLocaleDateString('es-CL')}</dd></div>
            <div><dt className="text-gray-500 inline">Ubicación:</dt> <dd className="inline">{cot.ubicacion_servicio}</dd></div>
            <div><dt className="text-gray-500 inline">Duración:</dt> <dd className="inline">{cot.unidades_solicitadas} {cot.unidad}{cot.unidades_solicitadas !== 1 ? 's' : ''}</dd></div>
            {cot.distancia_km > 0 && <div><dt className="text-gray-500 inline">Distancia:</dt> <dd className="inline">{cot.distancia_km} km (×2 ida+vuelta)</dd></div>}
            {cot.operarios > 0 && <div><dt className="text-gray-500 inline">Operarios:</dt> <dd className="inline">{cot.operarios}</dd></div>}
            {cot.notas_cliente && <div className="pt-2"><dt className="text-gray-500">Notas:</dt> <dd>{cot.notas_cliente}</dd></div>}
          </dl>
        </section>
      </div>

      {/* Desglose financiero */}
      <section className="bg-white rounded-xl shadow p-5 mb-6">
        <h2 className="font-bold mb-3 text-navy-950">Desglose</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-2 border-b text-gray-600">Uso de máquina</td>
              <td className="py-2 border-b text-right">{formatCLP(cot.precio_uso)}</td>
            </tr>
            {cot.traslado_combustible > 0 && (
              <tr><td className="py-2 border-b text-gray-600">Traslado combustible</td><td className="py-2 border-b text-right">{formatCLP(cot.traslado_combustible)}</td></tr>
            )}
            {cot.traslado_carga > 0 && (
              <tr><td className="py-2 border-b text-gray-600">Carga / descarga</td><td className="py-2 border-b text-right">{formatCLP(cot.traslado_carga)}</td></tr>
            )}
            {cot.traslado_operario > 0 && (
              <tr><td className="py-2 border-b text-gray-600">Operario tiempo trabajado</td><td className="py-2 border-b text-right">{formatCLP(cot.traslado_operario)}</td></tr>
            )}
            {cot.peajes > 0 && (
              <tr><td className="py-2 border-b text-gray-600">Peajes</td><td className="py-2 border-b text-right">{formatCLP(cot.peajes)}</td></tr>
            )}
            <tr><td className="py-2 border-b font-semibold">Subtotal neto</td><td className="py-2 border-b text-right font-semibold">{formatCLP(cot.subtotal_neto)}</td></tr>
            <tr><td className="py-2 border-b text-gray-600">IVA 19%</td><td className="py-2 border-b text-right">{formatCLP(cot.iva)}</td></tr>
            <tr><td className="py-3 font-bold text-lg">Total con IVA</td><td className="py-3 text-right font-bold text-lg text-orange-600">{formatCLP(cot.total)}</td></tr>
          </tbody>
        </table>

        <button
          type="button"
          onClick={() => setShowInternal((v) => !v)}
          className="mt-4 text-xs text-blue-600 hover:underline"
        >
          {showInternal ? 'Ocultar' : 'Mostrar'} reservas internas (admin only)
        </button>
        {showInternal && (
          <div className="mt-3 bg-amber-50 border border-amber-200 p-3 rounded text-sm">
            <p className="font-semibold mb-2 text-amber-900">P&L interno (no se muestra al cliente):</p>
            <p>Reserva mantención: <strong>{formatCLP(cot.reserva_mantencion)}</strong></p>
            <p>Utilidad real: <strong>{formatCLP(cot.utilidad_real)}</strong></p>
            <p className="mt-2 text-xs text-amber-700">
              Estos % se aplican sobre subtotal neto según tarifas vigentes al crear la cotización.
            </p>
          </div>
        )}
      </section>

      {/* Acciones */}
      <div className="flex gap-3">
        {cot.estado === 'aceptada' && (
          <button
            type="button"
            onClick={convertirAContrato}
            className="bg-orange-500 text-white px-4 py-2 rounded font-semibold hover:bg-orange-600"
          >
            Convertir a contrato →
          </button>
        )}
        <button
          type="button"
          onClick={() => window.open(`/api/admin/cotizaciones-arriendo/${id}/pdf`, '_blank')}
          className="bg-navy-950 text-white px-4 py-2 rounded font-semibold hover:bg-navy-800"
        >
          Ver PDF
        </button>
        {/* F1 Tier 6: duplicar para re-cotizar mismo cliente/máquina */}
        <button
          type="button"
          onClick={async () => {
            const ok = await confirm({
              title: '¿Duplicar esta cotización?',
              message: 'Se creará una nueva en estado "borrador" con los mismos datos (cliente + máquina + traslado). La fecha de servicio queda vacía para que elijas la nueva.',
              confirmLabel: 'Duplicar',
            });
            if (!ok) return;
            const res = await fetch(`/api/admin/cotizaciones-arriendo/${id}/duplicar`, { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.id) {
              window.location.href = `/admin/cotizaciones-arriendo/${data.id}`;
            } else {
              alert(data.error || 'No se pudo duplicar');
            }
          }}
          className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded font-semibold"
        >
          ↻ Duplicar
        </button>
      </div>
      <ConfirmDialogPortal />
    </div>
  );
}
