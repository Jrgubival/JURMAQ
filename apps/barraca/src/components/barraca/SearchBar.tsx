"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: number;
  nombre: string;
  slug: string;
  precio: number;
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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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
          className={`w-full ${sizeClasses[size]} pl-12 pr-24 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base text-gray-900 placeholder-gray-400 shadow-sm`}
        />
        <svg
          className={`absolute left-4 top-1/2 -translate-y-1/2 ${iconSize[size]} text-gray-400`}
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
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 px-4 ${size === "lg" ? "h-10" : "h-8"} bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition-colors`}
        >
          Buscar
        </button>
        {loading && (
          <div className="absolute right-20 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
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
              className="w-full px-4 py-3 text-left hover:bg-orange-50 flex items-center justify-between border-b border-gray-100 last:border-0 transition-colors"
            >
              <span className="text-sm text-gray-900 truncate">
                {product.nombre}
              </span>
              <span className="text-sm font-semibold text-orange-600 shrink-0 ml-3">
                ${product.precio.toLocaleString("es-CL")}
              </span>
            </button>
          ))}
          <button
            onClick={handleSubmit}
            className="w-full px-4 py-3 text-sm text-orange-600 font-semibold hover:bg-orange-50 text-center transition-colors border-t border-gray-100"
          >
            Ver todos los resultados
          </button>
        </div>
      )}
    </div>
  );
}
