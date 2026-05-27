"use client"

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StarRating from '@/components/barraca/StarRating';

interface Review {
  id: string;
  usuario_id: number;
  producto_id: number;
  rating: number;
  titulo: string | null;
  comentario: string | null;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  usuario_nombre: string;
  compra_verificada: boolean;
  utiles_count: number;
  moderado_at: string | null;
  notas_moderacion: string | null;
  created_at: string;
  barraca_productos: { id: number; nombre: string; slug: string } | null;
  barraca_usuarios: { email: string | null } | null;
}

const ESTADO_COLOR: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  aprobada: 'bg-green-100 text-green-700',
  rechazada: 'bg-gray-100 text-gray-500',
};

export default function ReviewsAdminPage() {
  const [items, setItems] = useState<Review[]>([]);
  const [pendientesCount, setPendientesCount] = useState(0);
  const [estado, setEstado] = useState<'pendiente' | 'aprobada' | 'rechazada'>('pendiente');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [estado]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/reviews?estado=${estado}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      setPendientesCount(data.pendientesCount || 0);
    }
    setLoading(false);
  }

  async function moderar(id: string, nuevoEstado: 'aprobada' | 'rechazada') {
    setActing(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (res.ok) await load();
    } finally {
      setActing(null);
    }
  }

  async function eliminar(id: string) {
    if (!confirm('Eliminar review físicamente? (Considera usar "rechazar" en su lugar)')) return;
    setActing(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      if (res.ok) await load();
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Moderación de Reviews</h1>
        <p className="text-sm text-gray-500">
          Aprobá o rechazá reseñas de productos. Las reviews con compra verificada se auto-aprueban;
          las de usuarios sin compra van a cola de moderación.
        </p>
      </div>

      {pendientesCount > 0 && estado !== 'pendiente' && (
        <button
          onClick={() => setEstado('pendiente')}
          className="mb-4 px-4 py-2 bg-amber-100 text-amber-800 text-sm rounded-xl hover:bg-amber-200"
        >
          ⚠️ {pendientesCount} review{pendientesCount !== 1 ? 's' : ''} pendiente{pendientesCount !== 1 ? 's' : ''} de moderación
        </button>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(['pendiente', 'aprobada', 'rechazada'] as const).map((e) => (
          <button
            key={e}
            onClick={() => setEstado(e)}
            className={`px-4 py-2 text-sm rounded-xl whitespace-nowrap ${
              estado === e
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            {e.charAt(0).toUpperCase() + e.slice(1)}
            {e === 'pendiente' && pendientesCount > 0 && (
              <span className="ml-2 inline-block px-1.5 py-0.5 bg-amber-500 text-white text-[10px] rounded-full">
                {pendientesCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-sm text-gray-500">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            Sin reviews en estado &ldquo;{estado}&rdquo;.
          </div>
        ) : (
          items.map((r) => (
            <article key={r.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <header className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <StarRating value={r.rating} size="sm" />
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        ESTADO_COLOR[r.estado]
                      }`}
                    >
                      {r.estado}
                    </span>
                    {r.compra_verificada && (
                      <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded-full">
                        ✓ Compra verificada
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/categorias/${r.barraca_productos?.slug ?? r.producto_id}`}
                    target="_blank"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Producto: {r.barraca_productos?.nombre ?? `#${r.producto_id}`} ↗
                  </Link>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString('es-CL')}
                </span>
              </header>

              {r.titulo && <h3 className="font-semibold text-gray-900">{r.titulo}</h3>}
              {r.comentario && (
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{r.comentario}</p>
              )}

              <footer className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  {r.usuario_nombre} {r.barraca_usuarios?.email ? `· ${r.barraca_usuarios.email}` : ''}
                </span>
                <div className="flex gap-2">
                  {r.estado !== 'aprobada' && (
                    <button
                      onClick={() => moderar(r.id, 'aprobada')}
                      disabled={acting === r.id}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded disabled:opacity-50"
                    >
                      ✓ Aprobar
                    </button>
                  )}
                  {r.estado !== 'rechazada' && (
                    <button
                      onClick={() => moderar(r.id, 'rechazada')}
                      disabled={acting === r.id}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded disabled:opacity-50"
                    >
                      ✗ Rechazar
                    </button>
                  )}
                  <button
                    onClick={() => eliminar(r.id)}
                    disabled={acting === r.id}
                    className="px-3 py-1 bg-white border border-red-300 hover:bg-red-50 text-red-700 text-xs rounded disabled:opacity-50"
                  >
                    🗑 Eliminar
                  </button>
                </div>
              </footer>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
