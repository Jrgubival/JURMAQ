import 'server-only';
import { supabaseAdmin } from '@jurmaq/shared/supabase';

/** Storage bucket for fuel invoice attachments (private). */
export const COMBUSTIBLE_BUCKET = 'facturas-combustible';

/** Signed URL lifetime: 1 year (seconds). */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

/** Valid estados for a combustible factura. */
export const ALLOWED_ESTADOS = new Set([
  'registrada',
  'validada',
  'recuperada',
  'anulada',
]);

/** Valid tipos de combustible. */
export const ALLOWED_TIPOS_COMBUSTIBLE = new Set([
  'diesel',
  'gasolina_93',
  'gasolina_95',
  'gasolina_97',
  'kerosene',
  'otro',
]);

/** Valid tipos de documento tributario (alineado con DB check constraint). */
export const ALLOWED_TIPOS_DOCUMENTO = new Set([
  'factura_electronica',
  'boleta',
  'factura_exenta',
  'vale',
]);

/**
 * Create a signed URL for a stored factura file path.
 * Returns null on failure (invalid path, missing bucket, etc).
 * Safe to call with a null/empty path (returns null).
 */
export async function getSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path || typeof path !== 'string') return null;
  // If this was already stored as a full URL (legacy data), pass through.
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(COMBUSTIBLE_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch (err) {
    console.error('Error al generar signed URL:', err);
    return null;
  }
}

/**
 * Given a raw fecha input (YYYY-MM-DD or full ISO), return YYYY-MM for mes_tributario.
 * Returns null if input can't be parsed into a valid date.
 */
export function computeMesTributario(fecha: string | null | undefined): string | null {
  if (!fecha || typeof fecha !== 'string') return null;
  // Accept YYYY-MM-DD directly to avoid timezone issues.
  const ymd = /^(\d{4})-(\d{2})-\d{2}/.exec(fecha);
  if (ymd) return `${ymd[1]}-${ymd[2]}`;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Parse a numeric :id param into a positive integer, or null. */
export function parseNumericId(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Normalize & validate mes_tributario format YYYY-MM. Returns null if invalid. */
export function validateMes(mes: string | null | undefined): string | null {
  if (!mes || typeof mes !== 'string') return null;
  return /^\d{4}-\d{2}$/.test(mes) ? mes : null;
}
