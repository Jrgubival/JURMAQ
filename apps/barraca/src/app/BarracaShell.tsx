"use client";

import Link from "@/components/barraca/Enlace";
import dynamic from "next/dynamic";
import Image from "next/image";
import MediosPago from "@/components/barraca/MediosPago";
import { useState, useEffect, useRef } from "react";
import { env } from "@jurmaq/shared/env";
import { usePathname } from "next/navigation";
import SearchBar from "@/components/barraca/SearchBar";
import ToastContainer from "@/components/Toast";
import { LEGAL_INFO, HORARIO_BARRACA, buildFooterCopyright } from "@jurmaq/shared/seo";
import { whatsappCtaBarracaCotizar, whatsappCtaBarracaMejorarPrecio } from "@jurmaq/shared/whatsapp";
import { FRANJA_TIENDA } from "@/lib/promesa";
import { cantidadEnCarrito } from "@/lib/carrito";

const CartDrawer = dynamic(
  () => import("@/components/barraca/CartDrawer"),
  { ssr: false }
);
// NewsletterPopup retirado del shell.
//
// Aparecía en TODAS las páginas públicas ofreciendo "5% OFF en tu primera
// compra". Es el patrón más reproducido de las plantillas de e-commerce y una
// de las cosas que hacían que el sitio se leyera como generado.
//
// El dato que terminó de decidirlo: hay 18 suscriptores capturados y nunca se
// les envió una campaña. Interrumpir a cada visitante para alimentar una lista
// a la que no se le escribe es fricción sin contrapartida.
//
// La ruta /api/suscriptores y los 18 correos se conservan intactos. Si en
// algún momento se van a mandar campañas, el lugar correcto es un campo
// discreto en el footer, no un modal sobre el catálogo.

interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  producto_count?: number;
}

const CATEGORY_ICON_DEFAULT = "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4";

/**
 * Switcher de las tres unidades JURMAQ.
 *
 * Debe ser idéntico en los tres sitios (jurmaq.cl, constructora.jurmaq.cl y
 * barraca.jurmaq.cl): jurmaq.cl es el hub y desde cualquier página se salta a
 * cualquier vertical. El gemelo vive en
 * `apps/constructora/src/components/public/Navbar.tsx` — si cambia uno, cambia
 * el otro. Está duplicado y no en shared porque cada app usa su propio sistema
 * de color (naranja acá, gold en constructora) y compartirlo obligaría a
 * parametrizar más de lo que ahorra.
 */
const VERTICALES = [
  { key: 'arriendo', label: 'Arriendo', sub: 'Maquinaria', url: 'https://jurmaq.cl' },
  { key: 'constructora', label: 'Constructora', sub: 'Obras civiles', url: 'https://constructora.jurmaq.cl' },
  { key: 'barraca', label: 'Barraca', sub: 'Fierros y materiales', url: '/' },
] as const;

