/**
 * Piezas comunes de las herramientas de dinero y borrado (scope `tienda:dinero`): vista previa de un solo uso con
 * huella, aviso a Jorge ANTES de la operación (bloqueante), texto seguro del cliente y auditoría sin datos personales.
 * Ninguna herramienta de este grupo repite esta lógica.
 */
import { ErrorHerramienta, type ContextoHerramienta } from "./registro.ts";
import { consumirVistaPreviaConEspera, crearVistaPrevia, type MotivoRechazoConEspera } from "../../gestion/index.ts";
import {
  avisarOperacionDinero, correoAprobadorValido, iniciales, nombrePila, textoAviso, type DatosAvisoDinero, type DepsAviso,
} from "../aviso-operacion.ts";
import { datoCliente } from "../../pedidos/vista-mcp.ts";
import { TOPES_DINERO, TEXTO_TOPE, mensajeTope, reservarCupoDinero } from "../topes-dinero.ts";
import { despacharAvisoDinero, encolarAvisoDinero } from "../aviso-operacion.ts";

/** El id de confirmación de dinero y borrado dura poco (10 minutos) y sirve una sola vez; el valor vive en topes-dinero.ts. */
export const TTL_DINERO_MS = TOPES_DINERO.vistaPreviaDuraMs;

export const cl = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

/** Cliente para mostrar: SOLO nombre de pila (o iniciales), como dato entre marcadores; nunca como instrucción. */
export function clienteSeguro(nombre: unknown): string {
  const corto = nombrePila(nombre) ?? iniciales(nombre);
  return corto ? (datoCliente(corto, 40) ?? "(sin nombre)") : "(sin nombre)";
}

export const MENSAJES_VISTA: Record<MotivoRechazoConEspera, string> = {
  no_existe: "Ese id de vista previa no existe (o es de otra persona). Previsualiza de nuevo.",
  expirada: "La vista previa venció (duran 10 minutos). Previsualiza de nuevo.",
  usada: "Esa vista previa ya se usó. Cada una sirve una sola vez: si falta algo, previsualiza de nuevo.",
  tipo_distinto: "Ese id no corresponde a esta operación.",
  huella_cambiada: "Algo cambió desde la vista previa (o no coincide lo que confirmas). No se hizo nada: previsualiza de nuevo.",
  muy_pronto: "La confirmación llegó demasiado pronto: la vista previa y la confirmación no pueden ir pegadas ni en la misma llamada. Primero muéstrale la vista previa a Jorge y confirma solo cuando él lo pida. No se hizo nada y el id sigue sirviendo (espera unos segundos).",
};

export interface DepsAvisoDinero {
  aviso(): Promise<DepsAviso> | DepsAviso;
}

/** Antes de gastar el id de la vista previa: sin el correo de Jorge la operación está BLOQUEADA y el id sigue sirviendo. */
export async function exigirAvisoPosible(deps: DepsAvisoDinero): Promise<DepsAviso> {
  const d = await deps.aviso();
  if (!correoAprobadorValido(d.aprobadorEmail)) {
    throw new ErrorHerramienta(
      "BLOQUEADO: las operaciones de dinero y borrado avisan siempre a Jorge por correo y falta configurar su correo. No se hizo nada. Avísale a Jorge.",
    );
  }
  return d;
}

/** Crea la vista previa (10 min, ligada al usuario, con huella) y devuelve su id. */
export async function nuevaVista(ctx: ContextoHerramienta, tipo: string, payload: unknown, huella: string) {
  return crearVistaPrevia(ctx.db, { usuarioId: ctx.usuario.id, tipo, payload, huella, ttlMs: TTL_DINERO_MS }, ctx.ahora);
}

