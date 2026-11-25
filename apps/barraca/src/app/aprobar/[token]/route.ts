import { obtenerGestionDb } from "@/lib/gestion";
import { TEXTO_MOTIVO, resolverAprobacion, verAprobacionPorToken, type VistaAprobacion } from "@/lib/mcp/aprobaciones";
import { abrirFirmado, empaquetarFirmado, sha256Hex } from "@/lib/mcp/cripto";
import { MAX_BODY_OAUTH_BYTES, MIN, baseCanonica } from "@/lib/mcp/config";
import { escapar, huellaIp, leerTextoLimitado, mismoOrigen, paginaError, paginaHtml, respuestaHtml, secretoFirma } from "@/lib/mcp/http";
import { limitar } from "@/lib/mcp/limites";

/**
 * Página pública de aprobación (enlace del correo de Jorge).
 * GET: solo muestra el detalle, no cambia nada (así un antivirus o la vista
 * previa del correo no aprueban por accidente). POST: Aprobar o Rechazar con
 * botón; exige mismo origen y un paquete CSRF firmado ligado a este enlace.
 * El enlace sirve una sola vez, vence rápido y la herramienta, al aplicar,
 * vuelve a comprobar que los datos sigan igual.
 */
export const dynamic = "force-dynamic";

const USO_CSRF = "aprobar-v1";
type Ctx = { params: Promise<{ token: string }> };

const ESTADOS: Record<string, string> = {
  aprobada: "Esta solicitud ya fue aprobada.",
  rechazada: "Esta solicitud ya fue rechazada.",
  usada: "Esta solicitud ya se aplicó.",
  vencida: "Esta solicitud venció. Pídele a Claude que la prepare de nuevo.",
};

function detalleTexto(d: unknown): string {
  if (d === null || d === undefined) return "";
  let t = typeof d === "string" ? d : JSON.stringify(d, null, 2);
  if (t.length > 4000) t = `${t.slice(0, 4000)}\n…`;
  return t;
}

function pagina(v: VistaAprobacion, token: string, csrf: string | null, mensaje?: { tipo: "ok" | "info"; texto: string }): Response {
  const motivos = v.motivos.map((m) => `<li>${escapar(TEXTO_MOTIVO[m])}</li>`).join("");
  const detalle = detalleTexto(v.detalle);
  const formulario = v.estado === "pendiente" && csrf
    ? `<form method="post" action="/aprobar/${escapar(token)}" autocomplete="off">
<input type="hidden" name="csrf" value="${escapar(csrf)}">
<div class="botones">
<button class="primario" type="submit" name="decision" value="aprobar">Aprobar</button>
<button class="peligro" type="submit" name="decision" value="rechazar">Rechazar</button>
</div></form>`
    : `<div class="aviso">${escapar(ESTADOS[v.estado] ?? "Esta solicitud ya no se puede decidir.")}</div>`;
  return respuestaHtml(paginaHtml({
    titulo: "Aprobar cambio en la tienda",
    cuerpo: `<div class="tarjeta">
<h1>Cambio esperando tu OK</h1>
${mensaje ? `<div class="${mensaje.tipo === "ok" ? "dato" : "aviso"}"><b>${escapar(mensaje.texto)}</b></div>` : ""}
<p>${escapar(v.resumen)}</p>
<h2>Por qué pide aprobación</h2><ul>${motivos}</ul>
${detalle ? `<h2>Detalle</h2><div class="dato"><pre>${escapar(detalle)}</pre></div>` : ""}
<p><small>Pedido por ${escapar(v.solicitante ?? "Claude")}. Vence ${escapar(new Date(v.venceEn).toLocaleString("es-CL", { timeZone: "America/Santiago" }))}.</small></p>
${formulario}
<p><small>Si apruebas, vuelve a Claude y pídele que continúe. Si los datos cambian antes de aplicarlo, la aprobación deja de servir.</small></p>
</div>`,
  }));
}

async function csrfPara(token: string, secreto: string): Promise<string> {
  return empaquetarFirmado(secreto, USO_CSRF, { t: await sha256Hex(token), exp: Date.now() + 30 * MIN });
}

export async function GET(req: Request, { params }: Ctx) {
  const { token } = await params;
  const secreto = secretoFirma();
  const db = await obtenerGestionDb();
  if (!db || !secreto) return paginaError("No disponible", "Esta página todavía no está lista.", 503);
  try {
    const lim = await limitar(db, `aprobar:${await huellaIp(req)}`, 40, MIN);
    if (!lim.permitido) return paginaError("Demasiados intentos", "Espera un momento.", 429);
    const v = await verAprobacionPorToken(db, token);
    if (!v) return paginaError("Enlace no válido", "Este enlace no existe o está mal copiado.", 404);
    return pagina(v, token, v.estado === "pendiente" ? await csrfPara(token, secreto) : null);
  } catch {
    return paginaError("No disponible", "No pude cargar la solicitud. Intenta de nuevo en un momento.", 503);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  if (!mismoOrigen(req, baseCanonica())) return paginaError("Solicitud rechazada", "La solicitud no vino de esta página.", 403);
  const secreto = secretoFirma();
  const db = await obtenerGestionDb();
  if (!db || !secreto) return paginaError("No disponible", "Esta página todavía no está lista.", 503);
  const texto = await leerTextoLimitado(req, MAX_BODY_OAUTH_BYTES);
  if (texto === null) return paginaError("Solicitud rechazada", "La solicitud es demasiado grande.", 413);
  const form = new URLSearchParams(texto);
  const decision = form.get("decision");
  if (decision !== "aprobar" && decision !== "rechazar") return paginaError("Solicitud rechazada", "Falta la decisión.", 400);
  const csrf = await abrirFirmado<{ t?: string; exp?: number }>(secreto, USO_CSRF, form.get("csrf"), Date.now());
  if (!csrf || csrf.t !== (await sha256Hex(token))) return paginaError("La página venció", "Abre el enlace del correo otra vez.", 400);
  try {
    const lim = await limitar(db, `aprobar:${await huellaIp(req)}`, 40, MIN);
    if (!lim.permitido) return paginaError("Demasiados intentos", "Espera un momento.", 429);
    const r = await resolverAprobacion(db, token, decision);
    const v = await verAprobacionPorToken(db, token);
    if (!v) return paginaError("Enlace no válido", "Este enlace no existe o está mal copiado.", 404);
    if (r.ok) {
      return pagina(v, token, null, {
        tipo: "ok",
        texto: r.estado === "aprobada" ? "Aprobado. Vuelve a Claude y pídele que continúe." : "Rechazado. No se hará el cambio.",
      });
    }
    return pagina(v, token, null, { tipo: "info", texto: "Este enlace ya no se puede usar para decidir." });
  } catch (e) {
    console.error("[mcp-aprobar-fallo]", { tipo: e instanceof Error ? e.name : typeof e });
    return paginaError("No disponible", "No pude guardar tu decisión. Vuelve a abrir el enlace e intenta de nuevo.", 503);
  }
}
