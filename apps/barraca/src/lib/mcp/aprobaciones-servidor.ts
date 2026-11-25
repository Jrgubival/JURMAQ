import "server-only";
/**
 * Cableado real del servicio de aprobaciones: lee el secreto
 * BARRACA_APROBADOR_EMAIL (si falta, las acciones quedan bloqueadas) y manda el
 * correo por Resend. Las herramientas usan esto, no aprobaciones.ts directo:
 *
 *   const r = await solicitarAprobacionReal(ctx.db, { usuario, herramienta, motivos, resumen, detalle, huella });
 *   if (!r.ok) return "Acción bloqueada: Jorge no tiene configurado el correo de aprobación.";
 */
import type { D1Like } from "../gestion/index.ts";
import { solicitarAprobacion, type DatosSolicitud, type DepsAprobacion } from "./aprobaciones.ts";
import { enviarCorreoAprobacion } from "./correo-aprobacion.ts";
import { baseCanonica } from "./config.ts";

export function depsAprobacionReales(): DepsAprobacion {
  return {
    // Secreto de Cloudflare (`wrangler secret put BARRACA_APROBADOR_EMAIL`), nunca en el código.
    aprobadorEmail: process.env.BARRACA_APROBADOR_EMAIL,
    enviar: enviarCorreoAprobacion,
    base: baseCanonica(),
  };
}

export function solicitarAprobacionReal(db: D1Like, datos: DatosSolicitud) {
  return solicitarAprobacion(db, datos, depsAprobacionReales());
}
