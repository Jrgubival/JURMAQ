/**
 * HTML de la pantalla de autorización y lectura de la decisión. Vive aparte de
 * las rutas para poder probar el HTML REAL que ve Jorge: la casilla de dinero
 * tiene que quedar DENTRO del <form> que se envía a /oauth/decision, porque un
 * input fuera del formulario no viaja en el POST y el permiso nunca se concede.
 */
import { SCOPE_DINERO } from "./config.ts";
import { escapar, paginaHtml } from "./http.ts";
import { DINERO_PUEDE, NO_PUEDE, NO_PUEDE_CON_DINERO, NOTAS, PUEDE } from "./permisos-texto.ts";

export const ACCION_DECISION = "/oauth/decision";

export type DatosPantalla = {
  nombreCliente: string;
  hostRedirect: string;
  loopback: boolean;
  emailUsuario: string;
  scopePedido: string;
  paquete: string;
};

/** ¿La casilla de dinero llegó marcada en el POST? (única lectura, la usa la ruta de decisión). */
export function dineroMarcado(form: URLSearchParams): boolean {
  return form.get("dinero") === "si";
}

export function htmlPantallaAutorizar(d: DatosPantalla): string {
  const li = (xs: readonly string[]) => xs.map((x) => `<li>${escapar(x)}</li>`).join("");
  // El permiso de dinero y borrado es APARTE: solo se ofrece si el cliente lo pidió y va desmarcado. Sin la casilla no se concede.
  const pideDinero = d.scopePedido.split(" ").includes(SCOPE_DINERO);
  const bloqueDinero = pideDinero
    ? `<div class="dinero"><h2>Dinero y borrado (permiso aparte)</h2>
<p>Esta aplicación también pide poder tocar <b>pagos y borrar datos</b>. Es más delicado, por eso lo decides tú por separado. Si lo das, Claude podrá:</p>
<ul class="si">${li(DINERO_PUEDE)}</ul>
<p>Cada operación de dinero o borrado te avisa por correo, y las que no se pueden deshacer te las muestra antes.</p>
<label class="casilla"><input type="checkbox" name="dinero" value="si"><span>Sí, quiero darle también el permiso de dinero y borrado</span></label>
<p><small>Si no marcas la casilla, Claude se conecta solo con el permiso básico y no podrá tocar pagos ni borrar nada.</small></p></div>`
    : "";
  return paginaHtml({
    titulo: "Conectar Claude a la tienda",
    cuerpo: `<div class="tarjeta">
<h1>¿Dejar que Claude administre la tienda?</h1>
<p>La aplicación <b>${escapar(d.nombreCliente)}</b> (vuelve a <b>${escapar(d.hostRedirect)}</b>) pide acceso a la tienda JURMAQ Barraca.</p>
<div class="dato">Entrarás como <b>${escapar(d.emailUsuario)}</b></div>
${d.loopback ? `<div class="aviso">Esta conexión se abre en un programa de este computador (${escapar(d.hostRedirect)}). Autoriza solo si la empezaste tú, por ejemplo desde Claude Code.</div>` : ""}
<h2>Claude podrá</h2><ul class="si">${li(PUEDE)}</ul>
<h2>Claude no podrá</h2><ul class="no">${li(pideDinero ? NO_PUEDE_CON_DINERO : NO_PUEDE)}</ul>
<p>${NOTAS.map(escapar).join("<br>")}</p>
<form method="post" action="${ACCION_DECISION}" autocomplete="off">
<input type="hidden" name="solicitud" value="${escapar(d.paquete)}">
${bloqueDinero}
<div class="botones">
<button class="primario" type="submit" name="decision" value="permitir">Autorizar</button>
<button class="secundario" type="submit" name="decision" value="denegar">Cancelar</button>
</div></form>
<p><small>Si no empezaste esta conexión desde Claude, toca Cancelar.</small></p>
</div>`,
  });
}
