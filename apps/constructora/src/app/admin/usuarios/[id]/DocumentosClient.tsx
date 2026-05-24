'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface Documento {
  id: number;
  user_id: number;
  tipo: TipoDocumento;
  nombre: string;
  descripcion: string | null;
  archivo_path: string;
  archivo_mime: string;
  archivo_size_bytes: number;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  created_at: string;
  preview_url: string | null;
}

type TipoDocumento =
  | 'licencia_municipal'
  | 'cedula'
  | 'contrato_laboral'
  | 'capacitacion'
  | 'examen_psicosensometrico'
  | 'foto'
  | 'otro';

const TIPO_LABELS: Record<TipoDocumento, string> = {
  licencia_municipal: 'Licencia municipal',
  cedula: 'Cédula',
  contrato_laboral: 'Contrato laboral',
  capacitacion: 'Capacitación',
  examen_psicosensometrico: 'Examen psicosensométrico',
  foto: 'Foto',
  otro: 'Otro',
};

const TIPO_ICONS: Record<TipoDocumento, string> = {
  licencia_municipal: '🪪',
  cedula: '🆔',
  contrato_laboral: '📄',
  capacitacion: '🎓',
  examen_psicosensometrico: '🩺',
  foto: '📷',
  otro: '📎',
};

const TIPOS_LIST: TipoDocumento[] = [
  'licencia_municipal',
  'cedula',
  'contrato_laboral',
  'capacitacion',
  'examen_psicosensometrico',
  'foto',
  'otro',
];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  const now = Date.now();
  if (isNaN(target)) return null;
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}

