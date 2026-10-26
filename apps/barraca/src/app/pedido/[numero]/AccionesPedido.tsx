"use client";

import { useEffect, useState } from "react";
import { formatCLP } from "@jurmaq/shared/format";
import { trackEvents } from "@/lib/analytics";

/**
 * Parte interactiva de la confirmación: evento Purchase (una vez por pedido)
 * y el botón para volver a intentar el pago en línea.
 */
export default function AccionesPedido({
  numero, total, pagado, puedeReintentar,
}: { numero: string; total: number; pagado: boolean; puedeReintentar: boolean }) {
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pagado) return;
    let items: Array<{ id: number; nombre: string; precio: number; cantidad: number }> = [];
    try { items = JSON.parse(sessionStorage.getItem(`pedido_items_${numero}`) || "[]"); } catch { /* sin detalle */ }
    trackEvents.purchase(numero, total, items);
  }, [pagado, numero, total]);

  if (!puedeReintentar) return null;

  async function pagar() {
    setAbriendo(true);
    setError(null);
    try {
      const res = await fetch(`/api/pedidos/${encodeURIComponent(numero)}/pagar`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.redirect) {
        setError(data.error || "No pudimos abrir el pago. Intenta de nuevo.");
        return;
      }
      window.location.href = data.redirect;
    } catch {
      setError("Se cortó la conexión. Intenta de nuevo.");
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={pagar}
        disabled={abriendo}
        className="w-full sm:w-auto min-h-[52px] px-8 py-3 bg-marca-600 hover:bg-marca-700 disabled:opacity-70 text-white text-base font-bold rounded-lg shadow-md shadow-marca-200 transition-colors"
      >
        {abriendo ? "Abriendo Mercado Pago…" : `Pagar ${formatCLP(total)} con Mercado Pago`}
      </button>
      {error && <p role="alert" className="mt-2 text-[13px] text-red-700">{error}</p>}
    </div>
  );
}
