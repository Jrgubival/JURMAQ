"use client";

import { showToast } from "@/components/Toast";
import { trackEvents } from "@/lib/analytics";
import { agregarAlCarrito, type ItemCarrito } from "@/lib/carrito";

/**
 * "Agregar al carrito" desde cualquier botón: guarda, avisa y mide
 * (GA4 add_to_cart + Meta AddToCart). Devuelve true si se agregó.
 */
export function agregarProducto(item: Omit<ItemCarrito, "cantidad">, cantidad = 1, { abrirCarrito = false } = {}): boolean {
  const r = agregarAlCarrito(item, cantidad);
  if (!r.ok) {
    showToast(r.error, "error");
    return false;
  }
  trackEvents.addToCart({ id: item.productoId, nombre: item.nombre, precio: item.precio, cantidad });
  showToast("Agregado al carrito", "success");
  if (abrirCarrito) window.dispatchEvent(new Event("barraca:open-cart"));
  return true;
}
