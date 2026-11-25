import "server-only";
/**
 * Cuántos suscriptores activos hay (SOLO el número). Tabla `barraca_suscriptores` (popup de la tienda y
 * panel /admin/suscriptores). Nunca se leen ni se devuelven correos ni nombres.
 */
import { supabaseAdmin } from "@jurmaq/shared/supabase";

export async function contarSuscriptoresActivos(): Promise<number | null> {
  try {
    const { count, error } = await supabaseAdmin.from("barraca_suscriptores").select("id", { count: "exact", head: true }).eq("activo", true);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}
