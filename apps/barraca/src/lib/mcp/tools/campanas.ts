/**
 * Campañas a suscriptores: SOLO BORRADORES. Crear, editar, listar, ver, previsualizar, restaurar una
 * versión y borrar borradores, con historial y auditoría.
 *
 * NINGUNA herramienta de este archivo envía, programa ni dispara envíos, y este archivo no importa nada
 * que lo haga (hay una prueba que lo exige). Jorge envía la campaña él mismo, desde donde corresponde
 * (hoy `scripts/enviar-campana.mjs`: por tandas, con tope diario, respetando las bajas).
 * De los suscriptores solo se muestra el NÚMERO, nunca correos ni nombres.
 * El contenido pasa por un saneamiento estricto (campanas/contenido.ts): sin HTML, enlaces solo a jurmaq.cl,
 * sin teléfonos ni correos, y el asunto dice «Publicidad» (Ley 19.496, art. 28 B).
 */
import {
  borrarCampana, crearCampana, datosDe, editarCampana, esIdCampana, igualesCampana, leerVersionCampana, listarCampanas, obtenerCampana, recuperarCampana, versionesDeCampana, volverCampana,
  type Campana,
} from "../../campanas/repositorio.ts";
import { vistaPreviaCampana, type DatosCampana } from "../../campanas/contenido.ts";
import { defineHerramienta, ErrorHerramienta, z, type ContextoHerramienta, type Revertidor, type SalidaHerramienta } from "./registro.ts";
import { usuarioDe } from "./contenido-comun.ts";

export interface DepsCampanas {
  /** Número de suscriptores activos (null = no disponible). Nunca correos. */
  contarSuscriptores(): Promise<number | null>;
}

let depsDePrueba: DepsCampanas | null = null;
/** Solo para pruebas. */
export function fijarDepsCampanas(d: DepsCampanas | null): void {
  depsDePrueba = d;
}
async function contar(): Promise<number | null> {
  if (depsDePrueba) return depsDePrueba.contarSuscriptores();
  try {
    const m = await import("../../campanas/suscriptores.ts");
    return await m.contarSuscriptoresActivos();
  } catch {
    return null;
  }
}

const ENTIDAD = "campana";
const AVISO_NO_ENVIA = "Esto es solo un borrador: ninguna herramienta lo envía. Jorge lo envía él mismo, desde donde corresponde.";

const idSchema = z.string().trim().min(10).max(10).regex(/^[2-9A-Za-hj-km-np-zA-HJ-KM-NP-Z]{10}$/, "Id de campaña no válido").describe("Id del borrador (ver_campanas).");

const campos = {
  asunto: z.string().max(200).describe("Debe decir «Publicidad» (ley del consumidor)."),
  texto: z.string().max(4500).describe("Párrafos separados por una línea en blanco. Sin HTML ni enlaces."),
  enlace: z.string().max(400).nullable().describe("Botón: https a jurmaq.cl o barraca.jurmaq.cl. null = sin botón."),
  segmento: z.string().max(300).nullable().describe("Para quién es, en palabras (no correos)."),
  fecha_sugerida: z.string().max(10).nullable().describe("AAAA-MM-DD. Solo sugerencia: nada se programa."),
};

async function resumen(c: Campana, suscriptores: number | null): Promise<string> {
  return vistaPreviaCampana(datosDe(c), suscriptores);
}

const filaListado = (c: Campana) => `- ${c.id}: «${c.asunto}»${c.segmento ? ` · para: ${c.segmento}` : ""}${c.fecha_sugerida ? ` · fecha sugerida ${c.fecha_sugerida}` : ""} · versión ${c.version}${c.borradoEn ? " · BORRADA" : ""}`;

const CAMPOS_EDITABLES = ["asunto", "texto", "enlace", "segmento", "fecha_sugerida"] as const;

