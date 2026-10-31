"use client";

import { useEffect, useRef } from "react";
import Link from "@/components/barraca/Enlace";
import Image from "next/image";
import { formatCLP } from "@jurmaq/shared/format";
import { trackEvents } from "@/lib/analytics";
import { cambiarCantidad, quitarDelCarrito, vaciarCarrito, type ItemCarrito } from "@/lib/carrito";
import { useCarrito } from "@/lib/useCarrito";
import CantidadEditable from "@/components/barraca/CantidadEditable";
import AvisoSinRetracto from "@/components/barraca/AvisoSinRetracto";
import { useZonaDespacho } from "@/components/barraca/SelectorZona";

/** Entrega según la zona elegida en el header: costo y cuánto falta para despacho gratis. */
function EntregaZona({ subtotal }: { subtotal: number }) {
  const [zona] = useZonaDespacho();
  if (!zona) {
    return (
      <div className="flex justify-between gap-3">
        <span className="text-gray-600">Entrega</span>
        <span className="text-gray-500 text-right">Retiro gratis en Molina o despacho a domicilio</span>
      </div>
    );
  }
  const gratis = zona.gratisDesde != null && subtotal >= zona.gratisDesde;
  return (
    <div>
      <div className="flex justify-between gap-3">
        <span className="text-gray-600">Despacho a {zona.nombre}</span>
        <span className={`tabular-nums ${gratis ? "text-[#2F7F4E] font-medium" : ""}`}>{gratis ? "Gratis" : formatCLP(zona.costo)}</span>
      </div>
      {!gratis && zona.gratisDesde != null && (
        <p className="text-xs text-gray-500 text-right mt-0.5 tabular-nums">Te faltan {formatCLP(zona.gratisDesde - subtotal)} para despacho gratis</p>
      )}
      <p className="text-xs text-gray-400 text-right mt-0.5">O retiro gratis en Molina. Lo eliges al pagar.</p>
    </div>
  );
}

function Cantidad({ item }: { item: ItemCarrito }) {
  return <CantidadEditable valor={item.cantidad} max={item.stock} nombre={item.nombre} onCambio={(n) => cambiarCantidad(item.productoId, n)} />;
}

