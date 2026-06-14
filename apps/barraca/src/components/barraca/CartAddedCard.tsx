"use client";

import Link from "next/link";
import Image from "next/image";
import { formatCLP } from "@jurmaq/shared/format";

/**
 * CartAddedCard — card que ADIA emite cuando agrega un producto al carrito.
 *
 * Se renderiza inline en el flow del chat (después del mensaje de assistant)
 * cuando el server response trae `ui: { kind: 'cart_added', producto, cantidad }`.
 *
 * Muestra:
 *  - Imagen del producto + nombre
 *  - Cantidad agregada × precio unit = subtotal
 *  - Total carrito (cantidad items)
 *  - 2 CTAs: "Ver carrito" → /carrito, "Ver producto" → /producto/{slug}
 *
 * Estética Editorial Luxury: hairline border #EAEAEA, bone bg, sin gradients.
 */

export interface CartAddedUi {
  kind: "cart_added";
  producto: {
    id: number;
    slug: string;
    nombre: string;
    precio: number;
    /** Precio "antes" tachado si el producto está en promo/oferta (null si no). */
    precio_normal?: number | null;
    imagen: string | null;
    unidad: string | null;
  };
  cantidad: number;
  total_carrito: number;
  total_items_carrito: number;
}

export default function CartAddedCard({ ui }: { ui: CartAddedUi }) {
  const { producto, cantidad, total_carrito, total_items_carrito } = ui;
  const subtotal = producto.precio * cantidad;

  return (
    <div className="bg-[#FBFBFA] border border-[#EAEAEA] rounded-2xl p-4 max-w-[90%] mt-2">
      {/* Eyebrow + producto */}
      <p className="text-[10px] font-semibold text-[#2F7F4E] uppercase tracking-[0.18em] mb-3 inline-flex items-center gap-1.5">
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 12 5 5L20 7" />
        </svg>
        Agregado al carrito
      </p>

      <div className="flex gap-3 mb-3">
        {producto.imagen ? (
          <Image
            src={producto.imagen}
            alt={producto.nombre}
            width={56}
            height={56}
            sizes="56px"
            className="w-14 h-14 object-cover rounded-lg bg-white border border-[#EAEAEA] shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-white border border-[#EAEAEA] shrink-0 flex items-center justify-center text-[#787774]">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-[#111111] leading-tight truncate">
            {producto.nombre}
          </h4>
          <p className="text-xs text-[#787774] mt-1">
            {cantidad} × {formatCLP(producto.precio)}
            {producto.precio_normal && producto.precio_normal > producto.precio && (
              <span className="text-[#A8A29E] line-through ml-1.5">
                {formatCLP(producto.precio_normal)}
              </span>
            )}
            {producto.unidad && ` / ${producto.unidad}`}
          </p>
          <p className="text-sm font-medium text-[#111111] tabular-nums mt-0.5">
            Subtotal: {formatCLP(subtotal)}
          </p>
        </div>
      </div>

      {/* Total carrito + CTAs */}
      <div className="pt-3 border-t border-[#EAEAEA] flex items-center justify-between gap-2">
        <p className="text-xs text-[#787774]">
          Carrito:{" "}
          <span className="text-[#111111] font-medium tabular-nums">
            {total_items_carrito} {total_items_carrito === 1 ? "item" : "items"}
          </span>{" "}
          ·{" "}
          <span className="text-[#111111] font-medium tabular-nums">
            {formatCLP(total_carrito)}
          </span>
        </p>
      </div>
      <div className="flex gap-2 mt-3">
        <Link
          href="/carrito"
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-navy-950 hover:bg-[#111111] text-white text-xs font-medium tracking-[0.02em] rounded-lg transition-colors flex-1"
        >
          Ver carrito
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          href={`/producto/${producto.slug}`}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-[#EAEAEA] text-[#111111] text-xs font-medium tracking-[0.02em] rounded-lg hover:bg-white transition-colors"
        >
          Ver producto
        </Link>
      </div>
    </div>
  );
}
