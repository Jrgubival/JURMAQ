"use client";

import { useEffect, useState } from "react";
import { obtenerCarrito } from "@/lib/carrito";

/** Cuántas unidades de un producto hay en el carrito, al día con cualquier cambio (otra pestaña incluida). */
export function useEnCarrito(productoId: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const leer = () => setN(obtenerCarrito().find((i) => i.productoId === productoId)?.cantidad ?? 0);
    leer();
    window.addEventListener("cart-updated", leer);
    window.addEventListener("storage", leer);
    return () => {
      window.removeEventListener("cart-updated", leer);
      window.removeEventListener("storage", leer);
    };
  }, [productoId]);
  return n;
}

/** Pausa corta para que "Agregando…" se alcance a ver: confirma que algo pasó. */
export const PAUSA_AGREGAR_MS = 450;
