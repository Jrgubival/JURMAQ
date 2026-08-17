"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import { env } from "@jurmaq/shared/env";
import { usePathname } from "next/navigation";
import SearchBar from "@/components/barraca/SearchBar";
import ToastContainer from "@/components/Toast";
import { IconCoin, IconArrowRight } from "@jurmaq/shared/icons";
import { LEGAL_INFO, buildFooterCopyright } from "@jurmaq/shared/seo";
import { whatsappCtaBarracaCotizar } from "@jurmaq/shared/whatsapp";

const CartDrawer = dynamic(
  () => import("@/components/barraca/CartDrawer"),
  { ssr: false }
);
const NewsletterPopup = dynamic(
  () => import("@/components/barraca/NewsletterPopup"),
  { ssr: false }
);

interface Categoria {
  id: number;
  nombre: string;
  slug: string;
}

const CATEGORY_ICON_DEFAULT = "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem("barraca_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("barraca_session_id", sid);
  }
  return sid;
}

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

function BrandSwitcher() {
  return (
    <div className="bg-navy-950 border-b border-navy-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* overflow-x-auto con scrollbar oculto: en macOS con "mostrar siempre"
            pintaba una barra gris permanente cruzando el header. */}
        <nav
          aria-label="Unidades de negocio JURMAQ"
          className="flex items-stretch gap-1 h-9 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {VERTICALES.map((v) => {
            const activa = v.key === 'barraca';
            return (
              <Link
                key={v.key}
                href={v.url}
                aria-current={activa ? 'page' : undefined}
                className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold tracking-wide uppercase border-b-2 transition-colors ${
                  activa
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-white/60 hover:text-white hover:border-white/30'
                }`}
              >
                {v.label}
                <span className="hidden sm:inline font-normal normal-case tracking-normal text-white/40">
                  {v.sub}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="bg-navy-950 border-b border-navy-800 text-gray-300 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-8 gap-4">
          <div className="hidden sm:flex items-center gap-4">
            <Link
              href="/te-mejoramos-el-precio"
              className="inline-flex items-center gap-1.5 font-semibold text-orange-400 hover:text-orange-300 transition-colors"
            >
              <IconCoin className="w-3.5 h-3.5" />
              Te mejoramos el precio en 2h
            </Link>
            <span className="text-navy-700">|</span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              Despacho a toda la Región del Maule
            </span>
            <span className="text-navy-700">|</span>
            <span>Lun-Vie 8:30-18:30 / Sab 9:00-14:00</span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <a
              href="https://wa.me/56976673577"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-green-400 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              +56 9 7667 3577
            </a>
            <span className="text-navy-600 hidden sm:inline">|</span>
            <a href="mailto:contacto@jurmaq.cl" className="hidden sm:inline hover:text-orange-400 transition-colors">
              contacto@jurmaq.cl
            </a>
          </div>
        </div>
      </div>
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

  function fetchCartCount() {
    const sid = getSessionId();
    if (!sid) return;
    fetch("/api/carrito", {
      headers: { "X-Session-Id": sid },
    })
      .then((r) => r.json())
      .then((d) => {
        setCartCount(d.cantidad || 0);
      })
      .catch(() => {});
  }

  useEffect(() => {
    fetchCartCount();
    window.addEventListener("cart-updated", fetchCartCount);
    return () => window.removeEventListener("cart-updated", fetchCartCount);
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
      <header role="banner" style={{ paddingTop: 'env(safe-area-inset-top)' }} className={`sticky top-0 z-50 bg-navy-950/95 backdrop-blur-sm border-b border-navy-800 transition-transform duration-300 ${navVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20 gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-baseline shrink-0">
              <span className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                JURMAQ
              </span>{" "}
              <span className="text-lg lg:text-xl font-semibold text-orange-500 ml-1">
                Barraca
              </span>
            </Link>

            {/* Desktop Search - bigger and more prominent */}
            <div className="hidden lg:block flex-1 max-w-2xl mx-8">
              <SearchBar size="lg" />
            </div>

            {/* Desktop Nav */}
            <nav role="navigation" aria-label="Navegación barraca" className="hidden lg:flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-navy-800/60 rounded-lg transition-colors"
              >
                Inicio
              </Link>

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
                  className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-navy-800/60 rounded-lg transition-colors flex items-center gap-1"
                >
                  Categorías
                  <svg className={`w-3 h-3 transition-transform ${catOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {catOpen && categorias.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-[calc(100vw-2rem)] max-w-[600px] bg-white rounded-xl shadow-2xl border border-gray-200 p-6 z-50 mega-menu">
                    <div className="grid grid-cols-3 gap-x-6 gap-y-1">
                      {categorias.map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/categorias/${cat.slug}`}
                          className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={CATEGORY_ICON_DEFAULT} />
                          </svg>
                          {cat.nombre}
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 mt-4 pt-4">
                      <Link
                        href="/categorias"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
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

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Mi Cuenta Dropdown */}
              <div ref={accountRef} className="relative hidden sm:block">
                <button
                  onClick={() => setAccountOpen(!accountOpen)}
                  aria-expanded={accountOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-navy-800/60 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="hidden xl:inline">{user ? user.nombre : "Mi Cuenta"}</span>
                  {user?.rol === 'admin' && (
                    <svg className="w-3.5 h-3.5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <Link href="/cuenta" onClick={() => setAccountOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                          Mi Cuenta
                        </Link>
                        <Link href="/cuenta" onClick={() => setAccountOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                          Mis Cotizaciones
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
                        <Link href="/cuenta/login" onClick={() => setAccountOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                          Iniciar sesión
                        </Link>
                        <Link href="/cuenta/registro" onClick={() => setAccountOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
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
                className="relative p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-300 hover:text-white hover:bg-navy-800/60 rounded-lg transition-colors"
                aria-label="Carrito"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 bg-red-600 text-white text-[11px] font-black rounded-full flex items-center justify-center ring-2 ring-navy-950 animate-[pulse_2s_ease-in-out_1]">
                    {cartCount}
                  </span>
                )}
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

          {/* Mobile Search */}
          <div className="lg:hidden pb-3">
            <SearchBar size="md" />
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div role="dialog" aria-label="Menú de navegación móvil" className="lg:hidden bg-navy-950 border-t border-navy-800 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <div className="px-4 py-4 space-y-1">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center px-4 min-h-[48px] py-3 text-base font-medium text-gray-300 hover:text-white hover:bg-navy-800/60 rounded-lg transition-colors"
              >
                Inicio
              </Link>
              <Link
                href="/categorias"
                onClick={() => setMobileOpen(false)}
                className="flex items-center px-4 min-h-[48px] py-3 text-base font-medium text-gray-300 hover:text-white hover:bg-navy-800/60 rounded-lg transition-colors"
              >
                Categorías
              </Link>
              {categorias.slice(0, 8).map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categorias/${cat.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center px-8 min-h-[44px] py-2.5 text-sm text-gray-500 hover:text-white hover:bg-navy-800/60 rounded-lg transition-colors"
                >
                  {cat.nombre}
                </Link>
              ))}
              <div className="pt-4 border-t border-navy-800 space-y-1">
                <Link
                  href="/carrito"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center px-4 min-h-[48px] py-3 text-base font-medium text-gray-300 hover:text-white hover:bg-navy-800/60 rounded-lg transition-colors"
                >
                  Carrito ({cartCount})
                </Link>
                {user ? (
                  <>
                    <Link
                      href="/cuenta"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center px-4 min-h-[48px] py-3 text-base font-medium text-gray-300 hover:text-white hover:bg-navy-800/60 rounded-lg transition-colors"
                    >
                      Mi Cuenta
                    </Link>
                    <Link
                      href="/cuenta"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center px-4 min-h-[48px] py-3 text-base font-medium text-gray-300 hover:text-white hover:bg-navy-800/60 rounded-lg transition-colors"
                    >
                      Mis Cotizaciones
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/cuenta/login"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center px-4 min-h-[48px] py-3 text-base font-medium text-gray-300 hover:text-white hover:bg-navy-800/60 rounded-lg transition-colors"
                    >
                      Ingresar
                    </Link>
                    <Link
                      href="/cuenta/registro"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center min-h-[48px] px-5 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors"
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
  return (
    <a
      href={whatsappCtaBarracaCotizar('productos-barraca', 'shell_fab')}
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

function Footer() {
  return (
    <footer role="contentinfo" className="bg-navy-950 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {/* Company Info */}
          <div>
            <Link href="/" className="inline-flex items-baseline mb-4">
              <span className="text-2xl font-extrabold text-white tracking-tight">JURMAQ</span>{" "}
              <span className="text-lg font-semibold text-orange-500 ml-1">Barraca</span>
            </Link>
            <p className="text-sm text-gray-300 mb-4 leading-relaxed">
              Barraca de fierros y materiales de construcción en Molina. Despachamos a Curicó, Talca, Linares y toda la Región del Maule.
              Más de 1.600 productos: fierros, perfiles, planchas, tubos, mallas,
              pinturas y herramientas. <strong className="text-orange-400">Súbenos tu
              cotización y en menos de 2 horas te mejoramos el precio</strong> de Sodimac,
              Easy o Construmart.
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-3 mb-6">
              <a
                href="https://wa.me/56976673577"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-navy-800 hover:bg-green-600 rounded-lg flex items-center justify-center transition-colors"
                aria-label="WhatsApp"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
              <a href="mailto:contacto@jurmaq.cl" className="w-9 h-9 bg-navy-800 hover:bg-orange-600 rounded-lg flex items-center justify-center transition-colors" aria-label="Email">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Contact & Hours */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Contacto
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5">
                <svg className="w-4 h-4 mt-0.5 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm text-gray-500">
                  Av. Poniente 2157<br />Molina, Maule
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a href="tel:+56976673577" className="text-sm text-gray-500 hover:text-orange-500 transition-colors">
                  +56 9 7667 3577
                </a>
              </li>
            </ul>
            <div className="text-xs text-gray-500 mt-4 space-y-1">
              <p>Lun - Vie: 8:30 - 18:30</p>
              <p>Sábado: 9:00 - 14:00</p>
            </div>
          </div>

          {/* Payments & Shipping */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Pago y despacho
            </h3>
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="px-3 py-1.5 bg-navy-800 rounded text-xs font-medium text-gray-300">MercadoPago</span>
              <span className="px-3 py-1.5 bg-navy-800 rounded text-xs font-medium text-gray-300">Transferencia</span>
            </div>
            <ul className="space-y-2 text-xs text-gray-500">
              <li className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Despacho a toda la Región del Maule
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Retiro en la barraca, Molina
              </li>
            </ul>
            {/* /sucursales existía pero no estaba enlazada desde ningún lado.
                Ahora que dice la verdad —un local en Molina— es justo lo que
                busca el cliente que quiere retirar o saber si le despachamos. */}
            <Link
              href="/sucursales"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
            >
              Dónde estamos y hasta dónde llegamos
              <IconArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Despacho por comuna — internal links for SEO */}
        <div className="mt-12 pt-8 border-t border-navy-800 space-y-8">
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Despacho de materiales en la Región del Maule
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
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
              ].map((c) => (
                <Link
                  key={c.slug}
                  href={`/en/${c.slug}`}
                  className="px-3 py-1.5 text-xs text-gray-300 bg-navy-800 hover:bg-orange-600 hover:text-white rounded transition-colors"
                >
                  Barraca en {c.name}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <Link
              href="/te-mejoramos-el-precio"
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-bold text-white transition-colors"
            >
              <IconCoin className="w-4 h-4" />
              Te mejoramos el precio en 2h
              <IconArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500">
              {buildFooterCopyright('barraca')}
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <a href="https://jurmaq.cl/terminos" className="hover:text-orange-500 transition-colors">Terminos y Condiciones</a>
              <span className="text-navy-700">|</span>
              <a href="https://jurmaq.cl/privacidad" className="hover:text-orange-500 transition-colors">Politica de Privacidad</a>
              <span className="text-navy-700">|</span>
              <Link href="/" className="hover:text-orange-500 transition-colors">
                Volver a JURMAQ.cl
              </Link>
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
      <BrandSwitcher />
      <TopBar />
      <Navbar />
      <main id="main-content" className="flex-1 min-h-screen bg-gray-50">{children}</main>
      <Footer />
      <WhatsAppFloat />
      <NewsletterPopup />
      <ToastContainer />
    </>
  );
}
