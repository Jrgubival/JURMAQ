"use client";

import { useEffect } from "react";
import { trackEvents } from "@/lib/analytics";

/**
 * Mount-time GA4 view_item tracker. Server pages render this client island
 * with the active product props; el evento dispara una sola vez por mount.
 *
 * Si NEXT_PUBLIC_GA_MEASUREMENT_ID no está configurado, trackEvents.viewItem
 * es no-op — seguro para dev/preview.
 */
export default function ViewItemTracker({
  id,
  nombre,
  precio,
  categoria,
}: {
  id: string | number;
  nombre: string;
  precio: number;
  categoria?: string;
}) {
  useEffect(() => {
    trackEvents.viewItem({ id, nombre, precio, cantidad: 1, categoria });
  }, [id, nombre, precio, categoria]);

  return null;
}
