"use client"

import { useEffect, useState } from 'react';
import StarRating from './StarRating';

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
 * Sección de opiniones en la página de producto:
 *   - Resumen (promedio + distribución por estrellas)
 *   - Lista de opiniones aprobadas
 *
 * Sin cuentas de cliente (oct-2026): sólo opina quien compró, con el enlace
 * que le llega por correo después de la entrega (/opinar/<numero>/<token>).
 *
 * Endpoint: GET /api/public/productos/[id]/reviews
 */

/** Nombre público: nombre + inicial ("Juan P."), también para opiniones antiguas. */
function nombrePublico(nombre: string): string {
  const [primero, segundo] = (nombre || 'Cliente').trim().split(/\s+/);
  return segundo ? `${primero} ${segundo.charAt(0).toUpperCase()}.` : primero;
}
export default function ReviewsList({ productoId }: { productoId: number }) {
  const [items, setItems] = useState<Review[]>([]);
  const [rating, setRating] = useState<RatingAgg | null>(null);
  const [loading, setLoading] = useState(true);

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

  const total = rating?.total_reviews ?? 0;
  const avg = rating?.rating_promedio ? Number(rating.rating_promedio) : 0;

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-bold text-navy-950 mb-4">Opiniones de clientes</h2>

      {/* Resumen */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        {total === 0 ? (
          <p className="text-sm text-gray-500">
            Aún no hay opiniones de este producto.
          </p>
        ) : (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="text-center md:border-r md:pr-6 md:border-gray-200">
              <p className="text-5xl font-bold text-gray-900">{avg.toFixed(1)}</p>
              <StarRating value={avg} className="justify-center my-1" />
              <p className="text-xs text-gray-500">
                Basado en {total} {total === 1 ? 'opinión' : 'opiniones'}
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

        <p className="mt-3 text-xs text-gray-500">
          Las opiniones son de clientes que compraron; te llega un enlace por correo después de la entrega.
        </p>
      </div>

      {/* Lista reviews */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-gray-500 text-center py-8">Cargando opiniones…</div>
        ) : items.length === 0 ? (
          /* Sin reseñas el resumen de arriba ya lo dijo ("Aún no hay reseñas
             para este producto"). Repetirlo acá mostraba el mismo vacío dos
             veces en las 1.977 fichas, y encima hablaba de "reviews aprobadas",
             que es vocabulario del panel de moderación, no del comprador. */
          null
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
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString('es-CL')}
                </span>
              </header>
              {r.comentario && (
                <p className="text-sm text-gray-700 whitespace-pre-line">{r.comentario}</p>
              )}
              <footer className="mt-2 text-xs">
                <span className="text-gray-500">{nombrePublico(r.usuario_nombre)}</span>
              </footer>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
