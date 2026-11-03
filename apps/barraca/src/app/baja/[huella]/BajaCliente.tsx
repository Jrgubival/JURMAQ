"use client";

import { useState } from "react";

export default function BajaCliente({ huella, origen }: { huella: string; origen: string | null }) {
  const [estado, setEstado] = useState<"inicial" | "enviando" | "listo" | "error">("inicial");
  const [mensaje, setMensaje] = useState("");

  async function confirmar() {
    setEstado("enviando");
    try {
      const r = await fetch("/api/baja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ huella, origen }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No pudimos registrar la baja.");
      setEstado("listo");
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No pudimos registrar la baja.");
      setEstado("error");
    }
  }

  if (estado === "listo") {
    return <p className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-green-800 font-medium">Listo, no le enviaremos más correos.</p>;
  }
  return (
    <div>
      <button
        type="button"
        onClick={confirmar}
        disabled={estado === "enviando"}
        className="h-12 px-6 rounded-xl bg-navy-950 text-white font-semibold disabled:opacity-60"
      >
        {estado === "enviando" ? "Registrando…" : "Confirmar baja"}
      </button>
      {estado === "error" && <p className="mt-3 text-sm text-red-700">{mensaje}</p>}
    </div>
  );
}
