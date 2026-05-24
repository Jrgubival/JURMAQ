"use client";

import Link from "next/link";
import { useState } from "react";
import { showToast } from "@/components/Toast";
import { titleCase } from "@jurmaq/shared/format";
import { formatCLP } from "@jurmaq/shared/format";

const categoryImages: Record<string, string> = {
  'fierros-construccion': '/images/barraca/categorias/fierro.jpg',
  'fijaciones': '/images/barraca/categorias/fijaciones.jpg',
  'herramientas-y-maq': '/images/barraca/categorias/herramientas.png',
  'pinturas': '/images/barraca/categorias/pinturas.webp',
  'perfiles-y-planchas': '/images/barraca/categorias/perfiles.webp',
  'electricidad-e-iluminacion': '/images/barraca/categorias/electricidad.png',
  'bano-cocina-y-loggia': '/images/barraca/categorias/bano.jpg',
  'seguridad-industrial': '/images/barraca/categorias/seguridad.webp',
  'jardin': '/images/barraca/categorias/jardin.png',
  'adhesivos-y-sellantes': '/images/barraca/categorias/adhesivos.webp',
  'cerraduras': '/images/barraca/categorias/cerraduras.jpg',
  'quincalleria': '/images/barraca/categorias/quincasilleria.webp',
  'cercos-y-mallas': '/images/barraca/categorias/mallas.jpg',
  'aridos-y-morteros': '/images/barraca/categorias/morteros.webp',
  'tabiqueria': '/images/barraca/categorias/tabiqueria.png',
  'techumbre': '/images/barraca/categorias/Techumbres.jpg',
  'aditivos-e-impermeabilizantes': '/images/barraca/categorias/impermeabilizante.webp',
  'aislacion': '/images/barraca/categorias/aislacion.webp',
};

function getProductImage(
  imagen: string | null,
  categoriaSlug?: string
): string | null {
  if (!imagen) {
    return categoriaSlug ? categoryImages[categoriaSlug] || null : null;
  }
  if (imagen.startsWith("/images/barraca/categorias/")) {
    return imagen;
  }
  if (imagen.startsWith("/images/barraca/")) {
    return categoriaSlug ? categoryImages[categoriaSlug] || null : null;
  }
  return imagen;
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem("barraca_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("barraca_session_id", sid);
  }
  return sid;
}

interface PromotedProductCardProps {
  id: number;
  nombre: string;
  slug: string;
  precioOriginal: number;
  precioDescuento: number;
  descuento: number;
  imagen: string | null;
  stock: number;
  unidad: string | null;
  medida: string | null;
  categoriaSlug?: string;
}

export default function PromotedProductCard({
  id,
  nombre,
  slug,
  precioOriginal,
  precioDescuento,
  descuento,
  imagen,
  stock,
  unidad,
  medida,
  categoriaSlug,
}: PromotedProductCardProps) {
  const resolvedImage = getProductImage(imagen, categoriaSlug);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const fallbackImage = categoriaSlug ? (categoryImages[categoriaSlug] || null) : null;
  const displayImage = imgError ? fallbackImage : resolvedImage;

  async function handleAdd() {
    setAdding(true);
    try {
      const res = await fetch("/api/carrito", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": getSessionId(),
        },
        body: JSON.stringify({
          sessionId: getSessionId(),
          productoId: id,
          cantidad: 1,
          precioOverride: precioDescuento,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        const msg = (data as { error?: string }).error || (res.status === 429 ? "Demasiadas solicitudes" : "No se pudo agregar al carrito");
        showToast(msg, "error");
        return;
      }
      setAdded(true);
      window.dispatchEvent(new Event("cart-updated"));
      showToast("Agregado al carrito con descuento", "success");
      setTimeout(() => setAdded(false), 2000);
    } catch {
      showToast("Error al agregar al carrito", "error");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden group hover:shadow-lg hover:border-orange-200 transition-all duration-300 relative">
      {/* Discount badge */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        <span className="px-2 py-0.5 text-xs font-bold bg-red-600 text-white rounded-full">
          -{descuento}%
        </span>
        <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-500 text-white rounded-full uppercase tracking-wider">
          Oferta del Dia
        </span>
      </div>

      <Link href={`/producto/${slug}`} className="block">
        <div className="aspect-square bg-gray-100 relative overflow-hidden">
          {displayImage ? (
            <img
              src={displayImage}
              alt={nombre}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => { if (!imgError) setImgError(true); }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg
                className="w-16 h-16 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
          )}

          <div className="absolute top-2 right-2">
            {stock > 0 ? (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                En stock
              </span>
            ) : (
              <span className="px-2.5 py-1 text-xs font-bold bg-red-600 text-white rounded-full">
                Sin stock
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="p-4">
        <Link href={`/producto/${slug}`} className="block">
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1 group-hover:text-orange-600 transition-colors">
            {titleCase(nombre)}
          </h3>
          {medida && <p className="text-xs text-gray-500 mb-2">{medida}</p>}
        </Link>

        {stock > 0 && stock < 10 && (
          <p className="text-xs text-amber-600 font-medium mb-2">
            Quedan {stock} unidades
          </p>
        )}

        <div className="flex items-end justify-between mt-2 gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-lg font-bold text-orange-600">
                {formatCLP(precioDescuento)}
              </p>
              {unidad && (
                <span className="text-xs text-gray-500 font-medium">
                  /{unidad}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 line-through">
              {formatCLP(precioOriginal)}
            </p>
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || stock <= 0}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
              added
                ? "bg-green-500 text-white"
                : stock <= 0
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-orange-600 text-white hover:bg-orange-700 active:scale-95"
            }`}
          >
            {adding ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : added ? (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                  />
                </svg>
                <span className="hidden sm:inline">Agregar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
