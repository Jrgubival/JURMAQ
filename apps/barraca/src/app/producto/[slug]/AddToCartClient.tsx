"use client";

import { useState } from "react";
import SelectorMedidas from "@/components/barraca/SelectorMedidas";
import { familiaDe, tituloFamilia } from "@/lib/variantes";
import { formatCLP } from "@jurmaq/shared/format";
import { agregarProducto } from "@/lib/agregar";
import { unidadesDisponibles } from "@/lib/stock";

interface Producto {
  id: number;
  nombre: string;
  codigo?: string | null;
  precio: number;
  stock: number;
  slug: string;
  imagen: string | null;
  medida: string | null;
  unidad: string | null;
}

interface Variante {
  id: number;
  nombre: string;
  slug: string;
  precio: number;
  stock: number;
  medida: string | null;
}

export default function AddToCartClient({
  producto,
  variantes,
  precioVenta,
}: {
  producto: Producto;
  variantes: Variante[];
  /** Precio que se cobra (oferta o promoción ya aplicada), o 0 si no se vende en línea. */
  precioVenta: number;
}) {
  const [cantidad, setCantidad] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  // El selector de medidas navega a la ficha de cada variante: el producto
  // que se compra es siempre el de esta página.
  const unidades = unidadesDisponibles(producto.stock);
  const comprable = precioVenta > 0 && unidades > 0;
  const displayPrecio = precioVenta > 0 ? precioVenta : producto.precio;
  const displayTachado = precioVenta > 0 && precioVenta < producto.precio ? producto.precio : null;

  function handleAdd() {
    if (!comprable) return;
    setAdding(true);
    const ok = agregarProducto(
      {
        productoId: producto.id,
        nombre: producto.nombre,
        precio: precioVenta,
        imagen: producto.imagen,
        slug: producto.slug,
        medida: producto.medida,
        unidad: producto.unidad,
        stock: unidades,
      },
      cantidad,
      { abrirCarrito: true },
    );
    setAdding(false);
    if (ok) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
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

      {comprable && cantidad > unidades && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Solo quedan {unidades} unidades.
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
              {displayTachado ? "Precio oferta · " : ""}IVA incluido{comprable ? "" : " · sin stock"}
            </p>
          </div>
          {unidades > 0 && unidades <= 5 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-amber-500 text-white">
              <span className="w-1.5 h-1.5 bg-white" />
              {unidades} unid.
            </span>
          )}
        </div>
        {/* Quantity selector (sólo si se puede comprar) */}
        <div className={`flex items-center gap-3 ${comprable ? "" : "hidden"}`}>
          <span className="text-sm font-medium text-gray-700">Cantidad:</span>
          <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setCantidad(Math.max(1, cantidad - 1))}
              disabled={!comprable || cantidad <= 1}
              className="w-11 h-11 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 transition-colors"
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
              max={Math.max(1, unidades)}
              disabled={!comprable}
              aria-label="Cantidad"
              value={cantidad}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 1) setCantidad(Math.min(val, Math.max(1, unidades)));
              }}
              className="w-14 h-11 text-center text-base font-bold text-navy-950 border-x-2 border-gray-200 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => setCantidad(Math.min(Math.max(1, unidades), cantidad + 1))}
              disabled={!comprable || cantidad >= unidades}
              className="w-11 h-11 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 transition-colors"
              aria-label="Aumentar cantidad"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Acción principal de la ficha: agregar al carrito (abre el carrito
            para seguir a pagar). Sin stock, el botón queda inerte y lo dice. */}
        <button
          onClick={handleAdd}
          disabled={adding || !comprable}
          className={`w-full min-h-[52px] flex items-center justify-center gap-2 font-bold rounded-xl text-base transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-marca-600 ${
            !comprable
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : added
                ? "bg-green-700 text-white"
                : "bg-marca-600 text-white hover:bg-marca-700 shadow-md shadow-marca-200"
          }`}
        >
          {!comprable ? (
            precioVenta > 0 ? "Sin stock" : "No disponible en línea"
          ) : added ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Agregado al carrito
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              Agregar al carrito
            </>
          )}
        </button>
      </div>
    </div>
  );
}
