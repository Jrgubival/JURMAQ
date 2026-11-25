import { z } from "@jurmaq/shared/validation";
import { esGestionNoDisponible, usarGestion } from "@/lib/gestion";
import { LIMITE_REGISTRO_POR_HORA, HORA, MAX_BODY_OAUTH_BYTES } from "@/lib/mcp/config";
import { huellaIp, leerTextoLimitado, respuestaJson, respuestaOauthError } from "@/lib/mcp/http";
import { limitar } from "@/lib/mcp/limites";
import { registrarCliente } from "@/lib/mcp/oauth";

/**
 * Registro dinámico de clientes (RFC 7591). Sin autenticación (así lo hace
 * Claude), por eso: lista blanca cerrada de redirect_uri, solo clientes
 * públicos, límite por IP y tope de registros sin usar.
 */
export const dynamic = "force-dynamic";

const Registro = z.object({
  client_name: z.string().max(200).optional(),
  redirect_uris: z.array(z.string().max(300)).min(1).max(10),
  token_endpoint_auth_method: z.literal("none").optional(),
  grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).optional(),
  response_types: z.array(z.literal("code")).optional(),
  scope: z.string().max(200).optional(),
  application_type: z.enum(["web", "native"]).optional(),
}).passthrough();

export async function POST(req: Request) {
  try {
    const texto = await leerTextoLimitado(req, MAX_BODY_OAUTH_BYTES);
    if (texto === null) return respuestaOauthError("invalid_client_metadata", "Petición demasiado grande.", 413);
    let json: unknown;
    try { json = JSON.parse(texto); } catch { return respuestaOauthError("invalid_client_metadata", "JSON inválido."); }
    const p = Registro.safeParse(json);
    if (!p.success) return respuestaOauthError("invalid_client_metadata", "Metadata de cliente inválida.");
    const ip = await huellaIp(req);
    const r = await usarGestion(async (db) => {
      const lim = await limitar(db, `registro:${ip}`, LIMITE_REGISTRO_POR_HORA, HORA);
      if (!lim.permitido) return { limitado: lim.reintentarEnSeg } as const;
      return registrarCliente(db, { nombre: p.data.client_name, redirectUris: p.data.redirect_uris, ipHash: ip });
    });
    if ("limitado" in r) return respuestaOauthError("invalid_client_metadata", "Demasiados registros. Intenta más tarde.", 429, { "Retry-After": String(r.limitado) });
    if (!r.ok) return respuestaOauthError(r.error === "limite" ? "invalid_client_metadata" : r.error, r.descripcion, r.error === "limite" ? 503 : 400);
    return respuestaJson({
      client_id: r.cliente.id,
      client_id_issued_at: Math.floor(r.cliente.creadoEn / 1000),
      client_name: r.cliente.nombre,
      redirect_uris: r.cliente.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }, 201);
  } catch (e) {
    if (esGestionNoDisponible(e)) return respuestaOauthError("server_error", "Servicio no disponible.", 503);
    console.error("[mcp-registro-fallo]", { tipo: e instanceof Error ? e.name : typeof e });
    return respuestaOauthError("server_error", "Error interno.", 500);
  }
}
