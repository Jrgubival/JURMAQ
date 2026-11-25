/**
 * Textos de los correos al cliente (confirmación, pago recibido, rechazo, anulación, devolución,
 * opinión, boleta o factura): ver, editar el borrador, previsualizar, publicar y restaurar.
 *
 * Reglas (de Jorge):
 *  - Solo se editan TEXTOS, con variables fijas y validadas por correo. El diseño HTML, los productos,
 *    el total, los datos de la cuenta para transferir, los enlaces de pago y los Términos son bloques
 *    fijos del código (lib/pedidos/correos.ts): ninguna herramienta puede tocarlos ni moverlos.
 *  - Sin HTML, sin teléfonos, correos ni enlaces fuera de jurmaq.cl, sin datos bancarios ni montos.
 *  - El borrador es libre (nada lo envía). PUBLICAR siempre necesita la aprobación de Jorge: dos pasos
 *    (`publicar_correo` sin id = vista previa; con id = pide el OK, y cuando él aprueba se repite la
 *    misma llamada y se aplica una sola vez). Sin BARRACA_APROBADOR_EMAIL queda bloqueado.
 *  - Si D1 falla o la plantilla publicada queda dañada, el correo sale con el texto del código.
 *  - Ninguna herramienta de este archivo envía correos.
 */
import type { D1Like } from "../../gestion/tipos.ts";
import { consumirVistaPrevia, crearVistaPrevia } from "../../gestion/index.ts";
import { mirarVistaPrevia, MENSAJE_VISTA } from "../../gestion-precios/vistas.ts";
import { exigirAprobacion } from "../../gestion-precios/aprobacion.ts";
import { PLANTILLAS, VARIABLES, esClaveCorreo, variablesDeCampo, type ClaveCorreo } from "../../correos-cliente/plantillas.ts";
import { validarPlantilla } from "../../correos-cliente/validar.ts";
import { variablesEjemplo, vistaPreviaTexto } from "../../correos-cliente/render.ts";
import {
  descartarBorrador, estadoCorreo, guardarBorrador, igualesTextos, leerVersion, listarCorreos, listarVersiones, publicarBorrador, volverAVersion,
  type EstadoCorreo, type Textos,
} from "../../correos-cliente/repositorio.ts";
import { diferenciasCampos, huellaPublicacion, resumenParaAprobador, vistaConEjemplo } from "../../correos-cliente/servicio.ts";
import { defineHerramienta, ErrorHerramienta, z, type ContextoHerramienta, type Revertidor, type SalidaHerramienta } from "./registro.ts";
import { obtenerDeps } from "./productos-comun.ts";
import { usuarioDe } from "./contenido-comun.ts";

const TIPO_VISTA = "correo_publicar";
/** La vista previa de una publicación dura lo que la aprobación (4 h) más un margen. */
const TTL_VISTA_MS = 5 * 3_600_000;
const ENTIDAD = "correo";

const esquemaClave = z.string().trim().min(3).max(40).describe("Clave del correo (listar_plantillas_correo).");

function claveValida(clave: string): ClaveCorreo {
  if (!esClaveCorreo(clave)) throw new ErrorHerramienta(`No existe el correo «${clave.slice(0, 40)}». Usa listar_plantillas_correo para ver los que se pueden editar.`);
  return clave;
}

const textoFormas = (est: EstadoCorreo) => (est.origen === "d1" ? `publicado, versión ${est.versionPublicada}` : "texto original del código");

async function descartarCache(): Promise<void> {
  try {
    const m = await import("../../correos-cliente/servidor.ts");
    m.invalidarLecturaCorreos();
  } catch {
    // Fuera del servidor (pruebas) no hay caché; en producción la caché dura 30 s.
  }
}

