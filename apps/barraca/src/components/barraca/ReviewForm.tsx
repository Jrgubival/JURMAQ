"use client"

import { useState } from 'react';
import StarRating from './StarRating';

/**
 * Formulario para crear una review de producto.
 *
 * Requiere cliente logueado (token barraca). Si no, muestra prompt para
 * loguearse en lugar del form.
 *
 * Llama POST /api/cuenta/reviews → estado depende de compra_verificada
 * server-side:
 *   - Si compra verificada: auto-aprobada, visible inmediatamente
 *   - Si NO compra: queda 'pendiente' hasta moderación admin
 */
export default function ReviewForm({
  productoId,
  onSuccess,
}: {
  productoId: number;
  onSuccess?: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [titulo, setTitulo] = useState('');
  const [comentario, setComentario] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  // Check sesión solo en cliente.
  if (loggedIn === null && typeof window !== 'undefined') {
    const t = localStorage.getItem('barraca_token');
    setLoggedIn(!!t);
  }

  if (loggedIn === false) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">¿Compraste este producto?</p>
        <p>
          <a
            href={`/cuenta/login?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`}
            className="text-blue-700 hover:underline font-medium"
          >
            Iniciá sesión
          </a>{' '}
          para dejar tu review.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem('barraca_token');
    if (!token) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/cuenta/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ producto_id: productoId, rating, titulo, comentario }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error al enviar review' });
        return;
      }
      const estado = data.review?.estado;
      setMsg({
        kind: 'ok',
        text:
          estado === 'aprobada'
            ? '¡Gracias! Tu review fue publicada.'
            : 'Tu review está pendiente de moderación (será visible cuando aprobemos).',
      });
      setTitulo('');
      setComentario('');
      setRating(5);
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <h3 className="font-bold text-gray-900">Dejá tu review</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Calificación *</label>
        <StarRating value={rating} size="lg" readOnly={false} onChange={setRating} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Título (opcional)</label>
        <input
          type="text"
          maxLength={100}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ej: Excelente calidad, lo recomiendo"
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Comentario (opcional)</label>
        <textarea
          rows={3}
          maxLength={2000}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Contales a otros qué te pareció el producto…"
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">{comentario.length} / 2000</p>
      </div>

      {msg && (
        <div
          className={`px-3 py-2 rounded-lg text-sm ${
            msg.kind === 'ok'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || rating < 1}
        className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-xl disabled:opacity-50"
      >
        {submitting ? 'Enviando…' : 'Publicar review'}
      </button>
    </form>
  );
}
