import Link from "next/link";

/**
 * Breadcrumbs — navegación jerárquica visible y accesible compartida entre apps.
 *
 * Variantes:
 *   - "light" para fondos claros (barraca, públicos)
 *   - "dark"  para hero/sections navy (constructora)
 *
 * El último item se renderiza como <span> (current page, no clickable) aunque
 * tenga href, siguiendo el patrón estándar de breadcrumbs accesibles.
 *
 * NOTA: este componente sólo cubre la UI visible. El JSON-LD BreadcrumbList
 * debe seguir inyectándose por separado en cada página (ya existe en todas
 * las pages dinámicas del proyecto).
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  items: BreadcrumbItem[];
  variant?: "light" | "dark";
  className?: string;
}

export default function Breadcrumbs({
  items,
  variant = "light",
  className,
}: Props) {
  const isDark = variant === "dark";
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-2 text-sm flex-wrap ${className || ""}`}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="inline-flex items-center gap-2">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className={
                  isDark
                    ? "text-white/55 hover:text-gold-400 transition-colors"
                    : "text-[#787774] hover:text-[#111111] transition-colors"
                }
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={
                  isDark
                    ? "text-white/85 font-medium"
                    : "text-[#111111] font-medium"
                }
              >
                {item.label}
              </span>
            )}
            {!isLast && (
              <svg
                className={`w-3.5 h-3.5 ${isDark ? "text-white/30" : "text-[#787774]/50"}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            )}
          </span>
        );
      })}
    </nav>
  );
}
