"use client"

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { whatsappCtaHome } from '@jurmaq/shared/whatsapp';
import { IconWhatsapp } from '@jurmaq/shared/icons';
import WhatsappLink from '@/components/public/WhatsappLink';

/**
 * Navbar global de constructora.
 * Sticky top, transparente sobre hero navy + sólido cuando scrolleas.
 */
const NAV_LINKS = [
  { href: '/maquinarias', label: 'Maquinarias' },
  { href: '/como-funciona', label: 'Cómo Funciona' },
  { href: '/recursos', label: 'Recursos' },
  { href: 'https://barraca.jurmaq.cl', label: 'Barraca', external: true },
  { href: '/contacto', label: 'Contacto' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // No renderizar navbar en rutas admin, login, cuenta, firma de contratos.
  const HIDE_PREFIXES = ['/admin', '/login', '/cuenta', '/contrato', '/api'];
  if (HIDE_PREFIXES.some((p) => pathname?.startsWith(p))) {
    return null;
  }

  // Páginas con hero navy oscuro al inicio (transparent navbar OK).
  // Resto de páginas: fondo claro → necesita navbar sólido desde el inicio.
  const HAS_DARK_HERO = pathname === '/' || pathname?.startsWith('/maquinarias');
  const isSolid = scrolled || !HAS_DARK_HERO;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
    {/* Spacer para que el contenido de páginas sin hero oscuro no quede oculto bajo el navbar fixed. */}
    {!HAS_DARK_HERO && <div aria-hidden="true" className="h-16 lg:h-18" />}
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all ${
        isSolid
          ? 'bg-navy-950/95 backdrop-blur border-b border-navy-800/50 shadow-lg'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl lg:text-2xl font-bold text-white tracking-tight">
              JURMAQ
            </span>
            <span className="text-[10px] uppercase tracking-widest text-gold-400 font-semibold">
              Obras · Arriendo · Maestranza
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="text-sm font-medium text-white/90 hover:text-gold-400 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/cuenta"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-gold-400 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Mi cuenta
            </Link>
            <WhatsappLink
              href={whatsappCtaHome()}
              source="navbar_desktop"
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
            {NAV_LINKS.map((link) => (
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
            <Link
              href="/cuenta"
              onClick={() => setMobileOpen(false)}
              className="block py-2 text-white/90 hover:text-gold-400 text-base font-medium inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Mi cuenta
            </Link>
            <WhatsappLink
              href={whatsappCtaHome()}
              source="navbar_mobile"
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
