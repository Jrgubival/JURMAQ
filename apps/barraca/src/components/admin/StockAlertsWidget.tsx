'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ProductoAlerta {
  id: number;
  codigo: string | null;
  nombre: string;
  stock: number;
  precio: number;
  categoria_id: number | null;
}

interface AlertsResp {
  umbral: number;
  total: number;
  sin_stock: number;
  bajo_stock: number;
  items: ProductoAlerta[];
}

/**
 * Widget compacto para el dashboard admin barraca. Muestra alertas de stock
 * (sin stock + bajo stock) con dropdown lista. Click → /admin/productos
 * filtrado.
 */
export default function StockAlertsWidget({ umbral = 5 }: { umbral?: number }) {
  const [data, setData] = useState<AlertsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/stock-alerts?umbral=${umbral}`);
        if (res.ok) {
          const json = (await res.json()) as AlertsResp;
          if (!cancelled) setData(json);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [umbral]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-400">
        Cargando alertas de stock…
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
        ✓ Stock OK — no hay productos con stock bajo.
      </div>
    );
  }

  return (
    <div
      className={`bg-white border rounded-xl ${
        data.sin_stock > 0 ? 'border-red-300' : 'border-amber-300'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl text-left"
      >
        <div className="flex items-center gap-3 flex-wrap">
          {data.sin_stock > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
              <span aria-hidden>⚠</span> {data.sin_stock} sin stock
            </span>
          )}
          {data.bajo_stock > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
              {data.bajo_stock} stock bajo (≤{umbral})
            </span>
          )}
          <span className="text-sm text-gray-600">
            {data.total} producto{data.total !== 1 ? 's' : ''} requieren atención
          </span>
        </div>
        <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 max-h-72 overflow-y-auto">
          <ul className="divide-y divide-gray-100">
            {data.items.slice(0, 20).map((p) => (
              <li key={p.id} className="px-4 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/productos`}
                    className="text-sm font-medium text-gray-900 hover:text-orange-600 truncate block"
                  >
                    {p.nombre}
                  </Link>
                  {p.codigo && <div className="text-xs text-gray-500">{p.codigo}</div>}
                </div>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                    p.stock === 0
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  Stock: {p.stock}
                </span>
              </li>
            ))}
          </ul>
          {data.items.length > 20 && (
            <div className="px-4 py-2 text-xs text-gray-500 text-center border-t border-gray-100">
              +{data.items.length - 20} más. <Link href="/admin/productos" className="text-orange-600 hover:underline">Ver todos</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
