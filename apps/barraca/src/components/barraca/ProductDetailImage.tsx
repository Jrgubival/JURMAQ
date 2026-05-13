"use client";

import { useState } from "react";

const categoryImages: Record<string, string> = {
  'fierros-construccion': '/images/barraca/categorias/fierro.jpg',
  'fijaciones': '/images/barraca/categorias/fijaciones.jpg',
  'herramientas-y-maq': '/images/barraca/categorias/herramientas.png',
  'pinturas': '/images/barraca/categorias/pinturas.webp',
  'perfiles-y-planchas': '/images/barraca/categorias/perfiles.webp',
  'electricidad-e-iluminacion': '/images/barraca/categorias/electricidad.png',
  'bano-cocina-y-loggia': '/images/barraca/categorias/Baño.jpg',
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

interface ProductDetailImageProps {
  imagen: string | null;
  nombre: string;
  categoriaSlug?: string;
}

export default function ProductDetailImage({ imagen, nombre, categoriaSlug }: ProductDetailImageProps) {
  const [imgError, setImgError] = useState(false);

  const fallback = categoriaSlug ? (categoryImages[categoriaSlug] || null) : null;
  // If imagen is a local category path, use it directly; otherwise fallback
  const resolvedImage = (!imagen)
    ? fallback
    : imagen.startsWith('/images/barraca/categorias/')
    ? imagen
    : imagen.startsWith('/images/barraca/')
    ? fallback
    : imagen;
  const src = imgError ? fallback : resolvedImage;

  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <svg className="w-32 h-32 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
    );
  }

  return (
    // LCP candidate en /producto/[slug] — fetchpriority="high" prioriza la
    // descarga vs lazy-loaded thumbnails y CSS background-images. El parent
    // div ya tiene aspect-square que reserva espacio (CLS OK).
    <img
      src={src}
      alt={nombre}
      className="w-full h-full object-contain p-4"
      fetchPriority="high"
      decoding="async"
      onError={() => { if (!imgError) setImgError(true); }}
    />
  );
}
