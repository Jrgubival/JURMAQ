"use client";

import { useEffect, useState } from "react";
import { formatCLP } from "@jurmaq/shared/format";

/**
 * FleteCalculator — Input de dirección libre + cálculo de flete real.
 *
 * El cliente ingresa la dirección completa de la obra (ej: "Av Argentina
 * 1234, Talca"). Llamamos /api/flete-cotizar?direccion=... que:
 *  1. Geocodifica con OpenRouteService (dirección → lat/lng + comuna)
 *  2. Calcula ruta HQ → obra (distancia + tiempo reales)
 *  3. Aplica fórmula JURMAQ con peajes según comuna
 *
 * Persiste la dirección en localStorage('jurmaq:direccion-flete'). Cuando
 * cambia, dispara CustomEvent('flete-updated') con el desglose completo
 * para que las cards y otros consumidores escuchen.
 *
 * Estética Editorial Luxury: bone bg, hairlines, eyebrow, sin gradientes.
 */

const STORAGE_KEY = "jurmaq:direccion-flete";
const STORAGE_RESULT = "jurmaq:flete-resultado";

interface FleteDesglose {
  direccionGeocodificada: string;
  comuna: string | null;
  distanciaTotalKm: number;
  tiempoOpMin: number;
  peajes: number;
  subtotal: number;
  total: number;
}

export default function FleteCalculator() {
  const [direccion, setDireccion] = useState<string>("");
  const [desglose, setDesglose] = useState<FleteDesglose | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedResult = localStorage.getItem(STORAGE_RESULT);
    if (saved) setDireccion(saved);
    if (savedResult) {
      try {
        const parsed = JSON.parse(savedResult) as FleteDesglose;
        setDesglose(parsed);
        // Propagar a cards al cargar
        window.dispatchEvent(
          new CustomEvent("flete-updated", {
            detail: {
              ciudad: parsed.comuna,
              flete: parsed.total,
              distanciaKm: parsed.distanciaTotalKm,
            },
          }),
        );
      } catch { /* ignorar JSON corrupto */ }
    }
  }, []);

  async function calcular() {
    const dir = direccion.trim();
    if (dir.length < 5) {
      setError("Ingresa una dirección más específica (ej: Av Argentina 1234, Talca).");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/flete-cotizar?direccion=${encodeURIComponent(dir)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No pudimos calcular el flete.");
        setDesglose(null);
        return;
      }
      setDesglose(data);
      localStorage.setItem(STORAGE_KEY, dir);
      localStorage.setItem(STORAGE_RESULT, JSON.stringify(data));
      window.dispatchEvent(
        new CustomEvent("flete-updated", {
          detail: {
            ciudad: data.comuna || "tu obra",
            flete: data.total,
            distanciaKm: data.distanciaTotalKm,
          },
        }),
      );
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      calcular();
    }
  }

  if (!mounted) return null;

  return (
    <div className="bg-white border border-[#EAEAEA] rounded-2xl px-5 py-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1 min-w-0">
          <label
            htmlFor="direccion-flete"
            className="block text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-1.5"
          >
            Dirección de tu obra
          </label>
          <input
            id="direccion-flete"
            type="text"
            placeholder="Ej: Av Argentina 1234, Talca"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full text-sm bg-transparent border-0 border-b border-[#EAEAEA] focus:border-[#111111] focus:outline-none py-1.5 text-[#111111] tracking-tight placeholder:text-[#787774]"
          />
        </div>
        <button
          type="button"
          onClick={calcular}
          disabled={loading}
          className="px-4 py-2 bg-navy-950 hover:bg-[#111111] disabled:bg-[#787774] text-white text-xs font-medium tracking-[0.02em] rounded-lg transition-colors shrink-0"
        >
          {loading ? "Calculando…" : "Calcular flete"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-[#9C2B1F] mt-2">{error}</p>
      )}

      {desglose && !error && (
        <div className="mt-4 pt-4 border-t border-[#EAEAEA] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-0.5">
              Flete referencial · {desglose.comuna || "destino"}
            </p>
            <p className="text-xs text-[#787774] truncate" title={desglose.direccionGeocodificada}>
              {desglose.direccionGeocodificada}
            </p>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-base text-[#111111] tabular-nums" style={{ fontWeight: 500 }}>
              {formatCLP(desglose.total)}
            </p>
            <p className="text-[10px] text-[#787774]">
              {desglose.distanciaTotalKm}km ida+vuelta
              {desglose.peajes > 0 ? ` · peajes ${formatCLP(desglose.peajes)}` : " · sin peajes"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
