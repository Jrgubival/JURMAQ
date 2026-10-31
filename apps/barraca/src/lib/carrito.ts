"use client";

import type { Combo } from "@/lib/combos";

/**
 * Carrito de la tienda, guardado en el navegador (localStorage).
 *
 * Antes el carrito vivía en la tabla `barraca_carrito` de Supabase y cada
 * "agregar" era un POST a /api/carrito. Para una tienda sin cuentas obligatorias
 * eso no aporta: el carrito es del navegador igual, y cada visita costaba
 * consultas. Ahora el carrito es una lista {productoId, cantidad} más una foto
 * del nombre/precio/imagen para dibujarlo al instante.
 *
 * La foto NO es la verdad: el precio y el stock que se cobran los recalcula el
 * servidor desde la base (POST /api/tienda/carrito y POST /api/pedidos). Si el
 * precio cambió, el carrito se actualiza al abrirlo.
 *
 * Cualquier cambio dispara el evento `cart-updated` (el contador del header y
 * el drawer lo escuchan).
 */

export interface ItemCarrito {
  productoId: number;
  cantidad: number;
  nombre: string;
  precio: number;
  imagen: string | null;
  slug: string | null;
  medida: string | null;
  unidad: string | null;
  /** Stock conocido al agregar; el servidor lo vuelve a revisar. */
  stock: number;
  /** Código Softmad (para el aviso de "sin derecho a retracto"). */
  codigo?: string | null;
  /** Descuento por cantidad ("Lleva 2 por $12.000"); el servidor lo vuelve a revisar. */
  combo?: Combo | null;
}

const CLAVE = "barraca_carrito_v2";
export const CANTIDAD_MAXIMA = 9999;

function leer(): ItemCarrito[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (i): i is ItemCarrito =>
        i && Number.isInteger(i.productoId) && i.productoId > 0 &&
        Number.isInteger(i.cantidad) && i.cantidad > 0 && typeof i.nombre === "string",
    );
  } catch {
    return [];
  }
}

function guardar(items: ItemCarrito[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(items));
  } catch { /* modo privado o cuota llena: el carrito vive sólo en memoria */ }
  window.dispatchEvent(new Event("cart-updated"));
}

export function obtenerCarrito(): ItemCarrito[] {
  return leer();
}

export function cantidadEnCarrito(): number {
  return leer().reduce((s, i) => s + i.cantidad, 0);
}

/** Tope por ítem: el stock conocido (nunca más de lo que hay). */
function tope(stock: number): number {
  return Math.max(0, Math.min(CANTIDAD_MAXIMA, Math.floor(stock)));
}

/**
 * Suma un producto. Devuelve la cantidad que quedó en el carrito, o un error
 * si no hay stock suficiente.
 */
export function agregarAlCarrito(
  item: Omit<ItemCarrito, "cantidad">,
  cantidad = 1,
): { ok: true; cantidad: number } | { ok: false; error: string } {
  if (!Number.isInteger(cantidad) || cantidad < 1) return { ok: false, error: "Cantidad inválida" };
  const max = tope(item.stock);
  if (max <= 0) return { ok: false, error: "Producto sin stock" };
  const items = leer();
  const existente = items.find((i) => i.productoId === item.productoId);
  const actual = existente?.cantidad ?? 0;
  if (actual + cantidad > max) {
    return { ok: false, error: `Solo quedan ${max} unidades disponibles` };
  }
  if (existente) {
    Object.assign(existente, item, { cantidad: actual + cantidad });
  } else {
    items.unshift({ ...item, cantidad });
  }
  guardar(items);
  return { ok: true, cantidad: actual + cantidad };
}

export function cambiarCantidad(productoId: number, cantidad: number) {
  const items = leer();
  const it = items.find((i) => i.productoId === productoId);
  if (!it) return;
  if (cantidad <= 0) {
    guardar(items.filter((i) => i.productoId !== productoId));
    return;
  }
  it.cantidad = Math.min(cantidad, tope(it.stock) || cantidad);
  guardar(items);
}

export function quitarDelCarrito(productoId: number) {
  guardar(leer().filter((i) => i.productoId !== productoId));
}

export function vaciarCarrito() {
  guardar([]);
}

/** Reemplaza la foto de precio/stock con lo que respondió el servidor. */
export function reemplazarCarrito(items: ItemCarrito[]) {
  guardar(items);
}

/** Respuesta de POST /api/tienda/carrito. */
export interface ItemRevisado {
  productoId: number;
  cantidad: number;
  nombre: string;
  precio: number;
  imagen: string | null;
  slug: string | null;
  medida: string | null;
  unidad: string | null;
  stock: number;
  combo: Combo | null;
  /** Motivo por el que no se puede comprar (sin stock, sin precio, inactivo). */
  problema: string | null;
}

/**
 * Pide al servidor el precio y stock vigentes del carrito y guarda la foto
 * actualizada. Los productos que ya no existen se quitan.
 */
export async function revisarCarrito(): Promise<ItemRevisado[]> {
  const items = leer();
  if (items.length === 0) return [];
  const res = await fetch("/api/tienda/carrito", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })) }),
  });
  if (!res.ok) throw new Error("No se pudo revisar el carrito");
  const data = (await res.json()) as { items: ItemRevisado[] };
  const revisados = data.items || [];
  reemplazarCarrito(
    revisados.map((r) => ({
      productoId: r.productoId,
      cantidad: r.cantidad,
      nombre: r.nombre,
      precio: r.precio,
      imagen: r.imagen,
      slug: r.slug,
      medida: r.medida,
      unidad: r.unidad,
      stock: r.stock,
      combo: r.combo ?? null,
    })),
  );
  return revisados;
}
