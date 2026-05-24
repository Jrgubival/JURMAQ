import Link from "next/link";

/**
 * Footer constructora — Editorial Luxury.
 *
 * Skills: minimalist-ui (warm bone), web-typography (Newsreader italic accents),
 * design-taste (hairlines + generous spacing), accessibility (role=contentinfo
 * + nav landmarks + skip target).
 *
 * Estructura:
 *  - Top row: brand + tagline + nav columns (4: Empresa, Servicios, Cuenta, Contacto)
 *  - Bottom row: copyright + legales hairline-divided
 */

const COLS = [
  {
    label: "Empresa",
    links: [
      { href: "/", label: "Inicio" },
      { href: "/proyectos", label: "Proyectos" },
      { href: "/como-funciona", label: "Cómo funciona" },
      { href: "/contacto", label: "Contacto" },
    ],
  },
  {
    label: "Servicios",
    links: [
      { href: "/maquinarias", label: "Arriendo de maquinaria" },
      { href: "/maquinarias?tipo=retroexcavadora", label: "Retroexcavadoras" },
      { href: "/maquinarias?tipo=miniexcavadora", label: "Miniexcavadoras" },
      { href: "/maquinarias?tipo=brazo_articulado", label: "Brazos articulados" },
      { href: "/maquinarias?tipo=plataforma_elevadora", label: "Plataformas elevadoras" },
      { href: "/maquinarias?tipo=minicargador", label: "Minicargadores" },
      { href: "https://barraca.jurmaq.cl", label: "Barraca de fierros" },
    ],
  },
  {
    label: "Mi cuenta",
    links: [
      { href: "/cuenta", label: "Iniciar sesión" },
      { href: "/cuenta/cotizaciones", label: "Mis cotizaciones" },
      { href: "/cuenta/contratos", label: "Mis contratos" },
      { href: "/cuenta/garantias", label: "Garantías" },
    ],
  },
];

export default function Footer() {
  return (
    <footer role="contentinfo" className="bg-navy-950 text-gray-300 border-t border-navy-800 mt-24 lg:mt-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_2.5fr] gap-12 lg:gap-20 mb-16">
          {/* Brand block */}
          <div>
            <Link href="/" className="inline-flex items-baseline gap-2 mb-6">
              <span className="text-2xl font-extrabold text-white tracking-tight">JURMAQ</span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-gold-400 font-semibold">
                Maule · desde 1998
              </span>
            </Link>
            <p
              className="text-white/85 leading-relaxed mb-6 max-w-sm"
              style={{ fontSize: 'clamp(1rem, 1.2vw, 1.125rem)' }}
            >
              Obras civiles, arriendo de maquinaria, maestranza y barraca de fierros — un solo proveedor
              para todo el ciclo de tu <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>obra</span>.
            </p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <a href="tel:+56972551666" className="hover:text-gold-400 transition-colors">
                  +56 9 7255 1666
                </a>
              </li>
              <li>
                <a href="mailto:contacto@jurmaq.cl" className="hover:text-gold-400 transition-colors">
                  contacto@jurmaq.cl
                </a>
              </li>
              <li>Camino a Molina, Curicó · Región del Maule</li>
            </ul>
          </div>

          {/* Nav columns */}
          <nav aria-label="Enlaces del sitio" className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            {COLS.map((col) => (
              <div key={col.label}>
                <p className="text-[10px] font-semibold text-white/55 uppercase tracking-[0.22em] mb-4">
                  {col.label}
                </p>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        className="text-sm text-gray-300 hover:text-gold-400 transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom row — hairline */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} JURMAQ Constructora SpA · 27 años en la Región del Maule
          </p>
          <ul className="flex flex-wrap gap-6 text-xs text-gray-500">
            <li>
              <Link href="/privacidad" className="hover:text-gold-400 transition-colors">
                Privacidad
              </Link>
            </li>
            <li>
              <Link href="/terminos" className="hover:text-gold-400 transition-colors">
                Términos
              </Link>
            </li>
            <li>
              <a
                href="https://barraca.jurmaq.cl"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gold-400 transition-colors"
              >
                Barraca JURMAQ
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
