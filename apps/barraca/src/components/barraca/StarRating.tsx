'use client';

import { useState } from 'react';

/**
 * Componente de estrellas reusable.
 *
 * Modos:
 *   - readOnly (default): solo muestra rating (decimales OK con half-star)
 *   - interactive: click cambia valor (para form de nueva review)
 */
interface Props {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
  onChange?: (v: number) => void;
  className?: string;
  /** Muestra el número junto a las estrellas. */
  showValue?: boolean;
  /** Muestra "(N reviews)" al lado. */
  count?: number;
}

const SIZE_PX: Record<NonNullable<Props['size']>, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
};

export default function StarRating({
  value,
  max = 5,
  size = 'md',
  readOnly = true,
  onChange,
  className = '',
  showValue = false,
  count,
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover !== null ? hover : value;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div className="inline-flex" role="img" aria-label={`${value} de ${max} estrellas`}>
        {Array.from({ length: max }).map((_, i) => {
          const starValue = i + 1;
          const filled = display >= starValue;
          const half = !filled && display >= starValue - 0.5;
          return (
            <button
              key={i}
              type="button"
              disabled={readOnly}
              onMouseEnter={readOnly ? undefined : () => setHover(starValue)}
              onMouseLeave={readOnly ? undefined : () => setHover(null)}
              onClick={readOnly ? undefined : () => onChange?.(starValue)}
              className={`${readOnly ? 'cursor-default' : 'cursor-pointer'} ${
                readOnly ? '' : 'hover:scale-110 transition-transform'
              }`}
              aria-label={`${starValue} estrella${starValue > 1 ? 's' : ''}`}
            >
              <svg
                className={`${SIZE_PX[size]} ${filled || half ? 'text-amber-400' : 'text-gray-300'}`}
                viewBox="0 0 24 24"
                fill={filled ? 'currentColor' : half ? 'url(#half)' : 'currentColor'}
                stroke="currentColor"
                strokeWidth={1}
              >
                {half && (
                  <defs>
                    <linearGradient id="half">
                      <stop offset="50%" stopColor="currentColor" />
                      <stop offset="50%" stopColor="white" />
                    </linearGradient>
                  </defs>
                )}
                <path
                  fill={filled ? 'currentColor' : half ? 'url(#half)' : 'none'}
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm font-semibold text-gray-700">
          {Number(value).toFixed(1)}
        </span>
      )}
      {typeof count === 'number' && (
        <span className="text-xs text-gray-500">
          ({count} review{count !== 1 ? 's' : ''})
        </span>
      )}
    </div>
  );
}
