import { auth } from "@jurmaq/shared/auth";
import { obtenerGestionDb } from "@/lib/gestion";
import { firmarSolicitud, urlRetorno } from "@/lib/mcp/autorizar";
import { escapar, paginaError, paginaHtml, respuestaHtml, secretoFirma } from "@/lib/mcp/http";
import { validarSolicitudAutorizacion } from "@/lib/mcp/oauth";
import { SCOPE_DINERO } from "@/lib/mcp/config";
import { DINERO_PUEDE, NO_PUEDE, NO_PUEDE_CON_DINERO, NOTAS, PUEDE } from "@/lib/mcp/permisos-texto";
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
  const host = hostDeRedirect(s.redirectUri);
  const local = esLoopback(s.redirectUri);
  const li = (xs: readonly string[]) => xs.map((x) => `<li>${escapar(x)}</li>`).join("");
  // El permiso de dinero y borrado es APARTE: solo se ofrece si el cliente lo pidió y va desmarcado. Sin la casilla no se concede.
  const pideDinero = s.scope.split(" ").includes(SCOPE_DINERO);
  const bloqueDinero = pideDinero
    ? `<div class="dinero"><h2>Dinero y borrado (permiso aparte)</h2>
<p>Esta aplicación también pide poder tocar <b>pagos y borrar datos</b>. Es más delicado, por eso lo decides tú por separado. Si lo das, Claude podrá:</p>
<ul class="si">${li(DINERO_PUEDE)}</ul>
<p>Cada operación de dinero o borrado te avisa por correo, y las que no se pueden deshacer te las muestra antes.</p>
<label class="casilla"><input type="checkbox" name="dinero" value="si"><span>Sí, quiero darle también el permiso de dinero y borrado</span></label>
<p><small>Si no marcas la casilla, Claude se conecta solo con el permiso básico y no podrá tocar pagos ni borrar nada.</small></p></div>`
    : "";
  const html = paginaHtml({
    titulo: "Conectar Claude a la tienda",
    cuerpo: `<div class="tarjeta">
<h1>¿Dejar que Claude administre la tienda?</h1>
<p>La aplicación <b>${escapar(s.cliente.nombre)}</b> (vuelve a <b>${escapar(host)}</b>) pide acceso a la tienda JURMAQ Barraca.</p>
<div class="dato">Entrarás como <b>${escapar(u.usuario.email)}</b></div>
${local ? `<div class="aviso">Esta conexión se abre en un programa de este computador (${escapar(host)}). Autoriza solo si la empezaste tú, por ejemplo desde Claude Code.</div>` : ""}
<h2>Claude podrá</h2><ul class="si">${li(PUEDE)}</ul>
<h2>Claude no podrá</h2><ul class="no">${li(pideDinero ? NO_PUEDE_CON_DINERO : NO_PUEDE)}</ul>
${bloqueDinero}
<p>${NOTAS.map(escapar).join("<br>")}</p>
<form method="post" action="/oauth/decision" autocomplete="off">
<input type="hidden" name="solicitud" value="${escapar(paquete)}">
<div class="botones">
<button class="primario" type="submit" name="decision" value="permitir">Autorizar</button>
<button class="secundario" type="submit" name="decision" value="denegar">Cancelar</button>
</div></form>
<p><small>Si no empezaste esta conexión desde Claude, toca Cancelar.</small></p>
</div>`,
  });
  return respuestaHtml(html);
}
