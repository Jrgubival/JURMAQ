"use client";

import { useState } from "react";
import StarRating from "@/components/barraca/StarRating";

/** Formulario de opinión de un producto del pedido (una sola vez). */
export default function FormOpinion({
  numero,
  token,
  productoId,
  nombre,
  yaOpinado,
}: {
  numero: string;
  token: string;
  productoId: number;
  nombre: string;
  yaOpinado: boolean;
}) {
  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(yaOpinado);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError("Elige de 1 a 5 estrellas.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/opiniones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero, token, producto_id: productoId, rating, comentario: comentario.trim() || null }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok || res.status === 409) {
        // 409 = ya había una opinión para este producto: queda como enviada.
        if (res.ok || data.error === "Ya opinaste sobre este producto.") setListo(true);
        else setError(data.error ?? "No pudimos guardar tu opinión.");
        return;
      }
      setError(data.error ?? "No pudimos guardar tu opinión. Intenta de nuevo.");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="bg-white border border-[#EAEAEA] rounded-2xl p-5">
      <h2 className="text-[15px] font-semibold text-[#111111] mb-3">{nombre}</h2>
      {listo ? (
        <p className="text-sm text-green-700">¡Gracias! Ya recibimos tu opinión de este producto.</p>
      ) : (
        <form onSubmit={enviar} className="space-y-3">
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">Calificación</span>
            <StarRating value={rating} size="lg" readOnly={false} onChange={setRating} />
          </div>
          <div>
            <label htmlFor={`comentario-${productoId}`} className="block text-sm font-medium text-gray-700 mb-1">
              Comentario (opcional)
            </label>
            <textarea
              id={`comentario-${productoId}`}
              rows={3}
              maxLength={2000}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="¿Cómo te fue con el producto?"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-base"
            />
            <p className="text-xs text-gray-500 mt-1">{comentario.length} / 2000</p>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={enviando}
            className="px-5 h-11 bg-marca-600 hover:bg-marca-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
          >
            {enviando ? "Enviando…" : "Enviar opinión"}
          </button>
        </form>
      )}
    </section>
  );
}
