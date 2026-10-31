"use client";

import Link from "@/components/barraca/Enlace";
import dynamic from "next/dynamic";
import MediosPago from "@/components/barraca/MediosPago";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import SearchBar from "@/components/barraca/SearchBar";
import SelectorZona, { EVENTO_MENU } from "@/components/barraca/SelectorZona";
import ToastContainer from "@/components/Toast";
import { HORARIO_BARRACA, buildFooterCopyright } from "@jurmaq/shared/seo";
import { whatsappCtaBarracaCotizar } from "@jurmaq/shared/whatsapp";
import { precioWebHasta } from "@/lib/vigencia";
import { cantidadEnCarrito } from "@/lib/carrito";
import gsap from "gsap";
import { EVENTO_CONFIGURAR_COOKIES } from "@jurmaq/shared/ui/CookieBanner";

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


function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  // Hide navbar on scroll down, show on scroll up
  useEffect(() => {
    function handleScroll() {
      const currentY = window.scrollY;
      if (currentY < 100) { setNavVisible(true); }
      else if (currentY > lastScrollY.current + 10) { setNavVisible(false); setCatOpen(false); }
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

  // Contador del carrito: el carrito vive en el navegador (lib/carrito.ts),
  // así que se lee de localStorage sin ir al servidor.
  const iconoCarrito = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let previo = cantidadEnCarrito();
    const leer = () => {
      const n = cantidadEnCarrito();
      setCartCount(n);
      // Al agregar, el ícono da un salto corto: la confirmación de que entró,
      // aunque el carrito no se abra (en la tarjeta no se abre).
      if (n > previo && iconoCarrito.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(iconoCarrito.current, { scale: 1, rotate: 0 }, { keyframes: [{ scale: 1.25, rotate: -8, duration: 0.14 }, { scale: 1, rotate: 0, duration: 0.42, ease: "elastic.out(1, 0.45)" }] });
      }
      previo = n;
    };
    setCartCount(previo);
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

  // Un solo menú abierto a la vez: Categorías avisa al abrirse y se cierra
  // cuando se abre otro (el selector "Despacho a").
  useEffect(() => {
    if (catOpen) window.dispatchEvent(new CustomEvent(EVENTO_MENU, { detail: "categorias" }));
  }, [catOpen]);
  useEffect(() => {
    const otro = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== "categorias") setCatOpen(false);
    };
    window.addEventListener(EVENTO_MENU, otro);
    return () => window.removeEventListener(EVENTO_MENU, otro);
  }, []);

  // Close dropdowns and mobile menu on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (catOpen) setCatOpen(false);
        if (mobileOpen) setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [catOpen, mobileOpen]);

  return (
    <>
      <header role="banner" style={{ paddingTop: "env(safe-area-inset-top)" }} className={`sticky top-0 z-50 bg-navy-950 border-b border-navy-900 transition-transform duration-300 ${navVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20 gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-baseline shrink-0">
              <span className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                JURMAQ
              </span>{" "}
              <span className="text-lg lg:text-xl font-semibold text-marca-400 ml-1">
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
                  className="px-3.5 py-2 text-sm font-semibold text-white bg-white/10 hover:bg-white/15 rounded-lg transition-colors flex items-center gap-1"
                >
                  Categorías
                  <svg className={`w-3 h-3 transition-transform ${catOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {catOpen && categorias.length > 0 && (
                  /* Mega menú al modo Sodimac/Easy: cada categoría con su foto
                     en círculo y cuántos productos tiene, en 4 columnas. */
                  <div className="absolute top-full left-0 pt-2 z-50 origin-top-left menu-aparecer">
                    <div className="w-[880px] bg-white rounded-xl shadow-[0_24px_60px_-20px_rgba(8,20,40,0.45)] border border-gray-200 p-4">
                      <ul className="grid grid-cols-4 gap-1">
                        {categorias.map((cat) => (
                          <li key={cat.id}>
                            <Link
                              href={`/categorias/${cat.slug}`}
                              onClick={() => setCatOpen(false)}
                              className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 group/cat"
                            >
                              <span className="w-10 h-10 shrink-0 rounded-full overflow-hidden bg-gray-100 ring-1 ring-gray-200">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`/images/barraca/categorias/fotos/${cat.slug}.webp`} alt="" width={40} height={40} loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-navy-950 leading-tight group-hover/cat:text-marca-600 transition-colors">{cat.nombre}</span>
                                {cat.producto_count ? (
                                  <span className="block text-xs text-gray-500 tabular-nums">{cat.producto_count} productos</span>
                                ) : null}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <div className="border-t border-gray-100 mt-3 pt-3 px-2.5">
                        <Link href="/categorias" onClick={() => setCatOpen(false)} className="text-sm font-semibold text-marca-600 hover:text-marca-700">
                          Ver todas las categorías
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </nav>

            <div className="hidden lg:block ml-2 shrink-0">
              <SelectorZona variante="escritorio" />
            </div>

            {/* Desktop Search - bigger and more prominent */}
            <div className="hidden lg:block flex-1 max-w-3xl mx-4">
              <SearchBar size="lg" />
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCartOpen(true)}
                data-magnetic
                className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center gap-2 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label={`Carrito${cartCount > 0 ? ` (${cartCount})` : ""}`}
              >
                <span ref={iconoCarrito} className="relative inline-block">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                  </svg>
                  {cartCount > 0 && (
                    <span aria-live="polite" className="absolute -top-2.5 -right-2.5 min-w-[22px] h-[22px] px-1 bg-marca-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center ring-2 ring-navy-950">
                      {cartCount}
                    </span>
                  )}
                </span>
                <span className="hidden lg:inline text-sm font-medium whitespace-nowrap">Carrito</span>
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-expanded={mobileOpen}
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
          <div className="lg:hidden pb-1.5">
            <SearchBar size="md" />
            <div className="mt-1">
              <SelectorZona variante="celular" />
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div role="dialog" aria-label="Menú de navegación móvil" className="lg:hidden bg-white border-t border-gray-200 max-h-[calc(100vh-8rem)] overflow-y-auto origin-top menu-baja">
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
  const pathname = usePathname();
  // En la compra (carrito, checkout, confirmación) el botón flotante tapaba
  // campos y el botón de pagar en celular; ahí no se muestra.
  if (pathname === "/carrito" || pathname === "/checkout" || pathname?.startsWith("/pedido/") || pathname?.startsWith("/pago/")) {
    return null;
  }
  const href = whatsappCtaBarracaCotizar('shell_fab');
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      // En la ficha, el celular tiene la barra fija de compra abajo: el botón sube sobre ella.
      className={`fixed ${pathname?.startsWith("/producto/") ? "bottom-24 lg:bottom-6" : "bottom-6"} left-4 z-40 w-11 h-11 bg-white text-[#25D366] border border-gray-200 rounded-full flex items-center justify-center shadow-[0_4px_14px_-6px_rgba(8,20,40,0.35)] hover:border-gray-300 transition-colors safe-bottom`}
      aria-label="Contactar por WhatsApp"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  );
}


// Comunas con landing propia (/en/[comuna]). Se enlazan desde el pie por SEO.
// Despacho propio (camión): Molina y alrededores, a pedido del dueño (oct-2026).
// Talca y Linares salen: el fierro no se despacha tan lejos. Los montos los
// define el dueño en el checkout.
const COMUNAS_DESPACHO = [
  { slug: "molina", name: "Molina" },
  { slug: "curico", name: "Curicó" },
  { slug: "sagrada-familia", name: "Sagrada Familia" },
  { slug: "romeral", name: "Romeral" },
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

/* Pie en cuatro columnas: marca con el contacto compacto (teléfono que se
   toca, WhatsApp, dirección con "Cómo llegar" y horario), tienda, comunas en
   chico y medios de pago con logos. Reemplaza la franja "¿No encuentras lo
   que buscas?" que había sobre el pie en la portada. */
function Footer() {
  const titulo = "text-sm font-bold text-navy-950 mb-3";
  const enlace = "text-sm text-gray-600 hover:text-navy-950 transition-colors duration-150";
  return (
    <footer role="contentinfo" className="bg-[#F4F5F7] text-gray-600 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
        {/* Marca, tienda, comunas y pagos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1.3fr_1.3fr] gap-10">
          <div>
            <Link href="/" className="inline-flex items-baseline mb-3">
              <span className="text-2xl font-extrabold text-navy-950 tracking-tight">JURMAQ</span>{" "}
              <span className="text-lg font-semibold text-marca-500 ml-1">Barraca</span>
            </Link>
            <p className="text-sm text-gray-600 leading-relaxed max-w-xs">
              Fierros y materiales de construcción en Molina. Retiro en el local o despacho a domicilio en Molina, Curicó, Talca y alrededores.
            </p>
            {/* Contacto compacto: teléfono que se toca, WhatsApp, dirección y horario. */}
            <div className="mt-5 space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <a href="tel:+56976673577" className="text-sm font-semibold text-navy-950 tabular-nums whitespace-nowrap hover:text-marca-600 transition-colors">
                  +56 9 7667 3577
                </a>
                <a
                  href={whatsappCtaBarracaCotizar('footer')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-navy-950 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  WhatsApp
                </a>
              </div>
              <p className="text-sm text-gray-600">
                Av. Poniente 2157, Molina{" "}
                <a
                  href={URL_COMO_LLEGAR}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-xs font-semibold text-marca-600 hover:text-marca-700 whitespace-nowrap transition-colors"
                >
                  Cómo llegar
                </a>
              </p>
              <div className="text-xs text-gray-500 leading-relaxed">
                <p>{HORARIO_BARRACA.semana}</p>
                <p>{HORARIO_BARRACA.sabado} · {HORARIO_BARRACA.domingo}</p>
              </div>
            </div>
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
            <h3 className={titulo}>Despacho</h3>
            <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs leading-relaxed">
              {COMUNAS_DESPACHO.map((c) => (
                <li key={c.slug}>
                  <Link href={`/en/${c.slug}`} className="text-gray-500 hover:text-navy-950 transition-colors duration-150" title={`Barraca en ${c.name}`}>
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
      <div className="border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 space-y-3 text-xs text-gray-500">
          <nav aria-label="Unidades de negocio JURMAQ" className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1">
            <span>Grupo JURMAQ:</span>
            {VERTICALES.map((v, i) => (
              <span key={v.key} className="inline-flex items-center gap-2">
                {i > 0 && <span className="text-navy-700" aria-hidden="true">·</span>}
                {v.key === 'barraca' ? (
                  <span className="text-gray-600" aria-current="page">{v.label}</span>
                ) : (
                  <a href={v.url} className="hover:text-navy-950 transition-colors duration-150">{v.label}</a>
                )}
              </span>
            ))}
          </nav>
          {precioWebHasta() && (
            <p className="mb-3 text-center sm:text-left">
              Precio web: precio de la tienda online, válido hasta el {precioWebHasta()}. Precio normal: el de nuestro local en Molina.{" "}
              <Link href="/terminos#5-precios" className="underline underline-offset-2 hover:text-navy-950">Condiciones</Link>
            </p>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-center sm:text-left">{buildFooterCopyright('barraca')}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <Link href="/terminos" className="hover:text-navy-950 transition-colors duration-150">Términos y condiciones</Link>
              <span className="text-gray-300" aria-hidden="true">|</span>
              <Link href="/privacidad" className="hover:text-navy-950 transition-colors duration-150">Política de privacidad</Link>
              <span className="text-gray-300" aria-hidden="true">|</span>
              <button type="button" onClick={() => window.dispatchEvent(new Event(EVENTO_CONFIGURAR_COOKIES))} className="hover:text-navy-950 transition-colors duration-150">
                Configurar cookies
              </button>
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
  // El ingreso al panel (/login) tampoco lleva el header ni el pie de la tienda.
  const isAdmin = pathname?.startsWith("/admin") || pathname === "/login" || pathname?.startsWith("/login/");
  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Ir al contenido principal
      </a>
      <Navbar />
      <main id="main-content" className="flex-1 min-h-screen bg-gray-50">{children}</main>
      <Footer />
      <WhatsAppFloat />
      <ToastContainer />
    </>
  );
}
