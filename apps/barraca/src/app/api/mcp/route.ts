import { esGestionNoDisponible, usarGestion } from "@/lib/gestion";
import { MAX_BODY_MCP_BYTES } from "@/lib/mcp/config";
import { leerTextoLimitado, respuestaJson } from "@/lib/mcp/http";
import { manejarSolicitudMcp, type RespuestaMcp } from "@/lib/mcp/servidor";
import { registro } from "@/lib/mcp/tools";
import { verificarUsuarioMcp } from "@/lib/mcp/usuario";

/**
 * Servidor MCP remoto (Streamable HTTP, solo POST). Toda la lógica vive en
 * lib/mcp/servidor.ts; esta ruta solo lee el cuerpo con tope y traduce.
 * Docs: docs/MCP-NOTAS.md.
 */
export const dynamic = "force-dynamic";

function aRespuesta(r: RespuestaMcp): Response {
  if (r.body === undefined) return new Response(null, { status: r.status, headers: r.headers });
  return respuestaJson(r.body, r.status, r.headers);
}

async function manejar(req: Request): Promise<Response> {
  try {
    const texto = req.method === "POST" ? await leerTextoLimitado(req, MAX_BODY_MCP_BYTES) : "";
    if (texto === null) return respuestaJson({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "La petición es demasiado grande." } }, 413);
    const r = await usarGestion((db) =>
      manejarSolicitudMcp(
        { metodo: req.method, cabecera: (n) => req.headers.get(n), texto },
        { db, registro, verificarUsuario: verificarUsuarioMcp },
      ),
    );
    return aRespuesta(r);
  } catch (e) {
    if (esGestionNoDisponible(e)) {
      return respuestaJson({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Servicio no disponible." } }, 503, { "Retry-After": "30" });
    }
    console.error("[mcp-fallo]", { tipo: e instanceof Error ? e.name : typeof e });
    return respuestaJson({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Error interno." } }, 500);
  }
}

export const POST = manejar;
export const GET = manejar;
export const DELETE = manejar;
