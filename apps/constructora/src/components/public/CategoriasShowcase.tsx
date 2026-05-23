import Link from 'next/link';

/**
 * Grid visual de categorías de maquinaria, estilo Rendalomaq.
 * Cada card linka a /maquinarias?tipo=<slug> y muestra el conteo opcional.
 *
 * Uso:
 *   <CategoriasShowcase counts={{ retroexcavadora: 4, ... }} variant="dark" />
 */

export type TipoCategoria =
  | 'retroexcavadora'
  | 'miniexcavadora'
  | 'brazo_articulado'
  | 'grua'
  | 'camion'
  | 'rodillo'
  | 'otro';

interface Categoria {
  tipo: TipoCategoria;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
}

const CATEGORIAS: Categoria[] = [
  {
    tipo: 'retroexcavadora',
    label: 'Retroexcavadoras',
    subtitle: 'Excava + carga · obras grandes',
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 48v-8a4 4 0 014-4h12a4 4 0 014 4v8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M34 36l10-10 4 4-6 10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M44 30l6-2-2 6" />
        <circle cx="20" cy="52" r="4" />
        <circle cx="32" cy="52" r="4" />
      </svg>
    ),
  },
  {
    tipo: 'miniexcavadora',
    label: 'Miniexcavadoras',
    subtitle: 'Acceso a espacios reducidos',
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 50h28v-10H14v10z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M42 40l8-10 3 3-4 7" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 50h28" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 54h24" />
      </svg>
    ),
  },
  {
    tipo: 'brazo_articulado',
    label: 'Brazos articulados',
    subtitle: 'Alturas y ángulos · faenas',
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 50h12v-4H12v4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 46V26l16-8 8 14" />
        <circle cx="42" cy="32" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M42 35v8h-4" />
      </svg>
    ),
  },
  {
    tipo: 'grua',
    label: 'Grúas',
    subtitle: 'Izaje y posicionamiento',
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 52h20v-8H12v8z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M22 44V14l22 6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M44 20v8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M40 28h8" />
      </svg>
    ),
  },
  {
    tipo: 'camion',
    label: 'Camiones tolva',
    subtitle: 'Traslado de áridos',
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 44V24h28v20" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M34 30h12l8 8v6H34" />
        <circle cx="18" cy="48" r="4" />
        <circle cx="44" cy="48" r="4" />
      </svg>
    ),
  },
  {
    tipo: 'rodillo',
    label: 'Rodillos compactadores',
    subtitle: 'Compactación de suelos',
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="20" cy="44" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M30 38h16v-12h-16" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M46 30h6l-2 8h-4" />
      </svg>
    ),
  },
];

interface Props {
  counts?: Partial<Record<TipoCategoria, number>>;
  variant?: 'light' | 'dark';
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
}

export default function CategoriasShowcase({
  counts = {},
  variant = 'light',
  title = 'Explora por categoría',
  subtitle = 'Encuentra la máquina exacta que necesitas para tu faena.',
  showHeader = true,
}: Props) {
  const isDark = variant === 'dark';

  return (
    <section
      className={`py-16 lg:py-20 ${isDark ? 'bg-navy-950' : 'bg-white'} content-auto`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {showHeader && (
          <div className="mb-10 lg:mb-12 text-center lg:text-left">
            <h2
              className={`text-3xl lg:text-4xl font-extrabold mb-3 ${
                isDark ? 'text-white' : 'text-navy-950'
              }`}
            >
              {title}
            </h2>
            <p className={`text-lg max-w-2xl ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {subtitle}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-5">
          {CATEGORIAS.map((cat) => {
            const count = counts[cat.tipo];
            return (
              <Link
                key={cat.tipo}
                href={`/maquinarias?tipo=${cat.tipo}`}
                className={`group relative flex flex-col items-center text-center p-5 lg:p-6 rounded-2xl border transition-all ${
                  isDark
                    ? 'bg-navy-900/60 border-navy-800 hover:border-gold-500/60 hover:bg-navy-900'
                    : 'bg-gray-50 border-gray-200 hover:border-gold-500/60 hover:bg-white hover:shadow-lg'
                }`}
              >
                <div
                  className={`flex items-center justify-center w-16 h-16 rounded-2xl mb-4 transition-colors ${
                    isDark
                      ? 'bg-navy-950 text-gold-500 group-hover:bg-gold-500 group-hover:text-navy-950'
                      : 'bg-navy-950 text-gold-500 group-hover:bg-gold-500 group-hover:text-navy-950'
                  }`}
                >
                  {cat.icon}
                </div>
                <h3
                  className={`text-sm lg:text-base font-bold mb-1 ${
                    isDark ? 'text-white' : 'text-navy-950'
                  }`}
                >
                  {cat.label}
                </h3>
                <p
                  className={`text-xs leading-relaxed ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {cat.subtitle}
                </p>
                {count !== undefined && count > 0 && (
                  <span
                    className={`absolute top-3 right-3 inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-[10px] font-bold rounded-full ${
                      isDark
                        ? 'bg-gold-500 text-navy-950'
                        : 'bg-gold-500 text-navy-950'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export { CATEGORIAS };
