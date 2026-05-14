import XLSX from 'xlsx';
import { readFile } from 'node:fs/promises';
import { supabaseAdmin } from "@jurmaq/shared/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedExcel {
  sheetNames: string[];
  headers: string[];
  rows: any[];
  totalRows: number;
  sampleRows: any[];
}

export interface MatchResult {
  rowIndex: number;
  excelRow: any;
  matchedProduct: any | null;
  status: 'update' | 'create' | 'skip';
  changes: Array<{ field: string; oldValue: any; newValue: any }>;
}

export interface ImportConfig {
  createNew: boolean;
  createPromotionalPrices: boolean;
}

export interface ImportResult {
  updated: number;
  created: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Column synonym table
// ---------------------------------------------------------------------------

const COLUMN_SYNONYMS: Record<string, string[]> = {
  codigo: ['codigo', 'código', 'sku', 'code', 'cod', 'cod.'],
  nombre: ['nombre', 'descripcion', 'descripción', 'producto', 'detalle'],
  precio: [
    'precio',
    'precio vta',
    'precio vta.',
    'precio venta',
    'pvp',
    'precio unitario',
  ],
  costo: ['costo', 'costo bru', 'costo bru.', 'costo bruto', 'cost'],
  stock: ['stock', 'stock b1', 'cantidad', 'qty', 'inventario'],
  peso: ['peso', 'peso kg', 'peso (kg)', 'weight', 'kg'],
  unidad: ['unidad', 'und', 'unit', 'um', 'u.m.'],
  medida: ['medida', 'dimensiones', 'dimension', 'tamaño', 'tamano'],
  categoria: [
    'categoria',
    'categoría',
    'familia',
    'grupo',
    'linea',
    'línea',
  ],
  subcategoria: [
    'subcategoria',
    'subcategoría',
    'sub-familia',
    'subfamilia',
    'sub familia',
  ],
  precio_tachado: [
    'precio tachado',
    'precio original',
    'precio antes',
    'precio anterior',
    'precio de referencia',
    'precio normal',
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(str: string): string {
  return str.toLowerCase().trim();
}

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const rand = Math.random().toString(36).substring(2, 5);
  return `${base}-${rand}`;
}

async function fetchAllProducts(): Promise<any[]> {
  let allProducts: any[] = [];
  let offset = 0;

  while (true) {
    const { data } = await supabaseAdmin
      .from('barraca_productos')
      .select('*')
      .order('nombre')
      .range(offset, offset + 999);

    if (!data || data.length === 0) break;
    allProducts.push(...data);
    offset += 1000;
    if (data.length < 1000) break;
  }

  return allProducts;
}

function getValueFromRow(row: any, columnMapping: Record<string, string | null>, field: string): any {
  const excelColumn = columnMapping[field];
  if (!excelColumn) return undefined;
  return row[excelColumn];
}

function toNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

// ---------------------------------------------------------------------------
// Function 1: parseExcelFile
// ---------------------------------------------------------------------------

export function parseExcelFile(buffer: Buffer): ParsedExcel {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = workbook.SheetNames;

  // Prefer "Hoja2" if it exists, otherwise use the first sheet
  const targetSheet = sheetNames.includes('Hoja2') ? 'Hoja2' : sheetNames[0];
  const worksheet = workbook.Sheets[targetSheet];

  const rows: any[] = XLSX.utils.sheet_to_json(worksheet);
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const sampleRows = rows.slice(0, 10);

  return {
    sheetNames,
    headers,
    rows,
    totalRows: rows.length,
    sampleRows,
  };
}

// ---------------------------------------------------------------------------
// Function 2: detectColumnMapping
// ---------------------------------------------------------------------------

export function detectColumnMapping(headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};

  for (const dbField of Object.keys(COLUMN_SYNONYMS)) {
    const synonyms = COLUMN_SYNONYMS[dbField];
    let matched: string | null = null;

    for (const header of headers) {
      const normalizedHeader = normalize(header);
      for (const synonym of synonyms) {
        if (normalizedHeader === normalize(synonym)) {
          matched = header;
          break;
        }
      }
      if (matched) break;
    }

    mapping[dbField] = matched;
  }

  return mapping;
}

// ---------------------------------------------------------------------------
// Function 3: matchProducts
// ---------------------------------------------------------------------------

export async function matchProducts(
  rows: any[],
  columnMapping: Record<string, string | null>,
  matchBy: 'codigo' | 'nombre',
  fieldsToUpdate: string[],
  createPromotionalPrices: boolean
): Promise<MatchResult[]> {
  // Fetch all existing products from DB
  const existingProducts = await fetchAllProducts();

  // Build lookup map keyed by the match field (normalized)
  const lookupMap = new Map<string, any>();
  for (const product of existingProducts) {
    const key = matchBy === 'codigo'
      ? normalize(String(product.codigo || ''))
      : normalize(String(product.nombre || ''));
    if (key) {
      lookupMap.set(key, product);
    }
  }

  const results: MatchResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Get match key from the Excel row
    const rawKey = getValueFromRow(row, columnMapping, matchBy);
    const matchKey = rawKey ? normalize(String(rawKey)) : '';

    const matchedProduct = matchKey ? lookupMap.get(matchKey) || null : null;

    if (matchedProduct) {
      // Compare fields and record changes
      const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

      for (const field of fieldsToUpdate) {
        const excelValue = getValueFromRow(row, columnMapping, field);
        if (excelValue === undefined || excelValue === null || excelValue === '') continue;

        let dbField = field;
        let newValue: any = excelValue;

        // Map import fields to DB column names
        if (field === 'precio') {
          dbField = 'precio';
          newValue = toNumber(excelValue);
        } else if (field === 'costo') {
          dbField = 'costo';
          newValue = toNumber(excelValue);
        } else if (field === 'stock') {
          dbField = 'stock';
          newValue = toNumber(excelValue);
        } else if (field === 'peso') {
          dbField = 'peso';
          newValue = toNumber(excelValue);
        }

        if (newValue === null) continue;

        const oldValue = matchedProduct[dbField];

        // Only record if actually different
        if (String(oldValue) !== String(newValue)) {
          changes.push({ field: dbField, oldValue, newValue });
        }
      }

      // Handle promotional price logic (strike-through based on historic price)
      if (createPromotionalPrices) {
        const precioTachado = getValueFromRow(row, columnMapping, 'precio_tachado');
        const precioReal = getValueFromRow(row, columnMapping, 'precio');

        if (precioTachado !== undefined && precioTachado !== null && precioTachado !== '') {
          const tachNum = toNumber(precioTachado);
          const realNum = toNumber(precioReal);

          if (tachNum !== null && realNum !== null) {
            // DB precio = precio_tachado (inflated crossed-out price)
            // DB precio_original = precio (real price)
            // DB en_oferta = true
            const existingPrecio = matchedProduct.precio;
            const existingPrecioOriginal = matchedProduct.precio_original;
            const existingEnOferta = matchedProduct.en_oferta;

            if (String(existingPrecio) !== String(tachNum)) {
              changes.push({ field: 'precio', oldValue: existingPrecio, newValue: tachNum });
            }
            if (String(existingPrecioOriginal) !== String(realNum)) {
              changes.push({ field: 'precio_original', oldValue: existingPrecioOriginal, newValue: realNum });
            }
            if (!existingEnOferta) {
              changes.push({ field: 'en_oferta', oldValue: existingEnOferta, newValue: true });
            }
          }
        }
      }

      results.push({
        rowIndex: i,
        excelRow: row,
        matchedProduct,
        status: changes.length > 0 ? 'update' : 'skip',
        changes,
      });
    } else {
      // No match found — caller decides whether to create or skip
      results.push({
        rowIndex: i,
        excelRow: row,
        matchedProduct: null,
        status: 'create',
        changes: [],
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Function 4: executeImport
// ---------------------------------------------------------------------------

export async function executeImport(
  matches: MatchResult[],
  config: ImportConfig
): Promise<ImportResult> {
  let updated = 0;
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  const BATCH_SIZE = 50;

  for (let i = 0; i < matches.length; i += BATCH_SIZE) {
    const batch = matches.slice(i, i + BATCH_SIZE);

    for (const match of batch) {
      try {
        if (match.status === 'update' && match.matchedProduct) {
          // Build update object from changes
          const updateObj: Record<string, any> = {};
          for (const change of match.changes) {
            updateObj[change.field] = change.newValue;
          }

          if (Object.keys(updateObj).length > 0) {
            const { error } = await supabaseAdmin
              .from('barraca_productos')
              .update(updateObj)
              .eq('id', match.matchedProduct.id);

            if (error) {
              errors.push(`Error updating row ${match.rowIndex}: ${error.message}`);
            } else {
              updated++;
            }
          } else {
            skipped++;
          }
        } else if (match.status === 'create') {
          if (!config.createNew) {
            skipped++;
            continue;
          }

          // Build insert object from the Excel row
          const row = match.excelRow;
          const nombre = String(
            Object.values(row).find((v) => typeof v === 'string' && v.length > 2) || `Producto-${match.rowIndex}`
          );
          const slug = slugify(nombre);

          const insertObj: Record<string, any> = {
            nombre,
            slug,
            activo: true,
          };

          // Try to extract known fields from the row columns
          // We look for common column names in the row keys
          for (const [key, value] of Object.entries(row)) {
            const normalizedKey = normalize(key);
            if (COLUMN_SYNONYMS.codigo?.some((s) => normalize(s) === normalizedKey)) {
              insertObj.codigo = value;
            } else if (COLUMN_SYNONYMS.nombre?.some((s) => normalize(s) === normalizedKey)) {
              insertObj.nombre = String(value);
              insertObj.slug = slugify(String(value));
            } else if (COLUMN_SYNONYMS.precio?.some((s) => normalize(s) === normalizedKey)) {
              insertObj.precio = toNumber(value) || 0;
            } else if (COLUMN_SYNONYMS.costo?.some((s) => normalize(s) === normalizedKey)) {
              insertObj.costo = toNumber(value) || 0;
            } else if (COLUMN_SYNONYMS.stock?.some((s) => normalize(s) === normalizedKey)) {
              insertObj.stock = toNumber(value) || 0;
            } else if (COLUMN_SYNONYMS.peso?.some((s) => normalize(s) === normalizedKey)) {
              insertObj.peso = toNumber(value);
            } else if (COLUMN_SYNONYMS.unidad?.some((s) => normalize(s) === normalizedKey)) {
              insertObj.unidad = String(value);
            } else if (COLUMN_SYNONYMS.medida?.some((s) => normalize(s) === normalizedKey)) {
              insertObj.medida = String(value);
            }
          }

          // Handle promotional prices for new products
          if (config.createPromotionalPrices) {
            const precioTachadoCol = Object.keys(row).find((k) =>
              COLUMN_SYNONYMS.precio_tachado?.some((s) => normalize(s) === normalize(k))
            );
            if (precioTachadoCol) {
              const tachVal = toNumber(row[precioTachadoCol]);
              if (tachVal !== null) {
                insertObj.precio_original = insertObj.precio || 0;
                insertObj.precio = tachVal;
                insertObj.en_oferta = true;
              }
            }
          }

          const { error } = await supabaseAdmin
            .from('barraca_productos')
            .insert(insertObj);

          if (error) {
            errors.push(`Error creating row ${match.rowIndex}: ${error.message}`);
          } else {
            created++;
          }
        } else {
          skipped++;
        }
      } catch (err: any) {
        errors.push(`Exception at row ${match.rowIndex}: ${err.message || String(err)}`);
      }
    }
  }

  return { updated, created, skipped, errors };
}

export async function importBarracaFromXLSX(filePath: string): Promise<{
  categories: number;
  products: number;
  updated: number;
  created: number;
  skipped: number;
  errors: string[];
}> {
  const buffer = await readFile(filePath);
  const parsed = parseExcelFile(buffer);
  const mapping = detectColumnMapping(parsed.headers);
  const matchBy = mapping.codigo ? 'codigo' : 'nombre';
  const fieldsToUpdate = Object.keys(mapping).filter(
    (field) => Boolean(mapping[field]) && field !== 'categoria' && field !== 'subcategoria'
  );
  const matches = await matchProducts(
    parsed.rows,
    mapping,
    matchBy,
    fieldsToUpdate,
    true
  );
  const result = await executeImport(matches, {
    createNew: true,
    createPromotionalPrices: true,
  });

  return {
    categories: 0,
    products: result.updated + result.created,
    ...result,
  };
}
