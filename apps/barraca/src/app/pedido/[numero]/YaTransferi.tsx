"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MAX = 5 * 1024 * 1024;

/**
 * "Ya transferí": el comprador avisa que pagó por transferencia y, si quiere,
 * sube el comprobante (foto o PDF, máx. 5 MB) y una nota corta. El servidor
 * vuelve a validar todo (/api/pedidos/[numero]/transferencia).
 */
export default function YaTransferi({ numero, correo }: { numero: string; correo: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (archivo && archivo.size > MAX) {
      setError("El archivo pesa más de 5 MB. Sube una foto o un PDF más liviano.");
      return;
    }
    setEnviando(true);
    try {
      const fd = new FormData();
      if (archivo) fd.append("comprobante", archivo);
      if (nota.trim()) fd.append("nota", nota.trim());
      const res = await fetch(`/api/pedidos/${encodeURIComponent(numero)}/transferencia`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok || data.yaInformado) {
        router.refresh();
        return;
      }
      setError(data.error || "No pudimos guardar tu aviso. Intenta de nuevo.");
    } catch {
      setError("Se cortó la conexión. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="w-full sm:w-auto min-h-[52px] px-8 py-3 bg-marca-600 hover:bg-marca-700 text-white text-base font-bold rounded-lg shadow-md shadow-marca-200 transition-colors"
        >
          Ya transferí
        </button>
        <p className="mt-2 text-[13px] text-[#787774]">Avísanos cuando hagas la transferencia para revisarla más rápido.</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-5 rounded-xl border border-[#EAEAEA] bg-white p-5 space-y-4">
      <p className="text-[16px] font-semibold text-[#111111]">Avísanos que transferiste</p>
      <label className="block">
        <span className="block text-[14px] font-medium text-[#111111]">Comprobante (opcional)</span>
        <span className="block text-[13px] text-[#787774] mb-2">Foto o captura (JPG, PNG, WebP, HEIC) o PDF. Máximo 5 MB.</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,.heic,application/pdf"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          className="block w-full text-[14px] text-[#111111] file:mr-3 file:min-h-[44px] file:px-4 file:rounded-lg file:border file:border-[#D4D4D1] file:bg-[#F7F7F5] file:text-[14px] file:font-semibold"
        />
      </label>
      <label className="block">
        <span className="block text-[14px] font-medium text-[#111111]">Nota (opcional)</span>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Ej: transferí desde la cuenta de mi empresa"
          className="mt-1 block w-full rounded-lg border border-[#D4D4D1] px-3 py-2 text-base text-[#111111]"
        />
      </label>
      {error && <p role="alert" className="text-[13px] text-red-700">{error}</p>}
      <div className="flex flex-col-reverse sm:flex-row gap-2">
        <button type="button" onClick={() => setAbierto(false)} disabled={enviando} className="min-h-[48px] px-5 rounded-lg border border-[#D4D4D1] text-[15px] font-semibold text-[#5A5A57]">
          Volver
        </button>
        <button type="submit" disabled={enviando} className="min-h-[48px] px-6 rounded-lg bg-marca-600 hover:bg-marca-700 disabled:opacity-70 text-white text-[15px] font-bold">
          {enviando ? "Enviando…" : "Enviar aviso"}
        </button>
      </div>
      <p className="text-[12px] text-[#787774]">Si prefieres, manda el comprobante a {correo}.</p>
    </form>
  );
}
