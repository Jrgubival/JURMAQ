import "server-only";
import { supabasePublic } from "@jurmaq/shared/supabase";
import type { BuscadorReferencias } from "./referencias.ts";

/** Busca en el catálogo real (solo productos y categorías activos). */
export const buscadorSupabase: BuscadorReferencias = {
  async codigosExistentes(codigos) {
    const { data, error } = await supabasePublic.from("barraca_productos").select("codigo").eq("activo", true).in("codigo", codigos);
    if (error) throw new Error("No se pudo consultar el catálogo.");
    return new Set((data ?? []).map((f: { codigo: string | number }) => String(f.codigo)));
  },
  async slugsExistentes(slugs) {
    const { data, error } = await supabasePublic.from("barraca_categorias").select("slug").eq("activa", true).in("slug", slugs);
    if (error) throw new Error("No se pudo consultar el catálogo.");
    return new Set((data ?? []).map((f: { slug: string }) => f.slug));
  },
};
