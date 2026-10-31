import 'server-only';
import fs from 'fs';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { logSafeError } from '@jurmaq/shared/logging';
import type { Combo } from '@/lib/combos';

/**
 * Combos ("Lleva 2 por $12.000") de cada producto, desde las columnas
 * combo_cantidad / combo_precio de barraca_productos
 * (migración 2026_11_01_barraca_combos.sql).
 *
 * Va en una consulta aparte y tolera que las columnas aún no existan: en ese
 * caso no hay combos y todo se cobra al precio unitario (fail-closed: nunca
 * un descuento que la base no tiene).
 *
 * Sólo en `next dev`: COMBOS_LOCALES=.combos-locales.json reemplaza la base
 * por ese archivo ({ "combos": { "<id>": { cantidad, precio } } }), para
 * revisar una carga sin escribir en producción.
 */

const db = supabaseAdmin as unknown as SupabaseClient; // columnas aún fuera de db-types

function combosLocales(): Map<number, Combo> | null {
  const ruta = process.env.COMBOS_LOCALES?.trim();
  if (!ruta) return null;
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('COMBOS_LOCALES sólo se permite en desarrollo local');
  }
  const json = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), ruta), 'utf8')) as {
    combos: Record<string, Combo>;
  };
  return new Map(Object.entries(json.combos).map(([id, c]) => [Number(id), c]));
}

const entero = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);

export async function combosDe(ids: number[]): Promise<Map<number, Combo>> {
  if (ids.length === 0) return new Map();
  const locales = combosLocales();
  if (locales) return new Map(ids.flatMap((id) => (locales.has(id) ? [[id, locales.get(id)!] as const] : [])));
  try {
    const { data, error } = await db
      .from('barraca_productos')
      .select('id, combo_cantidad, combo_precio')
      .in('id', ids)
      .not('combo_cantidad', 'is', null);
    if (error) throw error;
    const out = new Map<number, Combo>();
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const cantidad = entero(r.combo_cantidad);
      const precio = entero(r.combo_precio);
      if (cantidad && precio) out.set(r.id as number, { cantidad, precio });
    }
    return out;
  } catch (error) {
    logSafeError('tienda-combos-error', { error: String(error) });
    return new Map();
  }
}
