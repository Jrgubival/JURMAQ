import { auth } from "@jurmaq/shared/auth";
import { obtenerGestionDb } from "@/lib/gestion";
import { abrirSolicitud, urlRetorno } from "@/lib/mcp/autorizar";
import { MAX_BODY_OAUTH_BYTES, MIN, baseCanonica } from "@/lib/mcp/config";
import { escapar, leerTextoLimitado, mismoOrigen, paginaError, paginaHtml, respuestaHtml, secretoFirma } from "@/lib/mcp/http";
import { limitar } from "@/lib/mcp/limites";
import { emitirCodigo, scopeConcedido, validarSolicitudAutorizacion } from "@/lib/mcp/oauth";
import { dineroMarcado } from "@/lib/mcp/pantalla-autorizar";
import { verificarUsuarioMcp } from "@/lib/mcp/usuario";
import { maskEmail } from "@jurmaq/shared/logging";

/**
 * Recibe el botón Autorizar / Cancelar. Defensas: mismo origen, sesión del
 * panel viva, usuario revalidado como admin, paquete firmado atado a ese
 * usuario y vencido a los 10 min, y la solicitud se vuelve a validar contra la
 * base. El retorno al cliente se hace con una página (meta refresh) y no con un
 * 302 porque Chrome aplica `form-action` de la CSP también a las redirecciones.
 */
export const dynamic = "force-dynamic";

function volverA(url: string): Response {
  const u = escapar(url);
  return respuestaHtml(
    paginaHtml({
      titulo: "Volviendo a Claude",
      cabeza: `<meta http-equiv="refresh" content="0;url=${u}">`,
      cuerpo: `<div class="tarjeta"><h1>Listo</h1><p>Volviendo a Claude…</p><p><a class="boton primario" href="${u}">Continuar</a></p></div>`,
    }),
  );
}

export async function POST(req: Request) {
  const base = baseCanonica();
  if (!mismoOrigen(req, base)) return paginaError("Solicitud rechazada", "La solicitud no vino de esta página.", 403);
  const secreto = secretoFirma();
  const db = await obtenerGestionDb();
  if (!db || !secreto) return paginaError("Conexión no disponible", "La conexión con Claude todavía no está lista.", 503);

  const texto = await leerTextoLimitado(req, MAX_BODY_OAUTH_BYTES);
  if (texto === null) return paginaError("Solicitud rechazada", "La solicitud es demasiado grande.", 413);
  const form = new URLSearchParams(texto);

  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return paginaError("Sesión vencida", "Entra de nuevo al panel y vuelve a conectar desde Claude.", 401);
  const u = await verificarUsuarioMcp(uid);
  if (!u.ok) return paginaError("Tu usuario no puede hacer esto", "Solo la persona administradora de la tienda puede conectar a Claude.", u.motivo === "no_disponible" ? 503 : 403);

  const p = await abrirSolicitud(secreto, form.get("solicitud"), u.usuario.id);
  if (!p) return paginaError("La pantalla venció", "Vuelve a Claude y empieza la conexión otra vez.", 400);

  try {
    const v = await validarSolicitudAutorizacion(db, {
      client_id: p.cliente_id, redirect_uri: p.redirect_uri, response_type: "code", code_challenge: p.code_challenge,
      code_challenge_method: "S256", state: p.state ?? undefined, scope: p.scope, resource: p.resource,
    });
    if (!v.ok) return paginaError("No se pudo conectar", "La solicitud ya no es válida. Vuelve a Claude e inténtalo de nuevo.");
    const s = v.solicitud;
    if (form.get("decision") !== "permitir") {
      return volverA(urlRetorno(s.redirectUri, { error: "access_denied", error_description: "El usuario canceló la conexión.", state: s.state }, base));
    }
    const lim = await limitar(db, `autorizar:${u.usuario.id}`, 10, 10 * MIN);
    if (!lim.permitido) return paginaError("Demasiados intentos", "Espera unos minutos y vuelve a intentar.", 429);
    // Dinero y borrado solo con la casilla marcada Y pedido por el cliente (la casilla nunca agrega un permiso que no se pidió).
    const scope = scopeConcedido(s.scope, dineroMarcado(form));
    const code = await emitirCodigo(db, {
      clienteId: s.cliente.id, usuario: u.usuario, redirectUri: s.redirectUri, codeChallenge: s.codeChallenge, scope, resource: s.resource,
    });
    console.info("[mcp-autorizado]", { usuario: maskEmail(u.usuario.email ?? ""), cliente: s.cliente.id, dinero: scope.includes("tienda:dinero") });
    return volverA(urlRetorno(s.redirectUri, { code, state: s.state }, base));
  } catch (e) {
    console.error("[mcp-decision-fallo]", { tipo: e instanceof Error ? e.name : typeof e });
    return paginaError("No se pudo conectar", "Ocurrió un problema. Intenta de nuevo en un momento.", 500);
  }
}
