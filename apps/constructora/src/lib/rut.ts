/**
 * Chilean RUT utilities.
 *
 * A RUT is a tax ID with format NNNNNNNN-D where D is a verification digit
 * computed with a modulo-11 algorithm. Common visual format adds thousand
 * separators: NN.NNN.NNN-D.
 *
 * The verification digit can be 0-9 or 'K'.
 */

/** Strip everything that isn't a digit or K/k. Uppercase the verification digit. */
function cleanRut(s: string): string {
  return (s || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * Format a RUT string to the canonical form "xx.xxx.xxx-x".
 * Accepts input with or without dots/dash. Returns the input unchanged if it
 * can't be parsed (fewer than 2 characters).
 */
export function formatRut(s: string): string {
  const clean = cleanRut(s);
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  // Add thousand separators to the body from the right
  let formatted = '';
  for (let i = 0; i < body.length; i++) {
    if (i > 0 && (body.length - i) % 3 === 0) {
      formatted += '.';
    }
    formatted += body[i];
  }

  return `${formatted}-${dv}`;
}

/**
 * Compute the expected verification digit for a given RUT body (digits only).
 * Returns '0'-'9' or 'K'.
 */
function computeDV(body: string): string {
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const mod = 11 - (sum % 11);
  if (mod === 11) return '0';
  if (mod === 10) return 'K';
  return String(mod);
}

/**
 * Validate a Chilean RUT. Accepts input in any format (with/without dots/dash).
 * Returns true iff the verification digit matches.
 */
export function validateRut(s: string): boolean {
  const clean = cleanRut(s);
  if (clean.length < 2) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  // Body must be digits only and reasonably sized
  if (!/^\d+$/.test(body)) return false;
  if (body.length < 7 || body.length > 9) return false;

  return computeDV(body) === dv;
}
