"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";
import SelectorMedidas from "@/components/barraca/SelectorMedidas";
import { familiaDe, tituloFamilia } from "@/lib/variantes";
import { formatCLP } from "@jurmaq/shared/format";
import BotonDescuento from "@/components/barraca/BotonDescuento";
import { TOAST_MESSAGES } from "@jurmaq/shared/messages";

interface Producto {
  id: number;
  nombre: string;
  codigo?: string | null;
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
      {/* Selector de medida por ejes — ver SelectorMedidas.tsx.
          Reemplaza la fila plana de píldoras con la medida completa: con 50
          tubos rectangulares eran 50 etiquetas casi idénticas que había que
          leer una por una. */}
      {variantes.length > 1 && (
        <SelectorMedidas
          variantes={variantes}
          actualId={producto.id}
          nombreBase={tituloFamilia(familiaDe(producto.nombre), producto.nombre)}
        />
      )}

      {/* Stock info note */}
      {activeStock > 0 && cantidad > activeStock && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Stock actual: {activeStock} unidades. Para cantidades mayores, cotizaremos disponibilidad.
        </div>
      )}
      {activeStock <= 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Sin stock actualmente. Pide tu precio por WhatsApp o agrégalo a tu cotización y te confirmamos disponibilidad.
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
              <span className={displayTachado ? "text-marca-600" : ""}>{formatCLP(displayPrecio)}</span>
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-gray-500">
              {displayTachado ? "Precio oferta" : "Precio de lista"} · IVA incl.{selectedVariant?.medida ? ` · ${selectedVariant.medida}` : ""}
            </p>
          </div>
          {activeStock > 0 && activeStock <= 5 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-amber-500 text-white">
              <span className="w-1.5 h-1.5 bg-white" />
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

        {/* Acción principal: pedir el precio con descuento por WhatsApp, con
            el producto, su código y la cantidad elegida. Reemplaza al antiguo
            "Cotizar por WhatsApp" verde: dos botones de WhatsApp confundían. */}
        <BotonDescuento nombre={producto.nombre} codigo={producto.codigo} cantidad={cantidad} lugar="ficha" grande />

        {/* Secundario: sumar el producto a "Mi cotización" (el carrito). */}
        <button
          onClick={handleAdd}
          disabled={adding}
          className={`w-full h-12 flex items-center justify-center gap-2 font-semibold rounded-xl text-base border-2 transition-[transform,background-color,color,border-color] duration-150 ease-out active:scale-[0.98] touch-manipulation ${
            added
              ? "border-green-600 bg-green-50 text-green-700"
              : "border-marca-600 bg-white text-marca-700 hover:bg-marca-50"
          }`}
        >
          {adding ? (
            <div className="w-5 h-5 border-2 border-marca-600 border-t-transparent rounded-full animate-spin" />
          ) : added ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Agregado a mi cotización
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Agregar a mi cotización
            </>
          )}
        </button>
      </div>
    </div>
  );
}
