/**
 * Cambios de despacho (costo por zona, monto de despacho gratis, activar o
 * desactivar una zona). TODOS requieren la aprobación de Jorge: la herramienta
 * deja la solicitud y, cuando él aprueba, se repite la misma llamada y recién
 * ahí se escribe (a nombre del usuario que la pidió, con auditoría).
 */
import { huellaDeDatos } from "../gestion/util.ts";
import { exigirAprobacion } from "./aprobacion.ts";
import type { CtxGestion, DepsGestion } from "./deps.ts";
import { pesos } from "./modelo.ts";
import { ErrorGestion, type Salida } from "./precios-masivos.ts";
import type { MotivoAprobacion } from "../mcp/aprobaciones.ts";

const MAX_MONTO = 10_000_000;

export interface EntradaDespacho {
  zona_id: string;
  costo?: number;
  /** null = nunca gratis. */
  gratis_desde?: number | null;
  activo?: boolean;
}

export async function cambiarDespacho(deps: DepsGestion, ctx: CtxGestion, e: EntradaDespacho): Promise<Salida> {
  if (e.costo !== undefined && !(Number.isInteger(e.costo) && e.costo >= 0 && e.costo <= MAX_MONTO)) throw new ErrorGestion(`El costo debe ser un entero de pesos entre $0 y ${pesos(MAX_MONTO)}.`);
  if (e.gratis_desde !== undefined && e.gratis_desde !== null && !(Number.isInteger(e.gratis_desde) && e.gratis_desde >= 1 && e.gratis_desde <= MAX_MONTO)) throw new ErrorGestion(`El monto de despacho gratis debe ser un entero de pesos entre $1 y ${pesos(MAX_MONTO)} (o null para "nunca gratis").`);

  let zonas;
  try {
    zonas = await deps.zonas.listar();
  } catch {
    throw new ErrorGestion("La tabla de zonas de despacho no está disponible, así que no puedo cambiarla. Avísale a Jorge.");
  }
  const zona = zonas.find((z) => z.id === e.zona_id);
  if (!zona) throw new ErrorGestion(`No encontré la zona "${e.zona_id}". Mira las ids con ver_zonas_despacho.`);

  const antes: Record<string, unknown> = {};
  const despues: Record<string, unknown> = {};
  const motivos: MotivoAprobacion[] = [];
  if (e.costo !== undefined && e.costo !== zona.costo) { antes.costo = zona.costo; despues.costo = e.costo; motivos.push("despacho"); }
  if (e.gratis_desde !== undefined && (e.gratis_desde ?? null) !== (zona.gratis_desde ?? null)) { antes.gratis_desde = zona.gratis_desde; despues.gratis_desde = e.gratis_desde; motivos.push("envio_gratis"); }
  if (e.activo !== undefined && e.activo !== zona.activo) { antes.activo = zona.activo; despues.activo = e.activo; if (!motivos.includes("despacho")) motivos.push("despacho"); }
  if (Object.keys(despues).length === 0) return { texto: `La zona ${zona.nombre} ya estaba así. No hay nada que cambiar.`, datos: { aplicado: false } };

  const partes: string[] = [];
  if ("costo" in despues) partes.push(`costo ${pesos(zona.costo)} → ${pesos(despues.costo as number)}`);
  if ("gratis_desde" in despues) partes.push(`gratis desde ${zona.gratis_desde ? pesos(zona.gratis_desde) : "nunca"} → ${despues.gratis_desde ? pesos(despues.gratis_desde as number) : "nunca"}`);
  if ("activo" in despues) partes.push(despues.activo ? "activar la zona" : "desactivar la zona");
  const resumen = `Despacho a ${zona.nombre}: ${partes.join("; ")}.`;

  const huella = await huellaDeDatos({ v: 1, h: "cambiar_despacho", zona: zona.id, antes, despues });
  const r = await exigirAprobacion(ctx.db, deps.aprobacion, { usuario: ctx.usuario, herramienta: "cambiar_despacho", motivos, resumen, detalle: { zona: zona.id, antes, despues }, huella }, ctx.ahora);
  if (r.tipo !== "aprobada") return { texto: r.mensaje, datos: { aplicado: false, estado: r.tipo } };
  if (!(await r.gastar())) throw new ErrorGestion("La aprobación de Jorge ya se había usado. No se cambió nada; vuelve a pedirlo.");

  let ok = false;
  try {
    ok = await deps.zonas.actualizar(zona.id, despues as { costo?: number; gratis_desde?: number | null; activo?: boolean }, ctx.usuario.id);
  } catch {
    ok = false;
  }
  if (!ok) throw new ErrorGestion("No pude guardar el cambio de despacho. No se cambió nada; vuelve a pedirlo (necesitará una aprobación nueva).");
  await ctx.auditar([{ entidad: "zona", entidadId: zona.id, antes, despues }]);
  await deps.zonasCambiadas();
  return { texto: `Listo (aprobado por Jorge): ${resumen} El checkout toma el cambio en menos de un minuto. Se puede deshacer desde Administración > Conexiones.`, datos: { aplicado: true, zona: zona.id, lote_id: ctx.loteId } };
}
