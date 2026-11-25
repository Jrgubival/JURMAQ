/**
 * Herramienta `subir_imagen`: sube una foto al almacenamiento público de la
 * tienda y devuelve su URL, para usarla en el popup, las láminas y la portada.
 * La subida real (tipo por contenido, tope 5 MB, defensa SSRF, nombre generado
 * por el servidor) vive en src/lib/contenido/imagenes*.ts.
 */
import { defineHerramienta, ErrorHerramienta, z, type Herramienta } from "./registro.ts";
import { usuarioDe } from "./contenido-comun.ts";

export type OrigenImagen = { base64: string } | { url: string };
export type ResultadoSubida = { ok: true; url: string; bytes: number; mime: string } | { ok: false; codigo: string; mensaje: string };

export interface DepsImagenes {
  subir(origen: OrigenImagen, usuario: { id: string; email?: string | null }): Promise<ResultadoSubida>;
}

export function depsImagenesReales(): DepsImagenes {
  return {
    async subir(origen, usuario) {
      const m = await import("../../contenido/servicio.ts");
      return m.contenidoSubirImagen(origen, usuario);
    },
  };
}

/** El servidor MCP rechaza pedidos de más de 128 KB: en base64 caben imágenes de ~90 KB. */
export const MAX_BASE64_CARACTERES = 120_000;

export function crearHerramientasImagenes(depsInyectadas?: Partial<DepsImagenes>): Herramienta[] {
  const deps = (): DepsImagenes => ({ ...depsImagenesReales(), ...depsInyectadas });
  const subir_imagen = defineHerramienta({
    nombre: "subir_imagen",
    titulo: "Subir una imagen a la tienda",
    descripcion:
    "Sube una imagen (JPG, PNG, WebP o GIF; sin SVG) y devuelve la URL pública para el popup, las láminas o la portada. Indica solo una forma: «url» (https público; hasta 5 MB; la preferible) o «base64» (el pedido completo no puede pasar de 128 KB: solo imágenes muy livianas). El tipo se verifica por el contenido real.",
    esquema: z.object({
      url: z.string().url().max(2000).refine((u) => u.startsWith("https://"), "Solo https.").optional().describe("Dirección https pública de la imagen."),
      base64: z.string().max(MAX_BASE64_CARACTERES).optional().describe("Imagen en base64 (sin el prefijo data:). Solo para imágenes livianas."),
    }),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ejecutar({ url, base64 }, ctx) {
      if ((url === undefined) === (base64 === undefined)) throw new ErrorHerramienta("Indica la imagen con «url» o con «base64», solo una de las dos.");
      const r = await deps().subir(url !== undefined ? { url } : { base64: base64 as string }, usuarioDe(ctx));
      if (!r.ok) throw new ErrorHerramienta(r.mensaje);
      return { texto: `Imagen subida (${Math.round(r.bytes / 1024)} KB, ${r.mime}). URL pública: ${r.url}`, datos: { url: r.url, bytes: r.bytes, mime: r.mime } };
    },
  });
  return [subir_imagen] as unknown as Herramienta[];
}