export default function CarritoPage() {
  const { items, problemas, cargando, total, cantidad, hayProblemas } = useCarrito({ revisar: true });
  const vista = useRef(false);

  useEffect(() => {
    if (cargando || vista.current || items.length === 0) return;
    vista.current = true;
    trackEvents.viewCart(items.map((i) => ({ id: i.productoId, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad })));
  }, [cargando, items]);

  if (cargando) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-marca-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const neto = Math.round(total / 1.19);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 pb-28 lg:pb-12">
      {/* Breadcrumb */}
      <nav aria-label="Ruta de navegación" className="flex items-center gap-2 text-sm text-[#787774] mb-10">
        <Link href="/" className="hover:text-[#111111] transition-colors">Inicio</Link>
        <svg className="w-3.5 h-3.5 text-[#C9C9C5]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[#111111] font-medium">Carrito</span>
      </nav>

      <div className="flex items-end justify-between mb-10 pb-6 border-b border-[#EAEAEA]">
        <div>
          <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
            Compra en línea
          </p>
          <h1
            className="text-[#111111] leading-[1.1]"
            style={{ fontSize: 'clamp(1.875rem, 3.5vw, 2.75rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            Tu <span className="font-semibold" style={{ fontWeight: 400 }}>carrito</span>
          </h1>
        </div>
        {items.length > 0 && (
          <button
            onClick={vaciarCarrito}
            className="min-h-[44px] px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 active:bg-red-100 font-medium flex items-center gap-1.5 transition-colors touch-manipulation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Vaciar carrito
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white border border-[#EAEAEA] rounded-2xl p-10 sm:p-16 text-center">
          <svg className="w-16 h-16 mx-auto text-[#C9C9C5] mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
          <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
            Tu carrito está vacío
          </p>
          <h2
            className="text-[#111111] mb-3 leading-[1.15]"
            style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 500, letterSpacing: '-0.005em' }}
          >
            Aún no hay <span className="font-semibold" style={{ fontWeight: 400 }}>productos</span>.
          </h2>
          <p className="text-base text-[#5A5A57] mb-8 max-w-md mx-auto">
            Agrega productos del catálogo y paga en línea o por transferencia.
          </p>
          <Link href="/categorias" className="inline-flex items-center gap-2 px-6 py-3 bg-navy-950 hover:bg-[#111111] text-white text-sm font-medium tracking-[0.02em] rounded-lg transition-colors">
            Explorar categorías
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Items */}
          <div className="flex-1 min-w-0">
            {/* Desktop */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="col-span-5">Producto</div>
                <div className="col-span-2 text-center">Precio</div>
                <div className="col-span-2 text-center">Cantidad</div>
                <div className="col-span-2 text-right">Subtotal</div>
                <div className="col-span-1" />
              </div>
              {items.map((item) => (
                <div key={item.productoId} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-100 last:border-0 items-center">
                  <div className="col-span-5">
                    <Link href={item.slug ? `/producto/${item.slug}` : '#'} className="flex items-center gap-4 group" aria-label={`Ver ${item.nombre}`}>
                      <div className="w-16 h-16 bg-gray-100 rounded-lg shrink-0 overflow-hidden relative">
                        <Image src={item.imagen || '/images/barraca/default.svg'} alt={`Producto ${item.nombre} en tu carrito`} fill sizes="64px" className="object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/barraca/default.svg'; }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 group-hover:text-marca-600 transition-colors">{item.nombre}</p>
                        {item.medida && <p className="text-xs text-gray-500">{item.medida}</p>}
                        {problemas[item.productoId] ? (
                          <p className="text-xs font-semibold text-red-600 mt-0.5">{problemas[item.productoId]}</p>
                        ) : (
                          <p className="text-xs text-gray-500 mt-0.5 tabular-nums">{item.stock} disponibles</p>
                        )}
                      </div>
                    </Link>
                  </div>
                  <div className="col-span-2 text-center text-sm font-medium text-gray-900 tabular-nums">{formatCLP(item.precio)}</div>
                  <div className="col-span-2 flex justify-center"><Cantidad item={item} /></div>
                  <div className="col-span-2 text-right text-sm font-bold text-navy-950 tabular-nums">{formatCLP(item.precio * item.cantidad)}</div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => quitarDelCarrito(item.productoId)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors" aria-label={`Quitar ${item.nombre} del carrito`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3">
              {items.map((item) => (
                <div key={item.productoId} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex gap-3">
                    <Link href={item.slug ? `/producto/${item.slug}` : '#'} className="w-20 h-20 bg-gray-100 rounded-lg shrink-0 overflow-hidden relative" aria-label={`Ver ${item.nombre}`}>
                      <Image src={item.imagen || '/images/barraca/default.svg'} alt={`Producto ${item.nombre} en tu carrito`} fill sizes="80px" className="object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/barraca/default.svg'; }} />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <Link href={item.slug ? `/producto/${item.slug}` : '#'} className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 hover:text-marca-600 transition-colors">{item.nombre}</p>
                          {item.medida && <p className="text-xs text-gray-500">{item.medida}</p>}
                        </Link>
                        <button onClick={() => quitarDelCarrito(item.productoId)} aria-label={`Quitar ${item.nombre} del carrito`} className="p-2 -mr-2 -mt-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-red-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <AvisoSinRetracto codigo={item.codigo} tamano="carrito" />
                      <p className="text-sm font-semibold text-navy-950 mt-1 tabular-nums">{formatCLP(item.precio)} <span className="text-xs font-normal text-gray-500">{item.unidad ? `/${item.unidad.toLowerCase()}` : "c/u"}</span></p>
                      {problemas[item.productoId] && (
                        <p className="text-xs font-semibold text-red-600 mt-0.5">{problemas[item.productoId]}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <Cantidad item={item} />
                    <p className="text-base font-bold text-navy-950 tabular-nums">{formatCLP(item.precio * item.cantidad)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resumen */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="bg-white border border-[#EAEAEA] rounded-2xl p-6 lg:sticky lg:top-40">
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-2">Total</p>
              <h2
                className="text-[#111111] mb-5 leading-[1.1]"
                style={{ fontSize: 'clamp(1.125rem, 1.6vw, 1.375rem)', fontWeight: 500, letterSpacing: '-0.005em' }}
              >
                Resumen de tu <span className="font-semibold" style={{ fontWeight: 400 }}>compra</span>
              </h2>
              <div className="space-y-2 mb-6 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Productos ({cantidad})</span>
                  <span className="font-medium text-gray-900 tabular-nums">{formatCLP(total)}</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-gray-200">
                  <span className="text-gray-600">Neto</span>
                  <span className="tabular-nums">{formatCLP(neto)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">IVA (19%)</span>
                  <span className="tabular-nums">{formatCLP(total - neto)}</span>
                </div>
                <EntregaZona subtotal={total} />
                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-100">
                  <span>Total (IVA incluido)</span>
                  <span className="text-marca-600 tabular-nums">{formatCLP(total)}</span>
                </div>
              </div>
              {hayProblemas && (
                <p className="text-xs text-red-600 font-medium mb-3">
                  Quita los productos marcados en rojo para continuar.
                </p>
              )}
              {hayProblemas ? (
                <span aria-disabled="true" className="flex w-full min-h-[52px] items-center justify-center px-4 py-3.5 text-base font-bold bg-gray-300 text-white rounded-lg cursor-not-allowed">
                  Ir a pagar
                </span>
              ) : (
                <Link
                  href="/checkout"
                  className="flex w-full min-h-[52px] items-center justify-center gap-2 px-4 py-3.5 text-center text-base font-bold leading-tight bg-marca-600 text-white rounded-lg hover:bg-marca-700 shadow-md shadow-marca-200 transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] touch-manipulation"
                >
                  Ir a pagar
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
              <p className="text-xs text-gray-500 mt-3 text-center">Webpay (débito y crédito) o transferencia bancaria.</p>
              <Link href="/categorias" className="block w-full py-2.5 mt-2 text-center text-sm font-medium text-gray-600 hover:text-navy-950 transition-colors">
                Seguir comprando
              </Link>
            </div>
          </div>

          {/* Celular: total y "Ir a pagar" siempre a mano, sin bajar hasta el resumen. */}
          {!hayProblemas && (
            <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-center gap-3 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 shadow-[0_-8px_24px_-16px_rgba(8,20,40,0.35)] safe-bottom">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-500 leading-none">Total · IVA incluido</p>
                <p className="text-xl font-extrabold text-navy-950 tabular-nums leading-tight mt-1">{formatCLP(total)}</p>
              </div>
              <Link href="/checkout" className="shrink-0 inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-marca-600 text-white font-bold active:scale-[0.98] transition-transform">
                Ir a pagar
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
