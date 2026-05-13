/**
 * Minimal Handlebars-lite renderer for contract templates.
 * Supports {{ var }} substitution and {{#if var}}...{{else}}...{{/if}} conditionals.
 * Not a full Handlebars — just the subset we need.
 *
 * formatCLP local (rounds + es-CL): se mantiene exportado para retro-compat
 * con archivos que importan `{ formatCLP } from '@/lib/contrato-render'`.
 */

export type ContratoVars = Record<string, string | number | boolean | null | undefined>;

/** Render a template string replacing {{ placeholders }} and {{#if}}/{{else}}/{{/if}} blocks. */
export function renderContrato(template: string, vars: ContratoVars): string {
  // First pass: resolve {{#if VAR}}...{{else}}...{{/if}} and {{#if VAR}}...{{/if}}
  let out = template;
  const ifRegex = /\{\{#if\s+([a-zA-Z_][\w]*)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
  let prev = '';
  // Loop to handle nested conditionals
  while (prev !== out) {
    prev = out;
    out = out.replace(ifRegex, (_m, name: string, thenBlock: string, elseBlock: string | undefined) => {
      const val = vars[name];
      const truthy = !!val && val !== '0' && val !== 0 && val !== 'false';
      return truthy ? thenBlock : (elseBlock || '');
    });
  }

  // Second pass: simple {{ var }} replacements
  out = out.replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g, (_m, name: string) => {
    const v = vars[name];
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });

  return out;
}

/**
 * Convert a number (up to 999,999,999) to Spanish words in CLP context.
 * Used for "precio_total_letras" and "garantia_monto_letras".
 */
export function numberToSpanishWords(n: number): string {
  n = Math.round(Math.abs(Number(n) || 0));
  if (n === 0) return 'cero';

  const units = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  function under1000(num: number): string {
    if (num === 0) return '';
    if (num === 100) return 'cien';
    if (num < 20) return units[num];
    if (num < 100) {
      const t = Math.floor(num / 10);
      const u = num % 10;
      if (t === 2 && u > 0) return 'veinti' + units[u];
      return tens[t] + (u ? ' y ' + units[u] : '');
    }
    const h = Math.floor(num / 100);
    const rest = num % 100;
    return hundreds[h] + (rest ? ' ' + under1000(rest) : '');
  }

  if (n < 1000) return under1000(n);
  if (n < 1000000) {
    const miles = Math.floor(n / 1000);
    const rest = n % 1000;
    const milesStr = miles === 1 ? 'mil' : under1000(miles) + ' mil';
    return milesStr + (rest ? ' ' + under1000(rest) : '');
  }
  // Millions
  const millones = Math.floor(n / 1000000);
  const restM = n % 1000000;
  const mStr = millones === 1 ? 'un millon' : under1000(millones) + ' millones';
  if (restM === 0) return mStr;
  if (restM < 1000) return mStr + ' ' + under1000(restM);
  const miles = Math.floor(restM / 1000);
  const rest = restM % 1000;
  const milesStr = miles === 1 ? 'mil' : under1000(miles) + ' mil';
  return mStr + ' ' + milesStr + (rest ? ' ' + under1000(rest) : '');
}

/** Format CLP amount as "$1.234.567" */
export function formatCLP(n: number): string {
  return '$' + (Math.round(Number(n) || 0)).toLocaleString('es-CL');
}

/** Format ISO date as "dd/mm/yyyy" */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return '';
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** Compute days between two ISO dates (inclusive of start, exclusive of end) */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)));
}
