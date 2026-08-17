"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatCLP } from "@jurmaq/shared/format";

interface CartItem {
  id: number;
  producto_id: number;
  nombre: string;
  precio: number;
  precio_tachado?: number | null;
  porcentaje_descuento?: number | null;
  cantidad: number;
  imagen: string | null;
  slug: string | null;
  medida: string | null;
  unidad: string | null;
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

export default function CarritoPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchCart() {
    setLoading(true);
    try {
      const sid = getSessionId();
      const res = await fetch("/api/carrito", {
        headers: { "X-Session-Id": sid },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCart();
  }, []);

  async function updateQuantity(itemId: number, newQty: number) {
    if (newQty < 1) return;
    // Audit fix S0 #2: PUT requería X-Session-Id que faltaba — endpoint rechazaba
    // mutaciones de usuarios que entraban directo a /carrito desde email (cookie
    // de sesión no se había seteado).
    const sid = getSessionId();
    await fetch("/api/carrito", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Session-Id": sid },
      body: JSON.stringify({ itemId, cantidad: newQty }),
    });
    setItems(
      items.map((i) => (i.id === itemId ? { ...i, cantidad: newQty } : i))
    );
    window.dispatchEvent(new Event("cart-updated"));
  }

  async function removeItem(itemId: number) {
    const sid = getSessionId();
    await fetch("/api/carrito", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "X-Session-Id": sid },
      body: JSON.stringify({ itemId }),
    });
    setItems(items.filter((i) => i.id !== itemId));
    window.dispatchEvent(new Event("cart-updated"));
  }

  async function clearCart() {
    // Audit fix S2 #16: paralelizar DELETE (antes era N+1 secuencial).
    const sid = getSessionId();
    await Promise.all(
      items.map((item) =>
        fetch("/api/carrito", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", "X-Session-Id": sid },
          body: JSON.stringify({ itemId: item.id }),
        }),
      ),
    );
    setItems([]);
    window.dispatchEvent(new Event("cart-updated"));
  }

  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const totalItems = items.reduce((s, i) => s + i.cantidad, 0);

  // Cupón state (Sprint 6 wiring)
  const [cuponInput, setCuponInput] = useState('');
  const [cuponEmail, setCuponEmail] = useState('');
  const [cuponState, setCuponState] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'applied'; codigo: string; descuento: number; descripcion: string | null; cuponId: string }
    | { kind: 'error'; msg: string }
  >({ kind: 'idle' });

  async function validarCupon() {
    if (!cuponInput.trim() || !cuponEmail.trim()) {
      setCuponState({ kind: 'error', msg: 'Ingresa email + código' });
      return;
    }
    setCuponState({ kind: 'loading' });
    try {
      const res = await fetch('/api/public/cupones/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: cuponInput.trim(), email: cuponEmail.trim(), monto_compra: subtotal }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCuponState({ kind: 'error', msg: data.error || 'Cupón inválido' });
        return;
      }
      setCuponState({
        kind: 'applied',
        codigo: data.codigo,
        descuento: data.descuento,
        descripcion: data.descripcion,
        cuponId: data.cupon_id,
      });
      // Persist en localStorage para que el flow de cotizar lo recupere.
      try {
        localStorage.setItem(
          'barraca_cupon',
          JSON.stringify({ codigo: data.codigo, descuento: data.descuento, cupon_id: data.cupon_id, email: cuponEmail.trim() }),
        );
      } catch {}
    } catch (err) {
      setCuponState({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    }
  }

  function quitarCupon() {
    setCuponState({ kind: 'idle' });
    setCuponInput('');
    try {
      localStorage.removeItem('barraca_cupon');
    } catch {}
  }

  const descuentoCupon = cuponState.kind === 'applied' ? cuponState.descuento : 0;
  const totalFinal = Math.max(0, subtotal - descuentoCupon);

  // A7: tracking carrito abandonado.
  // Cuando hay items + tenemos email (del cupón o del usuario logueado), o un
  // session_id, mandamos snapshot al endpoint /track. Eso habilita los emails
  // de recovery del cron carrito-recovery. Debounce 5s para no spammear.
  useEffect(() => {
    if (items.length === 0) return;
    if (subtotal <= 0) return;

    let email = '';
    let telefono = '';
    let sessionId = '';
    try {
      const stored = localStorage.getItem('barraca_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.email) email = String(u.email);
        // Tier 4 D7: SMS recovery requiere telefono — solo lo enviamos si el
        // cliente está logueado (consent implícito en registro).
        if (u?.telefono) telefono = String(u.telefono);
      }
      sessionId = localStorage.getItem('barraca_session_id') || '';
      if (!email && cuponEmail) email = cuponEmail;
    } catch {}

    if (!email && !sessionId) return;

    const t = setTimeout(() => {
      void fetch('/api/public/carrito-abandonado/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          telefono: telefono || undefined,
          session_id: sessionId,
          items: items.map((i) => ({
            producto_id: i.producto_id,
            nombre: i.nombre,
            precio: i.precio,
            cantidad: i.cantidad,
          })),
          total: subtotal,
        }),
      }).catch(() => undefined);
    }, 5000);

    return () => clearTimeout(t);
  }, [items, cuponEmail, subtotal]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
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
            Tu pedido
          </p>
          <h1
            className="text-[#111111] leading-[1.1]"
            style={{ fontSize: 'clamp(1.875rem, 3.5vw, 2.75rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            Mi <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>carrito</span>
          </h1>
        </div>
        {items.length > 0 && (
          <button
            onClick={clearCart}
            className="min-h-[44px] px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 active:bg-red-100 font-medium flex items-center gap-1.5 transition-colors touch-manipulation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Vaciar carrito
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white border border-[#EAEAEA] rounded-2xl p-16 text-center">
          <svg className="w-16 h-16 mx-auto text-[#C9C9C5] mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
          <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
            Carrito vacío
          </p>
          <h2
            className="text-[#111111] mb-3 leading-[1.15]"
            style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 500, letterSpacing: '-0.005em' }}
          >
            Aún no hay <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>productos</span>.
          </h2>
          <p className="text-base text-[#5A5A57] mb-8 max-w-md mx-auto">
            Agregá productos al carrito para pedir una cotización.
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
          {/* Cart Items */}
          <div className="flex-1">
            {/* Desktop view */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="col-span-5">Producto</div>
                <div className="col-span-2 text-center">Precio</div>
                <div className="col-span-2 text-center">Cantidad</div>
                <div className="col-span-2 text-right">Subtotal</div>
                <div className="col-span-1" />
              </div>

              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-100 last:border-0 items-center">
                  <div className="col-span-5">
                    <Link
                      href={item.slug ? `/producto/${item.slug}` : '#'}
                      className="flex items-center gap-4 group"
                      aria-label={`Ver ${item.nombre}`}
                    >
                      <div className="w-16 h-16 bg-gray-100 rounded-lg shrink-0 overflow-hidden relative">
                        <Image src={item.imagen || '/images/barraca/default.svg'} alt={`Producto ${item.nombre} en el carrito`} fill sizes="64px" className="object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/barraca/default.svg'; }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 group-hover:text-orange-600 transition-colors">{item.nombre}</p>
                        {item.medida && <p className="text-xs text-gray-500">{item.medida}</p>}
                      </div>
                    </Link>
                  </div>
                  <div className="col-span-2 text-center text-sm font-medium text-gray-900">
                    {item.precio_tachado && item.precio_tachado > item.precio ? (
                      <>
                        <span className="block text-xs text-gray-400 line-through tabular-nums">{formatCLP(item.precio_tachado)}</span>
                        <span className="block text-orange-600 tabular-nums">{formatCLP(item.precio)}</span>
                      </>
                    ) : (
                      formatCLP(item.precio)
                    )}
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <div className="flex items-center border-2 border-gray-200 rounded-lg overflow-hidden">
                      <button onClick={() => updateQuantity(item.id, item.cantidad - 1)} aria-label={`Disminuir cantidad de ${item.nombre}`} className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold transition-colors">-</button>
                      <span className="w-11 h-11 flex items-center justify-center text-sm font-bold border-x-2 border-gray-200">{item.cantidad}</span>
                      <button onClick={() => updateQuantity(item.id, item.cantidad + 1)} aria-label={`Aumentar cantidad de ${item.nombre}`} className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold transition-colors">+</button>
                    </div>
                  </div>
                  <div className="col-span-2 text-right text-sm font-bold text-navy-950">
                    {formatCLP((item.precio * item.cantidad))}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeItem(item.id)} className="p-2 text-gray-500 hover:text-red-500 transition-colors" aria-label={`Eliminar ${item.nombre} del carrito`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {items.map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex gap-3">
                    <Link href={item.slug ? `/producto/${item.slug}` : '#'} className="w-20 h-20 bg-gray-100 rounded-lg shrink-0 overflow-hidden relative" aria-label={`Ver ${item.nombre}`}>
                      <Image src={item.imagen || '/images/barraca/default.svg'} alt={`Producto ${item.nombre} en el carrito`} fill sizes="80px" className="object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/barraca/default.svg'; }} />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <Link href={item.slug ? `/producto/${item.slug}` : '#'} className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 hover:text-orange-600 transition-colors">{item.nombre}</p>
                          {item.medida && <p className="text-xs text-gray-500">{item.medida}</p>}
                        </Link>
                        <button onClick={() => removeItem(item.id)} aria-label={`Eliminar ${item.nombre} del carrito`} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-red-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-navy-950 mt-1">
                        {item.precio_tachado && item.precio_tachado > item.precio && (
                          <span className="text-xs text-gray-400 line-through tabular-nums mr-1.5 font-normal">{formatCLP(item.precio_tachado)}</span>
                        )}
                        <span className={item.precio_tachado && item.precio_tachado > item.precio ? "text-orange-600" : ""}>{formatCLP(item.precio)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center border-2 border-gray-200 rounded-lg overflow-hidden">
                      <button onClick={() => updateQuantity(item.id, item.cantidad - 1)} aria-label={`Disminuir cantidad de ${item.nombre}`} className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold transition-colors">-</button>
                      <span className="w-11 h-11 flex items-center justify-center text-sm font-bold border-x-2 border-gray-200">{item.cantidad}</span>
                      <button onClick={() => updateQuantity(item.id, item.cantidad + 1)} aria-label={`Aumentar cantidad de ${item.nombre}`} className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold transition-colors">+</button>
                    </div>
                    <p className="text-base font-bold text-navy-950">{formatCLP((item.precio * item.cantidad))}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cart Summary */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="bg-white border border-[#EAEAEA] rounded-2xl p-6 sticky top-24">
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-2">
                Total
              </p>
              <h2
                className="text-[#111111] mb-5 leading-[1.1]"
                style={{ fontSize: 'clamp(1.125rem, 1.6vw, 1.375rem)', fontWeight: 500, letterSpacing: '-0.005em' }}
              >
                Resumen del <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>pedido</span>
              </h2>
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Productos ({totalItems})</span>
                  <span className="font-medium text-gray-900">{formatCLP(subtotal)}</span>
                </div>

                {/* Cupón input (A6 Sprint Tier 1) */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  {cuponState.kind === 'applied' ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
                      <div className="text-xs">
                        <span className="font-mono font-semibold text-green-800">{cuponState.codigo}</span>
                        <span className="text-green-700"> aplicado · −{formatCLP(cuponState.descuento)}</span>
                      </div>
                      <button
                        onClick={quitarCupon}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <details className="text-sm">
                      <summary className="text-xs text-[#956400] hover:text-[#111111] cursor-pointer inline-flex items-center gap-1.5 font-medium">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                          <path d="M13 5v2M13 17v2M13 11v2" />
                        </svg>
                        ¿Tienes un código de descuento?
                      </summary>
                      <div className="mt-2 space-y-2">
                        <input
                          type="email"
                          value={cuponEmail}
                          onChange={(e) => setCuponEmail(e.target.value)}
                          placeholder="Tu email"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={cuponInput}
                            onChange={(e) => setCuponInput(e.target.value.toUpperCase())}
                            placeholder="CÓDIGO"
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono uppercase"
                          />
                          <button
                            onClick={validarCupon}
                            disabled={cuponState.kind === 'loading' || !cuponInput || !cuponEmail}
                            className="px-3 py-1.5 bg-navy-950 hover:bg-[#111111] disabled:opacity-50 text-white text-xs font-medium tracking-[0.02em] rounded"
                          >
                            {cuponState.kind === 'loading' ? '…' : 'Aplicar'}
                          </button>
                        </div>
                        {cuponState.kind === 'error' && (
                          <p className="text-xs text-red-600">{cuponState.msg}</p>
                        )}
                      </div>
                    </details>
                  )}
                </div>

                <div className="space-y-2 pt-4 border-t border-gray-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal neto</span>
                    <span>{formatCLP(Math.round(subtotal / 1.19))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IVA (19%)</span>
                    <span>{formatCLP((subtotal - Math.round(subtotal / 1.19)))}</span>
                  </div>
                  {cuponState.kind === 'applied' && (
                    <div className="flex justify-between text-sm text-green-700 font-medium">
                      <span>Descuento ({cuponState.codigo})</span>
                      <span>−{formatCLP(descuentoCupon)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Despacho</span>
                    <span className="text-gray-500">Por cotizar segun comuna</span>
                  </div>
                  <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-100">
                    <span>Total (IVA incluido)</span>
                    <span className="text-orange-600">{formatCLP(totalFinal)}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-5">* Precios referenciales. Se confirmarán en la cotización.</p>
              <Link href="/cotizar" className="block w-full py-3.5 text-center text-base font-bold bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-md shadow-orange-200 transition-colors">
                Solicitar cotización
              </Link>
              <Link href="/categorias" className="block w-full py-3 mt-3 text-center text-sm font-semibold border-2 border-orange-600 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                Seguir comprando
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
