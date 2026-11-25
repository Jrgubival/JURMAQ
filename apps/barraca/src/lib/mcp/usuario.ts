import "server-only";
/**
 * Revalidación del usuario contra Supabase en CADA llamada al MCP y en cada
 * paso del OAuth: existe, su correo sigue en la lista del panel, es admin y su
 * scope cubre la barraca. El rol del JWT del panel puede tardar hasta 24 h en
 * actualizarse; aquí nunca se usa. Cualquier duda se niega (fail-closed).
 *
 * La tabla `users` no tiene columna de "activo": una baja es borrar la fila o
 * bajarle el rol/scope, y eso ya corta el acceso en la siguiente llamada.
 */
import { LOGIN_BARRACA_PERMITIDOS } from "@jurmaq/shared/auth/codigo-correo";
import { supabaseAdmin } from "@jurmaq/shared/supabase";
import type { ResultadoUsuario } from "./oauth.ts";
import { evaluarUsuario } from "./evaluar-usuario.ts";

export async function verificarUsuarioMcp(usuarioId: string): Promise<ResultadoUsuario> {
  if (!/^\d{1,18}$/.test(usuarioId)) return { ok: false, motivo: "no_autorizado" };
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, email, role, scope")
      .eq("id", Number(usuarioId))
      .maybeSingle();
    if (error) return { ok: false, motivo: "no_disponible" };
    return evaluarUsuario(data, LOGIN_BARRACA_PERMITIDOS);
  } catch {
    return { ok: false, motivo: "no_disponible" };
  }
}