// ───────── lectura ─────────
export const listarPlantillasCorreo = defineHerramienta({
  nombre: "listar_plantillas_correo",
  titulo: "Listar los correos al cliente que se pueden editar",
  descripcion:
    "Muestra los correos que la tienda manda a los clientes (confirmación de pedido, pago recibido, rechazo, anulación, devolución, opinión, boleta o factura) con cuándo se envían, si hoy salen con el texto original del código o con uno publicado, y si hay un borrador sin publicar. Solo se editan los textos; el detalle del pedido, los datos de transferencia y los enlaces son fijos.",
  esquema: z.object({}),
  anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  ejecutar: async (_a, ctx) => {
    const todos = await listarCorreos(ctx.db);
    const lineas = todos.map((e) => `- ${e.clave}: ${PLANTILLAS[e.clave].titulo}. Hoy sale con ${textoFormas(e)}.${e.borradorSinPublicar ? " Hay un borrador sin publicar." : ""}${e.publicadoDanado ? " OJO: lo publicado dejó de validar; está saliendo el texto del código." : ""}`);
    return {
      texto: `${lineas.join("\n")}\n\nSiguiente paso: ver_plantilla_correo con la clave para ver los textos y las variables permitidas.`,
      datos: { correos: todos.map((e) => ({ clave: e.clave, titulo: PLANTILLAS[e.clave].titulo, cuando: PLANTILLAS[e.clave].cuando, origen: e.origen, version_publicada: e.versionPublicada, borrador_sin_publicar: e.borradorSinPublicar })) },
    };
  },
});

export const verPlantillaCorreo = defineHerramienta({
  nombre: "ver_plantilla_correo",
  titulo: "Ver los textos de un correo al cliente",
  descripcion:
    "Muestra, campo por campo, el texto que sale hoy, el borrador (si hay) y el texto original del código de un correo al cliente, junto con las variables permitidas, el largo máximo y las reglas. Con `version` muestra una versión anterior del historial (0 = el texto original del código).",
  esquema: z.object({
    clave: esquemaClave,
    version: z.number().int().min(0).max(100000).optional().describe("Versión del historial a mostrar (0 = texto original del código)."),
  }),
  anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => {
    const clave = claveValida(a.clave);
    const def = PLANTILLAS[clave];
    const est = await estadoCorreo(ctx.db, clave);
    const versiones = await listarVersiones(ctx.db, clave, 10);
    let version: Textos | null = null;
    if (a.version !== undefined) {
      version = await leerVersion(ctx.db, clave, a.version);
      if (!version) throw new ErrorHerramienta(`No existe la versión ${a.version} de ese correo.`);
    }
    const campos = def.campos.map((c) => {
      const lineas = [`• ${c.clave} (${c.etiqueta}${c.cuando ? `; ${c.cuando}` : ""}${c.opcional ? "; opcional" : ""}; máx. ${c.max}): ${JSON.stringify(est.efectivo[c.clave] ?? "")}`];
      if (est.borrador && (est.borrador[c.clave] ?? "") !== (est.efectivo[c.clave] ?? "")) lineas.push(`    borrador: ${JSON.stringify(est.borrador[c.clave] ?? "")}`);
      if (version) lineas.push(`    versión ${a.version}: ${JSON.stringify(version[c.clave] ?? "")}`);
      return lineas.join("\n");
    });
    const vars = def.variables.map((v) => `{${v}} = ${VARIABLES[v].descripcion}${VARIABLES[v].soloCuerpo ? " (solo en párrafos)" : ""}`);
    return {
      texto: [
        `${def.titulo}. ${def.cuando}`,
        `Hoy sale con ${textoFormas(est)}.${est.borrador ? (est.borradorSinPublicar ? " Hay un borrador sin publicar." : " El borrador es igual a lo que sale hoy.") : " No hay borrador."}`,
        "", "Campos (texto de hoy):", ...campos, "",
        "Variables permitidas (se escriben entre llaves): ", ...vars.map((v) => `  ${v}`), "",
        "Reglas: solo texto (sin HTML), **negrita** solo en párrafos, sin teléfonos, correos ni enlaces fuera de jurmaq.cl, sin datos bancarios ni montos escritos a mano. El detalle del pedido, los datos para transferir, los enlaces y los Términos son fijos.",
        versiones.length ? `\nHistorial (últimas): ${versiones.map((v) => `v${v.version}${v.vigente ? " (vigente)" : ""}`).join(", ")}. Versión 0 = texto original del código.` : "\nSin versiones publicadas todavía (sale el texto original del código).",
      ].join("\n"),
      datos: {
        clave, origen: est.origen, version_publicada: est.versionPublicada,
        efectivo: est.efectivo, borrador: est.borrador, original: PLANTILLAS[clave].campos.reduce<Textos>((o, c) => ({ ...o, [c.clave]: c.defecto }), {}),
        variables: Object.fromEntries(def.campos.map((c) => [c.clave, variablesDeCampo(clave, c)])),
      },
    };
  },
});

