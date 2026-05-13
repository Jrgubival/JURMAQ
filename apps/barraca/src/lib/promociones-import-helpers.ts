/**
 * Helpers extraídos del route.ts de /api/barraca/promociones/import.
 *
 * Por qué viven aparte: el route handler tenía 280+ líneas mezclando
 * I/O HTTP con lógica de parsing, normalización y validación de filas
 * Excel. Mover los pure-functions a lib/ permite:
 *
 *   1) Test unitario sin tener que mockear Request/Response.
 *   2) Reutilización si en el futuro hay otro endpoint que importe Excel
 *      con el mismo schema (ej. importación bulk vía CLI script).
 *   3) Cohesión más alta de la comunidad C23 ("Import Diagnostics") en
 *      el grafo de graphify — antes la cohesión era 0.48 porque todas
 *      las funciones quedaban concentradas en un mismo route.ts mezclado
 *      con auth, rate-limit y handlers.
 *
 * Este archivo NO contiene I/O ni acceso a DB. La validación cross-DB
 * (`buildDiagnostics`) sigue en el route.ts porque depende de
 * supabaseAdmin + RPC.
 */

import XLSX from "xlsx";

export const PRECIO_ITEM_MAX = 50_000_000;
export const MIN_DIAS_VIGENCIA = 30;
export const VENTANA_DIAS = 30;

export const COLUMN_SYNONYMS: Record<string, string[]> = {
  codigo: ["codigo", "código", "sku", "code", "cod", "cod."],
  precio_promocional: [
    "precio_promocional",
    "precio promocional",
    "precio_oferta",
    "precio oferta",
    "precio_promo",
    "precio promo",
    "promo",
    "oferta",
    "precio_descuento",
  ],
  fecha_fin: [
    "fecha_fin",
    "fecha fin",
    "valido_hasta",
    "valido hasta",
    "hasta",
    "vence",
    "expira",
    "fin",
    "end_date",
  ],
};

export type ParsedRow = {
  rowIndex: number;
  codigo: string;
  precio_promocional: number;
  fecha_fin: string | null;
  rawRow: Record<string, unknown>;
};

export type RowDiagnostic = {
  rowIndex: number;
  codigo: string;
  precio_promocional: number;
  fecha_fin: string | null;
  status: "ok" | "reject";
  reason?: string;
  productoId?: number;
  precioActual?: number;
  diasVigencia?: number;
  descuento?: number;
};

/** Normaliza header de Excel a forma comparable: lowercase, sin acentos, sin doble espacio. */
export function normalizeHeader(s: string): string {
  return String(s)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/** Detecta qué columna del Excel mapea a cada campo lógico (codigo / precio / fecha). */
export function detectColumnMapping(
  headers: string[]
): Partial<Record<keyof typeof COLUMN_SYNONYMS, string>> {
  const mapping: Partial<Record<keyof typeof COLUMN_SYNONYMS, string>> = {};
  const normalized = headers.map((h) => ({ original: h, norm: normalizeHeader(h) }));
  for (const target of Object.keys(COLUMN_SYNONYMS) as (keyof typeof COLUMN_SYNONYMS)[]) {
    const synonyms = COLUMN_SYNONYMS[target].map(normalizeHeader);
    const hit = normalized.find((h) => synonyms.includes(h.norm));
    if (hit) mapping[target] = hit.original;
  }
  return mapping;
}

/** Lee un buffer Excel y devuelve headers + rows en formato serializable. */
export function parseExcelBuffer(
  buffer: ArrayBuffer
): { headers: string[]; rows: Record<string, unknown>[] } {
  const wb = XLSX.read(buffer, { type: "array" });
  // Prefiere "Promociones" si existe, si no la primera hoja.
  const preferida = wb.SheetNames.find((n) => /promo/i.test(n));
  const sheetName = preferida || wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

/** Parsea fecha_fin desde Excel (Date, serial number o string en varios formatos). */
export function coerceFechaFin(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === "number") {
    // Excel serial date: días desde 1899-12-30
    const d = new Date(Date.UTC(1899, 11, 30) + raw * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return null;
  }
  return null;
}

/** Limpia y devuelve un código de producto. */
export function coerceCodigo(raw: unknown): string {
  return String(raw ?? "").trim();
}

/** Convierte un precio desde Excel ("12.345", "$12,345", número) a entero CLP. */
export function coercePrecio(raw: unknown): number {
  if (typeof raw === "number") return Math.round(raw);
  if (typeof raw === "string") {
    const cleaned = raw.replace(/[^\d-]/g, "");
    const n = parseInt(cleaned, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
