/**
 * Deshacer un lote de cambios. El mecanismo es común; cómo se revierte cada
 * cosa lo aporta cada herramienta con su `revertidor` (ver tools/registro.ts).
 * Todo o nada: si falta un revertidor o alguno falla, el lote NO se marca como
 * deshecho y se informa por qué.
 */
import { marcarDeshecho, obtenerLote, type D1Like, type UsuarioGestion } from "../gestion/index.ts";
import type { Registro } from "./tools/registro.ts";

export type ResultadoDeshacer =
  | { ok: true; revertidos: number; mensajes: string[] }
  | { ok: false; motivo: "no_existe" | "ya_deshecho" | "sin_revertidor" | "fallo"; mensaje: string };

/**
 * ¿Por qué este lote NO se puede deshacer hoy? null = se puede. Comprueba que existan todos los revertidores y, donde la
 * herramienta lo sabe (`puedeDeshacer`), que el dato siga como lo dejó (sin escribir nada).
 */
export async function motivoNoSePuedeDeshacer(
  db: D1Like, registro: Registro, loteId: string, usuario: UsuarioGestion = { id: "sistema", email: null } as UsuarioGestion, ahora: number = Date.now(),
): Promise<string | null> {
  const entradas = (await obtenerLote(db, loteId)).filter((e) => e.deshechoEn === null);
  if (entradas.length === 0) return "Ese lote ya se deshizo o no existe.";
  const porHerramienta = new Map<string, typeof entradas>();
  for (const e of entradas) porHerramienta.set(e.herramienta, [...(porHerramienta.get(e.herramienta) ?? []), e]);
  for (const nombre of porHerramienta.keys()) {
    if (!registro.obtener(nombre)?.revertidor) return "Alguna de sus herramientas no tiene deshacer (por ejemplo, textos legales aprobados o encendido de cupones).";
  }
  for (const [nombre, es] of porHerramienta) {
    const simula = registro.obtener(nombre)!.puedeDeshacer;
    if (!simula) continue;
    try {
      const r = await simula({ db, usuario, ahora, entradas: es, simular: true });
      if (!r.ok) return r.mensaje;
    } catch {
      return "No pude comprobar si se puede deshacer; intenta de nuevo.";
    }
  }
  return null;
}

/** ¿Este lote tiene botón Deshacer? (existen todos los revertidores, queda algo vigente y el dato sigue como se dejó). */
export async function loteSePuedeDeshacer(db: D1Like, registro: Registro, loteId: string): Promise<boolean> {
  return (await motivoNoSePuedeDeshacer(db, registro, loteId)) === null;
}

export async function deshacerLote(
  db: D1Like, registro: Registro, loteId: string, usuario: UsuarioGestion, ahora: number = Date.now(),
): Promise<ResultadoDeshacer> {
  const todas = await obtenerLote(db, loteId);
  if (todas.length === 0) return { ok: false, motivo: "no_existe", mensaje: "No encontré ese cambio." };
  const vigentes = todas.filter((e) => e.deshechoEn === null);
  if (vigentes.length === 0) return { ok: false, motivo: "ya_deshecho", mensaje: "Ese cambio ya se había deshecho." };
  const porHerramienta = new Map<string, typeof vigentes>();
  for (const e of vigentes) porHerramienta.set(e.herramienta, [...(porHerramienta.get(e.herramienta) ?? []), e]);
  for (const nombre of porHerramienta.keys()) {
    if (!registro.obtener(nombre)?.revertidor) {
      return { ok: false, motivo: "sin_revertidor", mensaje: "Este cambio todavía no se puede deshacer desde el panel." };
    }
  }
  const mensajes: string[] = [];
  let revertidos = 0;
  for (const [nombre, entradas] of porHerramienta) {
    let r;
    try {
      r = await registro.obtener(nombre)!.revertidor!({ db, usuario, ahora, entradas });
    } catch {
      return { ok: false, motivo: "fallo", mensaje: "No se pudo deshacer. No se cambió nada más; intenta de nuevo." };
    }
    if (!r.ok) return { ok: false, motivo: "fallo", mensaje: r.mensaje };
    if (r.mensaje) mensajes.push(r.mensaje);
    revertidos += entradas.length;
  }
  await marcarDeshecho(db, loteId, usuario.id, ahora);
  return { ok: true, revertidos, mensajes };
}
