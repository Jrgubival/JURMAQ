"use client";

import Link from "@/components/barraca/Enlace";
import Image from "next/image";
import { useState } from "react";
import { titleCase } from "@jurmaq/shared/format";
import { formatCLP } from "@jurmaq/shared/format";
import { agregarProducto } from "@/lib/agregar";
import { unidadesDisponibles } from "@/lib/stock";

const categoryImages: Record<string, string> = {
  'fierros-construccion': '/images/barraca/categorias/fierro.jpg',
  'fijaciones': '/images/barraca/categorias/fijaciones.jpg',
  'herramientas-y-maq': '/images/barraca/categorias/herramientas.webp',
  'pinturas': '/images/barraca/categorias/pinturas.webp',
  'perfiles-y-planchas': '/images/barraca/categorias/perfiles.webp',
  'electricidad-e-iluminacion': '/images/barraca/categorias/electricidad.webp',
  'bano-cocina-y-loggia': '/images/barraca/categorias/bano.jpg',
  'seguridad-industrial': '/images/barraca/categorias/seguridad.webp',
  'jardin': '/images/barraca/categorias/jardin.png',
  'adhesivos-y-sellantes': '/images/barraca/categorias/adhesivos.webp',
  'cerraduras': '/images/barraca/categorias/cerraduras.jpg',
  'quincalleria': '/images/barraca/categorias/quincasilleria.webp',
  'cercos-y-mallas': '/images/barraca/categorias/mallas.jpg',
  'aridos-y-morteros': '/images/barraca/categorias/morteros.webp',
  'tabiqueria': '/images/barraca/categorias/tabiqueria.webp',
  'techumbre': '/images/barraca/categorias/Techumbres.jpg',
  'aditivos-e-impermeabilizantes': '/images/barraca/categorias/impermeabilizante.webp',
  'aislacion': '/images/barraca/categorias/aislacion.webp',
};

function getProductImage(
  imagen: string | null,
  categoriaSlug?: string
): string | null {
  // Igual que ProductCard: sin foto propia va la placa con la medida, no la
  // foto de la categoría (confundía con otro producto). La de la categoría
  // queda sólo para cuando la foto propia falla al cargar.
  if (!imagen) return null;
  if (imagen.startsWith("/images/barraca/categorias/")) {
    return imagen;
  }
  if (imagen.startsWith("/images/barraca/")) {
    return categoriaSlug ? categoryImages[categoriaSlug] || null : null;
  }
  return imagen;
}

interface PromotedProductCardProps {
  id: number;
  nombre: string;
  codigo?: string | null;
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

  const unidades = unidadesDisponibles(stock);
  const comprable = unidades > 0 && precioDescuento > 0;
  // El descuento sólo se muestra si es real (≥1%), como en ProductCard.
  const muestraOferta = descuento >= 1 && precioOriginal > precioDescuento;
  const recorte = nombre.replace(/\s+\d[\d.,/x×\s"]*(mm|cm|mts?|m|kg|gr|lts?|l|")?\s*$/i, "").trim();
  const nombreSinMedida = recorte.length >= 3 ? recorte : nombre;
  const unitLabel = unidad ? `/${unidad.toLowerCase()}` : "";
  const medidaTexto = medida
    ? medida.replace(/(\d)\s*[xX]\s*(?=\d)/g, "$1\u2009×\u2009").replace(/(\d)\.(\d)/g, "$1,$2").replace(/\b(MM|CM|MTS?|KG|LTS?)\b/g, (u) => u.toLowerCase())
    : null;

  function handleAdd() {
    if (!comprable) return;
    setAdding(true);
    const ok = agregarProducto({
      productoId: id, nombre, precio: precioDescuento, imagen, slug, medida, unidad, stock: unidades,
    });
    setAdding(false);
    if (ok) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  }

  /* Misma jerarquía que ProductCard: precio de oferta primero, nombre en
     medio tono con la medida en negrita, una línea gris de metadatos y un
     solo botón. Sin pastillas de stock sobre la foto. */
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden group transition-[border-color,box-shadow] duration-150 ease-out hover:border-gray-300 hover:shadow-[0_8px_24px_-12px_rgba(12,29,58,0.25)] flex flex-col h-full relative">
      <Link href={`/producto/${slug}`} className="block" aria-label={`Ver detalles de ${nombre}${medida ? ` - ${medida}` : ""}`}>
        <div className="aspect-square bg-white relative overflow-hidden p-4">
          {displayImage ? (
            <Image
              src={displayImage}
              alt={nombre}
              className="w-full h-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.03]"
              width={400}
              height={400}
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              onError={() => { if (!imgError) setImgError(true); }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#F3F3F1] rounded-lg px-3 pt-6 sm:pt-0 text-center">
              {medida ? (
                <>
                  <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-2 line-clamp-2">
                    {titleCase(nombreSinMedida).slice(0, 28)}
                  </span>
                  <span className="font-[var(--font-heading)] text-lg sm:text-2xl leading-tight sm:leading-none font-semibold text-navy-950 tabular-nums">
                    {medidaTexto}
                  </span>
                </>
              ) : (
                <span className="text-xs uppercase tracking-[0.14em] text-gray-400">Sin foto</span>
              )}
            </div>
          )}

          {muestraOferta && (
            <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md text-xs font-bold bg-marca-600 text-white tabular-nums">
              −{descuento}%
            </span>
          )}
        </div>
      </Link>

      <div className="px-4 pb-4 pt-1 flex flex-col flex-grow">
        <Link href={`/producto/${slug}`} className="block">
          <h3 className="text-sm text-gray-600 leading-snug line-clamp-2 group-hover:text-navy-950 transition-colors duration-150">
            {titleCase(medida ? nombreSinMedida : nombre)}
          </h3>
          {medidaTexto && (
            <p className="mt-0.5 text-sm sm:text-[15px] font-semibold text-navy-950 leading-snug tabular-nums">
              {medidaTexto}
            </p>
          )}
        </Link>

        <div className="mt-auto pt-4">
          {muestraOferta && (
            <p className="text-xs text-gray-400 line-through tabular-nums leading-none mb-1">
              {formatCLP(precioOriginal)}
            </p>
          )}
          <p className="leading-none tabular-nums">
            <span className={`text-xl sm:text-2xl font-extrabold tracking-tight ${muestraOferta ? "text-marca-700" : "text-navy-950"}`}>
              {formatCLP(precioDescuento)}
            </span>
            {unitLabel && <span className="text-xs text-gray-500 ml-1">{unitLabel}</span>}
          </p>
          <p className="mt-1.5 text-xs text-gray-500 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
            <span className="hidden sm:inline">IVA incluido · </span>
            {unidades > 0 ? (
              <span>{unidades} en stock</span>
            ) : (
              <span className="font-semibold text-[#9C2B1F]">Sin stock</span>
            )}
          </p>

          {comprable && (
            <button
              onClick={handleAdd}
              disabled={adding}
              aria-label={added ? `${nombre} agregado al carrito` : `Agregar ${nombre} al carrito`}
              className={`mt-3 w-full flex items-center justify-center gap-2 px-3 min-h-[44px] text-sm font-semibold rounded-lg transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy-950 ${
                added ? "bg-green-700 text-white" : "bg-navy-950 text-white hover:bg-navy-800"
              }`}
            >
              {added ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Agregado</span>
                </>
              ) : (
                <>
                  <span className="sm:hidden">Agregar</span>
                  <span className="hidden sm:inline">Agregar al carrito</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
