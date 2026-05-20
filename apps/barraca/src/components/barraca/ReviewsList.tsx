'use client';

import { useEffect, useState } from 'react';
import StarRating from './StarRating';
import ReviewForm from './ReviewForm';

interface Review {
  id: string;
  rating: number;
  titulo: string | null;
  comentario: string | null;
  usuario_nombre: string;
  compra_verificada: boolean;
  utiles_count: number;
  created_at: string;
}

interface RatingAgg {
  total_reviews: number;
  rating_promedio: number | null;
  r5: number;
  r4: number;
  r3: number;
  r2: number;
  r1: number;
}

/**
 * Sección completa de reviews en página de producto:
 *   - Resumen (avg + distribución por estrellas)
 *   - Form para dejar review (solo cliente logueado)
 *   - Lista de reviews aprobados ordenados por utilidad
 *
 * Endpoints:
 *   - GET /api/public/productos/[id]/reviews
 *   - POST /api/cuenta/reviews
 *   - POST /api/cuenta/reviews/[id]/like
 */
export default function ReviewsList({ productoId }: { productoId: number }) {
  const [items, setItems] = useState<Review[]>([]);
  const [rating, setRating] = useState<RatingAgg | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [liking, setLiking] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/productos/${productoId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setRating(data.rating || null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function darLike(reviewId: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('barraca_token') : null;
    if (!token) {
      window.location.href = `/cuenta/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    setLiking(reviewId);
    try {
      const res = await fetch(`/api/cuenta/reviews/${reviewId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((r) => (r.id === reviewId ? { ...r, utiles_count: r.utiles_count + 1 } : r)),
        );
      }
    } finally {
      setLiking(null);
    }
  }

  const total = rating?.total_reviews ?? 0;
  const avg = rating?.rating_promedio ? Number(rating.rating_promedio) : 0;

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-bold text-navy-950 mb-4">Opiniones de clientes</h2>

      {/* Resumen */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        {total === 0 ? (
          <p className="text-sm text-gray-500">
            Aún no hay reseñas para este producto. Sé el primero en dejar una.
          </p>
        ) : (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="text-center md:border-r md:pr-6 md:border-gray-200">
              <p className="text-5xl font-bold text-gray-900">{avg.toFixed(1)}</p>
              <StarRating value={avg} className="justify-center my-1" />
              <p className="text-xs text-gray-500">
                Basado en {total} {total === 1 ? 'review' : 'reviews'}
              </p>
            </div>
            <div className="flex-1 space-y-1.5">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const cnt = rating?.[`r${star}` as 'r5' | 'r4' | 'r3' | 'r2' | 'r1'] ?? 0;
                const pct = total > 0 ? (cnt / total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-sm">
                    <span className="w-12 text-gray-700">{star} ★</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-gray-500 text-xs tabular-nums">{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={() => setShowForm((v) => !v)}
          className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-xl"
        >
          {showForm ? 'Cancelar' : '✍️ Escribir review'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6">
          <ReviewForm
            productoId={productoId}
            onSuccess={() => {
              setShowForm(false);
              void load();
            }}
          />
        </div>
      )}

      {/* Lista reviews */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-8">Cargando reviews…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-8">Aún sin reviews aprobadas.</div>
        ) : (
          items.map((r) => (
            <article key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <header className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <StarRating value={r.rating} size="sm" />
                    {r.compra_verificada && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded-full">
                        ✓ Compra verificada
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {r.titulo || (r.comentario ? '' : 'Sin título')}
                  </p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString('es-CL')}
                </span>
              </header>
              {r.comentario && (
                <p className="text-sm text-gray-700 whitespace-pre-line">{r.comentario}</p>
              )}
              <footer className="mt-2 flex items-center justify-between text-xs">
                <span className="text-gray-500">{r.usuario_nombre.split(' ')[0]}</span>
                <button
                  onClick={() => darLike(r.id)}
                  disabled={liking === r.id}
                  className="text-gray-500 hover:text-orange-600 disabled:opacity-50"
                >
                  👍 Me sirvió ({r.utiles_count})
                </button>
              </footer>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
