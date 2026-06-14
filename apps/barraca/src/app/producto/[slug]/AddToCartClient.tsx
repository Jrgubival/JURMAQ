"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";
import { formatCLP } from "@jurmaq/shared/format";
import { whatsappCtaProducto } from "@jurmaq/shared/whatsapp";
import { TOAST_MESSAGES } from "@jurmaq/shared/messages";

interface Producto {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
}

interface Variante {
  id: number;
  nombre: string;
  slug: string;
  precio: number;
  stock: number;
  medida: string | null;
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem("barraca_session_id");
  if (!sid) {
    // crypto.randomUUID() == 128 bits de entropia y formato consistente con
    // el resto de los componentes (CartDrawer, etc.). Antes usabamos
    // Math.random + Date.now que es no-criptografico y produce IDs con
    // formato distinto, lo que rompia el matching de sesion entre componentes.
    sid = crypto.randomUUID();
    localStorage.setItem("barraca_session_id", sid);
  }
  return sid;
}

export default function AddToCartClient({
  producto,
  variantes,
  precioPromo,
}: {
  producto: Producto;
  variantes: Variante[];
  precioPromo?: number | null;
}) {
  const router = useRouter();
  const [selectedVariant, setSelectedVariant] = useState<Variante | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const activeProduct = selectedVariant || producto;
  const activeId = selectedVariant ? selectedVariant.id : producto.id;
  const activeStock = activeProduct.stock;
  const activePrecio = activeProduct.precio;
  // FIX (audit jun-2026): junto al botón mostrábamos el precio NORMAL aunque
  // hubiera oferta (precioPromo, que es lo que se cobra). Mostramos la oferta
  // tachando el normal. precioPromo aplica al producto base, no a variantes.
  const showPromo = !selectedVariant && !!precioPromo && precioPromo > 0 && precioPromo < producto.precio;
  const displayPrecio = showPromo ? (precioPromo as number) : activePrecio;
  const displayTachado = showPromo ? producto.precio : null;

  async function handleAdd() {
    setAdding(true);
    try {
      const sid = getSessionId();
      const res = await fetch("/api/carrito", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": sid,
        },
        body: JSON.stringify({
          sessionId: sid,
          productoId: activeId,
          cantidad,
          ...(precioPromo ? { precioOverride: precioPromo } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data?.error || TOAST_MESSAGES.cart.ADD_FAILED_FALLBACK, "error");
        return;
      }
      // Track conversion event GA4 (no-op si NEXT_PUBLIC_GA_MEASUREMENT_ID falta)
      try {
        const { trackEvents } = await import("@/lib/analytics");
        trackEvents.addToCart({
          id: activeId,
          nombre: activeProduct.nombre,
          precio: activePrecio,
          cantidad,
        });
      } catch { /* no romper UX si el track falla */ }
      setAdded(true);
      window.dispatchEvent(new Event("cart-updated"));
      showToast(TOAST_MESSAGES.cart.ADDED, "success");
      setTimeout(() => setAdded(false), 2000);
    } catch {
      showToast(TOAST_MESSAGES.cart.ADD_ERROR, "error");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Variant Selector - Pill style */}
      {variantes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-navy-950 mb-3">
            Medida / Variante
          </h3>
          <div className="flex flex-wrap gap-2">
            {variantes.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setSelectedVariant(v);
                  router.push(`/producto/${v.slug}`, { scroll: false });
                }}
                className={`px-4 py-2.5 text-sm font-semibold rounded-full border-2 transition-all ${
                  selectedVariant?.id === v.id
                    ? "bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-200"
                    : v.stock <= 0
                    ? "bg-amber-50 text-amber-700 border-amber-300 hover:border-amber-400"
                    : "bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:text-orange-600"
                }`}
              >
                {v.medida || v.nombre}
                {v.stock <= 0 && " (sin stock)"}
              </button>
            ))}
          </div>
          {selectedVariant && (
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-xl font-bold text-navy-950">
                {formatCLP(activePrecio)}
              </p>
              {selectedVariant.stock > 0 && selectedVariant.stock < 10 && (
                <span className="text-xs text-amber-600 font-medium">
                  Quedan {selectedVariant.stock} unidades
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stock info note */}
      {activeStock > 0 && cantidad > activeStock && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Stock actual: {activeStock} unidades. Para cantidades mayores, cotizaremos disponibilidad.
        </div>
      )}
      {activeStock <= 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Sin stock actualmente. Puedes agregar al carrito y cotizaremos disponibilidad.
        </div>
      )}

      {/* Quantity + Add to Cart - sticky on mobile.
          Mobile UX: precio visible en la barra sticky para que el usuario
          siempre vea el costo al decidir. Antes el precio estaba arriba en
          la página y se perdía al scrollear hasta el botón. Win conversion
          mobile (~10-20% en e-commerce de catálogo según Baymard). */}
      <div className="space-y-3 fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-300 shadow-[0_-4px_16px_-4px_rgba(0,0,0,0.08)] p-4 z-40 lg:static lg:border-0 lg:shadow-none lg:p-0 lg:z-auto safe-bottom">
        {/* Mobile-only: precio + medida visible en la barra sticky */}
        <div className="flex items-baseline justify-between gap-3 lg:hidden border-b border-gray-200 pb-3 -mx-1 px-1">
          <div className="min-w-0">
            <p className="text-2xl font-extrabold text-navy-950 tabular-nums leading-none">
              {displayTachado && (
                <span className="text-base text-gray-400 line-through font-bold mr-2">{formatCLP(displayTachado)}</span>
              )}
              <span className={displayTachado ? "text-orange-600" : ""}>{formatCLP(displayPrecio)}</span>
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-gray-500">
              IVA incl.{selectedVariant?.medida ? ` · ${selectedVariant.medida}` : ""}
            </p>
          </div>
          {activeStock > 0 && activeStock <= 5 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-amber-500 text-white">
              <span className="w-1.5 h-1.5 bg-white animate-pulse" />
              {activeStock} unid.
            </span>
          )}
        </div>
        {/* Quantity selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Cantidad:</span>
          <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setCantidad(Math.max(1, cantidad - 1))}
              className="w-11 h-11 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="Disminuir cantidad"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={cantidad}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 1 && val <= 9999) setCantidad(val);
              }}
              className="w-14 h-11 text-center text-base font-bold text-navy-950 border-x-2 border-gray-200 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => setCantidad(Math.min(9999, cantidad + 1))}
              className="w-11 h-11 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="Aumentar cantidad"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Full-width add to cart button */}
        <button
          onClick={handleAdd}
          disabled={adding}
          className={`w-full h-14 flex items-center justify-center gap-2 font-bold rounded-xl text-base transition-all active:scale-[0.98] ${
            added
              ? "bg-green-500 text-white"
              : activeStock <= 0
              ? "bg-amber-600 text-white hover:bg-amber-700 shadow-lg shadow-amber-200"
              : "bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-200"
          }`}
        >
          {adding ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : added ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Agregado al carrito
            </>
          ) : activeStock <= 0 ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Cotizar disponibilidad
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              Agregar al carrito
            </>
          )}
        </button>

        {/* WhatsApp quick quote */}
        <a
          href={whatsappCtaProducto(String(producto.id), producto.nombre, cantidad)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full h-12 border-2 border-green-500 text-green-700 hover:bg-green-50 font-semibold rounded-xl text-sm transition-colors"
        >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        Cotizar por WhatsApp
        </a>
      </div>
    </div>
  );
}
