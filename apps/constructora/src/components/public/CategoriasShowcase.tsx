import Link from 'next/link';
import Image from 'next/image';

/**
 * Grid visual de categorías de maquinaria estilo Sodimac/Prodalam.
 *
 * Cambio (feedback usuario): de iconos SVG → fotos reales de cada categoría
 * para que se vea "más cómodo, más ordenado". Cada card tiene la foto arriba,
 * label + subtitle abajo, contador opcional flotante.
 *
 * Uso:
 *   <CategoriasShowcase counts={{ retroexcavadora: 4, ... }} variant="dark" />
 */

// IMPORTANTE: estos valores deben coincidir EXACTO con el campo `tipo` en
// la tabla `maquinarias`. Si los renombramos acá sin migrar DB, los enlaces
// de categoría devuelven 404 (no hay maquinarias con ese `tipo`).
export type TipoCategoria =
  | 'retroexcavadora'
  | 'miniexcavadora'
  | 'brazo_articulado'
  | 'alzahombre' // Display label = "Plataforma elevadora"
  | 'minicargador'
  | 'camion'
  | 'otro';

interface Categoria {
  tipo: TipoCategoria;
  label: string;
  subtitle: string;
  /** Path a la foto en /public/images/maquinarias/ */
  imagen: string;
}

const CATEGORIAS: Categoria[] = [
  {
    tipo: 'retroexcavadora',
    label: 'Retroexcavadoras',
    subtitle: 'Excavación y carga',
    imagen: '/images/maquinarias/retroexcavadora-hmk-102b.jpg',
  },
  {
    tipo: 'miniexcavadora',
    label: 'Miniexcavadoras',
    subtitle: 'Espacios reducidos',
    imagen: '/images/maquinarias/miniexcavadora-xcmg-xe35u.jpg',
  },
  {
    tipo: 'brazo_articulado',
    label: 'Brazos articulados',
    subtitle: 'Alturas y faenas',
    imagen: '/images/maquinarias/brazo-articulado-jlg-e450aj.jpg',
  },
  {
    tipo: 'alzahombre',
    label: 'Plataformas elevadoras',
    subtitle: 'Trabajo en altura',
    imagen: '/images/maquinarias/plataforma-genie-gs1930.png',
  },
  {
    tipo: 'minicargador',
    label: 'Minicargadores',
    subtitle: 'Carga ágil',
    imagen: '/images/maquinarias/minicargador-bobcat-s650.jpg',
  },
  {
    tipo: 'camion',
    label: 'Camiones tolva',
    subtitle: 'Traslado de áridos',
    imagen: '/images/maquinarias/camion-tolva-vw-constellation.jpg',
  },
];

interface Props {
  counts?: Partial<Record<TipoCategoria, number>>;
  variant?: 'light' | 'dark';
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
  /** Versión compacta para usar como nav auxiliar dentro de pages de listing
   *  (no como hero section). Reduce padding, grid 3→6 cols, aspect square. */
  compact?: boolean;
}

export default function CategoriasShowcase({
  counts = {},
  variant = 'light',
  title = 'Nuestras máquinas',
  subtitle = 'Flota propia con mantención al día — disponibles para arriendo en toda la Región del Maule, con operador incluido en maquinaria de movimiento de tierra.',
  showHeader = true,
  compact = false,
}: Props) {
  const isDark = variant === 'dark';
  const sectionPadding = compact ? 'py-8 lg:py-10' : 'py-20 lg:py-28';
  const gridCols = compact
    ? 'grid grid-cols-3 md:grid-cols-6 gap-2 lg:gap-3'
    : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 lg:gap-6';
  const aspectClass = compact ? 'aspect-square' : 'aspect-[4/3]';

  return (
    <section
      className={`${sectionPadding} ${isDark ? 'bg-navy-950' : 'bg-[#FBFBFA]'} content-auto`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {showHeader && !compact && (
          <div className="mb-12 lg:mb-16 max-w-3xl">
            <p className={`text-[10px] font-semibold uppercase tracking-[0.22em] mb-4 ${isDark ? 'text-white/55' : 'text-[#787774]'}`}>
              Flota JURMAQ · 2026
            </p>
            <h2
              className={`leading-[1.1] mb-4 ${isDark ? 'text-white' : 'text-[#111111]'}`}
              style={{ fontSize: 'clamp(1.875rem, 3.5vw, 3rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
            >
              {title.split(/(máquinas)/).map((part, i) =>
                part === 'máquinas' ? (
                  <span key={i} className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>{part}</span>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </h2>
            <p className={`text-base lg:text-lg leading-relaxed max-w-[55ch] ${isDark ? 'text-gray-300' : 'text-[#5A5A57]'}`}>
              {subtitle}
            </p>
          </div>
        )}

        <div className={gridCols}>
          {CATEGORIAS.map((cat) => {
            const count = counts[cat.tipo];
            return (
              <Link
                key={cat.tipo}
                href={`/maquinarias?tipo=${cat.tipo}`}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all ${
                  isDark
                    ? 'border-navy-800 bg-navy-900/60 hover:border-gold-500/40'
                    : 'border-[#EAEAEA] bg-white hover:border-[#111111]'
                }`}
              >
                {/* Foto — aspect-[4/3] en versión hero, aspect-square en compacta */}
                <div className={`relative ${aspectClass} w-full overflow-hidden ${isDark ? 'bg-navy-950' : 'bg-[#F7F6F3]'}`}>
                  <Image
                    src={cat.imagen}
                    alt={`${cat.label} JURMAQ — arriendo en Curicó y Región del Maule`}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 33vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  {count !== undefined && count > 0 && (
                    <span
                      className={`absolute top-3 right-3 inline-flex items-center justify-center min-w-[28px] h-7 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] rounded-full ${
                        isDark
                          ? 'bg-white text-navy-950'
                          : 'bg-navy-950 text-white'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </div>

                {/* Label */}
                <div className={compact ? 'px-2 py-2 lg:px-3 lg:py-2.5' : 'px-5 py-4 lg:px-6 lg:py-5'}>
                  <h3
                    className={`${compact ? 'text-[11px] lg:text-xs' : 'text-base lg:text-lg'} font-medium tracking-[-0.005em] leading-tight ${
                      isDark ? 'text-white' : 'text-[#111111]'
                    }`}
                  >
                    {cat.label}
                  </h3>
                  {!compact && (
                    <p
                      className={`text-sm mt-1 ${
                        isDark ? 'text-gray-400' : 'text-[#787774]'
                      }`}
                    >
                      {cat.subtitle}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export { CATEGORIAS };
