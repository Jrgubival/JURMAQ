"use client";

import Link from "@/components/barraca/Enlace";
import Image from "next/image";
import { useState } from "react";
import { titleCase } from "@jurmaq/shared/format";
import { agregarProducto } from "@/lib/agregar";
import { unidadesDisponibles } from "@/lib/stock";
import { precioDeVenta, vistaPrecio } from "@/lib/precio-web";
import Precio from "./Precio";
import StarRating from "./StarRating";
import { nombreMarca } from "@/lib/marcas";

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

function getProductImage(imagen: string | null, categoriaSlug?: string): string | null {
  // Sin foto propia NO se muestra la foto de la categoría. Un "Chaleco
  // Geólogo" sin imagen salía con el buzo blanco de Seguridad Industrial, y
  // el comprador entendía que estaba comprando un buzo. La placa de medida
  // (bloque oscuro con nombre y medida) es honesta: dice lo que hay y no
  // finge una foto. El fallback de categoría queda sólo para cuando la foto
  // propia FALLA al cargar (onError), que es otro caso.
  if (!imagen) return null;
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
  /** Código del maestro (SKU). */
  codigo?: string | null;
  /** Tier 4 D2: rating agregado de reviews aprobadas. Opcional. */
  rating?: number | null;
  rating_count?: number;
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
  rating,
  rating_count,
}: ProductCardProps) {
  const marca = nombreMarca(nombre);
  // El nombre sin su medida: se corta donde empieza la cadena dimensional. Si
  // el recorte deja menos de 3 caracteres se usa el nombre completo.
  const recorte = nombre.replace(/\s+\d[\d.,/x×\s"]*(mm|cm|mts?|m|kg|gr|lts?|l|")?\s*$/i, '').trim();
  const nombreSinMedida = recorte.length >= 3 ? recorte : nombre;
  const resolvedImage = getProductImage(imagen, categoriaSlug);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const fallbackImage = categoriaSlug ? (categoryImages[categoriaSlug] || null) : null;
  const displayImage = imgError ? fallbackImage : resolvedImage;

  // Precio web / precio normal / No disponible: ver lib/precio-web.ts.
  const vista = vistaPrecio({ precio, precio_original, en_oferta, stock, solo_cotizar });
  const precioVenta = precioDeVenta({ precio, precio_original, en_oferta });
  const muestraOferta = vista.ahorroPct != null;
  const pctOferta = vista.ahorroPct ?? 0;
  const unidades = unidadesDisponibles(stock);
  const comprable = vista.disponible;

  function handleAdd() {
    if (!comprable) return;
    setAdding(true);
    const ok = agregarProducto({
      productoId: id, nombre, precio: precioVenta, imagen, slug, medida, unidad, stock: unidades,
    });
    setAdding(false);
    if (ok) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  }

    // "100 x 100 x 5.0 MM" → "100 × 100 × 5,0 mm": más fácil de leer de un golpe.
  const medidaTexto = medida
    ? medida.replace(/(\d)\s*[xX]\s*(?=\d)/g, '$1\u2009×\u2009').replace(/(\d)\.(\d)/g, '$1,$2').replace(/\b(MM|CM|MTS?|KG|LTS?)\b/g, (u) => u.toLowerCase())
    : null;

  /* Jerarquía de la tarjeta (de arriba a abajo, de más a menos peso):
       1. Precio: lo más grande y oscuro. Es lo que se compara entre tarjetas.
       2. Nombre + medida: el nombre en medio tono y la medida en negrita
          justo debajo. En perfiles y fierros la medida es lo único que
          distingue una tarjeta de la siguiente ("Ángulo doblado negro" ×3).
       3. Metadatos en UNA línea gris chica: IVA y stock.
     Antes la medida iba en una franja negra sobre la foto y el botón era otro
     bloque negro: dos manchas oscuras por tarjeta compitiendo con el precio,
     más una línea divisoria y dos rótulos en mayúscula chica. */
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden group transition-[border-color,box-shadow] duration-150 ease-out [@media(hover:hover)]:hover:border-gray-300 [@media(hover:hover)]:hover:shadow-[0_8px_24px_-14px_rgba(12,29,58,0.3)] flex flex-col h-full relative">
      <Link href={`/producto/${slug}`} className="block" aria-label={`Ver detalles de ${nombre}${medida ? ` - ${medida}` : ''}`}>
        <div className="aspect-square bg-white relative overflow-hidden p-4">
          {displayImage ? (
            <Image
              src={displayImage}
              alt={`Producto ${nombre}${medida ? ` ${medida}` : ''} disponible en Barraca JURMAQ`}
              className={`w-full h-full object-contain transition-transform duration-300 ease-out [@media(hover:hover)]:group-hover:scale-[1.03] ${comprable ? "" : "opacity-50 grayscale"}`}
              width={400}
              height={300}
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              onError={() => { if (!imgError) setImgError(true); }}
            />
          ) : (
            /* Sin foto, la medida es la imagen: un bloque gris claro con la
               medida grande. Gris y no negro, para que la grilla no se llene
               de manchas oscuras que compiten con el precio. */
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

          {/* Una sola etiqueta, arriba a la izquierda. El rojo queda reservado
              para la oferta; "Nuevo" va en navy. */}
          {muestraOferta ? (
            <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md text-xs font-bold bg-marca-600 text-white tabular-nums">
              −{pctOferta}%
            </span>
          ) : isNew ? (
            <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md text-xs font-semibold bg-navy-950 text-white">
              Nuevo
            </span>
          ) : null}
        </div>
      </Link>

      <div className="px-4 pb-4 pt-1 flex flex-col flex-grow">
        <Link href={`/producto/${slug}`} className="block">
          {/* Marca arriba del nombre, como en la etiqueta de repisa. Sólo si el
              producto tiene una (ver src/lib/marcas.ts). */}
          {marca && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-marca-700 mb-1">
              {marca}
            </p>
          )}
          <h3 className="text-sm text-gray-600 leading-snug line-clamp-2 group-hover:text-navy-950 transition-colors duration-150">
            {titleCase(medida ? nombreSinMedida : nombre)}
          </h3>
          {medidaTexto && (
            <p className="mt-0.5 text-sm sm:text-[15px] font-semibold text-navy-950 leading-snug tabular-nums">
              {medidaTexto}
            </p>
          )}
          {rating && rating > 0 && (
            <div className="mt-1.5">
              <StarRating value={rating} size="sm" count={rating_count} />
            </div>
          )}
        </Link>

        {/* Precio + metadatos, empujados al pie para que las tarjetas de una
            fila alineen precio con precio. */}
        <div className="mt-auto pt-4">
          <Precio vista={vista} unidad={unidad} />
          {comprable && (
            /* En celular la tarjeta mide ~150 px y "IVA incluido" partía la
               línea en dos; ahí queda sólo el stock. */
            <p className="mt-1.5 text-xs text-gray-500 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
              <span className="hidden sm:inline">IVA incluido · </span>
              {unidades <= 5 ? <span className="font-semibold text-amber-700">Quedan {unidades}</span> : `${unidades} en stock`}
            </p>
          )}

          {/* Una sola acción por tarjeta. Navy y no naranja: en una grilla de
              24 tarjetas, 24 botones naranjos competirían con "Ir a pagar",
              que es el único naranjo de la compra. Sin stock, el botón
              desaparece: la línea de arriba ya lo dice en rojo y un botón
              gris muerto sólo agregaba peso. */}
          {comprable ? (
            <button
              onClick={handleAdd}
              disabled={adding}
              aria-label={added ? `${nombre} agregado al carrito` : `Agregar ${nombre} al carrito`}
              className={`mt-3 w-full flex items-center justify-center gap-2 px-3 min-h-[44px] text-sm font-semibold rounded-lg transition-colors duration-150 [&:active]:transform-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy-950 ${
                added ? "bg-green-700 text-white" : "bg-navy-950 text-white hover:bg-navy-800 active:bg-navy-900"
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
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
                  </svg>
                  <span className="sm:hidden">Agregar</span>
                  <span className="hidden sm:inline">Agregar al carrito</span>
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
