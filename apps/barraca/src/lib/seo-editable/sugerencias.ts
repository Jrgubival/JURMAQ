/**
 * Textos sugeridos (puros). Respetan los límites (título hasta 60, descripción hasta 160), no llevan
 * precios, reseñas ni plazos, y NO se aplican solos: `ver_seo` los muestra para que alguien los revise.
 */
import { DESCRIPCION_IDEAL, TITULO_IDEAL, type PaginaSeo } from "./reglas.ts";
import type { TextosMeta } from "./defecto.ts";

/** Corta en el último espacio antes de `max` (sin puntos suspensivos ni palabras a medias). */
export function recortarEnPalabra(texto: string, max: number): string {
  const t = texto.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max + 1);
  const espacio = corte.lastIndexOf(" ");
  return (espacio > max * 0.5 ? corte.slice(0, espacio) : t.slice(0, max)).replace(/[\s,;:·|\-–]+$/, "");
}

const MARCA = "Barraca JURMAQ";

/** Título con el nombre completo si cabe; si no, el nombre recortado y la marca. */
function tituloConMarca(nombre: string, sufijo: string): string {
  const completo = `${nombre}${sufijo}`;
  if (completo.length <= TITULO_IDEAL) return completo;
  return `${recortarEnPalabra(nombre, TITULO_IDEAL - sufijo.length)}${sufijo}`;
}

export function sugerirProducto(p: { nombre: string; codigo: string | null | undefined }): TextosMeta {
  const base = `${p.nombre} en ${MARCA}, Molina. Retiro en Molina y despacho en camión a Curicó, Talca y alrededores.`;
  const conCodigo = p.codigo ? `${base} Código: ${p.codigo}.` : base;
  return {
    titulo: tituloConMarca(p.nombre, ` · ${MARCA}`),
    descripcion: conCodigo.length <= DESCRIPCION_IDEAL ? conCodigo : recortarEnPalabra(base, DESCRIPCION_IDEAL),
  };
}

export function sugerirCategoria(c: { nombre: string }): TextosMeta {
  return {
    titulo: tituloConMarca(c.nombre, ` en Molina · ${MARCA}`),
    descripcion: recortarEnPalabra(`${c.nombre} en ${MARCA}, Molina. Retiro en Molina y despacho en camión a Curicó, Talca y alrededores.`, DESCRIPCION_IDEAL),
  };
}

/** Páginas: se sugiere el texto por defecto recortado a los límites (si ya cabe, es el mismo). */
export function sugerirPagina(_id: PaginaSeo, defecto: TextosMeta): TextosMeta {
  return {
    titulo: recortarEnPalabra(defecto.titulo, TITULO_IDEAL),
    descripcion: recortarEnPalabra(defecto.descripcion, DESCRIPCION_IDEAL),
  };
}