// Franja roja fija arriba en todas las páginas (pedido del dueño, oct-2026).
// Desde la tienda en línea dice cómo comprar (FRANJA_TIENDA). Es la ÚNICA línea
// sobre el header: el dueño encontró recargadas dos barras (la azul llevaba
// promesa, despacho, horario, teléfono y correo) y pidió dejar sólo esta. El
// horario y el contacto siguen en el pie y en /sucursales.
//
// Siempre en una línea: la letra se achica con el ancho en vez de partirse en
// dos en celular. Mide 32 px y el header usa ese alto como offset.
function FranjaPrecios() {
  return (
    <div
      className="sticky top-0 z-[55] bg-marca-600 text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* El texto mide ~28,7 veces el tamaño de letra: con (ancho − 24 px) / 30
          cabe siempre en una línea, de 320 px en adelante y con margen; tope 13 px. */}
      <p
        className="max-w-7xl mx-auto px-3 h-8 flex items-center justify-center text-center font-semibold leading-none whitespace-nowrap overflow-hidden"
        style={{ fontSize: 'min(13px, calc((100vw - 24px) / 30))' }}
      >
        {FRANJA_TIENDA}
      </p>
    </div>
  );
}

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [user, setUser] = useState<{ nombre: string; rol?: string } | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  // Hide navbar on scroll down, show on scroll up
  useEffect(() => {
    function handleScroll() {
      const currentY = window.scrollY;
      if (currentY < 100) { setNavVisible(true); }
      else if (currentY > lastScrollY.current + 10) { setNavVisible(false); setCatOpen(false); setAccountOpen(false); }
      else if (currentY < lastScrollY.current - 10) { setNavVisible(true); }
      lastScrollY.current = currentY;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu or cart drawer is open
  useEffect(() => {
    if (mobileOpen || cartOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => document.body.classList.remove("overflow-hidden");
  }, [mobileOpen, cartOpen]);

  useEffect(() => {
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((d) => setCategorias(Array.isArray(d) ? d : d.categorias || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Read user from localStorage. Token format is base64 (not JWT) so we
    // only fall back to it as "logged-in" signal; the real user data lives in
    // barraca_user.
    function syncUser() {
      const storedUser = localStorage.getItem("barraca_user");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setUser({ nombre: parsed.nombre || "Usuario", rol: parsed.rol });
          return;
        } catch { /* invalid JSON */ }
      }
      const token = localStorage.getItem("barraca_token");
      if (!token) {
        setUser(null);
        return;
      }
      // Token present but no user JSON: show a generic logged-in badge until
      // the cuenta page loads the full profile.
      setUser({ nombre: "Mi Cuenta" });
    }

    syncUser();

    // Re-sync when another tab logs in/out, or when we dispatch the custom
    // event ourselves (e.g. after login on the same tab).
    function onStorage(e: StorageEvent) {
      if (e.key === "barraca_user" || e.key === "barraca_token" || e.key === null) syncUser();
    }
    function onAuthChange() { syncUser(); }
    window.addEventListener("storage", onStorage);
    window.addEventListener("barraca-auth-changed", onAuthChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("barraca-auth-changed", onAuthChange);
    };
  }, []);

  // Contador del carrito: el carrito vive en el navegador (lib/carrito.ts),
  // así que se lee de localStorage sin ir al servidor.
  useEffect(() => {
    const leer = () => setCartCount(cantidadEnCarrito());
    leer();
    window.addEventListener("cart-updated", leer);
    window.addEventListener("storage", leer);
    return () => {
      window.removeEventListener("cart-updated", leer);
      window.removeEventListener("storage", leer);
    };
  }, []);

  // Cualquier componente puede disparar "barraca:open-cart" para abrir el drawer
  // sin tener que pasarle el setter cross-component.
  useEffect(() => {
    function onOpenCart() { setCartOpen(true); }
    window.addEventListener("barraca:open-cart", onOpenCart);
    return () => window.removeEventListener("barraca:open-cart", onOpenCart);
  }, []);

  // Close account dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close dropdowns and mobile menu on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (catOpen) setCatOpen(false);
        if (accountOpen) setAccountOpen(false);
        if (mobileOpen) setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [catOpen, accountOpen, mobileOpen]);

  return (
    <>
      <header role="banner" className={`sticky top-[calc(2rem+env(safe-area-inset-top))] z-50 bg-white border-b border-gray-200 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] transition-transform duration-300 ${navVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20 gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-baseline shrink-0">
              <span className="text-2xl lg:text-3xl font-extrabold text-navy-950 tracking-tight">
                JURMAQ
              </span>{" "}
              <span className="text-lg lg:text-xl font-semibold text-marca-600 ml-1">
                Barraca
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav role="navigation" aria-label="Navegación barraca" className="hidden lg:flex items-center gap-1">

              {/* Categorias Mega Menu */}
              <div
                className="relative mega-menu-trigger"
                onMouseEnter={() => setCatOpen(true)}
                onMouseLeave={() => setCatOpen(false)}
              >
                <button
                  onClick={() => setCatOpen(!catOpen)}
                  aria-expanded={catOpen}
                  aria-haspopup="true"
                  className="px-3.5 py-2 text-sm font-semibold text-white bg-navy-950 hover:bg-navy-800 rounded-md transition-colors flex items-center gap-1"
                >
                  Categorías
                  <svg className={`w-3 h-3 transition-transform ${catOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {catOpen && categorias.length > 0 && (
                  <div className="absolute top-full left-0 mt-2 w-[780px] bg-white rounded-lg shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] border border-gray-200 p-5 z-50">
                    <div className="grid grid-cols-3 gap-x-4 gap-y-0">
                      {categorias.map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/categorias/${cat.slug}`}
                          className="block px-3 py-2 text-[15px] text-gray-800 hover:bg-gray-50 hover:text-marca-600 rounded-md transition-colors duration-150"
                        >
                          {cat.nombre}
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 mt-4 pt-4">
                      <Link
                        href="/categorias"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-marca-600 hover:text-marca-700 transition-colors"
                      >
                        Ver todas las categorías
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </nav>

            {/* Desktop Search - bigger and more prominent */}
            <div className="hidden lg:block flex-1 max-w-3xl mx-6">
              <SearchBar size="lg" />
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Mi Cuenta Dropdown */}
              <div ref={accountRef} className="relative hidden sm:block">
                <button
                  onClick={() => setAccountOpen(!accountOpen)}
                  aria-expanded={accountOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-navy-950 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="hidden xl:inline">{user ? user.nombre : "Mi Cuenta"}</span>
                  {user?.rol === 'admin' && (
                    <svg className="w-3.5 h-3.5 text-marca-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                  <svg className={`w-3 h-3 transition-transform ${accountOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {accountOpen && (
                  <div className="absolute top-full right-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
                    {user ? (
                      <>
                        <div className="px-4 py-2 border-b border-gray-100 mb-1">
                          <p className="text-sm font-semibold text-gray-900">{user.nombre}</p>
                        </div>
                        <Link href="/cuenta" onClick={() => setAccountOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-marca-50 hover:text-marca-600 transition-colors">
                          Mi Cuenta
                        </Link>
                        {user?.rol === 'admin' && (
                          // Full URL to main domain (admin panel lives only on jurmaq.cl).
                          // Using <a> instead of <Link> so the browser does a full cross-subdomain
                          // navigation — the NextAuth session cookie has Domain=.jurmaq.cl so the
                          // session carries over from barraca.jurmaq.cl.
                          <a
                            href="https://jurmaq.cl/admin"
                            onClick={() => setAccountOpen(false)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-indigo-700 hover:bg-indigo-50 transition-colors font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Panel Admin
                          </a>
                        )}
                        <div className="border-t border-gray-100 mt-1 pt-1">
                          <button
                            onClick={() => {
                              localStorage.removeItem("barraca_token");
                              localStorage.removeItem("barraca_user");
                              localStorage.removeItem("barraca_session_id");
                              window.dispatchEvent(new Event("barraca-auth-changed"));
                              setUser(null);
                              setAccountOpen(false);
                              window.location.href = "/";
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Cerrar sesión
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Link href="/cuenta/login" onClick={() => setAccountOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-marca-50 hover:text-marca-600 transition-colors">
                          Iniciar sesión
                        </Link>
                        <Link href="/cuenta/registro" onClick={() => setAccountOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-marca-50 hover:text-marca-600 transition-colors">
                          Crear cuenta
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Cart */}
              <button
                onClick={() => setCartOpen(true)}
                data-magnetic
                className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center gap-2 text-gray-700 hover:text-navy-950 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={`Carrito${cartCount > 0 ? ` (${cartCount})` : ""}`}
              >
                <span className="relative">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                  </svg>
                  {cartCount > 0 && (
                    <span className="absolute -top-2.5 -right-2.5 min-w-[22px] h-[22px] px-1 bg-red-600 text-white text-[11px] font-black rounded-full flex items-center justify-center ring-2 ring-white animate-[pulse_2s_ease-in-out_1]">
                      {cartCount}
                    </span>
                  )}
                </span>
                <span className="hidden lg:inline text-sm font-medium whitespace-nowrap">Carrito</span>
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-300 hover:text-white hover:bg-navy-800 rounded-lg transition-colors"
                aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              >
                {mobileOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Fila de categorías, bajo el buscador. La tienen Sodimac, Easy,
              Construmart y Prodalam. Siete que caben a 1280px sin scroll: un
              overflow-x-auto se corría con un gesto de trackpad y quedaba
              desplazado, que fue como lo vio el dueño.

              La fila se dibuja SIEMPRE (con su alto de 40px) aunque las
              categorías todavía no hayan llegado del fetch: antes se montaba
              recién con los datos y el banner saltaba 40px hacia abajo en cada
              carga. */}
          <nav aria-label="Categorías principales" className="hidden lg:block border-t border-gray-100">
              <ul className="flex items-center h-10 overflow-hidden">
                {[...categorias]
                  .sort((a, b) => (b.producto_count ?? 0) - (a.producto_count ?? 0))
                  .slice(0, 7)
                  .map((cat) => (
                  <li key={cat.id} className="shrink-0">
                    <Link
                      href={`/categorias/${cat.slug}`}
                      className="inline-flex items-center h-10 px-3 text-[13px] font-medium text-gray-700 hover:text-navy-950 border-b-2 border-transparent hover:border-marca-600 transition-colors duration-150"
                    >
                      {cat.nombre}
                    </Link>
                  </li>
                ))}
                <li className="shrink-0">
                  <Link href="/categorias" className="inline-flex items-center h-10 px-3 text-[13px] font-semibold text-marca-600 hover:text-marca-700 transition-colors duration-150">
                    Todas las categorías →
                  </Link>
                </li>
              </ul>
          </nav>
          {/* Mobile Search */}
          <div className="lg:hidden pb-3">
            <SearchBar size="md" />
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div role="dialog" aria-label="Menú de navegación móvil" className="lg:hidden bg-white border-t border-gray-200 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <div className="px-4 py-4 space-y-1">
              <Link
                href="/categorias"
                onClick={() => setMobileOpen(false)}
                className="flex items-center px-4 min-h-[48px] py-3 text-base font-medium text-gray-700 hover:text-navy-950 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Categorías
              </Link>
              {categorias.slice(0, 8).map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categorias/${cat.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center px-8 min-h-[44px] py-2.5 text-sm text-gray-500 hover:text-navy-950 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {cat.nombre}
                </Link>
              ))}
              <div className="pt-4 border-t border-gray-200 space-y-1">
                <Link
                  href="/carrito"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center px-4 min-h-[48px] py-3 text-base font-medium text-gray-700 hover:text-navy-950 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Carrito ({cartCount})
                </Link>
                {user ? (
                  <>
                    <Link
                      href="/cuenta"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center px-4 min-h-[48px] py-3 text-base font-medium text-gray-700 hover:text-navy-950 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Mi Cuenta
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/cuenta/login"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center px-4 min-h-[48px] py-3 text-base font-medium text-gray-700 hover:text-navy-950 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Ingresar
                    </Link>
                    <Link
                      href="/cuenta/registro"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center min-h-[48px] px-5 py-3 bg-marca-600 hover:bg-marca-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      Crear cuenta
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}

function WhatsAppFloat() {
  // WhatsApp FAB reubicado a left-6 (esquina opuesta a ADIA) y reducido a
  // w-11 h-11 para no competir visualmente con el botón ADIA primary.
  // Verde mantenido por reconocimiento de marca WhatsApp.
  // En /te-mejoramos-el-precio lleva el mismo texto que los botones de esa
  // página ("quiero que me mejoren esta cotización"); en el resto, el default.
  const pathname = usePathname();
  // En la compra (carrito, checkout, confirmación) el botón flotante tapaba
  // campos y el botón de pagar en celular; ahí no se muestra.
  if (pathname === "/carrito" || pathname === "/checkout" || pathname?.startsWith("/pedido/") || pathname?.startsWith("/pago/")) {
    return null;
  }
  const href = pathname === "/te-mejoramos-el-precio"
    ? whatsappCtaBarracaMejorarPrecio('shell_fab')
    : whatsappCtaBarracaCotizar('shell_fab');
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 left-6 z-40 w-11 h-11 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-md whatsapp-float transition-colors safe-bottom"
      aria-label="Contactar por WhatsApp"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  );
}

// The actual RUT should be set via NEXT_PUBLIC_COMPANY_RUT in .env
const RUT = env.NEXT_PUBLIC_COMPANY_RUT || '76.624.872-1';

// Comunas con landing propia (/en/[comuna]). Se enlazan desde el pie por SEO.
const COMUNAS_DESPACHO = [
  { slug: "curico", name: "Curicó" },
  { slug: "molina", name: "Molina" },
  { slug: "teno", name: "Teno" },
  { slug: "romeral", name: "Romeral" },
  { slug: "sagrada-familia", name: "Sagrada Familia" },
  { slug: "rauco", name: "Rauco" },
  { slug: "hualane", name: "Hualañé" },
  { slug: "licanten", name: "Licantén" },
  { slug: "vichuquen", name: "Vichuquén" },
  { slug: "talca", name: "Talca" },
  { slug: "linares", name: "Linares" },
  { slug: "constitucion", name: "Constitución" },
] as const;

const CATEGORIAS_PIE = [
  { href: "/categorias/fierros-construccion", name: "Fierros de construcción" },
  { href: "/categorias/perfiles-y-planchas", name: "Perfiles y planchas" },
  { href: "/categorias/techumbre", name: "Techumbre" },
  { href: "/categorias/herramientas-y-maq", name: "Herramientas" },
  { href: "/categorias", name: "Todas las categorías" },
  { href: "/sucursales", name: "Despacho y retiro" },
] as const;

const DIRECCION_MAPS = "Av. Poniente 2157, Molina, Chile";
const URL_COMO_LLEGAR = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(DIRECCION_MAPS)}`;
const URL_MAPA_EMBED = `https://www.google.com/maps?q=${encodeURIComponent(DIRECCION_MAPS)}&z=16&output=embed`;

/* Pie con identidad propia: arriba el local (foto real de la fachada + mapa
   de Av. Poniente 2157) junto al contacto en grande (teléfono que se toca y
   WhatsApp); abajo, marca, tienda, comunas en chico y medios de pago con
   logos. Reemplaza la franja "¿No encuentras lo que buscas?" que había sobre
   el pie en la portada: decía lo mismo que este bloque de contacto. */
function Footer() {
  const titulo = "text-xs font-semibold text-white uppercase tracking-wider mb-3";
  const enlace = "text-sm text-gray-400 hover:text-white transition-colors duration-150";
  return (
    <footer role="contentinfo" className="bg-navy-950 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 lg:pt-16 pb-10">
        {/* El local y el contacto */}
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-7 grid sm:grid-cols-2 rounded-xl overflow-hidden border border-navy-800">
            <div className="relative aspect-[16/9] sm:aspect-auto sm:min-h-[260px]">
              <Image
                src="/images/barraca/hero/hero-fachada.webp"
                alt="Fachada de Barraca JURMAQ en Av. Poniente 2157, Molina"
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 30vw"
                className="object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/90 to-transparent px-4 pt-10 pb-3">
                <p className="text-sm font-semibold text-white">Barraca JURMAQ</p>
                <p className="text-xs text-gray-300">Av. Poniente 2157, Molina</p>
              </div>
            </div>
            <div className="relative aspect-[16/9] sm:aspect-auto sm:min-h-[260px] bg-navy-900">
              <iframe
                src={URL_MAPA_EMBED}
                title="Mapa: Barraca JURMAQ, Av. Poniente 2157, Molina"
                className="absolute inset-0 w-full h-full border-0"
                loading="lazy"
                referrerPolicy="strict-origin"
              />
              <a
                href={URL_COMO_LLEGAR}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-8 right-3 inline-flex items-center gap-2 h-10 px-4 bg-marca-600 hover:bg-marca-700 text-white text-sm font-bold rounded-lg shadow-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Cómo llegar
              </a>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-center">
            <p className="text-xs font-semibold text-marca-400 uppercase tracking-wider mb-2">¿No encuentras lo que buscas?</p>
            <p className="text-sm text-gray-400 mb-4">Llámanos o escríbenos con la medida que necesitas.</p>
            <a
              href="tel:+56976673577"
              className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight tabular-nums hover:text-marca-400 transition-colors w-fit"
            >
              +56 9 7667 3577
            </a>
            <div className="flex flex-col min-[400px]:flex-row gap-3 mt-5">
              <a
                href={whatsappCtaBarracaCotizar('footer')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 h-12 px-5 bg-green-600 hover:bg-green-700 text-white text-[15px] font-semibold rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Escribir por WhatsApp
              </a>
              <a
                href="tel:+56976673577"
                className="inline-flex items-center justify-center h-12 px-5 border border-white/25 hover:bg-white/10 text-white text-[15px] font-semibold rounded-lg transition-colors"
              >
                Llamar
              </a>
            </div>
            <div className="mt-6 text-xs text-gray-500 leading-relaxed">
              <p>{HORARIO_BARRACA.semana}</p>
              <p>{HORARIO_BARRACA.sabado} · {HORARIO_BARRACA.domingo}</p>
              <p className="mt-1">
                <a href="mailto:contacto@jurmaq.cl" className="hover:text-white transition-colors duration-150">contacto@jurmaq.cl</a>
              </p>
            </div>
          </div>
        </div>

        {/* Marca, tienda, comunas y pagos */}
        <div className="mt-12 pt-10 border-t border-navy-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1.3fr_1.3fr] gap-10">
          <div>
            <Link href="/" className="inline-flex items-baseline mb-3">
              <span className="text-2xl font-extrabold text-white tracking-tight">JURMAQ</span>{" "}
              <span className="text-lg font-semibold text-marca-500 ml-1">Barraca</span>
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
              Fierros y materiales de construcción en Molina. Despacho a Curicó, Talca y toda la Región del Maule.
            </p>
          </div>

          <nav aria-label="Tienda">
            <h3 className={titulo}>Tienda</h3>
            <ul className="space-y-2">
              {CATEGORIAS_PIE.map((c) => (
                <li key={c.href}>
                  <Link href={c.href} className={enlace}>{c.name}</Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Comunas con landing propia: enlaces internos para SEO, en chico. */}
          <nav aria-label="Despacho por comuna">
            <h3 className={titulo}>Despacho en el Maule</h3>
            <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs leading-relaxed">
              {COMUNAS_DESPACHO.map((c) => (
                <li key={c.slug}>
                  <Link href={`/en/${c.slug}`} className="text-gray-500 hover:text-white transition-colors duration-150" title={`Barraca en ${c.name}`}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className={titulo}>Medios de pago</h3>
            <MediosPago />
          </div>
        </div>
      </div>

      {/* Barra legal + grupo JURMAQ en una línea discreta */}
      <div className="border-t border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 space-y-3 text-xs text-gray-500">
          <nav aria-label="Unidades de negocio JURMAQ" className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1">
            <span>Grupo JURMAQ:</span>
            {VERTICALES.map((v, i) => (
              <span key={v.key} className="inline-flex items-center gap-2">
                {i > 0 && <span className="text-navy-700" aria-hidden="true">·</span>}
                {v.key === 'barraca' ? (
                  <span className="text-gray-400" aria-current="page">{v.label}</span>
                ) : (
                  <a href={v.url} className="hover:text-white transition-colors duration-150">{v.label}</a>
                )}
              </span>
            ))}
          </nav>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-center sm:text-left">{buildFooterCopyright('barraca')}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <a href="https://jurmaq.cl/terminos" className="hover:text-white transition-colors duration-150">Términos y condiciones</a>
              <span className="text-navy-700" aria-hidden="true">|</span>
              <a href="https://jurmaq.cl/privacidad" className="hover:text-white transition-colors duration-150">Política de privacidad</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function BarracaShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Rutas administrativas (/admin/*) tienen su propio layout anidado
  // (apps/barraca/src/app/admin/layout.tsx + AdminShell). Si el shell público
  // se renderiza encima quedan dos headers, dos toasts, dos widgets de chat,
  // etc. SEO: /admin/* está disallow en robots.txt y noindex en metadata,
  // así que ocultar el shell público acá no impacta crawling.
  const isAdmin = pathname?.startsWith("/admin");
  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Ir al contenido principal
      </a>
      <FranjaPrecios />
      <Navbar />
      <main id="main-content" className="flex-1 min-h-screen bg-gray-50">{children}</main>
      <Footer />
      <WhatsAppFloat />
      <ToastContainer />
    </>
  );
}
