/**
 * Pantalla de autorización: paquete firmado (CSRF + integridad de parámetros)
 * y armado de la dirección de retorno. Puro y probable sin Next.
 *
 * El paquete va en un campo oculto del formulario: lleva todo lo que se vio en
 * la pantalla, atado al usuario que tenía la sesión y con vencimiento. Un
 * sitio externo no puede fabricarlo (no tiene la clave) ni reusar el de otra
 * persona (el uid no coincide).
 */
import { abrirFirmado, empaquetarFirmado } from "./cripto.ts";
import { TTL_SOLICITUD_MS, baseCanonica } from "./config.ts";
import type { SolicitudAutorizacion } from "./oauth.ts";

const USO = "autorizar-v1";

interface CargaSolicitud {
  cid: string; ru: string; cc: string; st: string | null; sc: string; rs: string; uid: string; exp: number;
}

export async function firmarSolicitud(secreto: string, s: SolicitudAutorizacion, usuarioId: string, ahora: number = Date.now()): Promise<string> {
  const carga: CargaSolicitud = {
    cid: s.cliente.id, ru: s.redirectUri, cc: s.codeChallenge, st: s.state, sc: s.scope, rs: s.resource, uid: usuarioId, exp: ahora + TTL_SOLICITUD_MS,
  };
  return empaquetarFirmado(secreto, USO, { ...carga, n: crypto.randomUUID() });
}

/** Abre el paquete: null si la firma, el vencimiento o el usuario no coinciden. */
export async function abrirSolicitud(
  secreto: string, paquete: unknown, usuarioId: string, ahora: number = Date.now(),
): Promise<Record<"cliente_id" | "redirect_uri" | "code_challenge" | "scope" | "resource", string> & { state: string | null } | null> {
  const c = await abrirFirmado<CargaSolicitud>(secreto, USO, paquete, ahora);
  if (!c || c.uid !== usuarioId) return null;
  return { cliente_id: c.cid, redirect_uri: c.ru, code_challenge: c.cc, state: c.st, scope: c.sc, resource: c.rs };
}

/** redirect_uri + parámetros (code/state/iss o error). Nunca pone nada que no sea de OAuth. */
export function urlRetorno(redirectUri: string, parametros: Record<string, string | null | undefined>, base: string = baseCanonica()): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(parametros)) if (v) u.searchParams.set(k, v);
  u.searchParams.set("iss", base);
  return u.toString();
}
