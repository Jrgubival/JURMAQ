/**
 * Herramientas de HISTORIAL y DESHACER. Cada llamada que cambia datos es un
 * lote de auditoría; aquí se ve y se deshace entero, en dos pasos:
 *   previsualizar_deshacer_lote (qué se revertiría) → deshacer_lote (id de un solo uso).
 * El deshacer lo hace cada herramienta con su revertidor, que NO pisa un cambio
 * posterior de otra persona (si el dato ya no está como lo dejó la herramienta,
 * no se toca y se avisa). Todo o nada: si una parte no se puede, no se marca
 * nada como deshecho.
 */
import { listarLotes, obtenerLote, type EntradaAuditoria, type ResumenLote } from "../../gestion/auditoria.ts";
import { huellaDeDatos } from "../../gestion/util.ts";
import { consumirVistaPrevia, crearVistaPrevia } from "../../gestion/vistas-previas.ts";
import type { D1Like } from "../../gestion/tipos.ts";
import { deshacerLote, motivoNoSePuedeDeshacer } from "../deshacer.ts";
import { defineHerramienta, ErrorHerramienta, z, type Herramienta, type Registro } from "./registro.ts";
import { aEnteroSeguro, recortar, textoRechazoVistaPrevia, usuarioDe } from "./contenido-comun.ts";

const ID_LOTE = z.string().trim().min(8).max(64).describe("Id del lote (de ver_historial).");

const fechaHora = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";

/**
 * Cada acción hecha con herramientas deja la entrada de la herramienta (la que se
 * puede deshacer) y, además, la de la capa de servicio (`contenido.*`, `cupones.*`),
 * escrita en el mismo instante por la misma persona. Las de la capa de servicio
 * que acompañan a una herramienta se ocultan para no mostrar cada cambio dos veces.
 * Los cambios hechos desde el panel (otro instante) se siguen mostrando.
 */
export function sinDuplicadosDeServicio(lotes: ResumenLote[]): ResumenLote[] {
  const deHerramienta = new Set(lotes.filter((l) => !l.herramienta.includes(".")).map((l) => `${l.usuarioId}|${l.creadoEn}`));
  return lotes.filter((l) => !(l.herramienta.includes(".") && deHerramienta.has(`${l.usuarioId}|${l.creadoEn}`)));
}

/** Una entrada de auditoría como dato (antes/después recortados para no inflar la respuesta). */
function datosEntrada(e: EntradaAuditoria) {
  return { entidad: e.entidad, entidadId: e.entidadId, herramienta: e.herramienta, deshechoEn: e.deshechoEn, antes: recortarJson(e.antes), despues: recortarJson(e.despues) };
}

function recortarJson(v: unknown): unknown {
  const t = JSON.stringify(v ?? null);
  return t.length <= 1500 ? (v ?? null) : `${t.slice(0, 1500)}… [${t.length} caracteres]`;
}

function resumenEntrada(e: EntradaAuditoria): string {
  const estado = e.deshechoEn ? ` [deshecho ${fechaHora(e.deshechoEn)}]` : "";
  return `  · ${e.entidad} ${recortar(e.entidadId, 40)}${estado}\n      antes: ${recortar(JSON.stringify(e.antes ?? null), 260)}\n      después: ${recortar(JSON.stringify(e.despues ?? null), 260)}`;
}

async function huellaDeLote(db: D1Like, loteId: string) {
  const entradas = await obtenerLote(db, loteId);
  return { entradas, huella: await huellaDeDatos(entradas.map((e) => [e.id, e.deshechoEn])) };
}

