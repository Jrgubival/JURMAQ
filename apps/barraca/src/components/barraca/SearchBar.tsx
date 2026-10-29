"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatCLP } from "@jurmaq/shared/format";
import { vistaPrecio } from "@/lib/precio-web";

interface SearchResult {
  id: number;
  nombre: string;
  slug: string;
  precio: number;
  // FIX (audit jun-2026): el dropdown mostraba precio crudo, ignorando la oferta.
  precio_original?: number | null;
  en_oferta?: boolean;
  stock?: number | null;
  solo_cotizar?: boolean | null;
}

export default function SearchBar({
  defaultValue = "",
  className = "",
  size = "md",
}: {
  defaultValue?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/buscar?q=${encodeURIComponent(query)}&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.productos || []);
          setShowDropdown(true);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (term) {
      setShowDropdown(false);
      import("@/lib/analytics")
        .then(({ trackEvents }) => trackEvents.search(term))
        .catch(() => { /* analytics no debe romper UX */ });
      router.push(`/buscar?q=${encodeURIComponent(term)}`);
    }
  }

  const sizeClasses = {
    sm: "h-10 text-sm",
    md: "h-12 text-sm",
    lg: "h-14 text-base",
  };

  const iconSize = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-5 h-5",
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} role="search" aria-label="Buscar productos" className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="¿Qué necesitas?"
          aria-label="Buscar productos en la barraca"
          className={`w-full ${sizeClasses[size]} pl-12 pr-24 bg-white border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-marca-500 text-base text-gray-900 placeholder-gray-500`}
        />
        <svg
          className={`absolute left-4 top-1/2 -translate-y-1/2 ${iconSize[size]} text-gray-500`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <button
          type="submit"
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 px-4 h-10 bg-marca-600 hover:bg-marca-700 text-white text-sm font-semibold rounded-lg transition-colors`}
        >
          Buscar
        </button>
        {loading && (
          <div className="absolute right-20 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-marca-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </form>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 top-full mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {results.map((product) => (
            <button
              key={product.id}
              onClick={() => {
                setShowDropdown(false);
                router.push(`/producto/${product.slug}`);
              }}
              className="w-full px-4 py-3 text-left hover:bg-marca-50 flex items-center justify-between border-b border-gray-100 last:border-0 transition-colors"
            >
              <span className="text-sm text-gray-900 truncate">
                {product.nombre}
              </span>
              <span className="text-sm shrink-0 ml-3 text-right">
                {(() => {
                  const v = vistaPrecio({ ...product, stock: product.stock ?? null });
                  if (!v.disponible) return <span className="text-xs text-gray-500">No disponible</span>;
                  return (
                    <>
                      <span className={`block font-semibold tabular-nums ${v.precioNormal ? "text-marca-700" : "text-navy-950"}`}>
                        {formatCLP(v.precioWeb)}
                      </span>
                      {v.precioNormal && (
                        <span className="block text-[11px] text-gray-500 leading-none tabular-nums">
                          Normal <span className="line-through">{formatCLP(v.precioNormal)}</span>
                        </span>
                      )}
                    </>
                  );
                })()}
              </span>
            </button>
          ))}
          <button
            onClick={handleSubmit}
            className="w-full px-4 py-3 text-sm text-marca-600 font-semibold hover:bg-marca-50 text-center transition-colors border-t border-gray-100"
          >
            Ver todos los resultados
          </button>
        </div>
      )}
    </div>
  );
}
