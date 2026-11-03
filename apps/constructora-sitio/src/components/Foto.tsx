import medidas from "@/data/fotos.json";
import type { FotoObra } from "@/data/obras";

/**
 * Foto de obra en WebP con dos anchos. La miniatura de fondo evita el cuadro
 * vacío mientras carga, y el alto reservado evita saltos de página.
 */
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
  return (
    <img
      className={className}
      src={`${base}-1280.webp`}
      srcSet={`${base}-640.webp ${Math.min(w, 640)}w, ${base}-1280.webp ${w}w`}
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