export const guardarCampanaBorrador = defineHerramienta({
  nombre: "guardar_campana_borrador",
  titulo: "Crear o editar un borrador de campaña",
  descripcion:
    "Sin «id» crea un BORRADOR de campaña para suscriptores (asunto y texto obligatorios); con «id» cambia solo los campos que pases y crea una versión nueva. NO envía ni programa nada: Jorge la envía él mismo. Asunto con «Publicidad», sin HTML, enlace solo a jurmaq.cl; null quita enlace, segmento o fecha. Muestra la vista previa con el número de suscriptores (nunca correos). Se puede deshacer.",
  esquema: z.object({ id: idSchema.optional(), asunto: campos.asunto.optional(), texto: campos.texto.optional(), enlace: campos.enlace.optional(), segmento: campos.segmento.optional(), fecha_sugerida: campos.fecha_sugerida.optional() })
    .refine((o) => o.id === undefined || CAMPOS_EDITABLES.some((k) => o[k] !== undefined), "Con id, pasa al menos un campo para cambiar.")
    .refine((o) => o.id !== undefined || (o.asunto !== undefined && o.texto !== undefined), "Para crear un borrador hacen falta asunto y texto."),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  ejecutar: async (a, ctx) => {
    if (a.id === undefined) {
      // El servidor valida con la forma sin `refine`, así que se revisa aquí también.
      if (a.asunto === undefined || a.texto === undefined) throw new ErrorHerramienta("Para crear un borrador hacen falta asunto y texto (o pasa «id» para editar uno).");
      const r = await crearCampana(ctx.db, { asunto: a.asunto, texto: a.texto, enlace: a.enlace ?? null, segmento: a.segmento ?? null, fecha_sugerida: a.fecha_sugerida ?? null }, usuarioDe(ctx), ctx.ahora);
      if (!r.ok) throw new ErrorHerramienta(`No guardé la campaña:\n- ${r.errores.join("\n- ")}`);
      await ctx.auditar([{ entidad: ENTIDAD, entidadId: r.campana.id, antes: null, despues: { version: 1, datos: datosDe(r.campana) } }]);
      return { texto: `Borrador creado (id ${r.campana.id}).\n\n${await resumen(r.campana, await contar())}\n\n${AVISO_NO_ENVIA}`, datos: { id: r.campana.id, version: 1, enviada: false } };
    }
    const { id, ...cambios } = a;
    if (!CAMPOS_EDITABLES.some((k) => cambios[k] !== undefined)) throw new ErrorHerramienta("Pasa al menos un campo para cambiar.");
    const r = await editarCampana(ctx.db, id.toUpperCase(), cambios, usuarioDe(ctx), ctx.ahora);
    if (!r.ok) throw new ErrorHerramienta(`No cambié la campaña:\n- ${r.errores.join("\n- ")}`);
    const cambio = r.antes !== null && !igualesCampana(r.antes, datosDe(r.campana));
    if (cambio) await ctx.auditar([{ entidad: ENTIDAD, entidadId: r.campana.id, antes: { version: r.campana.version - 1, datos: r.antes }, despues: { version: r.campana.version, datos: datosDe(r.campana) } }]);
    return {
      texto: `${cambio ? `Borrador ${r.campana.id} actualizado (versión ${r.campana.version}).` : `El borrador ${r.campana.id} ya tenía esos datos: no cambió nada.`}\n\n${await resumen(r.campana, await contar())}\n\n${AVISO_NO_ENVIA}`,
      datos: { id: r.campana.id, version: r.campana.version, enviada: false },
    };
  },
  revertidor: revertirCampanas(),
});

