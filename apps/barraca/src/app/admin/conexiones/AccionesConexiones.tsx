"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Botones de /admin/conexiones. Dos pasos (tocar, luego confirmar) para no
 * cortar una conexión o deshacer un cambio por un toque sin querer.
 */
export default function AccionConexion({
  accion, id, etiqueta, confirmacion,
}: { accion: "revocar" | "deshacer"; id: string; etiqueta: string; confirmacion: string }) {
  const router = useRouter();
  const [paso, setPaso] = useState<"inicio" | "confirmar" | "enviando">("inicio");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  async function enviar() {
    setPaso("enviando");
    setMensaje(null);
    const cuerpo = accion === "revocar" ? { accion, familiaId: id } : { accion, loteId: id };
    const res = await fetch("/api/mcp/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    const ok = !!res?.ok && data.ok !== false;
    setMensaje({ ok, texto: data.mensaje || data.error || (res ? "No se pudo completar." : "Sin conexión. Revisa el internet y vuelve a intentar.") });
    setPaso("inicio");
    if (ok) router.refresh();
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      {paso === "inicio" && (
        <button
          type="button"
          onClick={() => setPaso("confirmar")}
          className="min-h-[44px] px-4 rounded-xl text-sm font-semibold border border-gray-300 text-gray-800 bg-white hover:bg-gray-50"
        >
          {etiqueta}
        </button>
      )}
      {paso !== "inicio" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="mb-2">{confirmacion}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPaso("inicio")} disabled={paso === "enviando"} className="min-h-[44px] rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700">
              Cancelar
            </button>
            <button type="button" onClick={() => void enviar()} disabled={paso === "enviando"} className="min-h-[44px] rounded-xl bg-navy-950 text-white text-sm font-semibold disabled:opacity-60">
              {paso === "enviando" ? "Un momento…" : "Sí, " + etiqueta.toLowerCase()}
            </button>
          </div>
        </div>
      )}
      {mensaje && (
        <p role="status" className={`text-sm rounded-xl border px-3 py-2 ${mensaje.ok ? "text-green-800 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200"}`}>
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}