export function crearHerramientasHistorial(obtenerRegistro: () => Registro): Herramienta[] {
  const ver_historial = defineHerramienta({
    nombre: "ver_historial",
    titulo: "Ver el historial de cambios",
    descripcion:
    "Sin «lote_id» lista los lotes de cambios recientes (quién, cuándo, herramienta, cuántos cambios, si se deshizo o se puede deshacer). Con «lote_id», el detalle con el valor de antes y de después. Para deshacer: previsualizar_deshacer_lote.",
    esquema: z.object({
      lote_id: ID_LOTE.optional(),
      limite: z.number().int().min(1).max(50).optional(),
      antes_de: z.number().int().positive().optional().describe("Para paginar: el «creadoEn» (milisegundos) del último lote recibido."),
      solo_vigentes: z.boolean().optional().describe("Solo lotes que todavía no se deshicieron."),
    }),
    anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ejecutar({ lote_id, limite, antes_de, solo_vigentes }, ctx) {
      if (lote_id) {
        const entradas = await obtenerLote(ctx.db, lote_id);
        if (entradas.length === 0) throw new ErrorHerramienta("No encontré ese lote.");
        const primero = entradas[0];
        const motivo = await motivoNoSePuedeDeshacer(ctx.db, obtenerRegistro(), lote_id);
        const puede = motivo === null;
        const lineas = entradas.slice(0, 30).map(resumenEntrada);
        return {
          texto: `Lote ${lote_id}: ${primero.herramienta} · ${fechaHora(primero.creadoEn)} · por ${primero.usuarioEmail ?? primero.usuarioId} · ${entradas.length} cambio(s) · ${puede ? "se puede deshacer" : `no se puede deshacer: ${motivo}`}\n${lineas.join("\n")}${entradas.length > 30 ? `\n… y ${entradas.length - 30} más.` : ""}`,
          datos: {
            loteId: lote_id, herramienta: primero.herramienta, creadoEn: primero.creadoEn, usuario: primero.usuarioEmail ?? primero.usuarioId, usuarioId: primero.usuarioId,
            cambios: entradas.length, sePuedeDeshacer: puede, motivoNoSePuede: motivo,
            entradas: entradas.slice(0, 30).map(datosEntrada),
          },
        };
      }
      const lim = aEnteroSeguro(limite, 15, 1, 50);
      const crudos = await listarLotes(ctx.db, { limite: Math.min(lim * 2, 100), antesDe: antes_de, soloVigentes: solo_vigentes });
      const lotes = sinDuplicadosDeServicio(crudos).slice(0, lim);
      if (lotes.length === 0) return { texto: "No hay cambios registrados con ese filtro.", datos: { lotes: [] } };
      const registro = obtenerRegistro();
      const filas = [];
      for (const l of lotes) {
        const motivo = l.deshecho ? "Ya se deshizo." : await motivoNoSePuedeDeshacer(ctx.db, registro, l.loteId);
        filas.push({ ...l, sePuedeDeshacer: motivo === null, motivoNoSePuede: motivo });
      }
      const texto = filas.map((l) => `- ${l.loteId} · ${fechaHora(l.creadoEn)} · ${l.herramienta} · ${l.usuarioEmail ?? l.usuarioId} · ${l.cambios} cambio(s)${l.deshecho ? " · DESHECHO" : l.deshechos ? ` · ${l.deshechos} deshecho(s)` : ""}${l.sePuedeDeshacer ? " · se puede deshacer" : ""}`).join("\n");
      const ultimo = lotes[lotes.length - 1];
      return { texto: `${texto}\n${crudos.length >= lim ? `Para ver más antiguos: antes_de ${ultimo.creadoEn}.` : ""}`.trim(), datos: { lotes: filas.map((l) => ({ loteId: l.loteId, creadoEn: l.creadoEn, herramienta: l.herramienta, usuario: l.usuarioEmail ?? l.usuarioId, usuarioId: l.usuarioId, cambios: l.cambios, deshecho: l.deshecho, deshechos: l.deshechos, sePuedeDeshacer: l.sePuedeDeshacer, motivoNoSePuede: l.sePuedeDeshacer ? null : l.motivoNoSePuede })), ...(crudos.length >= lim ? { siguienteAntesDe: ultimo.creadoEn } : {}) } };
    },
  });

  const previsualizar_deshacer_lote = defineHerramienta({
    nombre: "previsualizar_deshacer_lote",
    titulo: "Previsualizar un deshacer",
    descripcion:
    "Paso 1 de 2 para deshacer. No cambia nada: muestra qué se revertiría de ese lote y da un id de un solo uso. Muestra el resumen y espera el OK del usuario antes de deshacer_lote. Si alguien cambió algo después, esa parte no se pisa y el deshacer entero se cancela.",
    esquema: z.object({ lote_id: ID_LOTE }),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ejecutar({ lote_id }, ctx) {
      const { entradas, huella } = await huellaDeLote(ctx.db, lote_id);
      if (entradas.length === 0) throw new ErrorHerramienta("No encontré ese lote.");
      const vigentes = entradas.filter((e) => e.deshechoEn === null);
      if (vigentes.length === 0) throw new ErrorHerramienta("Ese lote ya se había deshecho.");
      const motivo = await motivoNoSePuedeDeshacer(ctx.db, obtenerRegistro(), lote_id);
      if (motivo !== null) throw new ErrorHerramienta(`Ese lote no se puede deshacer desde aquí: ${motivo}`);
      const vp = await crearVistaPrevia(ctx.db, { usuarioId: ctx.usuario.id, tipo: "deshacer_lote", payload: { loteId: lote_id }, huella }, ctx.ahora);
      const lineas = vigentes.slice(0, 25).map(resumenEntrada);
      return {
        texto: `Se deshacería el lote ${lote_id} (${vigentes[0].herramienta}, ${fechaHora(vigentes[0].creadoEn)}, ${vigentes.length} cambio(s)):\n${lineas.join("\n")}${vigentes.length > 25 ? `\n… y ${vigentes.length - 25} más.` : ""}\nSi algún dato ya no está como lo dejó esa herramienta, no se pisa y no se deshace nada.\nId de vista previa: ${vp.id} (un solo uso, vence en 15 minutos). Para aplicar: deshacer_lote con lote_id y ese id, solo con el OK del usuario.`,
        datos: {
          vistaPreviaId: vp.id, expiraEn: vp.expiraEn, loteId: lote_id, herramienta: vigentes[0].herramienta, creadoEn: vigentes[0].creadoEn,
          usuario: vigentes[0].usuarioEmail ?? vigentes[0].usuarioId, cambios: vigentes.length,
          entradas: vigentes.slice(0, 25).map(datosEntrada),
          ...(vigentes.length > 25 ? { entradasOmitidas: vigentes.length - 25 } : {}),
        },
      };
    },
  });

  const deshacer_lote = defineHerramienta({
    nombre: "deshacer_lote",
    titulo: "Deshacer un lote de cambios (paso 2)",
    descripcion:
    "Paso 2 de 2: deshace el lote con el id de previsualizar_deshacer_lote (un solo uso, solo tuyo; se rechaza si el lote cambió). Todo o nada: si otra persona cambió un dato después, no se pisa y no se deshace nada. Solo con el OK del usuario.",
    esquema: z.object({ lote_id: ID_LOTE, vista_previa_id: z.string().min(8).max(20) }),
    anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    async ejecutar({ lote_id, vista_previa_id }, ctx) {
      const { huella } = await huellaDeLote(ctx.db, lote_id);
      const c = await consumirVistaPrevia(ctx.db, { id: vista_previa_id, usuarioId: ctx.usuario.id, tipo: "deshacer_lote", huellaActual: huella }, ctx.ahora);
      if (!c.ok) throw new ErrorHerramienta(textoRechazoVistaPrevia(c.motivo));
      if ((c.payload as { loteId?: string } | null)?.loteId !== lote_id) throw new ErrorHerramienta("Esa vista previa era de otro lote. No se deshizo nada.");
      const r = await deshacerLote(ctx.db, obtenerRegistro(), lote_id, usuarioDe(ctx), ctx.ahora);
      if (!r.ok) throw new ErrorHerramienta(r.mensaje);
      return { texto: `Listo: se deshicieron ${r.revertidos} cambio(s) del lote ${lote_id}. ${r.mensajes.join(" ")}`.trim(), datos: { revertidos: r.revertidos } };
    },
  });

  return [ver_historial, previsualizar_deshacer_lote, deshacer_lote] as unknown as Herramienta[];
}
