/**
 * Direcciones de retorno (redirect_uri) permitidas. Lista blanca cerrada:
 * - Apps de Claude: la URL oficial exacta (claude.ai y claude.com).
 * - Claude Code: bucle local (http://127.0.0.1, http://localhost o [::1]) con
 *   cualquier puerto y solo la ruta /callback (RFC 8252). Sin query, sin
 *   fragmento, sin usuario/clave.
 * Cualquier otra cosa se rechaza al registrar y al autorizar.
 */
import { REDIRECTS_CLAUDE } from "./config.ts";

const HOSTS_LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
const RUTA_LOOPBACK = "/callback";

function parsear(uri: string): URL | null {
  if (typeof uri !== "string" || uri.length > 300 || /[\u0000-\u001f\s\\]/.test(uri)) return null;
  try {
    const u = new URL(uri);
    if (u.username || u.password || u.hash || u.search) return null;
    return u;
  } catch {
    return null;
  }
}

export function esLoopback(uri: string): boolean {
  const u = parsear(uri);
  return !!u && u.protocol === "http:" && HOSTS_LOOPBACK.has(u.hostname) && u.pathname === RUTA_LOOPBACK;
}

export function esRedirectPermitida(uri: string): boolean {
  if (REDIRECTS_CLAUDE.includes(uri)) return true;
  return esLoopback(uri);
}

/**
 * ¿La redirect pedida coincide con una registrada? Exacta, salvo bucle local:
 * ahí el puerto se ignora (cambia en cada sesión de Claude Code) pero deben
 * coincidir host y ruta.
 */
export function redirectCoincide(registrada: string, solicitada: string): boolean {
  if (registrada === solicitada) return esRedirectPermitida(solicitada);
  if (!esLoopback(registrada) || !esLoopback(solicitada)) return false;
  const a = new URL(registrada);
  const b = new URL(solicitada);
  return a.hostname === b.hostname && a.pathname === b.pathname;
}

/** Host para mostrar en la pantalla de autorización (quién pide el permiso). */
export function hostDeRedirect(uri: string): string {
  const u = parsear(uri);
  return u ? u.host : "desconocido";
}
