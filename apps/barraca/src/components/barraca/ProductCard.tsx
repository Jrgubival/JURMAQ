"use client";

import Link from "@/components/barraca/Enlace";
import Image from "next/image";
import { useState } from "react";
import { titleCase } from "@jurmaq/shared/format";
import { formatCLP } from "@jurmaq/shared/format";
import { agregarProducto } from "@/lib/agregar";
import { esComprable, tienePrecio, unidadesDisponibles } from "@/lib/stock";
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

  // Precio que se cobra: en oferta, el menor de los dos (mismo criterio que
  // resolvePrice en lib/pricing.ts y que el servidor al armar el pedido).
  const precioVenta = en_oferta && precio_original && precio_original > 0 ? Math.min(precio, precio_original) : precio;
  const unidades = unidadesDisponibles(stock);
  const comprable = esComprable({ precio: precioVenta, stock, solo_cotizar });

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

  // Unit display helper
  const unitLabel = unidad ? `/${unidad}` : '';

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden group transition-[transform,border-color,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:border-navy-950 hover:shadow-[0_2px_0_0_rgb(12,29,58)] flex flex-col h-full relative">
      <Link href={`/producto/${slug}`} className="block" aria-label={`Ver detalles de ${nombre}${medida ? ` - ${medida}` : ''}`}>
        <div className="aspect-square bg-white relative overflow-hidden p-3">
          {displayImage ? (
            <Image
              src={displayImage}
              alt={`Producto ${nombre}${medida ? ` ${medida}` : ''} disponible en Barraca JURMAQ`}
              className="w-full h-full object-contain"
              width={400}
              height={300}
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              onError={() => { if (!imgError) setImgError(true); }}
            />
          ) : (
            /* Sin foto, la medida ES la imagen. Antes acá iba un ícono de caja
               gris, igual en cientos de tarjetas. Un bloque oscuro con la
               medida en blanco dice cuánto mide la pieza, que es lo único que
               distingue una variante de la siguiente. */
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#1A1C1E] px-4 text-center">
              {medida ? (
                <>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-white/45 mb-1.5">
                    {titleCase(nombreSinMedida).slice(0, 28)}
                  </span>
                  <span className="font-[var(--font-heading)] text-[26px] leading-none font-medium text-white tabular-nums">
                    {medida}
                  </span>
                </>
              ) : (
                <span className="text-xs uppercase tracking-[0.18em] text-white/40">Sin foto</span>
              )}
            </div>
          )}

          {/* Con foto: la medida como franja al pie. Las fotos de perfiles son
              todas iguales entre sí; la medida es lo que distingue tres ángulos
              seguidos, y antes eran indistinguibles. */}
          {displayImage && medida && (
            <span className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-[rgba(26,28,30,0.92)] text-white font-[var(--font-heading)] text-[13px] leading-tight tabular-nums">
              {medida}
            </span>
          )}

          {/* Etiqueta única, arriba a la izquierda.
              Antes había hasta SEIS colores saturados en una tarjeta de 250 px:
              azul "Nuevo", rojo "Oferta", rojo claro "−X%", verde "En stock",
              ámbar "Pocas unid." con un punto parpadeando, y gris "Cotizable".
              Ninguna barraca real imprime etiquetas de seis colores; eso es lo
              que hacía que el catálogo se leyera como plantilla.

              Ahora una sola, y el rojo queda reservado EXCLUSIVAMENTE para
              oferta: si todo es rojo, nada destaca. El stock baja a dato
              tipográfico junto al precio, que es donde el comprador lo busca. */}
          {en_oferta && precio_original && precio_original > 0 && precio < precio_original && (
            <span className="absolute top-0 left-0 px-2 py-1 text-[10px] font-bold tracking-wider uppercase bg-marca-600 text-white tabular-nums">
              −{Math.round((1 - precio / precio_original) * 100)}%
            </span>
          )}
          {!en_oferta && isNew && (
            <span className="absolute top-0 left-0 px-2 py-1 text-[10px] font-bold tracking-wider uppercase bg-navy-950 text-white">
              Nuevo
            </span>
          )}
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-grow">
        <Link href={`/producto/${slug}`} className="block flex-grow min-h-0">
          {/* Marca arriba del nombre, como en la etiqueta de repisa: es lo
              primero que busca quien ya sabe qué marca quiere. Sólo aparece
              cuando el producto realmente tiene una — el 78% del catálogo es
              fierro y fijación sin marca, y rotularlo "Genérico" lo haría ver
              peor de lo que es. Ver src/lib/marcas.ts. */}
          {marca && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-marca-700 mb-0.5">
              {marca}
            </p>
          )}
          {/* El nombre del maestro trae la medida dentro ("Angulo Doblado
              Negro 100 x 100 x 3.0 MM"); con la placa al pie de la foto se
              leía dos veces en 250px. El aria-label del enlace conserva ambas. */}
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1 group-hover:text-marca-600 transition-colors duration-150 leading-tight">
            {titleCase(medida ? nombreSinMedida : nombre)}
          </h3>
          {/* Tier 4 D2: rating si hay reviews aprobadas */}
          {rating && rating > 0 && (
            <div className="mb-1">
              <StarRating value={rating} size="sm" count={rating_count} />
            </div>
          )}
        </Link>

        {/* Stock como DATO, no como alarma.
            Antes eran dos bloques de urgencia —rojo con ícono de triángulo
            para ≤5, ámbar para <10— más el badge verde/ámbar/gris sobre la
            foto. Tres formas de decir lo mismo, dos de ellas gritando. Un
            comprador de fierros lee "12 un." igual de bien, y el rojo queda
            libre para lo único que de verdad debe destacar: la oferta. */}
        {tienePrecio({ precio: precioVenta, stock, solo_cotizar }) && (
          unidades > 0 ? (
            <p className="text-xs text-gray-500 mb-2 tabular-nums">En stock · {unidades} un.</p>
          ) : (
            <p className="text-xs font-semibold text-[#9C2B1F] mb-2">Sin stock</p>
          )
        )}

        {/* Precio: lo que se paga al comprar. En oferta, el tachado es el
            precio normal y el grande el de oferta. */}
        <div className="mt-auto pt-3 border-t border-gray-200">
          <div className="mb-3">
            {solo_cotizar ? (
              <p className="text-base font-bold text-navy-950">
                Consultar precio
              </p>
            ) : en_oferta && precio_original && precio_original > 0 ? (
              /* El menor de los dos es el que se cobra: los escritores de la DB
                 no coinciden en cuál campo guarda el precio con descuento, así
                 que decidir por valor es lo único que no se puede invertir.
                 Mismo criterio que resolvePrice/getCartPrice en lib/pricing.ts. */
              <div>
                <p className="text-xs text-gray-500 leading-none tabular-nums mb-0.5">
                  Antes <span className="line-through">{formatCLP(Math.max(precio, precio_original))}</span>
                </p>
                <p className="text-[22px] font-extrabold text-navy-950 leading-none tabular-nums">
                  {formatCLP(Math.min(precio, precio_original))}
                  <span className="text-xs text-gray-500 font-medium ml-0.5">{unitLabel}</span>
                </p>
                <p className="text-[10px] text-gray-500 tracking-wide uppercase mt-0.5">Precio oferta · IVA incl.</p>
              </div>
            ) : (
              <>
                <p className="text-[22px] font-extrabold text-navy-950 leading-none tabular-nums">
                  {formatCLP(precio)}
                  <span className="text-xs text-gray-500 font-medium ml-0.5">{unitLabel}</span>
                </p>
                {precio > 0 && (
                  <p className="text-[10px] text-gray-500 tracking-wide uppercase mt-0.5">IVA incluido</p>
                )}
              </>
            )}
          </div>

          {/* Una sola acción por tarjeta. Navy y no naranja: en una grilla de
              24 tarjetas, 24 botones naranjos competirían con "Ir a pagar",
              que es el único naranjo de la compra. */}
          {comprable ? (
            <button
              onClick={handleAdd}
              disabled={adding}
              aria-label={added ? `${nombre} agregado al carrito` : `Agregar ${nombre} al carrito`}
              className={`w-full flex items-center justify-center gap-1.5 px-3 min-h-[44px] text-sm font-semibold leading-tight rounded-lg transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy-950 ${
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
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                  </svg>
                  <span>Agregar al carrito</span>
                </>
              )}
            </button>
          ) : (
            <Link
              href={`/producto/${slug}`}
              className="w-full flex items-center justify-center px-3 min-h-[44px] text-sm font-medium text-gray-500 bg-gray-100 rounded-lg"
              aria-label={`${nombre}: ${unidades > 0 ? 'consultar precio' : 'sin stock'}`}
            >
              {tienePrecio({ precio: precioVenta, stock, solo_cotizar }) ? 'Sin stock' : 'Ver producto'}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
