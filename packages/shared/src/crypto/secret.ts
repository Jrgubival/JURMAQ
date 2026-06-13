import 'server-only';
import crypto from 'crypto';

/**
 * Comparación de secretos en tiempo constante (anti timing-attack).
 *
 * SECURITY (audit jun-2026): comparar un secreto con `===` filtra, vía el
 * tiempo de respuesta, cuántos bytes iniciales coinciden — en teoría permite
 * recuperar el secreto byte a byte. Hasheamos ambos lados a SHA-256 (32 bytes
 * fijos) antes de `timingSafeEqual` para que la comparación sea de longitud
 * constante sin importar el largo de las entradas (evita el throw de
 * timingSafeEqual con buffers de distinto largo y no filtra la longitud).
 *
 * Devuelve false si alguno no es string (p. ej. header ausente → undefined).
 */
export function safeSecretEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
