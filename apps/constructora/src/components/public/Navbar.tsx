"use client"

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { whatsappCtaHome, whatsappCtaContacto } from '@jurmaq/shared/whatsapp';
import { IconWhatsapp } from '@jurmaq/shared/icons';
import WhatsappLink from '@/components/public/WhatsappLink';

/**
 * Navbar global. Dos filas:
 *
 *  1. **Switcher de marca** — las tres unidades de JURMAQ (Arriendo,
 *     Constructora, Barraca) presentes en TODOS los sitios, siempre. jurmaq.cl
 *     funciona como hub: desde cualquier página se salta a cualquier vertical.
 *  2. **Nav de la vertical activa** — los links propios del sitio en que estás.
 *
 * La vertical llega por prop desde el layout del route group, NO se infiere del
 * pathname: en constructora.jurmaq.cl el middleware hace rewrite y el path
 * interno (`/constructora/servicios`) no coincide con el que ve el navegador
 * (`/servicios`), así que inferirlo daría hydration mismatch.
 */
export type Vertical = 'arriendo' | 'constructora';

interface NavLink {
  href: string;
  label: string;
  external?: boolean;
}

/** Las tres unidades de negocio. `home` es absoluto salvo en el sitio activo. */
const VERTICALES = [
  {
    key: 'arriendo' as const,
    label: 'Arriendo',
    sub: 'Maquinaria',
    url: 'https://jurmaq.cl',
  },
  {
    key: 'constructora' as const,
    label: 'Constructora',
    sub: 'Obras civiles',
    url: 'https://constructora.jurmaq.cl',
  },
  {
    key: 'barraca' as const,
    label: 'Barraca',
    sub: 'Fierros y materiales',
    url: 'https://barraca.jurmaq.cl',
  },
];

const NAV_POR_VERTICAL: Record<Vertical, NavLink[]> = {
  arriendo: [
    { href: '/maquinarias', label: 'Maquinarias' },
    { href: '/como-funciona', label: 'Cómo Funciona' },
    { href: '/recursos', label: 'Recursos' },
    { href: '/contacto', label: 'Contacto' },
  ],
  constructora: [
    { href: '/servicios', label: 'Servicios' },
    { href: '/proyectos', label: 'Obras ejecutadas' },
    { href: '/nosotros', label: 'Nosotros' },
    { href: '/cotizar-obra', label: 'Cotizar obra' },
  ],
};

export default function Navbar({ vertical = 'arriendo' }: { vertical?: Vertical }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = NAV_POR_VERTICAL[vertical];
  const esConstructora = vertical === 'constructora';

  // Ocultar navbar en rutas admin, login, cuenta, firma de contratos.
  // IMPORTANTE: NO usar `return null` acá — eso causaba React error #300
  // (hydration mismatch) cuando el cliente navega de la home (con navbar
  // server-rendered) a /cuenta/login (donde el navbar quería desmontarse).
  // Solución: ocultar visualmente con CSS sin remover del árbol React.
  const HIDE_PREFIXES = ['/admin', '/login', '/cuenta', '/contrato', '/api'];
  const isHidden = HIDE_PREFIXES.some((p) => pathname?.startsWith(p));

  // Páginas con hero navy oscuro al inicio (navbar transparente OK).
  // Resto: fondo claro → navbar sólido desde el inicio.
  // En constructora la home y las landings de servicio abren en navy.
  const HAS_DARK_HERO = esConstructora
    ? pathname === '/' ||
      pathname === '/constructora' ||
      pathname?.includes('/servicios') ||
      pathname?.includes('/obras-civiles-en')
    : pathname === '/' || pathname?.startsWith('/maquinarias');
  const isSolid = scrolled || !HAS_DARK_HERO;

  const waHref = esConstructora ? whatsappCtaContacto() : whatsappCtaHome();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* Spacer: el header es fixed, así que las páginas sin hero oscuro
          necesitan aire arriba. Alto = franja de marcas (h-9) + nav (h-16/18). */}
      {!HAS_DARK_HERO && !isHidden && <div aria-hidden="true" className="h-[6.25rem] lg:h-[6.75rem]" />}
      <header
        style={isHidden ? { display: 'none' } : undefined}
        className={`fixed top-0 left-0 right-0 z-50 transition-all ${
          isSolid
            ? 'bg-navy-950/95 backdrop-blur border-b border-navy-800/50 shadow-lg'
            : 'bg-transparent'
        }`}
      >
        {/* ── Fila 1: switcher de las tres unidades JURMAQ ────────────────── */}
        <div
          className={`border-b transition-colors ${
            isSolid ? 'border-navy-800/60 bg-navy-950/60' : 'border-white/10 bg-black/20'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* overflow-x-auto para que las tres marcas quepan en pantallas
                muy angostas. El scrollbar se oculta: en macOS con "mostrar
                siempre" pintaba una barra gris permanente cruzando el header. */}
            <nav
              aria-label="Unidades de negocio JURMAQ"
              className="flex items-stretch gap-1 h-9 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {VERTICALES.map((v) => {
                const activa = v.key === vertical;
                return (
                  <Link
                    key={v.key}
                    href={activa ? '/' : v.url}
                    aria-current={activa ? 'page' : undefined}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold tracking-wide uppercase border-b-2 transition-colors ${
                      activa
                        ? 'border-gold-400 text-gold-400'
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

        {/* ── Fila 2: nav de la vertical activa ───────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-18">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl lg:text-2xl font-bold text-white tracking-tight">
                JURMAQ
              </span>
              <span className="text-[10px] uppercase tracking-widest text-gold-400 font-semibold">
                {esConstructora ? 'Obras Civiles e Industriales' : 'Obras · Arriendo · Maestranza'}
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-7">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="text-sm font-medium text-white/90 hover:text-gold-400 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              {!esConstructora && (
                <Link
                  href="/cuenta/login"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-gold-400 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Mi cuenta
                </Link>
              )}
              <WhatsappLink
                href={waHref}
                source={esConstructora ? 'navbar_desktop_constructora' : 'navbar_desktop'}
                className="ml-2 inline-flex items-center gap-2 px-4 py-2 bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-bold rounded-lg transition-colors"
              >
                <IconWhatsapp className="w-4 h-4" />
                WhatsApp
              </WhatsappLink>
            </nav>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden text-white p-2"
              aria-label="Abrir menú"
              aria-expanded={mobileOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
                />
              </svg>
            </button>
          </div>

          {/* Mobile menu */}
          {mobileOpen && (
            <nav className="lg:hidden bg-navy-950 border-t border-navy-800 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  onClick={() => setMobileOpen(false)}
                  className="block py-2 text-white/90 hover:text-gold-400 text-base font-medium"
                >
                  {link.label}
                </Link>
              ))}
              {!esConstructora && (
                <Link
                  href="/cuenta/login"
                  onClick={() => setMobileOpen(false)}
                  className="block py-2 text-white/90 hover:text-gold-400 text-base font-medium"
                >
                  Mi cuenta
                </Link>
              )}
              <WhatsappLink
                href={waHref}
                source={esConstructora ? 'navbar_mobile_constructora' : 'navbar_mobile'}
                className="mt-3 inline-flex items-center justify-center gap-2 w-full bg-gold-500 hover:bg-gold-400 text-navy-950 px-4 py-2.5 rounded-lg font-bold text-sm"
              >
                <IconWhatsapp className="w-4 h-4" />
                WhatsApp
              </WhatsappLink>
            </nav>
          )}
        </div>
      </header>
    </>
  );
}