function textoPrevia(clave: ClaveCorreo, textos: Textos): string {
  return vistaPreviaTexto(clave, textos, variablesEjemplo(clave));
}

export const previsualizarCorreo = defineHerramienta({
  nombre: "previsualizar_correo",
  titulo: "Vista previa de un correo al cliente",
  descripcion:
    "Muestra cómo queda un correo al cliente con datos de ejemplo (nombre, número de pedido, total…): asunto, resumen de la bandeja, título y cada párrafo, con una línea [FIJO] donde la tienda pone sus bloques (productos, datos de transferencia, botones, Términos). Por defecto muestra el borrador si hay y si no lo que sale hoy. No cambia nada ni envía nada.",
  esquema: z.object({
    clave: esquemaClave,
    fuente: z.enum(["borrador", "publicado", "codigo"]).optional().describe("Qué texto mostrar: el borrador, lo que sale hoy («publicado») o el original del código."),
  }),
  anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => {
    const clave = claveValida(a.clave);
    const est = await estadoCorreo(ctx.db, clave);
    const fuente = a.fuente ?? (est.borrador ? "borrador" : "publicado");
    let textos: Textos;
    if (fuente === "borrador") {
      if (!est.borrador) throw new ErrorHerramienta("No hay borrador de ese correo. Crea uno con editar_borrador_correo.");
      textos = est.borrador;
    } else textos = fuente === "codigo" ? Object.fromEntries(PLANTILLAS[clave].campos.map((c) => [c.clave, c.defecto])) : est.efectivo;
    return {
      texto: `Vista previa (${fuente === "codigo" ? "texto original del código" : fuente === "publicado" ? `lo que sale hoy: ${textoFormas(est)}` : "BORRADOR, todavía no se envía a nadie"}), con datos de ejemplo:\n\n${textoPrevia(clave, textos)}`,
      datos: { clave, fuente },
    };
  },
});

