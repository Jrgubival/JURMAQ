import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@jurmaq/shared/supabase";
import { escapeLikePattern } from "@jurmaq/shared/sanitize";
import type { CuponRegistro, RepoCupones } from "./servicio.ts";

/** Acceso a Supabase (barraca_cupones, barraca_categorias). Las tablas no están todas en db-types. */
const db = supabaseAdmin as unknown as SupabaseClient;

export const COLUMNAS_CUPON =
  "id, codigo, descripcion, tipo, valor, monto_minimo_compra, max_usos_total, max_usos_por_usuario, usos_actuales, valido_desde, valido_hasta, activo, created_at";

export const repoSupabase: RepoCupones = {
  async buscarPorCodigo(codigo) {
    const { data, error } = await db.from("barraca_cupones").select(COLUMNAS_CUPON).eq("codigo", codigo).maybeSingle();
    if (error) throw error;
    return (data as CuponRegistro | null) ?? null;
  },
  async usosAntiguosDeCorreo(cuponId, email) {
    const { count, error } = await db
      .from("barraca_cupones_usos")
      .select("*", { count: "exact", head: true })
      .eq("cupon_id", cuponId)
      .ilike("email", escapeLikePattern(email));
    if (error) throw error;
    return count ?? 0;
  },
  async categoriasPadre() {
    const { data, error } = await db.from("barraca_categorias").select("id, padre_id");
    if (error) throw error;
    return new Map(((data ?? []) as Array<{ id: number; padre_id: number | null }>).map((c) => [c.id, c.padre_id]));
  },
};

/**
 * ¿Ya está aplicada la migración de pedidos con cupón
 * (supabase/migrations/2026_11_26_barraca_cupones_pedidos.sql)?
 * Se prueba leyendo las columnas nuevas; cualquier error = no.
 */
export async function esquemaPedidosConCupon(): Promise<boolean> {
  try {
    const { error } = await db.from("barraca_pedidos").select("cupon_id, cupon_codigo, cupon_descuento").limit(1);
    return !error;
  } catch {
    return false;
  }
}

import type { RepoCuponesAdmin } from "./admin.ts";

export const repoAdminSupabase: RepoCuponesAdmin = {
  async listar(limite) {
    const { data, error } = await db.from("barraca_cupones").select(COLUMNAS_CUPON).order("created_at", { ascending: false }).limit(limite);
    if (error) throw error;
    return (data ?? []) as CuponRegistro[];
  },
  async porId(id) {
    const { data, error } = await db.from("barraca_cupones").select(COLUMNAS_CUPON).eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as CuponRegistro | null) ?? null;
  },
  async insertar(fila) {
    const { data, error } = await db.from("barraca_cupones").insert(fila).select(COLUMNAS_CUPON).single();
    if (error) return { ok: false, codigoRepetido: (error as { code?: string }).code === "23505" };
    return { ok: true, cupon: data as CuponRegistro };
  },
  async actualizar(id, campos) {
    const { error } = await db.from("barraca_cupones").update(campos).eq("id", id);
    return !error;
  },
  async codigosPorIds(ids) {
    if (ids.length === 0) return new Map();
    const { data, error } = await db.from("barraca_cupones").select("id, codigo").in("id", ids);
    if (error) throw error;
    return new Map(((data ?? []) as Array<{ id: string; codigo: string }>).map((c) => [c.id, c.codigo]));
  },
};
