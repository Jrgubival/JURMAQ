'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Tier 6 F4: vista completa de notificaciones admin constructora.
 */

interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: 'info' | 'success' | 'warning' | 'error';
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
  read_at: string | null;
}

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
};

const KIND_LABEL: Record<string, string> = {
  cotizacion_arriendo_nueva: 'Cotización arriendo nueva',
  contrato_firmado: 'Contrato firmado',
  klap_renovacion_fallo: 'Klap: fallo renovación hold',
  mantencion_proxima: 'Mantención próxima',
  cedula_proxima_a_purgar: 'Cédula próxima a purgar',
  otp_fail: 'Fallo OTP firma',
  otro: 'Otro',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

export default function NotificacionesPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'todas' | 'no_leidas'>('todas');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (filter === 'no_leidas') params.set('onlyUnread', 'true');
    const res = await fetch(`/api/admin/notifications?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      setUnreadCount(data.unread_count || 0);
    }
    setLoading(false);
  }

  async function markRead(n: Notification) {
    if (n.read_at) return;
    await fetch(`/api/admin/notifications/${n.id}/read`, { method: 'POST' });
    setItems((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    const res = await fetch('/api/admin/notifications/read-all', { method: 'POST' });
    if (res.ok) {
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnreadCount(0);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0
              ? `Tienes ${unreadCount} notificación${unreadCount !== 1 ? 'es' : ''} sin leer`
              : 'Todo al día ✓'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="px-3 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90"
            style={{ backgroundColor: '#0c1d3a' }}
          >
            Marcar todas leídas
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {(['todas', 'no_leidas'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              filter === f
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-300 text-gray-700'
            }`}
          >
            {f === 'todas' ? 'Todas' : 'No leídas'}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500">
            {filter === 'no_leidas' ? 'Sin notificaciones no leídas.' : 'Sin notificaciones.'}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((n) => {
              const isUnread = !n.read_at;
              return (
                <li key={n.id} style={isUnread ? { backgroundColor: '#fffbeb' } : undefined}>
                  <div className="px-4 py-4 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            SEVERITY_BADGE[n.severity] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {KIND_LABEL[n.kind] ?? n.kind}
                        </span>
                        <span className="text-xs text-gray-500">{timeAgo(n.created_at)}</span>
                        {isUnread && (
                          <span className="text-xs font-semibold" style={{ color: '#a16207' }}>
                            ● nuevo
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-sm ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}
                      >
                        {n.title}
                      </p>
                      {n.body && <p className="text-xs text-gray-500 mt-1">{n.body}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => void markRead(n)}
                          className="text-xs font-medium hover:underline whitespace-nowrap"
                          style={{ color: '#0c1d3a' }}
                        >
                          Ver detalle →
                        </Link>
                      )}
                      {isUnread && (
                        <button
                          onClick={() => void markRead(n)}
                          className="text-[10px] text-gray-500 hover:text-gray-700"
                        >
                          Marcar leída
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
