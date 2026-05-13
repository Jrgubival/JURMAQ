/**
 * Logging utilities con masking de PII.
 *
 * Audit 1D H1 (Ley 21.719): emails e IPs no deben ir cleartext a logs
 * porque Vercel/Datadog/etc. los persisten. Las funciones acá enmascaran
 * los valores manteniendo suficiente info para debug.
 *
 * Uso:
 *   import { maskEmail, maskIp, redactPII } from '@jurmaq/shared/logging';
 *   console.log('[admin-login-ok]', { user: user.id, email: maskEmail(email), ip: maskIp(ip) });
 *
 * En producción se puede reemplazar console por structlog/pino sin tocar callers.
 */

/**
 * Enmascara un email: "jorge@example.com" → "jo***@example.com".
 * Mantiene los 2 primeros chars y el dominio para identificar el usuario sin exponerlo.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '<no-email>';
  const trimmed = email.trim();
  const atIdx = trimmed.indexOf('@');
  if (atIdx === -1) return '<invalid-email>';
  const local = trimmed.substring(0, atIdx);
  const domain = trimmed.substring(atIdx);
  if (local.length <= 2) return `${local}***${domain}`;
  return `${local.substring(0, 2)}***${domain}`;
}

/**
 * Enmascara una IP: "192.168.1.42" → "192.168.*.*", "2001:db8::1" → "2001:db8::***".
 * Mantiene los primeros 2 octetos/segmentos para identificar zona/ISP sin localizar el host.
 */
export function maskIp(ip: string | null | undefined): string {
  if (!ip || typeof ip !== 'string') return '<no-ip>';
  const trimmed = ip.trim();
  if (trimmed === 'unknown' || trimmed === '') return trimmed || '<empty>';

  // IPv4
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`;
    }
  }

  // IPv6
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}:***`;
    }
  }

  // Unknown format
  return '<masked>';
}

/**
 * Enmascara un RUT chileno: "12345678-9" → "12.***.***-9". Mantiene el dígito
 * verificador (para debug) y los primeros 2 chars (rango de edad/categoría).
 */
export function maskRut(rut: string | null | undefined): string {
  if (!rut || typeof rut !== 'string') return '<no-rut>';
  const cleaned = rut.replace(/[.\-]/g, '').toUpperCase();
  if (cleaned.length < 2) return '<invalid-rut>';
  const dv = cleaned.slice(-1);
  const body = cleaned.slice(0, -1);
  if (body.length <= 2) return `${body}***-${dv}`;
  return `${body.substring(0, 2)}***-${dv}`;
}

/**
 * Enmascara un teléfono: "+56912345678" → "+569****5678".
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '<no-phone>';
  const cleaned = phone.replace(/\s+/g, '');
  if (cleaned.length < 6) return '<invalid-phone>';
  if (cleaned.length <= 8) return `${cleaned.substring(0, 3)}***`;
  return `${cleaned.substring(0, 4)}****${cleaned.slice(-4)}`;
}

/**
 * Helper para redactar un objeto entero. Aplica masks a campos comunes de PII.
 *
 *   redactPII({ email, ip, user_id, rut }) →
 *     { email: 'jo***@x.com', ip: '192.168.*.*', user_id: 42, rut: '12***-3' }
 */
export function redactPII<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = k.toLowerCase();
    if (typeof v === 'string') {
      if (key === 'email' || key.endsWith('email')) {
        out[k] = maskEmail(v);
        continue;
      }
      if (key === 'ip' || key.endsWith('ip') || key === 'ip_address') {
        out[k] = maskIp(v);
        continue;
      }
      if (key === 'rut' || key.endsWith('rut')) {
        out[k] = maskRut(v);
        continue;
      }
      if (key === 'phone' || key === 'telefono') {
        out[k] = maskPhone(v);
        continue;
      }
      if (key === 'password' || key === 'token' || key.includes('secret') || key.includes('apikey')) {
        out[k] = '<redacted>';
        continue;
      }
    }
    out[k] = v;
  }
  return out;
}

/**
 * Hash corto (sha256 primeros 8 chars) de un identificador interno — sincrónico.
 * Útil para correlar logs sin exponer IDs reales.
 *
 *   hid(contrato.id) → 'a1b2c3d4'
 *
 * Solo funciona en server (Node). En edge runtime usar `hashIdAsync` con
 * `crypto.subtle`.
 */
export function hid(id: string | number | null | undefined): string {
  if (id === null || id === undefined) return '<no-id>';
  const text = String(id);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require('node:crypto');
  return nodeCrypto.createHash('sha256').update(text).digest('hex').substring(0, 8);
}

/**
 * Versión async para edge runtime con `crypto.subtle`.
 */
export async function hashIdAsync(id: string | number): Promise<string> {
  const text = String(id);
  if (typeof globalThis.crypto !== 'undefined' && 'subtle' in globalThis.crypto) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const hex = Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return hex.substring(0, 8);
  }
  return hid(id);
}