// ───────── escritura del borrador (libre) ─────────
export const editarBorradorCorreo = defineHerramienta({
  nombre: "editar_borrador_correo",
  titulo: "Editar el borrador de un correo al cliente",
  descripcion:
    "Cambia uno o más textos del BORRADOR de un correo al cliente (los demás campos quedan como estaban en el borrador, o como salen hoy si no había borrador). Pasa `campos` con la clave de cada campo y su texto nuevo. Las variables van entre llaves, por ejemplo {nombre} o {numero_pedido}; **negrita** solo en párrafos; sin HTML, sin enlaces, sin teléfonos, sin datos bancarios ni montos escritos a mano. El borrador no cambia nada para los clientes: para que salga hay que publicarlo con publicar_correo (necesita el OK de Jorge). Se puede deshacer.",
  esquema: z.object({
    clave: esquemaClave,
    campos: z.record(z.string().trim().min(1).max(40), z.string().max(700)).refine((o) => Object.keys(o).length >= 1 && Object.keys(o).length <= 12, "Pasa entre 1 y 12 campos.")
      .describe("Objeto {campo: texto nuevo}. Los campos y sus variables están en ver_plantilla_correo."),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => {
    const clave = claveValida(a.clave);
    const def = PLANTILLAS[clave];
    for (const k of Object.keys(a.campos)) {
      if (!def.campos.some((c) => c.clave === k)) throw new ErrorHerramienta(`El campo «${k.slice(0, 40)}» no existe en este correo. Los campos son: ${def.campos.map((c) => c.clave).join(", ")}.`);
    }
    const est = await estadoCorreo(ctx.db, clave);
    const base = est.borrador ?? est.efectivo;
    const nuevo: Textos = { ...base, ...a.campos };
    const r = await guardarBorrador(ctx.db, clave, nuevo, usuarioDe(ctx), ctx.ahora);
    if (!r.ok) throw new ErrorHerramienta(`No guardé el borrador:\n- ${r.errores.join("\n- ")}`);
    await ctx.auditar([{ entidad: ENTIDAD, entidadId: clave, antes: { borrador: r.antes }, despues: { borrador: r.despues } }]);
    const cambios = diferenciasCampos(clave, est.efectivo, r.despues);
    return {
      texto: `Borrador de «${def.titulo}» guardado. Todavía NO se envía a los clientes: sigue saliendo ${textoFormas(est)}.\n\n${textoPrevia(clave, r.despues)}\n\nPara que salga: publicar_correo (necesita la aprobación de Jorge).`,
      datos: { clave, campos_distintos_de_hoy: cambios.map((c) => c.campo), publicado: false },
    };
  },
  revertidor: revertirBorradores(),
});

export const restaurarCorreo = defineHerramienta({
  nombre: "restaurar_correo",
  titulo: "Restaurar un texto anterior de un correo al cliente",
  descripcion:
    "Copia al BORRADOR el texto de una versión anterior del historial de un correo al cliente (`version` 0 = el texto original del código). No cambia lo que reciben los clientes: después hay que publicarlo con publicar_correo (necesita el OK de Jorge). Se puede deshacer.",
  esquema: z.object({ clave: esquemaClave, version: z.number().int().min(0).max(100000).describe("Versión del historial; 0 = texto original del código.") }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => {
    const clave = claveValida(a.clave);
    const textos = await leerVersion(ctx.db, clave, a.version);
    if (!textos) throw new ErrorHerramienta(`No existe la versión ${a.version} de ese correo, o ya no cumple las reglas actuales.`);
    const r = await guardarBorrador(ctx.db, clave, textos, usuarioDe(ctx), ctx.ahora);
    if (!r.ok) throw new ErrorHerramienta(`Esa versión ya no cumple las reglas actuales y no se puede restaurar:\n- ${r.errores.join("\n- ")}`);
    await ctx.auditar([{ entidad: ENTIDAD, entidadId: clave, antes: { borrador: r.antes }, despues: { borrador: r.despues } }]);
    return {
      texto: `Listo: el borrador de «${PLANTILLAS[clave].titulo}» quedó con ${a.version === 0 ? "el texto original del código" : `la versión ${a.version}`}. Los clientes siguen recibiendo lo mismo de antes hasta que se publique (publicar_correo, con el OK de Jorge).\n\n${textoPrevia(clave, r.despues)}`,
      datos: { clave, version: a.version, publicado: false },
    };
  },
  revertidor: revertirBorradores(),
});

function revertirBorradores(): Revertidor {
  return async ({ db, usuario, ahora, entradas }) => {
    const mensajes: string[] = [];
    let ajenos = 0;
    for (const e of [...entradas].reverse()) {
      const clave = e.entidadId;
      if (!esClaveCorreo(clave)) return { ok: false, mensaje: "No reconozco ese correo." };
      const antes = ((e.antes ?? {}) as { borrador?: Textos | null }).borrador ?? null;
      const despues = ((e.despues ?? {}) as { borrador?: Textos | null }).borrador ?? null;
      const est = await estadoCorreo(db, clave);
      if (!igualesTextos(est.borrador, despues)) { ajenos++; continue; }
      if (antes === null) {
        await descartarBorrador(db, clave);
        mensajes.push(`Borrador de «${PLANTILLAS[clave].titulo}» descartado (antes no había).`);
      } else {
        const r = await guardarBorrador(db, clave, antes, usuario, ahora);
        if (!r.ok) return { ok: false, mensaje: `No pude restaurar el borrador de «${PLANTILLAS[clave].titulo}».` };
        mensajes.push(`Borrador de «${PLANTILLAS[clave].titulo}» vuelto a como estaba.`);
      }
    }
    if (ajenos > 0 && mensajes.length === 0) return { ok: false, mensaje: "Alguien cambió el borrador después; no lo piso. Revísalo antes de deshacer." };
    return { ok: true, mensaje: [...mensajes, ...(ajenos ? [`${ajenos} cambio(s) se dejaron como estaban porque alguien los cambió después.`] : [])].join(" ") };
  };
}

// ───────── publicar (SIEMPRE con la aprobación de Jorge) ─────────
const MENSAJES_PUBLICAR: Record<string, string> = {
  sin_borrador: "No hay borrador de ese correo. Crea uno con editar_borrador_correo.",
  invalido: "El borrador ya no cumple las reglas. Corrígelo con editar_borrador_correo.",
  sin_cambios: "El borrador es igual a lo que sale hoy: no hay nada que publicar.",
  conflicto: "Alguien cambió el correo mientras tanto. No se publicó nada: genera una vista previa nueva con publicar_correo.",
};

export const publicarCorreo = defineHerramienta({
  nombre: "publicar_correo",
  titulo: "Publicar el texto de un correo al cliente (necesita OK de Jorge)",
  descripcion:
    "Hace que un correo al cliente salga con el texto del borrador. SIEMPRE necesita la aprobación de Jorge, en dos pasos: (1) sin `vista_previa_id` muestra cómo queda y entrega un id de un solo uso (vale 5 horas); (2) con ese id manda a Jorge el correo con el enlace de aprobación y NO publica nada hasta que él apruebe; cuando apruebe, repite la misma llamada con el mismo id y se publica una sola vez. Si cambió el borrador o el correo entre medio, se rechaza. Sin el correo del aprobador configurado queda bloqueado. Se puede deshacer volviendo a una versión ya aprobada.",
  esquema: z.object({
    clave: esquemaClave,
    vista_previa_id: z.string().trim().min(8).max(16).optional().describe("Id de la vista previa del paso 1. Sin id se hace el paso 1."),
    nota: z.string().trim().max(200).optional().describe("Nota corta para el historial (opcional)."),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  ejecutar: async (a, ctx): Promise<SalidaHerramienta> => {
    const clave = claveValida(a.clave);
    const def = PLANTILLAS[clave];
    const est = await estadoCorreo(ctx.db, clave);
    if (!est.borrador) throw new ErrorHerramienta(MENSAJES_PUBLICAR.sin_borrador);
    const v = validarPlantilla(clave, est.borrador);
    if (!v.ok) throw new ErrorHerramienta(`${MENSAJES_PUBLICAR.invalido}\n- ${v.errores.join("\n- ")}`);
    if (igualesTextos(est.borrador, est.efectivo)) throw new ErrorHerramienta(MENSAJES_PUBLICAR.sin_cambios);
    const cambios = diferenciasCampos(clave, est.efectivo, est.borrador);
    const huella = await huellaPublicacion(est);

    // Paso 1: vista previa de un solo uso.
    if (!a.vista_previa_id) {
      const vista = await crearVistaPrevia(ctx.db, { usuarioId: ctx.usuario.id, tipo: TIPO_VISTA, payload: { clave, version: est.versionPublicada, campos: cambios.map((c) => c.campo) }, huella, ttlMs: TTL_VISTA_MS }, ctx.ahora);
      return {
        texto: [
          `Vista previa de la publicación de «${def.titulo}» (lo que reciben los clientes cambiaría así, con datos de ejemplo):`, "",
          textoPrevia(clave, est.borrador), "",
          `Campos que cambian: ${cambios.map((c) => c.etiqueta).join(", ")}.`,
          `Id de vista previa: ${vista.id} (sirve una sola vez; vence en 5 horas).`,
          `Para publicar: publicar_correo con clave ${clave} y vista_previa_id "${vista.id}". Eso le manda a Jorge el correo para aprobar; no se publica hasta que él apruebe. Efecto: ningún correo se envía ahora; solo cambia el texto de los correos que se manden desde ahora.`,
        ].join("\n"),
        datos: { vista_previa_id: vista.id, expira_en: vista.expiraEn, campos: cambios.map((c) => c.campo) },
      };
    }

    // Paso 2: confirmar con el id.
    const vista = await mirarVistaPrevia(ctx.db, { id: a.vista_previa_id, usuarioId: ctx.usuario.id, tipo: TIPO_VISTA }, ctx.ahora);
    if (!vista.ok) throw new ErrorHerramienta(MENSAJE_VISTA[vista.motivo]);
    if ((vista.payload as { clave?: string } | null)?.clave !== clave) throw new ErrorHerramienta("Esa vista previa es de otro correo. Genera una nueva para este.");
    if (!vista.huella || vista.huella !== huella) throw new ErrorHerramienta(MENSAJE_VISTA.huella_cambiada);

    const deps = await obtenerDeps();
    const aprobacion = await exigirAprobacion(ctx.db, deps.aprobacion, {
      usuario: ctx.usuario,
      herramienta: "publicar_correo",
      motivos: ["correo_cliente"],
      resumen: resumenParaAprobador(clave, est.borrador, cambios),
      detalle: {
        correo: clave, titulo: def.titulo, version_vigente: est.versionPublicada,
        cambios: cambios.map((c) => ({ campo: c.etiqueta, antes: c.antes, despues: c.despues })),
        textoCompleto: `Así queda el correo con datos de ejemplo (los bloques [FIJO] los arma la tienda y no cambian):\n\n${vistaConEjemplo(clave, est.borrador)}`,
      },
      huella,
    }, ctx.ahora);
    if (aprobacion.tipo !== "aprobada") return { texto: aprobacion.mensaje, datos: { publicado: false, estado: aprobacion.tipo } };

    // Gasta la vista previa (un solo uso) y recién después la aprobación.
    const consumo = await consumirVistaPrevia(ctx.db, { id: vista.id, usuarioId: ctx.usuario.id, tipo: TIPO_VISTA, huellaActual: huella }, ctx.ahora);
    if (!consumo.ok) throw new ErrorHerramienta(consumo.motivo === "huella_cambiada" ? MENSAJE_VISTA.huella_cambiada : MENSAJE_VISTA[consumo.motivo as keyof typeof MENSAJE_VISTA]);
    if (!(await aprobacion.gastar())) throw new ErrorHerramienta("La aprobación de Jorge ya se había usado. No se publicó nada; genera una vista previa nueva.");

    const r = await publicarBorrador(ctx.db, { clave, usuario: usuarioDe(ctx), aprobacionId: aprobacion.id, esperado: { borrador: est.borrador, versionPublicada: est.versionPublicada }, nota: a.nota, ahora: ctx.ahora });
    if (!r.ok) {
      await aprobacion.devolver();
      throw new ErrorHerramienta(MENSAJES_PUBLICAR[r.motivo] ?? "No se pudo publicar.");
    }
    await ctx.auditar([{ entidad: ENTIDAD, entidadId: clave, antes: { version: r.antes.version, valor: r.antes.valor }, despues: { version: r.version, aprobacion: aprobacion.id } }]);
    await descartarCache();
    return {
      texto: `Listo: el correo «${def.titulo}» ahora sale con el texto nuevo (versión ${r.version}, aprobado por Jorge). Ya se usa en los próximos correos (puede tardar hasta 30 segundos). Si hay que volver atrás: restaurar_correo y publicar de nuevo, o deshacer el lote (vuelve a la versión anterior ya aprobada).`,
      datos: { publicado: true, clave, version: r.version },
    };
  },
  revertidor: async ({ db, usuario, ahora, entradas }) => {
    const mensajes: string[] = [];
    let ajenos = 0;
    for (const e of [...entradas].reverse()) {
      const clave = e.entidadId;
      if (!esClaveCorreo(clave)) return { ok: false, mensaje: "No reconozco ese correo." };
      const antes = (e.antes ?? {}) as { version?: number };
      const despues = (e.despues ?? {}) as { version?: number };
      if (!Number.isInteger(antes.version) || !Number.isInteger(despues.version)) return { ok: false, mensaje: "El registro de esa publicación está incompleto." };
      const r = await volverAVersion(db, { clave, desdeVersion: despues.version as number, aVersion: antes.version as number, usuario, ahora });
      if (r === "hecho") mensajes.push(`«${PLANTILLAS[clave].titulo}» volvió a ${antes.version === 0 ? "su texto original del código" : `la versión ${antes.version}`}.`);
      else if (r === "ya_estaba") mensajes.push(`«${PLANTILLAS[clave].titulo}» ya estaba así.`);
      else if (r === "cambio_ajeno") ajenos++;
      else return { ok: false, mensaje: `No encuentro la versión anterior de «${PLANTILLAS[clave].titulo}».` };
    }
    if (ajenos > 0 && mensajes.length === 0) return { ok: false, mensaje: "Alguien publicó otra versión después; no la piso. Usa restaurar_correo y publica con el OK de Jorge." };
    await descartarCache();
    return { ok: true, mensaje: [...mensajes, ...(ajenos ? [`${ajenos} correo(s) se dejaron como estaban porque se publicó otra versión después.`] : [])].join(" ") };
  },
});

export type { D1Like, ContextoHerramienta, EstadoCorreo };
