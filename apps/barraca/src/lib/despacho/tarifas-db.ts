import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { logSafeError } from '@jurmaq/shared/logging';
import { COMUNAS } from './comunas';
import { ZONAS_DESPACHO, type ZonaDespacho } from './zonas';

/**
 * Tarifas del camión propio leídas de la tabla `barraca_zonas_despacho`
 * (ver supabase/migrations/2026_10_31_barraca_admin.sql), editables desde
 * /admin/despacho.
 *
 * FAIL-SAFE: si la tabla no existe, la consulta falla, viene vacía o una fila
 * trae montos inválidos, se usan las constantes de zonas.ts (ZONAS_DESPACHO).
 * Nunca se cobra 0 por un error: un 0 sólo sale de la base si alguien lo
 * guardó a propósito.
 *
 * Caché corta en memoria (por instancia) para no ir a la base en cada
 * cotización del checkout. Al guardar desde el panel se invalida en esa
 * instancia; las demás toman el cambio en menos de CACHE_MS.
 */

const CACHE_MS = 60_000;
const TABLA = 'barraca_zonas_despacho';
export const PATRON_ID_ZONA = /^[a-z][a-z-]{1,29}$/;

// La tabla todavía no está en db-types (la migración no está aplicada).
const db = supabaseAdmin as unknown as SupabaseClient;

export interface FilaZona {
  id: string;
  nombre: string;
  comuna: string;
  costo: number;
  gratis_desde: number | null;
  activo: boolean;
  orden: number;
}

export interface ZonasVigentes {
  zonas: ZonaDespacho[];
  /** 'db' = tabla; 'codigo' = constantes de zonas.ts (tabla ausente o con error). */
  fuente: 'db' | 'codigo';
}

const codigosComuna = new Set(COMUNAS.map((c) => c.codigo));
const constantePorId = new Map(ZONAS_DESPACHO.map((z) => [z.id, z]));

const montoValido = (n: unknown, min: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= 10_000_000;

/** Fila de la base → zona, o null si algo no cuadra. */
function aZona(f: Partial<FilaZona>): ZonaDespacho | null {
  if (typeof f.id !== 'string' || !PATRON_ID_ZONA.test(f.id)) return null;
  if (typeof f.nombre !== 'string' || !f.nombre.trim()) return null;
  if (typeof f.comuna !== 'string' || !codigosComuna.has(f.comuna)) return null;
  if (!montoValido(f.costo, 0)) return null;
  if (f.gratis_desde != null && !montoValido(f.gratis_desde, 1)) return null;
  return { id: f.id, nombre: f.nombre.trim(), comuna: f.comuna, costo: f.costo, gratisDesde: f.gratis_desde ?? null };
}

/** Lee la tabla. Lanza si hay error (incluida la tabla inexistente). */
export async function leerFilasZonas(): Promise<FilaZona[]> {
  const { data, error } = await db
    .from(TABLA)
    .select('id, nombre, comuna, costo, gratis_desde, activo, orden')
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FilaZona[];
}

/** Arma la lista vigente a partir de las filas, con respaldo fila por fila. */
export function zonasDesdeFilas(filas: Partial<FilaZona>[]): ZonaDespacho[] {
  const zonas: ZonaDespacho[] = [];
  for (const f of filas) {
    if (f.activo === false) continue;
    const z = aZona(f);
    if (z) {
      zonas.push(z);
      continue;
    }
    // Fila dañada: se usa el valor del código para esa zona (si existe).
    const respaldo = typeof f.id === 'string' ? constantePorId.get(f.id) : undefined;
    if (respaldo) zonas.push(respaldo);
  }
  return zonas;
}

let cache: { valor: ZonasVigentes; hasta: number } | null = null;

export function invalidarCacheZonas(): void {
  cache = null;
}

/** Zonas activas con sus tarifas. Nunca lanza. */
export async function zonasDespachoVigentes(): Promise<ZonasVigentes> {
  const ahora = Date.now();
  if (cache && cache.hasta > ahora) return cache.valor;
  let valor: ZonasVigentes;
  try {
    const filas = await leerFilasZonas();
    const zonas = zonasDesdeFilas(filas);
    // Tabla vacía (o todo inválido): no se deja la tienda sin despacho por error.
    valor = zonas.length > 0 || filas.some((f) => f.activo === false)
      ? { zonas, fuente: 'db' }
      : { zonas: ZONAS_DESPACHO, fuente: 'codigo' };
  } catch (error) {
    logSafeError('despacho-tarifas-db-error', { error: String(error) });
    valor = { zonas: ZONAS_DESPACHO, fuente: 'codigo' };
    // Con error, reintentar antes: caché de 10 s en vez de 60 s.
    cache = { valor, hasta: ahora + 10_000 };
    return valor;
  }
  cache = { valor, hasta: ahora + CACHE_MS };
  return valor;
}

export async function zonaVigentePorId(id: string | null | undefined): Promise<ZonaDespacho | null> {
  if (!id) return null;
  const { zonas } = await zonasDespachoVigentes();
  return zonas.find((z) => z.id === id) ?? null;
}

/** Cambios permitidos desde el panel (whitelist). */
export interface CambioZona {
  costo?: number;
  gratis_desde?: number | null;
  activo?: boolean;
}

/** Actualiza una zona existente. Devuelve la fila guardada o null si no existe. */
export async function actualizarZona(id: string, cambio: CambioZona, por: string | null): Promise<FilaZona | null> {
  const fila: Record<string, unknown> = { updated_by: por, updated_at: new Date().toISOString() };
  if (cambio.costo !== undefined) fila.costo = cambio.costo;
  if (cambio.gratis_desde !== undefined) fila.gratis_desde = cambio.gratis_desde;
  if (cambio.activo !== undefined) fila.activo = cambio.activo;
  const { data, error } = await db
    .from(TABLA)
    .update(fila)
    .eq('id', id)
    .select('id, nombre, comuna, costo, gratis_desde, activo, orden')
    .maybeSingle();
  if (error) throw error;
  invalidarCacheZonas();
  return (data as FilaZona) ?? null;
}
