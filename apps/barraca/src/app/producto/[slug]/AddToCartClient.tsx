"use client";

import { useState } from "react";
import SelectorMedidas from "@/components/barraca/SelectorMedidas";
import { familiaDe, tituloFamilia } from "@/lib/variantes";
import Precio from "@/components/barraca/Precio";
import CantidadEditable from "@/components/barraca/CantidadEditable";
import type { VistaPrecio } from "@/lib/precio-web";
import { agregarProducto } from "@/lib/agregar";
import { cambiarCantidad, quitarDelCarrito } from "@/lib/carrito";
import { useEnCarrito, PAUSA_AGREGAR_MS } from "@/lib/useEnCarrito";
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
  vista,
}: {
  producto: Producto;
  variantes: Variante[];
  /** Precio web / normal ya resuelto en el servidor (lib/precio-web.ts). */
  vista: VistaPrecio;
}) {
  const [cantidad, setCantidad] = useState(1);
  const [adding, setAdding] = useState(false);
  // Si el producto ya está en el carrito, la cantidad de la ficha ES la del
  // carrito: se ve la que ya agregaste y cambiarla actualiza el carrito.
  const enCarrito = useEnCarrito(producto.id);
  const yaEnCarrito = enCarrito > 0;

  // El selector de medidas navega a la ficha de cada variante: el producto
  // que se compra es siempre el de esta página.
  const unidades = unidadesDisponibles(producto.stock);
  const comprable = vista.disponible && unidades > 0;
  const precioVenta = vista.precioWeb;

  function handleAdd() {
    if (!comprable || adding) return;
    if (yaEnCarrito) {
      window.dispatchEvent(new Event("barraca:open-cart"));
      return;
    }
    // "Agregando…" un instante para que se note que se guardó.
    setAdding(true);
    setTimeout(() => {
    agregarProducto(
      {
        productoId: producto.id,
        codigo: producto.codigo,
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
    }, PAUSA_AGREGAR_MS);
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

      {comprable && !yaEnCarrito && cantidad > unidades && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Solo quedan {unidades} unidades.
        </div>
      )}

      {/* Cantidad en la página (no en la barra fija): así la barra del
          celular queda en una fila, precio y botón, y no tapa media pantalla. */}
      {comprable && (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-medium text-gray-700">{yaEnCarrito ? "En tu carrito" : "Cantidad"}</span>
        {yaEnCarrito ? (
          <>
            <CantidadEditable valor={enCarrito} max={unidades} nombre={producto.nombre} onCambio={(n) => cambiarCantidad(producto.id, n)} />
            <button type="button" onClick={() => quitarDelCarrito(producto.id)} className="text-sm text-gray-500 underline underline-offset-2 hover:text-red-700">
              Quitar
            </button>
          </>
        ) : (
          <CantidadEditable valor={cantidad} max={unidades} nombre={producto.nombre} onCambio={setCantidad} />
        )}
      </div>
      )}

      {/* Barra fija del celular: precio + botón (en escritorio, botón normal).
          No disponible: sin barra de compra (el bloque de precio ya lo dice). */}
      {comprable && (
      <div className="fixed bottom-0 inset-x-0 z-40 flex items-center gap-3 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 shadow-[0_-8px_24px_-16px_rgba(8,20,40,0.35)] lg:static lg:block lg:bg-transparent lg:backdrop-blur-none lg:border-0 lg:shadow-none lg:p-0 lg:z-auto safe-bottom">
        {/* Sólo celular: el precio sigue a la vista junto al botón. */}
        <div className="lg:hidden min-w-0 flex-1">
          <Precio vista={vista} unidad={producto.unidad} tamano="barra" />
        </div>
        {/* Acción principal de la ficha: agregar al carrito (abre el carrito
            para seguir a pagar). Sin stock, el botón queda inerte y lo dice. */}
        <button
          onClick={handleAdd}
          disabled={adding || !comprable}
          className={`shrink-0 px-5 lg:w-full min-h-[52px] flex items-center justify-center gap-2 font-bold rounded-xl text-base transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-marca-600 ${
            !comprable
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : yaEnCarrito
                ? "bg-navy-950 text-white hover:bg-navy-800"
                : "bg-marca-600 text-white hover:bg-marca-700 shadow-md shadow-marca-200"
          }`}
        >
          {adding ? (
            <>
              <span className="w-5 h-5 border-2 border-white/90 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span>Agregando…</span>
            </>
          ) : yaEnCarrito ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="lg:hidden">Ver carrito ({enCarrito})</span>
              <span className="hidden lg:inline">En el carrito ({enCarrito}) · Ver carrito</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              <span className="lg:hidden">Agregar</span>
              <span className="hidden lg:inline">Agregar al carrito</span>
            </>
          )}
        </button>
      </div>
      )}
    </div>
  );
}
