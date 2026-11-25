import type { ResultadoUsuario } from "./oauth.ts";

/**
 * Regla única de "quién puede usar el MCP": fila de `users` con rol admin,
 * scope barraca o both y correo dentro de la lista del panel. Pura (sin red)
 * para poder probarla; `usuario.ts` la usa con Supabase.
 */
export function evaluarUsuario(
  fila: { id?: unknown; email?: unknown; role?: unknown; scope?: unknown } | null,
  permitidos: readonly string[],
): ResultadoUsuario {
  if (!fila) return { ok: false, motivo: "no_autorizado" };
  const email = typeof fila.email === "string" ? fila.email.trim().toLowerCase() : "";
  const scopeOk = fila.scope === "barraca" || fila.scope === "both";
  if (fila.role !== "admin" || !scopeOk || !email || !permitidos.includes(email)) return { ok: false, motivo: "no_autorizado" };
  return { ok: true, usuario: { id: String(fila.id), email } };
}
