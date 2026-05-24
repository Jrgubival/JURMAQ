'use client';

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { SignaturePadHandle } from '@/app/contrato/firmar/[token]/SignaturePad';
import { formatCLP } from "@jurmaq/shared/format";
import { useConfirmDialog } from "@jurmaq/shared/ui/useConfirmDialog";
import GarantiaPanel from './GarantiaPanel';

// `react-signature-canvas` toca DOM/canvas APIs en mount → SSR off.
const SignaturePad = dynamic(
  () => import('@/app/contrato/firmar/[token]/SignaturePad'),
  { ssr: false, loading: () => <div className="h-40 bg-gray-50 border border-dashed border-gray-300 rounded flex items-center justify-center text-sm text-gray-500">Cargando area de firma…</div> }
);

type Estado =
  | 'borrador'
  | 'pendiente_firma'
  | 'firmado'
  | 'en_entrega'
  | 'vigente'
  | 'en_devolucion'
  | 'finalizado'
  | 'finalizado_con_cargo'
  | 'vencido'
  | 'anulado';

interface Contrato {
  id: number;
  numero: string | null;
  estado: Estado;
  maquinaria_id: number | null;
  maquinaria_nombre?: string | null;
  arrendatario_tipo?: 'natural' | 'juridica';
  arrendatario_nombre: string | null;
  arrendatario_rut: string | null;
  arrendatario_email?: string | null;
  arrendatario_telefono?: string | null;
  fecha_inicio: string | null;
  fecha_termino: string | null;
  precio_unidad?: string;
  precio_por_unidad?: number;
  precio_total?: number;
  garantia_monto?: number;
  direccion_entrega?: string;
  direccion_retiro?: string;
  observaciones?: string;
  con_operador?: boolean;
  operador_nombre?: string;
  signature_link_url?: string | null;
  firma_timestamp?: string | null;
  firma_ip?: string | null;
  firma_hash?: string | null;
  firma_arrendatario?: string | null;
  firma_arrendador?: string | null;
  firma_arrendador_at?: string | null;
  firma_arrendador_nombre?: string | null;
  created_at?: string;
  updated_at?: string;
}

const estadoConfig: Record<Estado, { bg: string; text: string; label: string }> = {
  borrador: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Borrador' },
  pendiente_firma: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendiente de firma' },
  firmado: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Firmado' },
  en_entrega: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'En entrega' },
  vigente: { bg: 'bg-green-100', text: 'text-green-700', label: 'Vigente' },
  en_devolucion: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'En devolución' },
  finalizado: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Finalizado' },
  finalizado_con_cargo: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Finalizado con cargo' },
  vencido: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Vencido' },
  anulado: { bg: 'bg-red-100', text: 'text-red-700', label: 'Anulado' },
};

const formatDate = (s?: string | null) => {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-CL');
};

const formatDateTime = (s?: string | null) => {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('es-CL');
};

