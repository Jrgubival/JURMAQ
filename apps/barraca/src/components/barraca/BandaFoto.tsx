import Image from "next/image";

/**
 * Banda de foto propia, a sangre, entre secciones.
 *
 * Tres fotos del local llevaban meses en el repo sin usarse y son lo mejor que
 * hay: el mesón con el letrero interior y la línea amarilla del piso, los
 * ángulos con la medida escrita a plumón sobre el fierro, y el camión propio
 * cargado dentro del galpón.
 *
 * Van sin scrim y sin grano. El filtro `hero-grain` existía —según su propio
 * comentario— para que las fotos de stock se vieran menos genéricas; con fotos
 * propias sobra y sólo ensucia.
 *
 * El rótulo va en una barra navy al pie, como el pie de un letrero, y no
 * flotando sobre la imagen: así se lee igual de bien sea cual sea la foto y no
 * hay que oscurecerla para que el texto contraste.
 */
export default function BandaFoto({
  src,
  alt,
  rotulo,
  posicion = "center",
}: {
  src: string;
  alt: string;
  rotulo: string;
  /** Qué parte de la foto se conserva al recortar a 180px de alto. */
  posicion?: "top" | "center" | "bottom";
}) {
  return (
    <section aria-label={rotulo} className="relative">
      <div className="relative h-[150px] sm:h-[180px] overflow-hidden bg-[var(--color-acero)]">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: `center ${posicion}` }}
        />
      </div>
      <div className="bg-navy-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="cifra h-7 flex items-center text-[11px] uppercase tracking-[0.14em] text-white/85">
            {rotulo}
          </p>
        </div>
      </div>
    </section>
  );
}
