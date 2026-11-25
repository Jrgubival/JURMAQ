import { requireAuth, forbiddenResponse, unauthorizedResponse } from "@jurmaq/shared/auth/guard";
import { z } from "@jurmaq/shared/validation";
import { esGestionNoDisponible, usarGestion } from "@/lib/gestion";
import { baseCanonica } from "@/lib/mcp/config";
import { deshacerLote } from "@/lib/mcp/deshacer";
import { leerTextoLimitado, mismoOrigen, respuestaJson } from "@/lib/mcp/http";
import { revocarFamilia } from "@/lib/mcp/oauth";
import { registro } from "@/lib/mcp/tools";
import { verificarUsuarioMcp } from "@/lib/mcp/usuario";

/**
 * Acciones de /admin/conexiones: revocar una conexión y deshacer un lote.
 * Solo administradores (rol revisado en la base, no en el JWT) y mismo origen.
 */
export const dynamic = "force-dynamic";

const Cuerpo = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("revocar"), familiaId: z.string().min(1).max(64) }).strict(),
  z.object({ accion: z.literal("deshacer"), loteId: z.string().min(1).max(64) }).strict(),
]);

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return unauthorizedResponse();
  if ((session.user as { role?: string }).role !== "admin") return forbiddenResponse();
  if (!mismoOrigen(req, baseCanonica())) return forbiddenResponse("Solicitud rechazada.");
  const uid = (session.user as { id?: string }).id ?? "";
  const u = await verificarUsuarioMcp(uid);
  if (!u.ok) return u.motivo === "no_disponible" ? respuestaJson({ error: "No pude revisar tu cuenta. Intenta de nuevo." }, 503) : forbiddenResponse();

  const texto = await leerTextoLimitado(req, 2048);
  let json: unknown = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* queda null */ }
  const p = Cuerpo.safeParse(json);
  if (!p.success) return respuestaJson({ error: "Solicitud inválida." }, 400);

  try {
    return await usarGestion(async (db) => {
      if (p.data.accion === "revocar") {
        const n = await revocarFamilia(db, p.data.familiaId, "revocado_en_panel");
        return respuestaJson(n > 0 ? { ok: true, mensaje: "Conexión cortada. Claude ya no puede entrar." } : { ok: false, mensaje: "Esa conexión ya estaba cortada." }, n > 0 ? 200 : 409);
      }
      const r = await deshacerLote(db, registro, p.data.loteId, u.usuario);
      if (r.ok) return respuestaJson({ ok: true, mensaje: ["Listo, se deshizo el cambio.", ...r.mensajes].join(" ") });
      return respuestaJson({ ok: false, mensaje: r.mensaje }, r.motivo === "fallo" ? 500 : 409);
    });
  } catch (e) {
    if (esGestionNoDisponible(e)) return respuestaJson({ error: "La base de gestión todavía no está disponible." }, 503);
    console.error("[mcp-admin-fallo]", { tipo: e instanceof Error ? e.name : typeof e });
    return respuestaJson({ error: "No se pudo completar. Intenta de nuevo." }, 500);
  }
}
