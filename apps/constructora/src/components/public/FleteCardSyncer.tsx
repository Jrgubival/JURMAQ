"use client";

import { useEffect } from "react";
import { formatCLP } from "@jurmaq/shared/format";

/**
 * FleteCardSyncer — escucha 'flete-updated' y actualiza todos los
 * <span data-flete-card> en las cards de maquinaria del listing.
 *
 * Se monta una sola vez en /maquinarias. Al cargar, lee el último
 * resultado guardado en localStorage('jurmaq:flete-resultado') y lo
 * aplica de inmediato (sin esperar interacción).
 *
 * No renderiza nada visible.
 */

const STORAGE_RESULT = "jurmaq:flete-resultado";

interface FleteEventDetail {
  ciudad: string | null;
  flete: number | null;
  distanciaKm?: number | null;
}

// Placeholder usado en SSR (apps/constructora/src/app/maquinarias/page.tsx)
// y como fallback aquí cuando se limpia el resultado. Mantener en sincro
// para evitar flicker entre render server y hidratación cliente.
const PLACEHOLDER_HTML = '<span class="italic">según destino · cotiza tu flete</span>';

function aplicarFlete(detail: FleteEventDetail) {
  const els = document.querySelectorAll<HTMLElement>("[data-flete-card]");
  els.forEach((el) => {
    if (detail.flete !== null && detail.ciudad !== null) {
      const kmStr = detail.distanciaKm ? ` · ${detail.distanciaKm}km ida+vuelta` : "";
      el.innerHTML = `<span class="text-navy-950 font-medium tabular-nums">${formatCLP(detail.flete)}</span> a ${detail.ciudad}${kmStr}`;
    } else {
      el.innerHTML = PLACEHOLDER_HTML;
    }
  });
}

export default function FleteCardSyncer() {
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_RESULT);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        aplicarFlete({
          ciudad: data.comuna,
          flete: data.total,
          distanciaKm: data.distanciaTotalKm,
        });
      } catch { /* ignorar */ }
    }

    function onUpdate(ev: Event) {
      aplicarFlete((ev as CustomEvent<FleteEventDetail>).detail);
    }
    window.addEventListener("flete-updated", onUpdate);
    return () => window.removeEventListener("flete-updated", onUpdate);
  }, []);

  return null;
}
