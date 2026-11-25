import "server-only";
/**
 * API de servidor del contenido editable, para las herramientas del MCP y el
 * panel. Cada función abre la D1 de gestión (usarGestion), hace la operación y,
 * si cambió lo que ve la tienda, regenera las páginas afectadas.
 *
 * Quien llama debe haber comprobado ANTES el permiso del usuario (sesión + rol
 * revalidado contra la base) y pasar `usuario` desde esa sesión, nunca del
 * texto del usuario. Todas lanzan GestionNoDisponibleError (esGestionNoDisponible)
 * si la D1 no está lista; las demás devuelven resultados tipados.
 * Documentado en docs/MCP-NOTAS.md ("Contenido editable").
 */
import { revalidatePath } from "next/cache";
import { usarGestion } from "../gestion/d1.ts";
import {
  aprobarPendiente,
  descartarBorrador,
  guardarBorrador,
  listarContenidos,
  listarPendientes,
  listarVersiones,
  obtenerEstado,
  obtenerVersion,
  publicar,
  rechazarPendiente,
  restaurarVersion,
  type AprobacionDada,
  type ResultadoAprobar,
  type ResultadoRestaurar,
} from "./repositorio.ts";
import { invalidarLecturaContenido } from "./lectura.ts";
import { META_CONTENIDO, type ClaveContenido, type UsuarioContenido } from "./tipos.ts";
import { validarContenido } from "./esquemas.ts";
import { verificarReferenciasPortada } from "./referencias.ts";
import { buscadorSupabase } from "./referencias-supabase.ts";
import { subirImagenBase64, subirImagenUrl } from "./imagenes-supabase.ts";
import { registrarCambio } from "../gestion/auditoria.ts";
import { ImagenError } from "./imagenes.ts";

/** Regenera lo que ve el público de este contenido. Nunca lanza. */
export function revalidarContenido(clave: ClaveContenido): void {
  invalidarLecturaContenido();
  try {
    for (const p of META_CONTENIDO[clave].paginas) revalidatePath(p.ruta, p.tipo);
  } catch (e) {
    console.warn("[contenido] no se pudo revalidar", clave, e instanceof Error ? e.message : "");
  }
}

export const contenidoListar = () => usarGestion((db) => listarContenidos(db));
export const contenidoObtener = <K extends ClaveContenido>(clave: K) => usarGestion((db) => obtenerEstado(db, clave));
export const contenidoVersiones = (clave: ClaveContenido, limite?: number) => usarGestion((db) => listarVersiones(db, clave, limite));
export const contenidoVerVersion = <K extends ClaveContenido>(clave: K, version: number) => usarGestion((db) => obtenerVersion(db, clave, version));
export const contenidoPendientes = () => usarGestion((db) => listarPendientes(db));

/** Valida sin guardar (para mostrar errores o armar una vista previa). */
export function contenidoValidar<K extends ClaveContenido>(clave: K, valor: unknown) {
  return validarContenido(clave, valor);
}

export const contenidoGuardarBorrador = (clave: ClaveContenido, valor: unknown, usuario: UsuarioContenido) =>
  usarGestion((db) => guardarBorrador(db, { clave, valor, usuario }));

export const contenidoDescartarBorrador = (clave: ClaveContenido, usuario: UsuarioContenido) =>
  usarGestion((db) => descartarBorrador(db, { clave, usuario }));

/**
 * Publica el borrador. Términos y privacidad quedan "pendiente" mientras no se
 * pase `aprobacion` (la entrega el servicio de aprobaciones tras el OK de Jorge).
 * Si además la portada trae productos o categorías, se comprueba que existan.
 */
export async function contenidoPublicar(args: { clave: ClaveContenido; usuario: UsuarioContenido; nota?: string; valor?: unknown; aprobacion?: AprobacionDada }) {
  if (args.clave === "portada") {
    const crudo = args.valor ?? (await contenidoObtener("portada")).borrador;
    const v = validarContenido("portada", crudo);
    if (v.ok) {
      const refs = await verificarReferenciasPortada(v.valor, buscadorSupabase);
      if (!refs.ok) {
        return {
          ok: false as const,
          motivo: "referencias" as const,
          errores: [
            ...refs.productosFaltantes.map((c) => `No existe un producto activo con el código "${c}".`),
            ...refs.categoriasFaltantes.map((s) => `No existe una categoría activa con el slug "${s}".`),
          ],
        };
      }
    }
  }
  const r = await usarGestion((db) => publicar(db, args));
  if (r.ok && r.estado === "publicada") revalidarContenido(args.clave);
  return r;
}

export async function contenidoRestaurar(args: {
  clave: ClaveContenido;
  version: number;
  usuario: UsuarioContenido;
  destino: "borrador" | "publicado";
  nota?: string;
  aprobacion?: AprobacionDada;
}): Promise<ResultadoRestaurar> {
  const r = await usarGestion((db) => restaurarVersion(db, args));
  if (r.ok && r.estado === "publicada") revalidarContenido(args.clave);
  return r;
}

/** Para el servicio de aprobaciones: Jorge aprobó la versión pendiente. */
export async function contenidoAprobarPendiente(args: { clave: ClaveContenido; version: number; aprobadoPor: string; referencia?: string }): Promise<ResultadoAprobar> {
  const r = await usarGestion((db) => aprobarPendiente(db, args));
  if (r.ok) revalidarContenido(args.clave);
  return r;
}

export const contenidoRechazarPendiente = (args: { clave: ClaveContenido; version: number; rechazadoPor: string }) =>
  usarGestion((db) => rechazarPendiente(db, args));

/** Verifica que los códigos y slugs de una portada existan (sin guardar nada). */
export async function contenidoVerificarPortada(valor: unknown) {
  const v = validarContenido("portada", valor);
  if (!v.ok) return { valida: false as const, errores: v.errores };
  const refs = await verificarReferenciasPortada(v.valor, buscadorSupabase);
  return { valida: true as const, ...refs };
}

/** Sube una imagen (base64 o URL https pública) a barraca-redes/tienda/ y la deja en la auditoría. */
export async function contenidoSubirImagen(
  origen: { base64: string } | { url: string },
  usuario: UsuarioContenido,
): Promise<{ ok: true; url: string; bytes: number; mime: string } | { ok: false; codigo: string; mensaje: string }> {
  try {
    const r = "base64" in origen ? await subirImagenBase64(origen.base64) : await subirImagenUrl(origen.url);
    try {
      await usarGestion((db) => registrarCambio(db, usuario, { herramienta: "contenido.subir_imagen", entidad: "imagen", entidadId: r.ruta, despues: { bytes: r.bytes, mime: r.mime } }));
    } catch {
      /* la auditoría no debe perder una subida ya hecha */
    }
    return { ok: true, url: r.url, bytes: r.bytes, mime: r.mime };
  } catch (e) {
    if (e instanceof ImagenError) return { ok: false, codigo: e.codigo, mensaje: e.message };
    return { ok: false, codigo: "interno", mensaje: "No se pudo subir la imagen." };
  }
}
