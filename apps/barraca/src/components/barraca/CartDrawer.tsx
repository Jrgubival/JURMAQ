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
import Link from "next/link";
import { formatCLP } from "@jurmaq/shared/format";

interface CartItem {
  id: number;
  producto_id: number;
  nombre: string;
  precio: number;
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
        aria-label="Carrito de compras"
        className="fixed top-0 right-0 h-full w-full sm:max-w-md bg-white z-[70] shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col translate-x-0 overscroll-contain"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 shrink-0">
          <span className="text-lg font-bold text-navy-950">
            Carrito ({totalItems})
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
            aria-label="Cerrar carrito"
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
              <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              <p className="text-gray-500 font-medium">Tu carrito está vacío</p>
              <Link
                href="/categorias"
                onClick={onClose}
                className="inline-block mt-4 text-sm font-semibold text-orange-600 hover:text-orange-700"
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
                      alt={`Producto ${item.nombre} en el carrito`}
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
                      {formatCLP(item.precio)} c/u
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
            <Link
              href="/carrito"
              onClick={onClose}
              className="block w-full py-3 text-center text-xs font-bold uppercase tracking-wider border border-navy-950 text-navy-950 rounded-md hover:bg-navy-950 hover:text-white transition-colors"
            >
              Ver Carrito
            </Link>
            <Link
              href="/cotizar"
              onClick={onClose}
              className="block w-full py-3 text-center text-xs font-bold uppercase tracking-wider bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
            >
              Solicitar Cotización
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