export default function ContratoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { confirm, ConfirmDialogPortal } = useConfirmDialog();

  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionInfo, setActionInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmAnular, setConfirmAnular] = useState(false);

  // Firma JURMAQ (arrendador) state
  const [showJurmaqPad, setShowJurmaqPad] = useState(false);
  const jurmaqSigRef = useRef<SignaturePadHandle | null>(null);
  const handleJurmaqSigReady = useCallback(
    (h: SignaturePadHandle | null) => { jurmaqSigRef.current = h; },
    []
  );
  const [jurmaqSigBusy, setJurmaqSigBusy] = useState(false);

  async function firmarComoJurmaq() {
    if (!jurmaqSigRef.current) return;
    if (jurmaqSigRef.current.isEmpty()) {
      setActionError('La firma está vacía. Dibuja tu firma antes de guardar.');
      return;
    }
    setActionError('');
    setActionInfo('');
    setJurmaqSigBusy(true);
    try {
      const firmaBase64 = jurmaqSigRef.current.toDataURL('image/png');
      const res = await fetch(`/api/admin/contratos/${id}/firma-arrendador`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firma_base64: firmaBase64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || 'No se pudo guardar la firma JURMAQ.');
        return;
      }
      setActionInfo('Firma JURMAQ guardada.');
      setShowJurmaqPad(false);
      jurmaqSigRef.current?.clear();
      await fetchContrato();
    } catch {
      setActionError('Error de conexión al firmar.');
    } finally {
      setJurmaqSigBusy(false);
    }
  }

  async function borrarFirmaJurmaq() {
    const ok = await confirm({
      title: '¿Borrar la firma JURMAQ?',
      message: 'Solo se puede mientras el cliente no haya firmado todavía.',
      confirmLabel: 'Borrar firma',
      variant: 'danger',
    });
    if (!ok) return;
    setActionError('');
    setActionInfo('');
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/contratos/${id}/firma-arrendador`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || 'No se pudo borrar la firma.');
        return;
      }
      setActionInfo('Firma JURMAQ borrada.');
      await fetchContrato();
    } catch {
      setActionError('Error de conexión.');
    } finally {
      setBusy(false);
    }
  }

  const fetchContrato = async () => {
    try {
      const res = await fetch(`/api/admin/contratos/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo cargar el contrato');
      }
      const data = await res.json();
      setContrato(data);
    } catch (err: any) {
      setLoadError(err?.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContrato();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function updateEstado(nuevo: Estado) {
    setBusy(true);
    setActionError('');
    setActionInfo('');
    try {
      const res = await fetch(`/api/admin/contratos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo actualizar el estado');
      }
      await fetchContrato();
      setActionInfo(`Estado actualizado a ${nuevo}`);
    } catch (err: any) {
      setActionError(err?.message || 'Error al actualizar');
    } finally {
      setBusy(false);
    }
  }

  async function sendSignature() {
    setBusy(true);
    setActionError('');
    setActionInfo('');
    try {
      const res = await fetch(`/api/admin/contratos/${id}/send-signature`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo enviar el email');
      }
      await fetchContrato();
      setActionInfo('Email de firma enviado al arrendatario');
    } catch (err: any) {
      setActionError(err?.message || 'Error al enviar');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setActionError('');
    try {
      const res = await fetch(`/api/admin/contratos/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo eliminar');
      }
      router.push('/admin/contratos');
    } catch (err: any) {
      setActionError(err?.message || 'Error al eliminar');
      setBusy(false);
    }
  }

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

  if (loadError || !contrato) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/contratos"
          className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </Link>
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {loadError || 'Contrato no encontrado'}
        </div>
      </div>
    );
  }

  const est = estadoConfig[contrato.estado] || estadoConfig.borrador;
  const editable = contrato.estado === 'borrador' || contrato.estado === 'pendiente_firma';
  const deletable = contrato.estado === 'borrador';

  return (
    <div className="space-y-6">
      {/* Garantía Klap (lifecycle: entrega → vigente → devolución → cargo tardío) */}
      {contrato.estado !== 'borrador' && contrato.estado !== 'pendiente_firma' && (
        <GarantiaPanel
          contratoId={contrato.id}
          estado={contrato.estado}
          garantiaMetodo={(contrato as unknown as { garantia_metodo?: string }).garantia_metodo as
            | 'klap_hold'
            | 'cheque'
            | 'deposito_efectivo'
            | 'transferencia'
            | 'pagare'
            | null}
          garantiaMonto={contrato.garantia_monto ?? null}
          arrendatarioTelefono={contrato.arrendatario_telefono ?? null}
          onChange={() => fetchContrato()}
        />
      )}

      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Link
          href="/admin/contratos"
          className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mt-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">
              Contrato {contrato.numero || `#${contrato.id}`}
            </h1>
            <span
              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${est.bg} ${est.text}`}
            >
              {est.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Creado: {formatDateTime(contrato.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/admin/contratos/${contrato.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-sm font-medium rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition inline-flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Abrir PDF
          </a>
          <a
            href={`/api/admin/contratos/${contrato.id}/pdf?unsigned=1&print=1`}
            target="_blank"
            rel="noopener noreferrer"
            title="Abre el contrato con espacio para firma manual. Usa Cmd+P / Ctrl+P para imprimir o guardar como PDF."
            className="px-3 py-2 text-sm font-medium rounded-xl bg-navy-950 text-white hover:bg-navy-900 transition inline-flex items-center gap-1"
            style={{ backgroundColor: '#0c1d3a' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar sin firma
          </a>
        </div>
      </div>

      {(actionError || actionInfo) && (
        <div
          className={`p-3 rounded-xl text-sm border ${
            actionError
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-green-50 border-green-200 text-green-700'
          }`}
        >
          {actionError || actionInfo}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: metadata */}
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Resumen</h3>
            <dl className="space-y-2 text-sm">
              <MetaRow label="Maquinaria" value={contrato.maquinaria_nombre || `#${contrato.maquinaria_id}`} />
              <MetaRow label="Modalidad" value={contrato.precio_unidad ? `Por ${contrato.precio_unidad}` : '-'} />
              <MetaRow label="Fecha inicio" value={formatDate(contrato.fecha_inicio)} />
              <MetaRow label="Fecha termino" value={formatDate(contrato.fecha_termino)} />
              <MetaRow label={`Precio por ${contrato.precio_unidad || 'unidad'}`} value={formatCLP(contrato.precio_por_unidad ?? 0)} />
              <MetaRow label="Total" value={formatCLP(contrato.precio_total ?? 0)} highlight />
              <MetaRow label="Garantia" value={formatCLP(contrato.garantia_monto ?? 0)} />
              <MetaRow
                label="Operador"
                value={contrato.con_operador ? (contrato.operador_nombre || 'Si') : 'No'}
              />
            </dl>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Arrendatario</h3>
            <dl className="space-y-2 text-sm">
              <MetaRow
                label="Tipo"
                value={contrato.arrendatario_tipo === 'juridica' ? 'Empresa' : 'Persona natural'}
              />
              <MetaRow label="Nombre" value={contrato.arrendatario_nombre || '-'} />
              <MetaRow label="RUT" value={contrato.arrendatario_rut || '-'} />
              <MetaRow label="Email" value={contrato.arrendatario_email || '-'} />
              <MetaRow label="Telefono" value={contrato.arrendatario_telefono || '-'} />
            </dl>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Direcciones</h3>
            <dl className="space-y-2 text-sm">
              <MetaRow label="Entrega" value={contrato.direccion_entrega || '-'} />
              <MetaRow label="Retiro" value={contrato.direccion_retiro || '-'} />
            </dl>
            {contrato.observaciones && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <dt className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Observaciones
                </dt>
                <dd className="text-sm text-gray-700 whitespace-pre-wrap">
                  {contrato.observaciones}
                </dd>
              </div>
            )}
          </section>

          {/* Firma electronica */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Firma electronica</h3>
            {contrato.firma_timestamp ? (
              <>
                <dl className="space-y-2 text-sm">
                  <MetaRow
                    label="Fecha"
                    value={formatDateTime(contrato.firma_timestamp)}
                  />
                  <MetaRow label="IP" value={contrato.firma_ip || '-'} />
                  <MetaRow
                    label="Hash"
                    value={
                      contrato.firma_hash ? (
                        <span className="font-mono text-[10px] break-all">
                          {contrato.firma_hash}
                        </span>
                      ) : (
                        '-'
                      )
                    }
                  />
                </dl>
                {contrato.firma_arrendatario && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <dt className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                      Firma del arrendatario
                    </dt>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={contrato.firma_arrendatario}
                      alt="Firma del arrendatario"
                      className="max-w-full border border-gray-200 rounded bg-gray-50"
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Aun no ha sido firmado.</p>
            )}
          </section>

          {/* Firma del arrendador (JURMAQ) — admin firma desde acá */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Firma JURMAQ (arrendador)</h3>
              {contrato.firma_arrendador && !contrato.firma_arrendatario && (
                <button
                  type="button"
                  onClick={borrarFirmaJurmaq}
                  disabled={busy}
                  className="text-xs text-red-600 hover:underline"
                  title="Solo se puede borrar si el cliente aún no firmó"
                >
                  Borrar firma
                </button>
              )}
            </div>
            {contrato.firma_arrendador ? (
              <>
                <dl className="space-y-1 text-sm mb-3">
                  {contrato.firma_arrendador_nombre && (
                    <MetaRow label="Firmado por" value={contrato.firma_arrendador_nombre} />
                  )}
                  {contrato.firma_arrendador_at && (
                    <MetaRow label="Fecha" value={formatDateTime(contrato.firma_arrendador_at)} />
                  )}
                </dl>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={contrato.firma_arrendador}
                  alt="Firma JURMAQ"
                  className="max-w-full border border-gray-200 rounded bg-gray-50"
                />
              </>
            ) : showJurmaqPad ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-600">
                  Firma con el dedo (tablet) o con el mouse. Si te equivocas, borra y empieza de nuevo.
                </p>
                <div className="border border-gray-300 rounded bg-white">
                  <SignaturePad onReady={handleJurmaqSigReady} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={firmarComoJurmaq}
                    disabled={jurmaqSigBusy}
                    className="px-4 py-2 text-sm font-semibold rounded bg-gold-500 hover:bg-gold-600 disabled:bg-gold-300 text-navy-950"
                  >
                    {jurmaqSigBusy ? 'Guardando…' : 'Guardar firma JURMAQ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => jurmaqSigRef.current?.clear()}
                    disabled={jurmaqSigBusy}
                    className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
                  >
                    Limpiar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowJurmaqPad(false)}
                    disabled={jurmaqSigBusy}
                    className="px-4 py-2 text-sm rounded text-gray-600 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  Aún no has firmado este contrato como JURMAQ.
                </p>
                <button
                  type="button"
                  onClick={() => setShowJurmaqPad(true)}
                  className="px-4 py-2 text-sm font-semibold rounded bg-navy-900 hover:bg-navy-800 text-white"
                >
                  Firmar como JURMAQ
                </button>
              </div>
            )}
          </section>

          {/* Actions */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Acciones</h3>

            {contrato.estado === 'borrador' && (
              <>
                <button
                  onClick={sendSignature}
                  disabled={busy}
                  className="w-full px-4 py-2 text-sm font-semibold rounded-xl text-white hover:opacity-90 disabled:opacity-50 transition"
                  style={{ backgroundColor: '#ea580c' }}
                >
                  {busy ? 'Enviando...' : 'Enviar para firma'}
                </button>
                <p className="text-xs text-gray-500">
                  Edita desde la seccion izquierda; se reutiliza el wizard para cambios
                  mayores.
                </p>
              </>
            )}

            {contrato.estado === 'pendiente_firma' && (
              <>
                {contrato.signature_link_url && (
                  <a
                    href={contrato.signature_link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                  >
                    Ver link de firma
                  </a>
                )}
                <button
                  onClick={sendSignature}
                  disabled={busy}
                  className="w-full px-4 py-2 text-sm font-semibold rounded-xl text-white hover:opacity-90 disabled:opacity-50 transition"
                  style={{ backgroundColor: '#0c1d3a' }}
                >
                  {busy ? 'Enviando...' : 'Reenviar email'}
                </button>
                {confirmAnular ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateEstado('anulado')}
                      disabled={busy}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition"
                    >
                      Confirmar anular
                    </button>
                    <button
                      onClick={() => setConfirmAnular(false)}
                      className="px-3 py-2 text-sm font-medium rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmAnular(true)}
                    disabled={busy}
                    className="w-full px-4 py-2 text-sm font-medium rounded-xl border border-red-200 text-red-700 hover:bg-red-50 transition"
                  >
                    Anular
                  </button>
                )}
              </>
            )}

            {contrato.estado === 'firmado' && (
              <>
                <button
                  onClick={() => updateEstado('vigente')}
                  disabled={busy}
                  className="w-full px-4 py-2 text-sm font-semibold rounded-xl text-white hover:opacity-90 disabled:opacity-50 transition"
                  style={{ backgroundColor: '#0c1d3a' }}
                >
                  Marcar como vigente
                </button>
              </>
            )}

            {contrato.estado === 'vigente' && (
              <>
                <button
                  onClick={() => updateEstado('vencido')}
                  disabled={busy}
                  className="w-full px-4 py-2 text-sm font-medium rounded-xl border border-orange-200 text-orange-700 hover:bg-orange-50 disabled:opacity-50 transition"
                >
                  Marcar como vencido
                </button>
                {confirmAnular ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateEstado('anulado')}
                      disabled={busy}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition"
                    >
                      Confirmar anular
                    </button>
                    <button
                      onClick={() => setConfirmAnular(false)}
                      className="px-3 py-2 text-sm font-medium rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmAnular(true)}
                    disabled={busy}
                    className="w-full px-4 py-2 text-sm font-medium rounded-xl border border-red-200 text-red-700 hover:bg-red-50 transition"
                  >
                    Anular
                  </button>
                )}
              </>
            )}

            {(contrato.estado === 'vencido' || contrato.estado === 'anulado') && (
              <p className="text-sm text-gray-500">
                Este contrato esta en estado final. Solo lectura.
              </p>
            )}

            {deletable && (
              <div className="pt-3 border-t border-gray-100">
                {confirmDelete ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={busy}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition"
                    >
                      Confirmar eliminar
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-2 text-sm font-medium rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                    className="w-full px-4 py-2 text-sm font-medium rounded-xl border border-red-200 text-red-700 hover:bg-red-50 transition"
                  >
                    Eliminar borrador
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Right column: PDF preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Vista previa</h3>
              <a
                href={`/api/admin/contratos/${contrato.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-800 underline"
              >
                Abrir en nueva pestana
              </a>
            </div>
            <iframe
              src={`/api/admin/contratos/${contrato.id}/pdf`}
              title="Contrato PDF"
              className="w-full"
              style={{ height: '85vh', border: 0 }}
            />
          </div>
        </div>
      </div>
      <ConfirmDialogPortal />
    </div>
  );
}

function MetaRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs text-gray-500 uppercase tracking-wider shrink-0">{label}</dt>
      <dd
        className={`text-sm text-right ${
          highlight ? 'font-bold' : 'font-medium text-gray-900'
        }`}
        style={highlight ? { color: '#e6b422' } : {}}
      >
        {value}
      </dd>
    </div>
  );
}
