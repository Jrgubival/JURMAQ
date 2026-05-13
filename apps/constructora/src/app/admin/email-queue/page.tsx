'use client';

import { useState, useEffect, useCallback } from 'react';

interface QueueItem {
  id: number;
  to_email: string;
  subject: string;
  template_kind: string;
  context: Record<string, unknown> | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_attempt_at: string;
  status: string;
  created_at: string;
  sent_at: string | null;
}

interface Counts {
  pending: number;
  sent: number;
  failed: number;
  dropped: number;
}

const STATUS_TABS: Array<{ key: string; label: string; color: string }> = [
  { key: 'pending', label: 'Pendientes', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  { key: 'failed', label: 'Fallidos', color: 'text-red-700 bg-red-50 border-red-200' },
  { key: 'sent', label: 'Enviados', color: 'text-green-700 bg-green-50 border-green-200' },
  { key: 'dropped', label: 'Descartados', color: 'text-gray-700 bg-gray-50 border-gray-200' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

export default function EmailQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, sent: 0, failed: 0, dropped: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('failed');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/email-queue?status=${statusFilter}&limit=100`);
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error' });
        return;
      }
      setItems(data.items || []);
      setCounts(data.counts || { pending: 0, sent: 0, failed: 0, dropped: 0 });
    } catch {
      setMsg({ kind: 'err', text: 'Error de conexion' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  async function handleAction(id: number, action: 'retry_now' | 'drop') {
    if (action === 'drop' && !confirm('Descartar este email definitivamente? No se reintentara.')) return;
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/email-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error' });
        return;
      }
      setMsg({ kind: 'ok', text: action === 'retry_now' ? 'Reintento programado' : 'Email descartado' });
      fetchQueue();
    } catch {
      setMsg({ kind: 'err', text: 'Error de conexion' });
    } finally {
      setActionLoading(null);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cola de Emails</h1>
          <p className="text-sm text-gray-500">Reintentos automaticos por backoff. Aqui ves los que fallaron y puedes forzar retry o descartar.</p>
        </div>
        <button
          onClick={fetchQueue}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? 'Cargando...' : 'Refrescar'}
        </button>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.kind === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${statusFilter === t.key ? t.color : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}
          >
            {t.label} <span className="ml-1.5 text-xs opacity-70">({counts[t.key as keyof Counts] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {items.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            No hay emails en estado &quot;{statusFilter}&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Para</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Asunto</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Tipo</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Intentos</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Ultimo error</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Proximo</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-gray-100 align-top">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 break-all max-w-[180px]">{it.to_email}</td>
                    <td className="px-4 py-3 text-gray-900 max-w-[260px]" title={it.subject}>{it.subject}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-600">{it.template_kind}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold ${it.attempts >= it.max_attempts ? 'text-red-700' : 'text-gray-700'}`}>
                        {it.attempts}/{it.max_attempts}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-red-700 max-w-[300px] break-words" title={it.last_error || ''}>
                      {it.last_error ? (it.last_error.length > 80 ? it.last_error.substring(0, 80) + '...' : it.last_error) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{formatDate(it.next_attempt_at)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {(it.status === 'pending' || it.status === 'failed') && (
                        <>
                          <button
                            onClick={() => handleAction(it.id, 'retry_now')}
                            disabled={actionLoading === it.id}
                            className="px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 border border-blue-300 rounded mr-2 disabled:opacity-50"
                          >
                            Reintentar ya
                          </button>
                          <button
                            onClick={() => handleAction(it.id, 'drop')}
                            disabled={actionLoading === it.id}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 border border-gray-300 rounded disabled:opacity-50"
                          >
                            Descartar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
