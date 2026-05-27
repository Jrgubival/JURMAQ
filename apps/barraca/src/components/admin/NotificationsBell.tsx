"use client"

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * Tier 6 F4: bell con badge + dropdown de notificaciones admin barraca.
 *
 * Polling cada 60s para mantener fresh sin sobrecargar el endpoint. Si el
 * usuario abre el dropdown, refresca al toque. Click fuera del dropdown
 * cierra.
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

const POLL_INTERVAL_MS = 60_000;

const SEVERITY_COLOR: Record<string, string> = {
  info: 'border-blue-200 bg-blue-50',
  success: 'border-green-200 bg-green-50',
  warning: 'border-amber-200 bg-amber-50',
  error: 'border-red-200 bg-red-50',
};

const SEVERITY_ICON: Record<string, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '🚨',
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

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Polling.
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  // Refresh al abrir.
  useEffect(() => {
    if (open) void load();
  }, [open]);

  // Click outside cierra.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/notifications?limit=10');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setUnreadCount(data.unread_count || 0);
      }
    } finally {
      setLoading(false);
    }
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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} no leídas)` : ''}`}
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[95vw] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-orange-600 hover:underline"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">Cargando…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Sin notificaciones nuevas
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map((n) => {
                  const isUnread = !n.read_at;
                  const content = (
                    <div
                      className={`px-4 py-3 flex items-start gap-3 ${
                        isUnread ? 'bg-orange-50/40' : ''
                      } ${SEVERITY_COLOR[n.severity] ?? ''} border-l-4 border-l-transparent ${
                        isUnread
                          ? n.severity === 'warning'
                            ? 'border-l-amber-500'
                            : n.severity === 'success'
                            ? 'border-l-green-500'
                            : n.severity === 'error'
                            ? 'border-l-red-500'
                            : 'border-l-blue-500'
                          : ''
                      }`}
                    >
                      <span className="text-base shrink-0">{SEVERITY_ICON[n.severity] ?? 'ℹ️'}</span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'} truncate`}
                        >
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                        )}
                        <p className="text-[10px] text-gray-500 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                      )}
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => {
                            void markRead(n);
                            setOpen(false);
                          }}
                          className="block hover:bg-gray-50 transition-colors"
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void markRead(n)}
                          className="block w-full text-left hover:bg-gray-50 transition-colors"
                        >
                          {content}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="px-4 py-2 border-t border-gray-100 text-center">
            <Link
              href="/admin/notificaciones"
              onClick={() => setOpen(false)}
              className="text-xs text-orange-600 hover:underline"
            >
              Ver todas →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
