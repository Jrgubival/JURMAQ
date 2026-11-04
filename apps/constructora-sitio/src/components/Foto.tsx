import { preload } from "react-dom";
import medidas from "@/data/fotos.json";
import type { FotoObra } from "@/data/obras";

/**
 * Foto de obra en WebP con dos anchos. La miniatura de fondo evita el cuadro
 * vacío mientras carga, y el alto reservado evita saltos de página.
 */
/** Anchos de las variantes grandes de una foto, si existen. */
export function anchosGrandes(nombre: FotoObra["nombre"]): number[] {
  return (medidas[nombre] as { alta?: number[] }).alta ?? [];
}

/** Ancho máximo disponible: bajo 1600 px, una foto a todo ancho se ve granulada. */
export function anchoMaximo(nombre: FotoObra["nombre"]): number {
  return Math.max(medidas[nombre].w, ...anchosGrandes(nombre));
}

export default function Foto({
  foto,
  sizes,
  prioridad = false,
  className,
}: {
  foto: FotoObra;
  sizes: string;
  prioridad?: boolean;
  className?: string;
}) {
  const { w, h, lqip } = medidas[foto.nombre];
  const base = `/obras/${foto.nombre}`;
  // Variantes grandes (960, 1600, 2400 o el ancho real del original) para fotos a todo ancho.
  // El archivo lleva el tamaño pedido (960, 1600 o 2400); su ancho real puede ser menor.
  const grandes = anchosGrandes(foto.nombre).map((a) => `${base}-${[960, 1600, 2400].find((t) => a <= t) ?? 2400}.webp ${a}w`);
  const srcSet = [`${base}-640.webp ${Math.min(w, 640)}w`, `${base}-1280.webp ${w}w`, ...grandes].join(", ");
  if (prioridad) preload(`${base}-1280.webp`, { as: "image", imageSrcSet: srcSet, imageSizes: sizes, fetchPriority: "high" });
  return (
    <img
      className={className}
      src={`${base}-1280.webp`}
      srcSet={srcSet}
      sizes={sizes}
      width={w}
      height={h}
      alt={foto.alt}
      loading={prioridad ? "eager" : "lazy"}
      fetchPriority={prioridad ? "high" : undefined}
      decoding={prioridad ? "sync" : "async"}
      style={{ backgroundImage: `url(${lqip})`, backgroundSize: "cover" }}
    />
  );
}
