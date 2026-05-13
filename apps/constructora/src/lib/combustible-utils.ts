import { formatCLP as sharedFormatCLP } from "@jurmaq/shared/format";
/**
 * Utilities for the combustible (fuel tracking) admin module.
 *
 * Used for: factura data display, IVA/IEC calculations for Chilean tax
 * (Ley 18.502 - Impuesto Específico a los Combustibles), and labels for
 * select fields and badges.
 */

export type TipoCombustible =
  | 'diesel'
  | 'gasolina_93'
  | 'gasolina_95'
  | 'gasolina_97'
  | 'kerosene'
  | 'otro';

export type EstadoFactura =
  | 'registrada'
  | 'validada'
  | 'recuperada'
  | 'anulada';

export type TipoDocumento =
  | 'factura_electronica'
  | 'boleta'
  | 'factura_exenta'
  | 'vale';

export const tiposCombustibleLabels: Record<TipoCombustible, string> = {
  diesel: 'Diésel',
  gasolina_93: 'Gasolina 93',
  gasolina_95: 'Gasolina 95',
  gasolina_97: 'Gasolina 97',
  kerosene: 'Kerosene',
  otro: 'Otro',
};

export const estadosLabels: Record<EstadoFactura, string> = {
  registrada: 'Registrada',
  validada: 'Validada',
  recuperada: 'Recuperada',
  anulada: 'Anulada',
};

export const tiposDocumentoLabels: Record<TipoDocumento, string> = {
  factura_electronica: 'Factura electrónica',
  boleta: 'Boleta',
  factura_exenta: 'Factura exenta',
  vale: 'Vale',
};

export const estadoBadgeConfig: Record<EstadoFactura, { bg: string; text: string; label: string }> = {
  registrada: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Registrada' },
  validada: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Validada' },
  recuperada: { bg: 'bg-green-100', text: 'text-green-700', label: 'Recuperada' },
  anulada: { bg: 'bg-red-100', text: 'text-red-700', label: 'Anulada' },
};

/**
 * Format a number of liters with Spanish (CL) formatting.
 * Supports decimals. Example: 1234.56 → "1.234,56 L"
 */
export function formatLitros(n: number | null | undefined): string {
  const v = Number(n) || 0;
  return (
    v.toLocaleString('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' L'
  );
}

/** Format CLP currency. Rounds to integer and uses es-CL separators.
 *  Re-export wrapper sobre @jurmaq/shared/format que tolera null/undefined. */
export function formatCLP(n: number | null | undefined): string {
  const v = Math.round(Number(n) || 0);
  return sharedFormatCLP(v);
}

/**
 * Compute the tributary month (YYYY-MM) for a given ISO date.
 * Uses the local date portion of the ISO string (YYYY-MM-DD).
 */
export function computeMesTributario(fecha: string | null | undefined): string {
  if (!fecha) return '';
  // Accept either a full ISO datetime or a date-only string.
  const datePart = fecha.slice(0, 10);
  const [y, m] = datePart.split('-');
  if (!y || !m) return '';
  return `${y}-${m}`;
}

/** Returns the current month in YYYY-MM format, using local time. */
export function currentMesTributario(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Given a total (gross, IVA incluido), return neto + IVA pair.
 * Uses the Chilean 19% IVA rate. Neto = round(total / 1.19), IVA = total - neto.
 */
export function computeIvaNeto(total: number | null | undefined): {
  neto: number;
  iva: number;
} {
  const t = Math.round(Number(total) || 0);
  const neto = Math.round(t / 1.19);
  const iva = t - neto;
  return { neto, iva };
}

/** Format a YYYY-MM string as a Spanish month label: "2026-04" → "Abril 2026" */
export function formatMesLabel(mes: string): string {
  if (!mes) return '';
  const [y, m] = mes.split('-');
  if (!y || !m) return mes;
  const meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return mes;
  return `${meses[idx]} ${y}`;
}

/** Short date formatter (es-CL). Accepts ISO or YYYY-MM-DD. */
export function formatDate(s: string | null | undefined): string {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-CL');
}

/** Human-readable file size (KB / MB). */
export function formatFileSize(bytes: number | null | undefined): string {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