export const verCampanas = defineHerramienta({
  nombre: "ver_campanas",
  titulo: "Ver borradores de campañas",
  descripcion:
    "Solo lectura. Sin «id»: lista los borradores (más recientes primero) y dice cuántos suscriptores activos hay (solo el número, nunca correos). Con «id»: el borrador completo y su historial (con «version», esa versión anterior; con «vista_previa», cómo quedaría el correo).",
  esquema: z.object({
    id: idSchema.optional(),
    version: z.number().int().min(1).max(100000).optional().describe("Con id: versión anterior a mostrar."),
    vista_previa: z.boolean().optional().describe("Con id: mostrar cómo queda el correo."),
    limite: z.number().int().min(1).max(50).optional().describe("Sin id: cuántos listar (25 por defecto)."),
    incluir_borradas: z.boolean().optional().describe("Sin id: incluir las borradas."),
  }),
  anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => {
    if (a.id === undefined) {
      const lista = await listarCampanas(ctx.db, { limite: a.limite, incluirBorradas: a.incluir_borradas });
      const n = await contar();
      const susc = n === null ? "Suscriptores activos: no pude consultarlo ahora." : `Suscriptores activos hoy: ${n} (el envío real además salta a quienes pidieron la baja).`;
      if (lista.length === 0) return { texto: `No hay borradores de campañas. Crea uno con guardar_campana_borrador.\n${susc}`, datos: { campanas: [], suscriptores_activos: n } };
      return { texto: `${lista.map(filaListado).join("\n")}\n\n${susc}\n${AVISO_NO_ENVIA}`, datos: { campanas: lista.map((c) => ({ id: c.id, asunto: c.asunto, version: c.version, borrada: c.borradoEn !== null })), suscriptores_activos: n } };
    }
    const c = await campanaOError(ctx, a.id);
    if (a.vista_previa) return { texto: `${await resumen(c, await contar())}\n\n${AVISO_NO_ENVIA}`, datos: { id: c.id, enviada: false } };
    const versiones = await versionesDeCampana(ctx.db, c.id, 15);
    let datos: DatosCampana = datosDe(c);
    if (a.version !== undefined) {
      const v = await leerVersionCampana(ctx.db, c.id, a.version);
      if (!v) throw new ErrorHerramienta(`No existe la versión ${a.version} de esa campaña.`);
      datos = v;
    }
    return {
      texto: [
        `Campaña ${c.id}${c.borradoEn ? " (BORRADA)" : ""}, versión vigente ${c.version}${a.version !== undefined ? `; mostrando la versión ${a.version}` : ""}.`,
        `Asunto: ${datos.asunto}`, `Segmento: ${datos.segmento ?? "(sin segmento)"}`, `Fecha sugerida: ${datos.fecha_sugerida ?? "(sin fecha)"}`, `Enlace del botón: ${datos.enlace ?? "(sin botón)"}`,
        "", datos.texto, "", `Historial: ${versiones.map((v) => `v${v.version}`).join(", ")}.`, AVISO_NO_ENVIA,
      ].join("\n"),
      datos: { id: c.id, version: c.version, borrada: c.borradoEn !== null },
    };
  },
});

