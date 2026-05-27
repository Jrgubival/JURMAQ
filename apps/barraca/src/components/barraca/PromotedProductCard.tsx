"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { showToast } from "@/components/Toast";
import { titleCase } from "@jurmaq/shared/format";
import { formatCLP } from "@jurmaq/shared/format";
import { TOAST_MESSAGES } from "@jurmaq/shared/messages";

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
        const msg = (data as { error?: string }).error || (res.status === 429 ? TOAST_MESSAGES.cart.RATE_LIMITED : TOAST_MESSAGES.cart.ADD_FAILED_FALLBACK);
        showToast(msg, "error");
        return;
      }
      setAdded(true);
      window.dispatchEvent(new Event("cart-updated"));
      showToast(TOAST_MESSAGES.cart.ADDED_WITH_DISCOUNT, "success");
      setTimeout(() => setAdded(false), 2000);
    } catch {
      showToast(TOAST_MESSAGES.cart.ADD_ERROR, "error");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden group hover:border-[#111111]/30 transition-colors duration-300 relative">
      {/* Discount badge — single hairline pill, editorial */}
      <div className="absolute top-3 left-3 z-10">
        <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] bg-white/95 border border-[#EAEAEA] text-[#111111] rounded-full tabular-nums">
          Oferta · −{descuento}%
        </span>
      </div>

      <Link href={`/producto/${slug}`} className="block">
        <div className="aspect-square bg-gray-100 relative overflow-hidden">
          {displayImage ? (
            <Image
              src={displayImage}
              alt={nombre}
              className="w-full h-full object-cover"
              width={400}
              height={400}
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
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

          <div className="absolute top-3 right-3">
            {stock > 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] bg-white/95 border border-[#EAEAEA] text-[#2F7F4E] rounded-full">
                En stock
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] bg-white/95 border border-[#EAEAEA] text-[#9C2B1F] rounded-full">
                Sin stock
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="p-4">
        <Link href={`/producto/${slug}`} className="block">
          <h3 className="text-sm font-medium text-[#111111] line-clamp-2 mb-1 group-hover:text-[#111111] transition-colors">
            {titleCase(nombre)}
          </h3>
          {medida && <p className="text-xs text-[#787774] mb-2">{medida}</p>}
        </Link>

        {stock > 0 && stock < 10 && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#787774] mb-2">
            Quedan {stock} unidades
          </p>
        )}

        <div className="flex items-end justify-between mt-2 gap-2">
          <div>
            <p className="text-[10px] text-[#787774] line-through tabular-nums">
              Antes {formatCLP(precioOriginal)}
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <p className="text-lg font-medium text-[#111111] tabular-nums">
                {formatCLP(precioDescuento)}
              </p>
              {unidad && (
                <span className="text-xs text-[#787774] font-medium">
                  /{unidad}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || stock <= 0}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium tracking-[0.02em] rounded-lg transition-colors ${
              added
                ? "bg-[#2F7F4E] text-white"
                : stock <= 0
                ? "bg-[#F0EFEB] text-[#787774] cursor-not-allowed"
                : "bg-navy-950 text-white hover:bg-[#111111]"
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