/** Gasta el id (una sola vez, solo si es de este usuario, no venció y la huella actual coincide) o falla con un mensaje claro. */
export async function gastarVista(ctx: ContextoHerramienta, id: string, tipo: string, huellaActual: string): Promise<unknown> {
  const c = await consumirVistaPreviaConEspera(ctx.db, { id, usuarioId: ctx.usuario.id, tipo, huellaActual, edadMinimaMs: TOPES_DINERO.esperaMinimaConfirmacionMs }, ctx.ahora);
  if (!c.ok) throw new ErrorHerramienta(MENSAJES_VISTA[c.motivo] ?? "No se pudo usar esa vista previa.");
  return c.payload;
}

/**
 * TOPE DURO de volumen (ver topes-dinero.ts), igual en ambos modos: reserva un cupo ANTES de ejecutar. Si se superó (o no se
 * pudo comprobar), rechaza con un mensaje claro y manda a Jorge un aviso del intento (resultado «bloqueado»).
 */
export async function exigirCupo(
  ctx: ContextoHerramienta, depsAviso: DepsAviso,
  d: { herramienta: string; operacion: string; pedidoNumero?: string | null; monto?: number | null; medio?: string | null; clienteNombre?: string | null; esDevolucion?: boolean },
): Promise<void> {
  const r = await reservarCupoDinero(ctx.db, { usuarioId: ctx.usuario.id, herramienta: d.herramienta, esDevolucion: d.esDevolucion, monto: d.monto ?? 0, ahora: ctx.ahora });
  if (r.ok) return;
  let linea = "";
  try {
    const enc = await encolarAvisoDinero(ctx.db, depsAviso, {
      usuario: ctx.usuario, herramienta: d.herramienta, operacion: `${d.operacion} (BLOQUEADA por tope)`, pedidoNumero: d.pedidoNumero ?? null,
      clienteNombre: d.clienteNombre ?? null, monto: d.monto ?? null, medio: d.medio ?? null, loteId: ctx.loteId, ahora: ctx.ahora,
      resumen: `Intento rechazado por un tope de seguridad: ${TEXTO_TOPE[r.motivo]}. No se hizo nada.`,
    });
    linea = enc.ok ? textoAviso(await despacharAvisoDinero(ctx.db, depsAviso, enc.id, "bloqueado", ctx.ahora)) : "ATENCIÓN: no se pudo registrar el aviso a Jorge sobre este intento. Avísale.";
  } catch {
    linea = "ATENCIÓN: no se pudo avisar a Jorge de este intento. Avísale.";
  }
  throw new ErrorHerramienta(`${mensajeTope(r.motivo)} ${linea}`.trim());
}

/**
 * Corre la operación irreversible entre el aviso previo a Jorge (registrado ANTES, bloqueante) y el correo (DESPUÉS).
 * Devuelve el resultado de la operación y la línea de texto sobre el aviso.
 */
export async function conAvisoDinero<T>(
  ctx: ContextoHerramienta, depsAviso: DepsAviso, datos: Omit<DatosAvisoDinero, "usuario" | "loteId" | "ahora">,
  operacion: () => Promise<T>, exito: (r: T) => boolean = () => true,
): Promise<{ resultado: T; lineaAviso: string }> {
  const r = await avisarOperacionDinero(ctx.db, depsAviso, { ...datos, usuario: ctx.usuario, loteId: ctx.loteId, ahora: ctx.ahora }, operacion, exito);
  if (!r.ok) throw new ErrorHerramienta(r.mensaje);
  return { resultado: r.resultado, lineaAviso: textoAviso(r.aviso) };
}

/**
 * Auditoría de la operación (sin datos personales). Si no se pudiera escribir, la operación YA ocurrió: no se
 * convierte en error, se avisa en el texto.
 */
export async function auditarSeguro(ctx: ContextoHerramienta, cambios: Parameters<ContextoHerramienta["auditar"]>[0]): Promise<string> {
  try {
    await ctx.auditar(cambios);
    return "";
  } catch {
    return " ATENCIÓN: la operación se hizo, pero no se pudo escribir en el historial de la tienda; anótalo.";
  }
}
