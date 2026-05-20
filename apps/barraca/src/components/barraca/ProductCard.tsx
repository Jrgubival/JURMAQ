"use client";

import Link from "next/link";
import { useState } from "react";
import { showToast } from "@/components/Toast";
import { titleCase } from "@jurmaq/shared/format";
import { formatCLP } from "@jurmaq/shared/format";
import WishlistHeart from "./WishlistHeart";

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

function getProductImage(imagen: string | null, categoriaSlug?: string): string | null {
  if (!imagen) {
    return categoriaSlug ? (categoryImages[categoriaSlug] || null) : null;
  }
  if (imagen.startsWith('/images/barraca/categorias/')) {
    return imagen;
  }
  if (imagen.startsWith('/images/barraca/')) {
    return categoriaSlug ? (categoryImages[categoriaSlug] || null) : null;
  }
  return imagen;
}

interface ProductCardProps {
  id: number;
  nombre: string;
  slug: string;
  precio: number;
  imagen: string | null;
  stock: number;
  unidad: string | null;
  medida: string | null;
  isNew?: boolean;
  categoriaSlug?: string;
  precio_original?: number | null;
  en_oferta?: boolean;
  solo_cotizar?: boolean;
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

export default function ProductCard({
  id,
  nombre,
  slug,
  precio,
  imagen,
  stock,
  unidad,
  medida,
  isNew,
  categoriaSlug,
  precio_original,
  en_oferta,
  solo_cotizar,
}: ProductCardProps) {
  const resolvedImage = getProductImage(imagen, categoriaSlug);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const fallbackImage = categoriaSlug ? (categoryImages[categoriaSlug] || null) : null;
  const displayImage = imgError ? fallbackImage : resolvedImage;

  async function handleAdd() {
    setAdding(true);
    try {
      // If this card is showing a discounted price (either sticky offer with
      // precio_original, or daily-promo enriched in-memory), send it as
      // precioOverride so the cart honors what the customer saw on the card.
      // The server validates it against active promotions before accepting.
      const overridePrice =
        en_oferta && precio_original && precio_original > 0
          ? precio_original
          : null;
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
          ...(overridePrice ? { precioOverride: overridePrice } : {}),
        }),
      });
      if (!res.ok) {
        // 429 rate-limit, 403 origin, 400 stock — todos surface al usuario.
        // Antes el catch solo agarraba network errors y mostrabamos "Agregado"
        // aunque el server hubiera rechazado el item.
        const data = await res.json().catch(() => ({} as { error?: string }));
        const msg = (data as { error?: string }).error || (res.status === 429 ? "Demasiadas solicitudes" : "No se pudo agregar al carrito");
        showToast(msg, "error");
        return;
      }
      setAdded(true);
      window.dispatchEvent(new Event("cart-updated"));
      showToast("Agregado al carrito", "success");
      setTimeout(() => setAdded(false), 2000);
    } catch {
      showToast("Error al agregar al carrito", "error");
    } finally {
      setAdding(false);
    }
  }

  // Unit display helper
  const unitLabel = unidad ? `/${unidad}` : '';

  return (
    <div className="bg-white border border-gray-300 rounded-md overflow-hidden group transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-navy-950 hover:shadow-[0_2px_0_0_rgb(12,29,58)] flex flex-col h-full relative">
      {/* D3-UI Tier 4: ícono corazón para wishlist (cliente logueado) */}
      <div className="absolute top-2 right-2 z-10">
        <WishlistHeart productoId={id} size="sm" />
      </div>
      <Link href={`/producto/${slug}`} className="block" aria-label={`Ver detalles de ${nombre}${medida ? ` - ${medida}` : ''}`}>
        <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden">
          {displayImage ? (
            <img
              src={displayImage}
              alt={`Producto ${nombre}${medida ? ` ${medida}` : ''} disponible en Barraca JURMAQ`}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              width={400}
              height={300}
              onError={() => { if (!imgError) setImgError(true); }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
              <svg
                className="w-14 h-14 text-gray-300"
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

          {/* Badges - top left. Estilo "etiqueta de barraca": rectangular,
              tipografía wide-tracking, border-l acento. Diferencia clara
              del "rounded-md shadow-sm" del badge web genérico. */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {isNew && (
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-blue-600 text-white border-l-2 border-white">
                Nuevo
              </span>
            )}
            {en_oferta && precio_original && precio_original > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-red-600 text-white border-l-2 border-white">
                Oferta
              </span>
            )}
            {en_oferta && precio_original && precio_original > 0 && precio > precio_original && (
              <span className="px-2 py-0.5 text-[10px] font-extrabold tabular-nums bg-red-500 text-white border-l-2 border-white">
                −{Math.round((1 - precio_original / precio) * 100)}%
              </span>
            )}
          </div>

          {/* Imagen referencial note */}
          <span className="absolute bottom-1 right-1 text-[10px] text-white/70 bg-black/30 px-1.5 py-0.5 rounded">
            Imagen referencial
          </span>

          {/* Stock badge - top right. Estilo dato técnico (puntito + label uppercase). */}
          <div className="absolute top-2 right-2">
            {stock > 10 ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-green-600 text-white">
                <span className="w-1.5 h-1.5 bg-white" />
                En stock
              </span>
            ) : stock > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-amber-500 text-white">
                <span className="w-1.5 h-1.5 bg-white animate-pulse" />
                Pocas unid.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-gray-700 text-white">
                Cotizable
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-grow">
        <Link href={`/producto/${slug}`} className="block flex-grow min-h-0">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1 group-hover:text-orange-600 transition-colors leading-tight">
            {titleCase(nombre)}
          </h3>
          {medida && (
            <p className="text-xs text-gray-400 mb-1">{medida}</p>
          )}
        </Link>

        {/* Low stock warning with urgency */}
        {stock > 0 && stock <= 5 && (
          <p className="text-xs text-red-600 font-semibold mb-2 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Quedan {stock} unid.
          </p>
        )}
        {stock > 5 && stock < 10 && (
          <p className="text-xs text-amber-600 font-medium mb-2">
            Quedan {stock} unidades
          </p>
        )}

        {/* Price section - tabular-nums para feel "factura" estable.
            Pricing legible y técnico, no decoración. */}
        <div className="mt-auto pt-3 border-t border-gray-200">
          <div className="mb-3">
            {solo_cotizar ? (
              <p className="text-base font-bold text-indigo-700">
                Consultar precio
              </p>
            ) : en_oferta && precio_original && precio_original > 0 ? (
              <div>
                <p className="text-xs text-gray-400 line-through leading-none tabular-nums">
                  {formatCLP(precio)}{unitLabel}
                </p>
                <p className="text-xl font-extrabold text-red-600 leading-tight tabular-nums">
                  {formatCLP(precio_original)}
                  <span className="text-xs text-gray-500 font-medium ml-0.5">{unitLabel}</span>
                </p>
                <p className="text-[10px] text-gray-500 tracking-wide uppercase">IVA incl.</p>
              </div>
            ) : (
              <>
                <p className="text-xl font-extrabold text-navy-950 leading-tight tabular-nums">
                  {formatCLP(precio)}
                  <span className="text-xs text-gray-500 font-medium ml-0.5">{unitLabel}</span>
                </p>
                {precio > 0 && (
                  <p className="text-[10px] text-gray-500 tracking-wide uppercase">IVA incl.</p>
                )}
              </>
            )}
          </div>

          {/* Add to cart button - full width */}
          <button
            onClick={handleAdd}
            disabled={adding}
            aria-label={added ? `${nombre} agregado al carrito` : solo_cotizar ? `Cotizar ${nombre}` : `Agregar ${nombre} al carrito`}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] text-sm font-bold rounded-lg transition-all ${
              added
                ? "bg-green-500 text-white"
                : solo_cotizar
                ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]"
                : stock <= 0
                ? "bg-amber-600 text-white hover:bg-amber-700 active:scale-[0.98]"
                : "bg-orange-600 text-white hover:bg-orange-700 active:scale-[0.98] shadow-sm shadow-orange-200"
            }`}
          >
            {adding ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : added ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Agregado</span>
              </>
            ) : solo_cotizar ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span>Cotizar</span>
              </>
            ) : stock <= 0 ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span>Cotizar</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                <span>Agregar al carrito</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
