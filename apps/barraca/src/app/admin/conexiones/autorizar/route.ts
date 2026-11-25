import { auth } from "@jurmaq/shared/auth";
import { obtenerGestionDb } from "@/lib/gestion";
import { firmarSolicitud, urlRetorno } from "@/lib/mcp/autorizar";
import { paginaError, respuestaHtml, secretoFirma } from "@/lib/mcp/http";
import { validarSolicitudAutorizacion } from "@/lib/mcp/oauth";
import { htmlPantallaAutorizar } from "@/lib/mcp/pantalla-autorizar";
import { hostDeRedirect, esLoopback } from "@/lib/mcp/redirects";
import { verificarUsuarioMcp } from "@/lib/mcp/usuario";

/**
 * Pantalla de autorización de la conexión de Claude (endpoint /authorize).
 * Vive bajo /admin para usar el mismo login con código por correo: el
 * middleware manda a /login y vuelve aquí. Es una ruta (no una página) para
 * controlar los encabezados: sin marcos (anti clickjacking), sin caché y sin
 * Referer. La decisión se envía por POST a /oauth/decision.
 */
export const dynamic = "force-dynamic";

const CLAVES = ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state", "scope", "resource"] as const;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params: Record<string, string> = {};
  for (const k of CLAVES) {
    const v = url.searchParams.get(k);
    if (v !== null && v.length <= 2048) params[k] = v;
  }
  const secreto = secretoFirma();
  const db = await obtenerGestionDb();
  if (!db || !secreto) return paginaError("Conexión no disponible", "La conexión con Claude todavía no está lista en esta tienda. Avísale a quien administra el sitio.", 503);

  let validacion;
  try {
    validacion = await validarSolicitudAutorizacion(db, params);
  } catch {
    return paginaError("Conexión no disponible", "La conexión con Claude todavía no está lista en esta tienda.", 503);
  }
  if (!validacion.ok) {
    if (validacion.modo === "pagina") return paginaError("No se pudo conectar", "La solicitud de conexión no es válida. Vuelve a Claude e inténtalo de nuevo.");
    return new Response(null, {
      status: 302,
      headers: { Location: urlRetorno(validacion.redirectUri, { error: validacion.error, error_description: validacion.descripcion, state: validacion.state }), "Cache-Control": "no-store" },
    });
  }
  const s = validacion.solicitud;

  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) {
    return new Response(null, { status: 302, headers: { Location: `/login?callbackUrl=${encodeURIComponent(url.pathname + url.search)}`, "Cache-Control": "no-store" } });
  }
  // El rol del JWT puede tener hasta 24 h de atraso: se revisa en la base.
  const u = await verificarUsuarioMcp(uid);
  if (!u.ok) {
    return paginaError(
      u.motivo === "no_disponible" ? "Intenta de nuevo" : "Tu usuario no puede hacer esto",
      u.motivo === "no_disponible"
        ? "No pude revisar tu cuenta ahora mismo. Espera un momento y vuelve a intentar."
        : "Solo la persona administradora de la tienda puede conectar a Claude. Entra con la cuenta administradora.",
      u.motivo === "no_disponible" ? 503 : 403,
    );
  }

  const paquete = await firmarSolicitud(secreto, s, u.usuario.id);
  const html = htmlPantallaAutorizar({
    nombreCliente: s.cliente.nombre,
    hostRedirect: hostDeRedirect(s.redirectUri),
    loopback: esLoopback(s.redirectUri),
    emailUsuario: u.usuario.email ?? "",
    scopePedido: s.scope,
    paquete,
  });
  return respuestaHtml(html);
}
