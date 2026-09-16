import Link from "next/link";
import { LEGAL_INFO, buildFooterCopyright } from "@jurmaq/shared/seo";
import CuentaLinks from "./CuentaLinks";

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

/** En qué vertical se está renderizando. Determina los links del footer. */
export type FooterVertical = 'arriendo' | 'constructora';

/** Host del hub, para links absolutos desde el subdominio. */
const HUB = 'https://jurmaq.cl';

interface FooterCol {
  label: string;
  links: { href: string; label: string; externo?: boolean }[];
}

/**
 * Columnas por vertical.
 *
 * ## Por qué esto existe
 *
 * El footer era único y todos sus links eran del hub: /maquinarias,
 * /como-funciona, /recursos, /contacto, /privacidad, /terminos. En
 * constructora.jurmaq.cl esas rutas NO existen —el middleware reescribe al
 * árbol /constructora/*— así que los seis daban 404 en las 26 páginas del
 * subdominio. 156 enlaces rotos.
 *
 * Eso es casi con certeza lo que tenía a Google en "Descubierta: actualmente
 * sin indexar": un subdominio nuevo, sin backlinks, que en cada página le
 * ofrece al crawler media docena de 404. El rastreador baja la prioridad y
 * deja de volver.
 *
 * Los links que SÍ viven en el hub (legales, cuenta, arriendo) se escriben
 * absolutos a jurmaq.cl, que es donde existen de verdad.
 */
const COLS_POR_VERTICAL: Record<FooterVertical, FooterCol[]> = {
  arriendo: [
    {
      label: "Empresa",
      links: [
        { href: "/", label: "Inicio" },
        { href: "/como-funciona", label: "Cómo funciona" },
        { href: "/recursos", label: "Recursos" },
        { href: "/contacto", label: "Contacto" },
      ],
    },
    {
      label: "Maquinaria",
      links: [
        { href: "/maquinarias", label: "Toda la flota" },
        { href: "/maquinarias?tipo=retroexcavadora", label: "Retroexcavadoras" },
        { href: "/maquinarias?tipo=miniexcavadora", label: "Miniexcavadoras" },
        { href: "/maquinarias?tipo=minicargador", label: "Minicargadores" },
        { href: "/maquinarias?tipo=brazo_articulado", label: "Brazos articulados" },
      ],
    },
    {
      label: "Otras unidades",
      links: [
        { href: "https://constructora.jurmaq.cl", label: "Obras civiles", externo: true },
        { href: "https://barraca.jurmaq.cl", label: "Barraca de fierros", externo: true },
      ],
    },
  ],
  constructora: [
    {
      label: "Constructora",
      links: [
        { href: "/", label: "Inicio" },
        { href: "/servicios", label: "Servicios" },
        { href: "/proyectos", label: "Obras ejecutadas" },
        { href: "/nosotros", label: "Nosotros" },
        { href: "/cotizar-obra", label: "Cotizar una obra" },
      ],
    },
    {
      label: "Qué ejecutamos",
      links: [
        { href: "/servicios/fundaciones-y-obra-civil-industrial", label: "Fundaciones y obra civil" },
        { href: "/servicios/estructuras-metalicas-y-montaje-industrial", label: "Estructuras metálicas" },
        { href: "/servicios/pavimentos-industriales", label: "Pavimentos industriales" },
        { href: "/servicios/cubiertas-y-revestimientos-industriales", label: "Cubiertas industriales" },
        { href: "/servicios/mantencion-industrial-y-refuerzo-estructural", label: "Mantención industrial" },
        { href: "/servicios/movimiento-de-tierras-y-preparacion-de-terreno", label: "Movimiento de tierras" },
      ],
    },
    {
      label: "Otras unidades",
      links: [
        { href: `${HUB}/maquinarias`, label: "Arriendo de maquinaria", externo: true },
        { href: "https://barraca.jurmaq.cl", label: "Barraca de fierros", externo: true },
      ],
    },
  ],
};

export default function Footer({ vertical = 'arriendo' }: { vertical?: FooterVertical }) {
  const cols = COLS_POR_VERTICAL[vertical];
  const esConstructora = vertical === 'constructora';
  // En el subdominio los legales y la cuenta viven en el hub: absolutos.
  const hrefLegal = (p: string) => (esConstructora ? `${HUB}${p}` : p);

  return (
    <footer role="contentinfo" className="bg-navy-950 text-gray-300 border-t border-navy-800 mt-12 lg:mt-16">
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
                <a href={`tel:${LEGAL_INFO.brands.constructora.telefono}`} className="hover:text-gold-400 transition-colors">
                  {LEGAL_INFO.brands.constructora.telefonoDisplay}
                </a>
              </li>
              <li>
                <a href="mailto:contacto@jurmaq.cl" className="hover:text-gold-400 transition-colors">
                  contacto@jurmaq.cl
                </a>
              </li>
              <li>{LEGAL_INFO.brands.constructora.direccion} · {LEGAL_INFO.brands.constructora.addressRegion}</li>
            </ul>
          </div>

          {/* Nav columns */}
          <nav aria-label="Enlaces del sitio" className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            {cols.map((col) => (
              <div key={col.label}>
                <p className="text-[10px] font-semibold text-white/55 uppercase tracking-[0.22em] mb-4">
                  {col.label}
                </p>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        {...(link.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        className="text-sm text-gray-300 hover:text-gold-400 transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {/* Mi cuenta solo en el hub: /cuenta/* no existe en el subdominio
                (el middleware lo deja pasar sin reescribir, pero el portal
                del cliente vive en jurmaq.cl). */}
            {!esConstructora && <CuentaLinks />}
          </nav>
        </div>

        {/* Bottom row — hairline */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-xs text-gray-500">
            {buildFooterCopyright('constructora')}
          </p>
          <ul className="flex flex-wrap gap-6 text-xs text-gray-500">
            <li>
              <Link href={hrefLegal("/privacidad")} className="hover:text-gold-400 transition-colors">
                Privacidad
              </Link>
            </li>
            <li>
              <Link href={hrefLegal("/terminos")} className="hover:text-gold-400 transition-colors">
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
