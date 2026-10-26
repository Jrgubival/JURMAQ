"use client";

import { useState } from "react";

export default function PagoSimuladoClient({ numero }: { numero: string }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolver(resultado: "aprobar" | "rechazar") {
    setEnviando(true);
    setError(null);
    const res = await fetch("/api/pagos/simulado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero, resultado }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Error");
      setEnviando(false);
      return;
    }
    window.location.href = data.redirect;
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white border-2 border-dashed border-amber-400 rounded-2xl p-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700 mb-2">Pasarela de prueba</p>
        <h1 className="text-xl font-semibold text-[#111111] mb-2">Pago simulado del pedido {numero}</h1>
        <p className="text-sm text-[#5A5A57] mb-6">Sólo existe en desarrollo. No se cobra nada.</p>
        <div className="grid gap-3">
          <button disabled={enviando} onClick={() => resolver("aprobar")} className="min-h-[48px] bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:opacity-60">
            Aprobar pago
          </button>
          <button disabled={enviando} onClick={() => resolver("rechazar")} className="min-h-[48px] border-2 border-gray-300 text-[#111111] font-semibold rounded-lg disabled:opacity-60">
            Rechazar pago
          </button>
        </div>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