export const borrarCampanaBorrador = defineHerramienta({
  nombre: "borrar_campana_borrador",
  titulo: "Borrar un borrador de campaña",
  descripcion: "Borra un borrador de campaña (queda marcado como borrado; se puede deshacer). No toca a ningún suscriptor: nada de esto envía correos.",
  esquema: z.object({ id: idSchema }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  ejecutar: async (a, ctx) => {
    const c = await borrarCampana(ctx.db, a.id.toUpperCase(), usuarioDe(ctx), ctx.ahora);
    if (!c) throw new ErrorHerramienta("No encontré ese borrador de campaña, o ya estaba borrado.");
    await ctx.auditar([{ entidad: ENTIDAD, entidadId: c.id, antes: { borrada: false, version: c.version }, despues: { borrada: true } }]);
    return { texto: `Borrador ${c.id} («${c.asunto}») borrado. Se puede deshacer desde el historial.`, datos: { id: c.id } };
  },
  revertidor: revertirCampanas(),
});

export const restaurarCampanaVersion = defineHerramienta({
  nombre: "restaurar_campana_version",
  titulo: "Restaurar una versión anterior de un borrador de campaña",
  descripcion: "Deja el borrador con el contenido de una versión anterior (crea una versión nueva; el historial se conserva). No envía nada. Se puede deshacer.",
  esquema: z.object({ id: idSchema, version: z.number().int().min(1).max(100000).describe("Versión a restaurar (ver_campanas).") }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => {
    const c = await campanaOError(ctx, a.id);
    if (c.borradoEn) throw new ErrorHerramienta("Ese borrador está borrado.");
    const v = await leerVersionCampana(ctx.db, c.id, a.version);
    if (!v) throw new ErrorHerramienta(`No existe la versión ${a.version} de esa campaña, o ya no cumple las reglas actuales.`);
    const r = await editarCampana(ctx.db, c.id, v, usuarioDe(ctx), ctx.ahora);
    if (!r.ok) throw new ErrorHerramienta(`No pude restaurarla:\n- ${r.errores.join("\n- ")}`);
    if (r.campana.version !== c.version) await ctx.auditar([{ entidad: ENTIDAD, entidadId: c.id, antes: { version: c.version, datos: datosDe(c) }, despues: { version: r.campana.version, datos: datosDe(r.campana) } }]);
    return { texto: `Borrador ${c.id} quedó con el contenido de la versión ${a.version} (ahora es la versión ${r.campana.version}).\n\n${await resumen(r.campana, await contar())}\n\n${AVISO_NO_ENVIA}`, datos: { id: c.id, version: r.campana.version } };
  },
  revertidor: revertirCampanas(),
});

async function campanaOError(ctx: ContextoHerramienta, id: string): Promise<Campana> {
  if (!esIdCampana(id)) throw new ErrorHerramienta("Id de campaña no válido.");
  const c = await obtenerCampana(ctx.db, id.toUpperCase());
  if (!c) throw new ErrorHerramienta("No encontré ese borrador de campaña.");
  return c;
}

/** Deshacer de crear, editar, restaurar y borrar. No pisa lo que alguien cambió después. */
function revertirCampanas(): Revertidor {
  return async ({ db, usuario, ahora, entradas }) => {
    const mensajes: string[] = [];
    let ajenos = 0;
    for (const e of [...entradas].reverse()) {
      const id = e.entidadId;
      const antes = (e.antes ?? null) as null | { version?: number; datos?: DatosCampana; borrada?: boolean };
      const despues = (e.despues ?? {}) as { version?: number; datos?: DatosCampana; borrada?: boolean };
      if (despues.borrada === true) {
        // Era un borrado: se recupera.
        const r = await recuperarCampana(db, id);
        if (r === "no_existe") return { ok: false, mensaje: "No encuentro ese borrador." };
        mensajes.push(r === "hecho" ? `Borrador ${id} recuperado.` : `Borrador ${id} ya estaba.`);
      } else if (antes === null) {
        // Era una creación: se borra (marca).
        const c = await obtenerCampana(db, id);
        if (!c) return { ok: false, mensaje: "No encuentro ese borrador." };
        if (c.borradoEn !== null) { mensajes.push(`Borrador ${id} ya estaba borrado.`); continue; }
        if (c.version !== despues.version) { ajenos++; continue; }
        await borrarCampana(db, id, usuario, ahora);
        mensajes.push(`Borrador ${id} borrado (lo había creado esta llamada).`);
      } else if (antes.datos && Number.isInteger(despues.version)) {
        const r = await volverCampana(db, id, despues.version as number, antes.datos, usuario, ahora);
        if (r === "no_existe") return { ok: false, mensaje: "No encuentro ese borrador." };
        if (r === "cambio_ajeno") ajenos++;
        else mensajes.push(r === "hecho" ? `Borrador ${id} vuelto a como estaba.` : `Borrador ${id} ya estaba así.`);
      } else return { ok: false, mensaje: "El registro de ese cambio está incompleto." };
    }
    if (ajenos > 0 && mensajes.length === 0) return { ok: false, mensaje: "Alguien editó el borrador después; no lo piso." };
    return { ok: true, mensaje: [...mensajes, ...(ajenos ? [`${ajenos} cambio(s) se dejaron como estaban porque alguien editó después.`] : [])].join(" ") };
  };
}

export type { SalidaHerramienta };
