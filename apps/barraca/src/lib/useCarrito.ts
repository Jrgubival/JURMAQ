"use client";

import { useCallback, useEffect, useState } from "react";
import { obtenerCarrito, revisarCarrito, type ItemCarrito } from "@/lib/carrito";

/**
 * Estado del carrito para componentes. Dibuja al instante con la foto guardada
 * y, si `revisar` es true, pide al servidor el precio y stock vigentes.
 * `problemas` trae, por producto, el motivo por el que no se puede comprar.
 */
export function useCarrito({ revisar = false }: { revisar?: boolean } = {}) {
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [problemas, setProblemas] = useState<Record<number, string>>({});
  const [cargando, setCargando] = useState(true);
  const [errorRevision, setErrorRevision] = useState(false);

  const recargar = useCallback(async () => {
    const locales = obtenerCarrito();
    setItems(locales);
    // Con algo guardado se dibuja ya; la revisión del servidor llega después.
    if (locales.length > 0) setCargando(false);
    if (!revisar) {
      setCargando(false);
      return;
    }
    try {
      const revisados = await revisarCarrito();
      const p: Record<number, string> = {};
      for (const r of revisados) if (r.problema) p[r.productoId] = r.problema;
      setProblemas(p);
      setItems(obtenerCarrito());
      setErrorRevision(false);
    } catch {
      setErrorRevision(true);
    } finally {
      setCargando(false);
    }
  }, [revisar]);

  useEffect(() => {
    recargar();
    const alCambiar = () => setItems(obtenerCarrito());
    window.addEventListener("cart-updated", alCambiar);
    window.addEventListener("storage", alCambiar);
    return () => {
      window.removeEventListener("cart-updated", alCambiar);
      window.removeEventListener("storage", alCambiar);
    };
  }, [recargar]);

  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const cantidad = items.reduce((s, i) => s + i.cantidad, 0);
  const hayProblemas = items.some((i) => problemas[i.productoId]);

  return { items, problemas, cargando, errorRevision, total, cantidad, hayProblemas, recargar };
}
