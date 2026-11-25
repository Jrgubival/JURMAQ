import "server-only";
/**
 * Subida real de imágenes: Supabase Storage, bucket público `barraca-redes`,
 * carpeta tienda/ (es como se accede hoy a ese bucket: NO es un binding R2 de
 * Cloudflare; la tienda ya usa el service role del servidor). Si algún día se
 * pasa a un bucket R2, solo cambia `subirASupabase` por una función que use el
 * binding (env.IMAGENES_R2.put) y devuelva la URL pública: el resto (tipo,
 * tamaño, SSRF, nombre) no cambia.
 */
import { supabaseAdmin } from "@jurmaq/shared/supabase";
import { esUrlImagenPermitida } from "./markdown.ts";
import { ImagenError, subirImagenDesdeBase64, subirImagenDesdeUrl, type ImagenSubida } from "./imagenes.ts";

const BUCKET = "barraca-redes";

async function subirASupabase(ruta: string, bytes: Uint8Array, mime: string): Promise<string> {
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(ruta, bytes, { contentType: mime, cacheControl: "31536000", upsert: false });
  if (error) throw new ImagenError("subida", "No se pudo guardar la imagen.");
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(ruta);
  // La URL debe quedar dentro de lo que la tienda acepta como imagen propia.
  if (!esUrlImagenPermitida(data.publicUrl)) throw new ImagenError("bucket", "El bucket de imágenes no coincide con el configurado en la tienda.");
  return data.publicUrl;
}

export function subirImagenBase64(base64: string): Promise<ImagenSubida> {
  return subirImagenDesdeBase64(base64, { subir: subirASupabase });
}

export function subirImagenUrl(url: string): Promise<ImagenSubida> {
  return subirImagenDesdeUrl(url, { subir: subirASupabase });
}
