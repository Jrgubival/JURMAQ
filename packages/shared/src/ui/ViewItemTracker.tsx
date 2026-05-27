"use client";

import { useEffect } from "react";

/**
 * Mount-time GA4 view_item tracker compartido entre barraca y constructora.
 *
 * Las server pages renderizan este client island con los props del item activo
 * (producto / máquina); el evento dispara una sola vez por mount.
 *
 * Self-contained:
 * - Llama directamente a `window.gtag('event', 'view_item', ...)` en lugar de
 *   depender de `lib/analytics.ts` de cada app. Esto evita el problema de
 *   pasar funciones como prop desde server → client component (no permitido
 *   en Next.js App Router).
 * - Si `gtag` no está disponible (porque NEXT_PUBLIC_GA_MEASUREMENT_ID no está
 *   seteado y Analytics no montó gtag.js), el efecto es noop.
 *
 * El formato del payload sigue la spec GA4 view_item:
 * https://developers.google.com/analytics/devguides/collection/ga4/reference/events#view_item
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export interface ViewItemTrackerProps {
  id: string | number;
  nombre: string;
  precio: number;
  categoria?: string;
  /** Currency code ISO 4217 — default `'CLP'` (peso chileno). */
  currency?: string;
}

export default function ViewItemTracker({
  id,
  nombre,
  precio,
  categoria,
  currency = "CLP",
}: ViewItemTrackerProps) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    window.gtag("event", "view_item", {
      currency,
      value: precio,
      items: [
        {
          item_id: String(id),
          item_name: nombre,
          item_category: categoria,
          price: precio,
          quantity: 1,
        },
      ],
    });
  }, [id, nombre, precio, categoria, currency]);

  return null;
}
