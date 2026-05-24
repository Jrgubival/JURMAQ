'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface SearchHit {
  tipo: 'maquinaria' | 'cliente' | 'cotizacion' | 'contrato' | 'factura_combustible';
  titulo: string;
  subtitulo?: string;
  href: string;
}

const tipoLabel: Record<string, string> = {
  maquinaria: '🏗 Maquinaria',
  cliente: '👤 Cliente',
  cotizacion: '📋 Cotización',
  contrato: '📑 Contrato',
  factura_combustible: '⛽ Factura',
};

const tipoColor: Record<string, string> = {
  maquinaria: 'bg-blue-100 text-blue-700',
  cliente: 'bg-purple-100 text-purple-700',
  cotizacion: 'bg-amber-100 text-amber-700',
  contrato: 'bg-green-100 text-green-700',
  factura_combustible: 'bg-gray-100 text-gray-700',
};

/**
 * F2-UI Tier 6: Búsqueda global cross-modulo en AdminShell.
 *
 * UX:
 *   - Cmd+K (Mac) / Ctrl+K (Win) abre el modal
 *   - Esc cierra
 *   - Flechas + Enter para navegar resultados
 *   - Debounce 300ms
 *
 * Backend: /api/admin/search?q=...
 */
export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atajo de teclado global Cmd+K / Ctrl+K + Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus input cuando abre.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setHits(data.hits || []);
          setActiveIdx(0);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, open]);

  // Flechas + Enter.
  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && hits[activeIdx]) {
      e.preventDefault();
      window.location.href = hits[activeIdx].href;
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-white border border-gray-200 hover:border-gray-300 rounded-lg w-full max-w-sm"
        aria-label="Buscar (Cmd+K)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="text-[10px] font-mono text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">⌘K</kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Buscar máquinas, clientes, cotizaciones, contratos, facturas…"
            className="flex-1 text-sm outline-none placeholder:text-gray-500"
          />
          <kbd className="text-[10px] font-mono text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {q.trim().length < 2 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
              Empieza a tipear para buscar (min 2 caracteres)
            </div>
          ) : loading ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">Buscando…</div>
          ) : hits.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">Sin resultados para "{q}"</div>
          ) : (
            <ul className="py-2">
              {hits.map((hit, idx) => (
                <li key={`${hit.tipo}-${hit.href}`}>
                  <Link
                    href={hit.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-orange-50 transition ${
                      idx === activeIdx ? 'bg-orange-50' : ''
                    }`}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                        tipoColor[hit.tipo] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {tipoLabel[hit.tipo] ?? hit.tipo}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{hit.titulo}</p>
                      {hit.subtitulo && (
                        <p className="text-xs text-gray-500 truncate">{hit.subtitulo}</p>
                      )}
                    </div>
                    <span className="text-gray-300">↵</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500 flex items-center gap-4">
          <span>↑↓ Navegar</span>
          <span>↵ Ir</span>
          <span>Esc Cerrar</span>
        </div>
      </div>
    </div>
  );
}
