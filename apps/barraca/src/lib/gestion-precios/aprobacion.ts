/**
 * Pedir y gastar la aprobación de Jorge para un cambio (flujo único para toda
 * herramienta de gestión; no se repite por herramienta).
 *
 * La herramienta calcula el cambio exacto, saca su huella (contenido + estado
 * actual de los datos) y llama a `exigirAprobacion`:
 *   - sin solicitud previa (o vencida/usada): manda el correo y responde "pendiente";
 *   - pendiente: no manda otro correo;
 *   - aprobada: devuelve `gastar()` (un solo uso, atómico) y la herramienta aplica;
 *   - rechazada (últimas 4 h): no se aplica;
 *   - sin correo del aprobador / sin cupo / correo caído: BLOQUEADA, no se aplica.
 * Como la huella incluye el estado actual de los datos, si alguien cambió algo
 * entre medio la huella no coincide y se pide una aprobación nueva.
 * Todo corre a nombre del mismo usuario que pidió el cambio (la aprobación está
 * ligada a su id y nadie más puede gastarla).
 */
import type { D1Like, UsuarioGestion } from "../gestion/index.ts";
import { type CambioEvaluable, cifrasDeCambios, lineasDeCambios } from "./reglas.ts";
import {
  TEXTO_MOTIVO, TTL_APROBACION_MS, consumirAprobacion, devolverAprobacion, estadoAprobacion,
  type DatosSolicitud, type MotivoAprobacion, type ResultadoSolicitud,
} from "../mcp/aprobaciones.ts";

export interface DepsAprobacionGestion {
  solicitar(db: D1Like, datos: DatosSolicitud): Promise<ResultadoSolicitud>;
}

export type ResultadoExigir =
  | { tipo: "aprobada"; id: string; gastar(): Promise<boolean>; /** Devuelve la aprobación gastada si el cambio no se pudo aplicar. */ devolver(): Promise<boolean> }
  | { tipo: "pendiente"; id: string; mensaje: string }
  | { tipo: "rechazada"; mensaje: string }
  | { tipo: "bloqueada"; mensaje: string };

export function textoMotivos(motivos: MotivoAprobacion[]): string {
  return motivos.map((m) => TEXTO_MOTIVO[m].toLowerCase()).join("; ");
}

export async function exigirAprobacion(
  db: D1Like,
  deps: DepsAprobacionGestion,
  p: {
    usuario: UsuarioGestion; herramienta: string; motivos: MotivoAprobacion[]; resumen: string; detalle?: unknown; huella: string;
    /** Los cambios de precio que se aprobarían: de ahí salen las cifras del correo y la lista completa de la página. */
    cambios?: CambioEvaluable[];
  },
  ahora: number = Date.now(),
): Promise<ResultadoExigir> {
  const previa = await db
    .prepare("SELECT id, estado, creado_en FROM aprobaciones WHERE usuario_id = ? AND herramienta = ? AND huella = ? ORDER BY creado_en DESC LIMIT 1")
    .bind(p.usuario.id, p.herramienta, p.huella)
    .first<{ id: string; estado: string; creado_en: number }>();

  if (previa) {
    const estado = await estadoAprobacion(db, previa.id, { usuarioId: p.usuario.id, huellaActual: p.huella }, ahora);
    if (estado === "aprobada") {
      const llave = { usuarioId: p.usuario.id, huellaActual: p.huella };
      return {
        tipo: "aprobada", id: previa.id,
        gastar: () => consumirAprobacion(db, previa.id, llave, ahora),
        devolver: () => devolverAprobacion(db, previa.id, llave, ahora),
      };
    }
    if (estado === "rechazada" && previa.creado_en > ahora - TTL_APROBACION_MS) {
      return { tipo: "rechazada", mensaje: "Jorge rechazó este cambio, así que no se aplicó. Si quiere intentarlo de nuevo, hay que cambiar algo del pedido." };
    }
    // pendiente / vencida / usada / rechazada antigua: se pide (o se reutiliza la pendiente).
  }

  const r = await deps.solicitar(db, {
    usuario: { id: p.usuario.id, email: p.usuario.email ?? null },
    herramienta: p.herramienta, motivos: p.motivos, resumen: p.resumen, huella: p.huella,
    detalle: p.cambios && p.cambios.length > 0
      ? { cifras: cifrasDeCambios(p.cambios), lineas: lineasDeCambios(p.cambios), ...(p.detalle && typeof p.detalle === "object" && !Array.isArray(p.detalle) ? (p.detalle as Record<string, unknown>) : p.detalle === undefined ? {} : { detalle: p.detalle }) }
      : p.detalle,
  });
  if (r.ok) {
    const horas = Math.round(TTL_APROBACION_MS / 3_600_000);
    return {
      tipo: "pendiente",
      id: r.id,
      mensaje: r.nueva
        ? `Este cambio necesita el OK de Jorge (${textoMotivos(p.motivos)}). Le mandé un correo con el enlace para aprobarlo; vale ${horas} horas. No se cambió nada. Cuando apruebe, repite esta misma llamada y se aplica.`
        : `Este cambio sigue esperando el OK de Jorge (${textoMotivos(p.motivos)}). Ya tiene el correo con el enlace. No se cambió nada. Cuando apruebe, repite esta misma llamada.`,
    };
  }
  const razon: Record<typeof r.motivo, string> = {
    sin_aprobador: "Este cambio necesita el OK de Jorge, pero falta configurar el correo del aprobador, así que queda bloqueado. No se cambió nada. Avísale a Jorge.",
    limite: "Hay demasiadas solicitudes de aprobación en la última hora. No se cambió nada; espera un rato y vuelve a intentar.",
    mismo_usuario: "Este cambio necesita el OK de Jorge, pero el correo del aprobador es el mismo del usuario que lo pide, así que nadie puede aprobarlo (quien pide no aprueba). Hay que configurar BARRACA_APROBADOR_EMAIL con otro correo. No se cambió nada. Avísale a Jorge.",
    usuario_sin_correo: "Este cambio necesita el OK de Jorge, pero tu usuario no tiene correo registrado, así que no se puede comprobar que quien pide sea otra persona que quien aprueba. No se cambió nada. Avísale a Jorge.",
    correo_fallo: "Este cambio necesita el OK de Jorge, pero no pude mandarle el correo. No se cambió nada; intenta de nuevo en unos minutos.",
  };
  return { tipo: "bloqueada", mensaje: razon[r.motivo] };
}
