/**
 * Helpers de formateo compartidos por toda la app.
 *
 * Antes vivían duplicados en cada admin page (formatCLP/formatDate
 * redefinidos en al menos 7 archivos distintos). Centralizar elimina
 * inconsistencias y deja un solo punto a tocar si cambia el formato
 * (ej. se pide CLP con separador "." vs "," o cambia el locale a otro).
 */

/** Formatea un monto entero a CLP: 12500 → "$12.500" */
export function formatCLP(amount: number): string {
  return "$" + amount.toLocaleString("es-CL");
}

/**
 * Formatea fecha ISO o Date a "DD-MM-AAAA" según locale es-CL.
 * Acepta `null`/`undefined` y devuelve string vacío (varias páginas pasan
 * `created_at` que puede venir null desde Supabase).
 */
export function formatDate(input: string | Date | null | undefined): string {
  if (input === null || input === undefined || input === "") return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL");
}

/** Formatea fecha + hora corta. */
export function formatDateTime(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Convierte texto de MAYUSCULAS a Title Case legible.
 * "FIERRO ESTRIADO 10MM X 6M" → "Fierro Estriado 10mm x 6m"
 * Mantiene siglas comunes en mayúsculas (MM, PVC, etc.)
 */

const KEEP_LOWER = new Set(['x', 'y', 'de', 'del', 'en', 'con', 'por', 'para', 'mm', 'mts', 'un', 'kg', 'lt', 'lts', 'pcs', 'pzs']);
const KEEP_UPPER = new Set(['PVC', 'PPR', 'LED', 'UV', 'AC', 'DC', 'OSB', 'MDF', 'HDF', 'PH', 'UNI']);

export function titleCase(text: string): string {
  if (!text) return text;
  return text
    .toLowerCase()
    .split(' ')
    .map((word, i) => {
      const upper = word.toUpperCase();
      if (KEEP_UPPER.has(upper)) return upper;
      if (i > 0 && KEEP_LOWER.has(word)) return word;
      // Keep measurements lowercase: 10mm, 3/4, 6mts
      if (/^\d/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
