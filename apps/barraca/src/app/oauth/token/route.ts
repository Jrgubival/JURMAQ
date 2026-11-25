import { esGestionNoDisponible, usarGestion } from "@/lib/gestion";
import { LIMITE_TOKEN_POR_MIN, MAX_BODY_OAUTH_BYTES, MIN } from "@/lib/mcp/config";
import { huellaIp, leerTextoLimitado, respuestaJson, respuestaOauthError } from "@/lib/mcp/http";
import { limitar } from "@/lib/mcp/limites";
import { canjearCodigo, refrescar, type ErrorOauth } from "@/lib/mcp/oauth";
import { verificarUsuarioMcp } from "@/lib/mcp/usuario";

/** Endpoint de tokens: authorization_code (con PKCE) y refresh_token (con rotación). Sin caché. */
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store", Pragma: "no-cache" };

function aError(e: ErrorOauth): Response {
  const status = e.error === "invalid_client" ? 401 : e.error === "server_error" ? 503 : 400;
  return respuestaOauthError(e.error, e.descripcion, status);
}

export async function POST(req: Request) {
  try {
    if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/x-www-form-urlencoded")) {
      return respuestaOauthError("invalid_request", "Usa application/x-www-form-urlencoded.");
    }
    const texto = await leerTextoLimitado(req, MAX_BODY_OAUTH_BYTES);
    if (texto === null) return respuestaOauthError("invalid_request", "Petición demasiado grande.", 413);
    const p = new URLSearchParams(texto);
    const g = (k: string) => p.get(k) ?? undefined;
    const ip = await huellaIp(req);
    const r = await usarGestion(async (db) => {
      const lim = await limitar(db, `token:${ip}`, LIMITE_TOKEN_POR_MIN, MIN);
      if (!lim.permitido) return { limitado: lim.reintentarEnSeg } as const;
      const deps = { verificarUsuario: verificarUsuarioMcp };
      switch (g("grant_type")) {
        case "authorization_code":
          return canjearCodigo(db, { code: g("code"), clientId: g("client_id"), redirectUri: g("redirect_uri"), codeVerifier: g("code_verifier"), resource: g("resource") }, deps);
        case "refresh_token":
          return refrescar(db, { refreshToken: g("refresh_token"), clientId: g("client_id"), scope: g("scope"), resource: g("resource") }, deps);
        default:
          return { ok: false, error: "unsupported_grant_type", descripcion: "grant_type no soportado." } as ErrorOauth;
      }
    });
    if ("limitado" in r) return respuestaOauthError("invalid_request", "Demasiados intentos.", 429, { "Retry-After": String(r.limitado) });
    if (!r.ok) return aError(r);
    return respuestaJson(r.tokens, 200, SIN_CACHE);
  } catch (e) {
    if (esGestionNoDisponible(e)) return respuestaOauthError("server_error", "Servicio no disponible.", 503);
    console.error("[mcp-token-fallo]", { tipo: e instanceof Error ? e.name : typeof e });
    return respuestaOauthError("server_error", "Error interno.", 500);
  }
}
