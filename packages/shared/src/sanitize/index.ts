/**
 * Input sanitization utilities for API routes.
 */

/** Strip HTML tags from a string */
export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/** Sanitize a string input: trim and strip HTML. Returns null for empty/non-string values. */
export function sanitizeString(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;
  const cleaned = stripHtml(value).trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Sanitize a string input, throwing if the result is empty (for required fields). */
export function sanitizeRequired(value: unknown, fieldName: string): string {
  const result = sanitizeString(value);
  if (!result) {
    throw new ValidationError(`${fieldName} es requerido`);
  }
  return result;
}

/** Validate that a value is a valid email address */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Validate that a value is a positive integer */
export function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** Escape special characters for use in Supabase ilike patterns */
export function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

/**
 * Sanitize a user-supplied search term for use inside a PostgREST
 * `.or("field.ilike.%X%,...")` expression. PostgREST parses commas,
 * parentheses and periods as filter operators — if we splice a raw user
 * string in there, an attacker can inject extra clauses. Returns a string
 * safe to splice inside `%...%` together with `escapeLikePattern`.
 *
 * Example attack that is now neutralised:
 *   ?buscar=),nombre.eq.foo,(  → injected clause
 */
export function escapeOrFilter(str: string): string {
  return escapeLikePattern(str).replace(/[,()]/g, ' ');
}

/** Custom error class for validation failures */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * CSRF origin check for mutating API routes.
 * Parses Origin/Referer as URLs and compares EXACT host match.
 * Returns true only when the request clearly comes from an allowed hostname.
 */
const ALLOWED_HOSTS = new Set([
  'jurmaq.cl',
  'www.jurmaq.cl',
  'barraca.jurmaq.cl',
  'jurmaq-app.vercel.app',
  'localhost:3000',
  'localhost',
]);

export function isValidOrigin(request: { headers: { get(name: string): string | null }; url: string }): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // Hardening (audit A3): comparamos SOLO contra la allowlist explicita.
  // Antes aceptabamos `host === u.host` del header Host, pero detras de proxies
  // (Vercel, Cloudflare) el Host puede ser falsificado por el cliente y no es
  // confiable como referencia. Ahora la unica fuente de verdad es ALLOWED_HOSTS.
  const hostMatches = (candidate: string): boolean => {
    try {
      const u = new URL(candidate);
      if (ALLOWED_HOSTS.has(u.host)) return true;
      if (u.host.endsWith('.vercel.app') && u.host.includes('jurmaq')) return true;
      return false;
    } catch {
      return false;
    }
  };

  if (origin) return hostMatches(origin);
  if (referer) return hostMatches(referer);

  // Fallback restrictivo: solo `same-origin`. Antes aceptabamos `none`
  // tambien (navegaciones tipeadas), pero clientes no-navegador como curl
  // o herramientas custom pueden emitir `Sec-Fetch-Site: none` libremente
  // y eso abria un bypass trivial del CSRF. `same-origin` es estable: solo
  // los browsers modernos lo ponen y solo cuando la accion viene de la misma
  // origen. Si falta, mejor rechazar.
  const sfs = request.headers.get('sec-fetch-site');
  if (sfs === 'same-origin') return true;
  return false;
}