export default function DocumentosClient({
  userId,
  userName,
}: {
  userId: number;
  userName: string;
}) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrationMissing, setMigrationMissing] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formTipo, setFormTipo] = useState<TipoDocumento>('licencia_municipal');
  const [formNombre, setFormNombre] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formFechaEmision, setFormFechaEmision] = useState('');
  const [formFechaVencimiento, setFormFechaVencimiento] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletePending, setDeletePending] = useState<number | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/usuarios/${userId}/documentos`, { credentials: 'include' });
      const data = await res.json();
      if (res.status === 503) {
        setMigrationMissing(true);
        setDocumentos([]);
        setError(null);
      } else if (!res.ok) {
        setError(data?.error || 'No se pudieron cargar los documentos');
      } else {
        setDocumentos(data.documentos || []);
        setError(null);
      }
    } catch {
      setError('Error de red al cargar documentos');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const grouped = useMemo(() => {
    const out: Record<TipoDocumento, Documento[]> = {} as Record<TipoDocumento, Documento[]>;
    for (const t of TIPOS_LIST) out[t] = [];
    for (const d of documentos) out[d.tipo].push(d);
    return out;
  }, [documentos]);

  const totalCount = documentos.length;

  function resetForm() {
    setFormTipo('licencia_municipal');
    setFormNombre('');
    setFormDescripcion('');
    setFormFechaEmision('');
    setFormFechaVencimiento('');
    setFormFile(null);
    setFormError(null);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!formFile) return setFormError('Selecciona un archivo');
    if (formFile.size > 10 * 1024 * 1024) return setFormError('Archivo excede 10MB');
    if (formNombre.trim().length === 0) return setFormError('Nombre requerido');
    if (formFechaEmision && formFechaVencimiento && formFechaVencimiento < formFechaEmision) {
      return setFormError('Vencimiento no puede ser anterior a emisión');
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', formFile);
      fd.append('tipo', formTipo);
      fd.append('nombre', formNombre.trim());
      if (formDescripcion.trim()) fd.append('descripcion', formDescripcion.trim());
      if (formFechaEmision) fd.append('fecha_emision', formFechaEmision);
      if (formFechaVencimiento) fd.append('fecha_vencimiento', formFechaVencimiento);

      const res = await fetch(`/api/admin/usuarios/${userId}/documentos`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data?.error || 'Error al subir el archivo');
        return;
      }
      if (data.documento) {
        setDocumentos((prev) => [data.documento, ...prev]);
      } else {
        await fetchDocs();
      }
      resetForm();
      setShowForm(false);
    } catch {
      setFormError('Error de red al subir');
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete(id: number) {
    setDeletePending(id);
    try {
      const res = await fetch(`/api/admin/usuarios/${userId}/documentos/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || 'Error al eliminar');
        return;
      }
      setDocumentos((prev) => prev.filter((d) => d.id !== id));
      setDeletingId(null);
    } catch {
      alert('Error de red al eliminar');
    } finally {
      setDeletePending(null);
    }
  }

  if (migrationMissing) {
    return (
      <section className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <h2 className="font-semibold text-amber-900 mb-2">Falta migración SQL</h2>
        <p className="text-sm text-amber-800 mb-3">
          La tabla <code className="bg-amber-100 px-1 rounded">users_documentos</code> y el
          bucket <code className="bg-amber-100 px-1 rounded">users-documentos</code> no existen.
          Ejecuta:
        </p>
        <pre className="text-xs bg-amber-900 text-amber-50 p-3 rounded overflow-x-auto">
          apps/constructora/scripts/migrate-users-documentos.sql
        </pre>
        <p className="text-xs text-amber-700 mt-2">
          (Idempotente — Supabase Dashboard → SQL Editor → pegar y RUN.)
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <header className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-navy-950 flex items-center gap-2">
            Documentos
            <span className="text-sm font-normal text-gray-500">({totalCount})</span>
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Licencias, contratos, capacitaciones y otros documentos de {userName}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setFormError(null); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy-950 hover:bg-navy-800 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Subir documento'}
        </button>
      </header>

      {showForm && (
        <form onSubmit={handleUpload} className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="udoc-tipo" className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">
                Tipo *
              </label>
              <select
                id="udoc-tipo"
                value={formTipo}
                onChange={(e) => setFormTipo(e.target.value as TipoDocumento)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
              >
                {TIPOS_LIST.map((t) => (
                  <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="udoc-nombre" className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">
                Nombre *
              </label>
              <input
                id="udoc-nombre"
                type="text"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Ej: Licencia clase B vigente"
                maxLength={200}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="udoc-descripcion" className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">
              Descripción
            </label>
            <input
              id="udoc-descripcion"
              type="text"
              value={formDescripcion}
              onChange={(e) => setFormDescripcion(e.target.value)}
              placeholder="Notas opcionales"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="udoc-emi" className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">
                Fecha emisión
              </label>
              <input
                id="udoc-emi"
                type="date"
                value={formFechaEmision}
                onChange={(e) => setFormFechaEmision(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500 tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="udoc-venc" className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">
                Fecha vencimiento
              </label>
              <input
                id="udoc-venc"
                type="date"
                value={formFechaVencimiento}
                onChange={(e) => setFormFechaVencimiento(e.target.value)}
                min={formFechaEmision || undefined}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500 tabular-nums"
              />
            </div>
          </div>

          <div>
            <label htmlFor="udoc-file" className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">
              Archivo (PDF, JPG, PNG, WEBP — máx 10MB) *
            </label>
            <input
              id="udoc-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setFormFile(e.target.files?.[0] || null)}
              required
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-navy-50 file:text-navy-700 hover:file:bg-navy-100"
            />
            {formFile && (
              <p className="text-xs text-gray-500 mt-1 tabular-nums">
                {formFile.name} · {formatBytes(formFile.size)}
              </p>
            )}
          </div>

          {formError && (
            <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
              {formError}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={uploading}
              aria-busy={uploading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 disabled:cursor-not-allowed text-navy-950 text-sm font-bold rounded-xl transition-colors"
            >
              {uploading ? 'Subiendo…' : 'Subir documento'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
              disabled={uploading}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Cargando documentos…</div>
      ) : error ? (
        <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-3 rounded">
          {error}
        </div>
      ) : totalCount === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-500 text-sm">Aún no hay documentos para {userName}.</p>
          <p className="text-gray-500 text-xs mt-1">Sube licencia, cédula, contrato, capacitación…</p>
        </div>
      ) : (
        <div className="space-y-6">
          {TIPOS_LIST.filter((t) => grouped[t].length > 0).map((tipo) => (
            <div key={tipo}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2">
                <span aria-hidden="true">{TIPO_ICONS[tipo]}</span>
                {TIPO_LABELS[tipo]}
                <span className="text-gray-500 font-normal">({grouped[tipo].length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {grouped[tipo].map((doc) => (
                  <DocCard
                    key={doc.id}
                    doc={doc}
                    userId={userId}
                    onDeleteRequest={() => setDeletingId(doc.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {deletingId !== null && (
        <ConfirmDelete
          onCancel={() => setDeletingId(null)}
          onConfirm={() => confirmDelete(deletingId)}
          pending={deletePending === deletingId}
        />
      )}
    </section>
  );
}

function DocCard({
  doc,
  userId,
  onDeleteRequest,
}: {
  doc: Documento;
  userId: number;
  onDeleteRequest: () => void;
}) {
  const dv = daysUntil(doc.fecha_vencimiento);
  let vencBadge: { label: string; cls: string } | null = null;
  if (dv !== null) {
    if (dv < 0) vencBadge = { label: 'Vencido', cls: 'bg-red-100 text-red-700' };
    else if (dv <= 30) vencBadge = { label: `Vence en ${dv}d`, cls: 'bg-amber-100 text-amber-700' };
    else vencBadge = { label: `Vence ${formatDate(doc.fecha_vencimiento)}`, cls: 'bg-gray-100 text-gray-600' };
  }

  return (
    <article className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
      <header className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-semibold text-sm text-navy-950 leading-tight">{doc.nombre}</h4>
        {vencBadge && (
          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${vencBadge.cls}`}>
            {vencBadge.label}
          </span>
        )}
      </header>
      {doc.descripcion && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{doc.descripcion}</p>
      )}
      <dl className="text-xs text-gray-500 space-y-0.5 mb-3 tabular-nums">
        {doc.fecha_emision && (
          <div>Emisión: <span className="text-gray-700">{formatDate(doc.fecha_emision)}</span></div>
        )}
        <div>{formatBytes(doc.archivo_size_bytes)} · {doc.archivo_mime.replace('application/', '').replace('image/', '')}</div>
      </dl>
      <div className="flex items-center gap-2">
        <a
          href={`/api/admin/usuarios/${userId}/documentos/${doc.id}/download`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy-950 hover:bg-navy-800 text-white text-xs font-semibold rounded transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Descargar
        </a>
        {doc.preview_url && doc.archivo_mime !== 'application/pdf' && (
          <a
            href={doc.preview_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 hover:border-gray-400 text-gray-700 text-xs font-semibold rounded transition-colors"
          >
            Ver
          </a>
        )}
        <button
          type="button"
          onClick={onDeleteRequest}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded transition-colors ml-auto"
        >
          Eliminar
        </button>
      </div>
    </article>
  );
}

function ConfirmDelete({
  onCancel,
  onConfirm,
  pending,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl border border-gray-200 max-w-sm w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-navy-950 mb-2">¿Eliminar documento?</h3>
        <p className="text-sm text-gray-600 mb-4">
          Esto borra el archivo del almacenamiento y el registro de la base de datos. No se puede deshacer.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
          >
            {pending ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}
