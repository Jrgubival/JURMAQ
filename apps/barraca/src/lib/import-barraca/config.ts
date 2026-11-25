// Configuración que manda la pantalla /admin/importar. Sin dependencias de Next
// ni de zod para poder probarla directo con node --test.
import type { MatchBy } from '../import-barraca-smart.ts';

export interface ConfigImportacion {
  columnMapping: Record<string, string | null>;
  matchBy: MatchBy;
  fieldsToUpdate: string[];
  createNew: boolean;
  createPromotionalPrices: boolean;
}

const CAMPOS_PERMITIDOS = new Set([
  'precio', 'costo', 'stock', 'nombre', 'peso', 'unidad', 'medida', 'imagen', 'activo', 'precio_tachado',
]);
const CLAVES_MAPEO = new Set([
  'id', 'codigo', 'nombre', 'precio', 'costo', 'stock', 'peso', 'unidad', 'medida', 'categoria', 'subcategoria',
  'precio_tachado', 'imagen', 'activo',
]);

/** Valida la configuración con lista blanca. Devuelve null si algo no cuadra. */
export function leerConfigImportacion(texto: unknown): ConfigImportacion | null {
  let c: any;
  try {
    c = typeof texto === 'string' ? JSON.parse(texto) : texto;
  } catch {
    return null;
  }
  if (!c || typeof c !== 'object') return null;
  const matchBy: MatchBy = ['auto', 'id', 'codigo', 'nombre'].includes(c.matchBy) ? c.matchBy : 'auto';
  const mapeo: Record<string, string | null> = {};
  if (c.columnMapping && typeof c.columnMapping === 'object') {
    for (const [k, v] of Object.entries(c.columnMapping)) {
      if (CLAVES_MAPEO.has(k) && typeof v === 'string' && v.length <= 200) mapeo[k] = v;
    }
  }
  const campos = Array.isArray(c.fieldsToUpdate)
    ? c.fieldsToUpdate.filter((f: unknown): f is string => typeof f === 'string' && CAMPOS_PERMITIDOS.has(f))
    : ['precio', 'stock', 'costo'];
  return {
    columnMapping: mapeo,
    matchBy,
    fieldsToUpdate: campos,
    createNew: c.createNew === true,
    createPromotionalPrices: c.createPromotionalPrices === true,
  };
}

/** Un archivo puede traer hasta este número de filas por importación. */
export const MAX_FILAS_IMPORTACION = 20000;
