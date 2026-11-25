import { esGestionNoDisponible, usarGestion } from "@/lib/gestion";
import { LIMITE_TOKEN_POR_MIN, MAX_BODY_OAUTH_BYTES, MIN } from "@/lib/mcp/config";
import { huellaIp, leerTextoLimitado, respuestaOauthError } from "@/lib/mcp/http";
import { limitar } from "@/lib/mcp/limites";
import { revocarPorToken } from "@/lib/mcp/oauth";

/** RFC 7009: revoca la conexión a la que pertenece el token. Responde 200 aunque el token no exista. */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const texto = await leerTextoLimitado(req, MAX_BODY_OAUTH_BYTES);
    if (texto === null) return respuestaOauthError("invalid_request", "Petición demasiado grande.", 413);
    const token = new URLSearchParams(texto).get("token");
    if (!token || token.length > 200) return respuestaOauthError("invalid_request", "Falta el token.");
    const ip = await huellaIp(req);
    const lim = await usarGestion(async (db) => {
      const l = await limitar(db, `revoke:${ip}`, LIMITE_TOKEN_POR_MIN, MIN);
      if (l.permitido) await revocarPorToken(db, token);
      return l;
    });
    if (!lim.permitido) return respuestaOauthError("invalid_request", "Demasiados intentos.", 429, { "Retry-After": String(lim.reintentarEnSeg) });
    return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (esGestionNoDisponible(e)) return respuestaOauthError("server_error", "Servicio no disponible.", 503);
    console.error("[mcp-revoke-fallo]", { tipo: e instanceof Error ? e.name : typeof e });
    return respuestaOauthError("server_error", "Error interno.", 500);
  }
}
