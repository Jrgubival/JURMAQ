import Link from "next/link";

/**
 * CrossLinksGrid — grid editorial de cross-links SEO compartido entre apps.
 *
 * Estilo barraca-de-fierros: pills/boxes que cubren combinaciones de
 * ciudad × tipo / categoría × ciudad para mejorar SEO local. Usado en
 * constructora para arriendo/ciudad/tipo y en barraca para categorías,
 * materiales, productos y despachos por ciudad.
 *
 * Uso:
 *   <CrossLinksGrid
 *     title="También en otras ciudades del Maule"
 *     items={[
 *       { label: 'Arriendo en Curicó', href: '/arriendo-en/curico' },
 *       { label: 'Arriendo en Molina', href: '/arriendo-en/molina' },
 *       ...
 *     ]}
 *   />
 */
interface CrossLinkItem {
  label: string;
  href: string;
  count?: number;
}

interface Props {
  title: string;
  subtitle?: string;
  items: CrossLinkItem[];
  eyebrow?: string;
  variant?: "light" | "dark";
}

export default function CrossLinksGrid({
  title,
  subtitle,
  items,
  eyebrow = "Cobertura · Maule",
  variant = "light",
}: Props) {
  const isDark = variant === "dark";
  return (
    <section
      className={`py-20 lg:py-24 border-y ${isDark ? "bg-navy-950 border-navy-800" : "bg-[#FBFBFA] border-[#EAEAEA]"}`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.22em] mb-4 ${
              isDark ? "text-gold-400" : "text-[#787774]"
            }`}
          >
            {eyebrow}
          </p>
          <h2
            className={`leading-[1.1] mb-3 ${isDark ? "text-white" : "text-[#111111]"}`}
            style={{
              fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className={`text-base leading-relaxed ${isDark ? "text-white/75" : "text-[#5A5A57]"}`}
            >
              {subtitle}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 lg:gap-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group inline-flex items-center justify-between gap-2 px-4 py-3 rounded-xl border transition-colors ${
                isDark
                  ? "border-navy-800 bg-navy-900/40 hover:border-gold-500/40 text-white"
                  : "border-[#EAEAEA] bg-white hover:border-[#111111] text-[#111111]"
              }`}
            >
              <span className="text-sm font-medium tracking-[-0.005em] truncate">
                {item.label}
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                {typeof item.count === "number" && item.count > 0 && (
                  <span
                    className={`text-[10px] tabular-nums ${
                      isDark ? "text-gray-400" : "text-[#787774]"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
                <svg
                  className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 ${
                    isDark ? "text-gold-400" : "text-[#956400]"
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
