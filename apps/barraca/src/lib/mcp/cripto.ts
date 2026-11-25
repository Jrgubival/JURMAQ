/**
 * Cripto mínima del MCP, solo con WebCrypto (sin dependencias): números al
 * azar, SHA-256, PKCE S256, HMAC y comparación de tiempo constante.
 * Los tokens son opacos (al azar) y en la base solo vive su hash.
 */
import { sha256Hex } from "../gestion/util.ts";

export { sha256Hex };

const enc = new TextEncoder();

export function aBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deBase64Url(texto: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(texto)) return null;
  const b64 = texto.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (texto.length % 4)) % 4);
  try {
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Secreto al azar (CSPRNG), en base64url. 32 bytes = 256 bits. */
export function secretoAleatorio(bytes = 32): string {
  return aBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Comparación de tiempo constante (el largo sí se filtra; los valores comparados tienen largo fijo). */
export function igualesSeguro(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** PKCE: BASE64URL(SHA256(verifier)). */
export async function desafioS256(verificador: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(verificador));
  return aBase64Url(new Uint8Array(d));
}

/** El verificador cumple RFC 7636: 43 a 128 caracteres del alfabeto sin reservados. */
export function verificadorValido(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9\-._~]{43,128}$/.test(v);
}

/** El desafío S256 tiene la forma de un SHA-256 en base64url (43 caracteres). */
export function desafioValido(c: unknown): c is string {
  return typeof c === "string" && /^[A-Za-z0-9_-]{43}$/.test(c);
}

export async function pkceCoincide(verificador: string, desafio: string): Promise<boolean> {
  if (!verificadorValido(verificador) || !desafioValido(desafio)) return false;
  return igualesSeguro(await desafioS256(verificador), desafio);
}

async function claveHmac(secreto: string, uso: string): Promise<CryptoKey> {
  // Subclave por uso: la firma de una pantalla no sirve en otra.
  const base = await crypto.subtle.importKey("raw", enc.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sub = await crypto.subtle.sign("HMAC", base, enc.encode(`jurmaq-mcp:${uso}`));
  return crypto.subtle.importKey("raw", sub, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function firmarHmac(secreto: string, uso: string, datos: string): Promise<string> {
  const k = await claveHmac(secreto, uso);
  return aBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(datos))));
}

export async function verificarHmac(secreto: string, uso: string, datos: string, firma: string): Promise<boolean> {
  const esperada = await firmarHmac(secreto, uso, datos);
  return igualesSeguro(esperada, firma);
}

/**
 * Paquete firmado: base64url(JSON).firma. Lleva su vencimiento (`exp`, ms).
 * Sirve de CSRF y de integridad de los parámetros en las pantallas.
 */
export async function empaquetarFirmado(secreto: string, uso: string, carga: Record<string, unknown>): Promise<string> {
  const cuerpo = aBase64Url(enc.encode(JSON.stringify(carga)));
  return `${cuerpo}.${await firmarHmac(secreto, uso, cuerpo)}`;
}

export async function abrirFirmado<T extends { exp?: number }>(
  secreto: string, uso: string, paquete: unknown, ahora: number,
): Promise<T | null> {
  if (typeof paquete !== "string" || paquete.length > 4096) return null;
  const [cuerpo, firma, resto] = paquete.split(".");
  if (!cuerpo || !firma || resto !== undefined) return null;
  if (!(await verificarHmac(secreto, uso, cuerpo, firma))) return null;
  const bytes = deBase64Url(cuerpo);
  if (!bytes) return null;
  try {
    const carga = JSON.parse(new TextDecoder().decode(bytes)) as T;
    if (typeof carga.exp !== "number" || carga.exp < ahora) return null;
    return carga;
  } catch {
    return null;
  }
}
