"use client";

/**
 * CartDrawer — drawer lateral del carrito de barraca.
 *
 * Mounted via dynamic() en src/app/barraca/layout.tsx con ssr:false.
 * Por eso AST/graphify no detecta la edge layout→drawer (dynamic imports
 * no se resuelven estáticamente). El drawer está vivo en producción.
 *
 * Trigger: el Navbar (cart icon) dispara el evento `barraca:open-cart`
 * que el layout escucha para abrir el drawer.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "@/components/barraca/Enlace";
import { formatCLP } from "@jurmaq/shared/format";
import { trackCustom } from "@/lib/analytics";
import { mensajeDescuentoCotizacion, urlWhatsapp } from "@/lib/whatsapp-descuento";

interface CartItem {
  codigo?: string | null;
  id: number;
  producto_id: number;
  nombre: string;
  precio: number;
  precio_tachado?: number | null;
  cantidad: number;
  imagen: string | null;
  medida: string | null;
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem("barraca_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("barraca_session_id", sid);
  }
  return sid;
}

export default function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Focus management: move focus to close button when opened, return on close
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
      // Small delay to allow drawer animation to start
      const timer = setTimeout(() => closeButtonRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    },
    [open, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  async function fetchCart() {
    const sid = getSessionId();
    if (!sid) return;
    setLoading(true);
    try {
      const res = await fetch("/api/carrito", {
        headers: { "X-Session-Id": sid },
      });
      if (res.ok) {
        const data = await res.json();
        const fetched = data.items || [];
        setItems(fetched);
        if (fetched.length > 0) {
          try {
            const { trackEvents } = await import("@/lib/analytics");
            trackEvents.viewCart(
              fetched.map((it: CartItem) => ({
                id: it.producto_id,
                nombre: it.nombre,
                precio: it.precio,
                cantidad: it.cantidad,
              }))
            );
          } catch { /* analytics no debe romper UX */ }
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) fetchCart();
  }, [open]);

  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const totalItems = items.reduce((s, i) => s + i.cantidad, 0);

  async function removeItem(itemId: number) {
    const sid = getSessionId();
    const res = await fetch("/api/carrito", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "X-Session-Id": sid },
      body: JSON.stringify({ itemId }),
    });
    if (!res.ok) return;
    setItems(items.filter((i) => i.id !== itemId));
    window.dispatchEvent(new Event("cart-updated"));
  }

  async function clearCart() {
    const sid = getSessionId();
    const results = await Promise.all(
      items.map((item) =>
        fetch("/api/carrito", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", "X-Session-Id": sid },
          body: JSON.stringify({ itemId: item.id }),
        })
      )
    );
    if (results.some((r) => !r.ok)) {
      await fetchCart();
      return;
    }
    setItems([]);
    window.dispatchEvent(new Event("cart-updated"));
  }

  async function updateQuantity(itemId: number, newQty: number) {
    if (newQty < 1) return;
    const sid = getSessionId();
    const res = await fetch("/api/carrito", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Session-Id": sid },
      body: JSON.stringify({ itemId, cantidad: newQty }),
    });
    if (!res.ok) return;
    setItems(
      items.map((i) => (i.id === itemId ? { ...i, cantidad: newQty } : i))
    );
    window.dispatchEvent(new Event("cart-updated"));
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mi cotización"
        className="fixed top-0 right-0 h-full w-full sm:max-w-md bg-white z-[70] shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col translate-x-0 overscroll-contain"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 shrink-0">
          <span className="text-lg font-bold text-navy-950">
            Mi cotización ({totalItems})
          </span>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
              >
                Vaciar
              </button>
            )}
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Cerrar mi cotización"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-marca-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              <p className="text-gray-500 font-medium">Tu cotización está vacía</p>
              <Link
                href="/categorias"
                onClick={onClose}
                className="inline-block mt-4 text-sm font-semibold text-marca-600 hover:text-marca-700"
              >
                Explorar productos
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 p-3 bg-gray-50 rounded-xl"
                >
                  {/* Product thumbnail */}
                  <div className="w-16 h-16 bg-gray-200 rounded-lg shrink-0 overflow-hidden">
                    <img
                      src={item.imagen || '/images/barraca/default.svg'}
                      alt={`Producto ${item.nombre} en tu cotización`}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.src = '/images/barraca/default.svg'; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.nombre}
                    </p>
                    {item.medida && (
                      <p className="text-xs text-gray-500">{item.medida}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.precio_tachado && item.precio_tachado > item.precio && (
                        <span className="line-through text-gray-400 mr-1">{formatCLP(item.precio_tachado)}</span>
                      )}
                      <span className={item.precio_tachado && item.precio_tachado > item.precio ? "text-marca-600 font-semibold" : ""}>{formatCLP(item.precio)}</span> c/u
                    </p>
                    {/* Inline quantity controls */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                          className="w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:bg-gray-100 text-sm font-bold transition-colors"
                          aria-label="Disminuir cantidad"
                        >
                          -
                        </button>
                        <span className="w-9 h-9 flex items-center justify-center text-xs font-bold border-x border-gray-300">
                          {item.cantidad}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                          className="w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:bg-gray-100 text-sm font-bold transition-colors"
                          aria-label="Aumentar cantidad"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-sm font-bold text-navy-950">
                        {formatCLP((item.precio * item.cantidad))}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors self-start"
                    aria-label="Eliminar producto"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — feel "recibo de barraca": separadores tipo línea-corte,
            tipografía tabular en numeros, total prominent estilo factura. */}
        {items.length > 0 && (
          <div className="border-t-2 border-dashed border-gray-300 px-4 sm:px-6 py-4 space-y-3 shrink-0 safe-bottom bg-gray-50/40">
            {/* Trust line — IVA + items count, monospace mini */}
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-500 tabular-nums">
              <span>{totalItems} {totalItems === 1 ? "item" : "items"} · IVA incl.</span>
              <span>Despacho desde Molina</span>
            </div>
            {/* Total — fila destacada estilo línea de factura */}
            <div className="flex items-baseline justify-between border-t border-gray-300 pt-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Total</span>
              <span className="text-2xl font-extrabold text-navy-950 tabular-nums leading-none">
                {formatCLP(total)}
              </span>
            </div>
            {/* Principal: la cotización completa por WhatsApp, para que el
                vendedor la devuelva con descuento. */}
            <a
              href={urlWhatsapp(mensajeDescuentoCotizacion(items))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackCustom("whatsapp_descuento", { lugar: "drawer", productos: items.length, total })}
              className="flex w-full min-h-[48px] items-center justify-center gap-2 px-3 py-3 text-center text-sm font-bold bg-marca-600 text-white rounded-md hover:bg-marca-700 transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] touch-manipulation"
            >
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Pedir mi precio con descuento
            </a>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/carrito"
                onClick={onClose}
                className="block w-full py-2.5 text-center text-xs font-bold uppercase tracking-wider border border-navy-950 text-navy-950 rounded-md hover:bg-navy-950 hover:text-white transition-colors"
              >
                Ver mi cotización
              </Link>
              <Link
                href="/cotizar"
                onClick={onClose}
                className="block w-full py-2.5 text-center text-xs font-bold uppercase tracking-wider border border-marca-600 text-marca-700 rounded-md hover:bg-marca-50 transition-colors"
              >
                Solicitar cotización
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
