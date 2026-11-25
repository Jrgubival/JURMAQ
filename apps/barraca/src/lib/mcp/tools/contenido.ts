/**
 * Herramientas de CONTENIDO editable de la tienda (términos, privacidad,
 * envíos, nosotros, contacto, datos del local, popup, láminas, cinta, avisos,
 * orden de portada y textos). Detrás está src/lib/contenido/ (repositorio).
 *
 * Reglas:
 *  - Todo texto pasa por el saneador del contenido (sin HTML ni scripts).
 *  - Editar guarda un BORRADOR (no se ve en la tienda). Publicar es en DOS
 *    pasos: previsualizar_publicacion_contenido y confirmar_publicacion_contenido
 *    (id de un solo uso, ligado al usuario y a la huella del contenido).
 *  - Términos y privacidad: confirmar deja la publicación PENDIENTE y manda el
 *    correo de aprobación a Jorge; se aplica con aplicar_aprobacion_contenido
 *    cuando él aprobó. Sin el secreto BARRACA_APROBADOR_EMAIL queda BLOQUEADO.
 *  - Los lugares que dependen de Next o de correo (revalidar páginas, enviar
 *    el correo) entran por `DepsContenido`, para poder probar todo sin servidor.
 */
import { huellaDeDatos, jsonEstable } from "../../gestion/util.ts";
import { consumirVistaPrevia, crearVistaPrevia } from "../../gestion/vistas-previas.ts";
import type { D1Like } from "../../gestion/tipos.ts";
import type * as RepoTipos from "../../contenido/repositorio.ts";
import { validarContenido } from "../../contenido/esquemas.ts";
import { CLAVES_CONTENIDO, META_CONTENIDO, type ClaveContenido, type ValoresContenido } from "../../contenido/tipos.ts";
import {
  consumirAprobacion,
  estadoAprobacion,
  requiereAprobacion,
  TEXTO_MOTIVO,
  type DatosSolicitud,
  type ResultadoSolicitud,
} from "../aprobaciones.ts";
import {
  defineHerramienta,
  ErrorHerramienta,
  z,
  type ContextoHerramienta,
  type Herramienta,
  type Revertidor,
} from "./registro.ts";
import { diferenciaPorLineas, esObjeto, mezclarProfundo, recortar, textoRechazoVistaPrevia, usuarioDe } from "./contenido-comun.ts";

/**
 * Repositorio de contenido, cargado al usarlo (no al importar este archivo): así el
 * catálogo de herramientas se puede cargar en cualquier entorno sin arrastrar el
 * respaldo en código del contenido (que importa el paquete compartido).
 */
type Repo = typeof RepoTipos;
const repo = new Proxy({} as Repo, {
  get: (_t, nombre: string) => (...args: unknown[]) =>
    import("../../contenido/repositorio.ts").then((m) => (m as unknown as Record<string, (...a: unknown[]) => unknown>)[nombre](...args)),
});

// ───────── Dependencias (reales por defecto, falsas en las pruebas) ─────────

export interface DepsContenido {
  /** Regenera las páginas que dependen de este contenido. Nunca debe lanzar. */
  revalidar(clave: ClaveContenido): Promise<void>;
  /** Comprueba que los códigos y slugs de la portada existan y estén activos. */
  verificarPortada(valor: unknown): Promise<{ ok: true } | { ok: false; errores: string[] }>;
  /** Crea la solicitud de aprobación para Jorge (correo con enlace de un solo uso). */
  solicitarAprobacion(db: D1Like, datos: DatosSolicitud): Promise<ResultadoSolicitud>;
}

export function depsContenidoReales(): DepsContenido {
  return {
    async revalidar(clave) {
      try {
        const m = await import("../../contenido/servicio.ts");
        m.revalidarContenido(clave);
      } catch {
        /* la publicación ya quedó; las páginas se regeneran solas en 5 minutos */
      }
    },
    async verificarPortada(valor) {
      const m = await import("../../contenido/servicio.ts");
      const r = await m.contenidoVerificarPortada(valor);
      if (!r.valida) return { ok: false, errores: r.errores };
      if (r.ok) return { ok: true };
      return {
        ok: false,
        errores: [
          ...r.productosFaltantes.map((c) => `No existe un producto activo con el código "${c}".`),
          ...r.categoriasFaltantes.map((s) => `No existe una categoría activa con el slug "${s}".`),
        ],
      };
    },
    async solicitarAprobacion(db, datos) {
      const m = await import("../aprobaciones-servidor.ts");
      return m.solicitarAprobacionReal(db, datos);
    },
  };
}

// ───────── Utilidades ─────────

const claveSchema = z.enum(CLAVES_CONTENIDO).describe(
  "Qué contenido: terminos, privacidad, envios, nosotros, contacto, datos_local (teléfono, WhatsApp, dirección, horario), popup, slides (carrusel de la portada), cinta (cinta superior), avisos (cierres, feriados, despacho), portada (orden de secciones y destacados) o textos.",
);

const CLAVES_OBJETO = ["contacto", "datos_local", "popup", "cinta", "portada", "textos"] as const;

const MAX_AUDITORIA_CHARS = 200_000;
const PARTE_CHARS = 12_000;

const etiqueta = (c: ClaveContenido) => META_CONTENIDO[c].etiqueta;

async function paraAuditar(valor: unknown): Promise<{ valor: unknown } | { sinCopia: true; huella: string }> {
  const s = JSON.stringify(valor ?? null);
  if (s.length <= MAX_AUDITORIA_CHARS) return { valor };
  return { sinCopia: true, huella: await huellaDeDatos(valor) };
}

async function validarONada<K extends ClaveContenido>(clave: K, valor: unknown): Promise<ValoresContenido[K]> {
  const v = validarContenido(clave, valor);
  if (!v.ok) throw new ErrorHerramienta(`No se guardó nada. Corrige esto y reintenta: ${v.errores.slice(0, 12).join(" | ")}`);
  return v.valor;
}

/** Marca los accesos a la D1 de gestión (si no está lista, el servidor traduce el error a un mensaje claro). */
const conGestion = <T>(fn: () => Promise<T>): Promise<T> => fn();

/** Texto que muestra un valor de contenido, por partes si es largo. */
function mostrarValor(clave: ClaveContenido, valor: unknown, parte: number): string {
  const texto = clave === "terminos" || clave === "privacidad" || clave === "envios" || clave === "nosotros"
    ? String((valor as { texto: string }).texto)
    : JSON.stringify(valor, null, 1);
  const partes = Math.max(1, Math.ceil(texto.length / PARTE_CHARS));
  const p = Math.min(Math.max(parte, 1), partes);
  const trozo = texto.slice((p - 1) * PARTE_CHARS, p * PARTE_CHARS);
  return `${trozo}${partes > 1 ? `\n\n[Parte ${p} de ${partes}. Pide la siguiente con parte: ${p + 1}.]` : ""}`;
}

/** Resumen corto de qué cambia entre lo que ve la tienda y el borrador. */
export function resumirCambio(clave: ClaveContenido, antes: unknown, despues: unknown): { lineas: string[]; detalle: Record<string, unknown> } {
  if (clave === "terminos" || clave === "privacidad" || clave === "envios" || clave === "nosotros") {
    const a = String((antes as { texto: string }).texto);
    const d = String((despues as { texto: string }).texto);
    const dif = diferenciaPorLineas(a, d);
    return {
      lineas: [
        `Texto: ${a.length} → ${d.length} caracteres. Líneas agregadas: ${dif.agregadas}. Líneas quitadas: ${dif.quitadas}.`,
        ...dif.ejemploQuitadas.slice(0, 8).map((l) => `  − ${l}`),
        ...dif.ejemploAgregadas.slice(0, 8).map((l) => `  + ${l}`),
      ],
      detalle: { caracteresAntes: a.length, caracteresDespues: d.length, agregadas: dif.agregadas, quitadas: dif.quitadas, ejemploAgregadas: dif.ejemploAgregadas, ejemploQuitadas: dif.ejemploQuitadas },
    };
  }
  if (Array.isArray(despues)) {
    const a = new Map((antes as Array<{ id: string }>).map((x) => [x.id, x]));
    const d = new Map((despues as Array<{ id: string }>).map((x) => [x.id, x]));
    const nuevos = [...d.keys()].filter((id) => !a.has(id));
    const quitados = [...a.keys()].filter((id) => !d.has(id));
    const editados = [...d.keys()].filter((id) => a.has(id) && jsonEstable(a.get(id)) !== jsonEstable(d.get(id)));
    const orden = jsonEstable([...a.keys()].filter((id) => d.has(id))) !== jsonEstable([...d.keys()].filter((id) => a.has(id)));
    const lineas = [
      `Elementos: ${a.size} → ${d.size}.`,
      ...(nuevos.length ? [`  Nuevos: ${nuevos.join(", ")}`] : []),
      ...(quitados.length ? [`  Quitados: ${quitados.join(", ")}`] : []),
      ...(editados.length ? [`  Modificados: ${editados.join(", ")}`] : []),
      ...(orden ? ["  Cambia el orden."] : []),
    ];
    return { lineas, detalle: { nuevos, quitados, editados, cambiaOrden: orden } };
  }
  const cambios: string[] = [];
  const recorrer = (a: unknown, d: unknown, ruta: string) => {
    if (esObjeto(a) && esObjeto(d)) {
      for (const k of new Set([...Object.keys(a), ...Object.keys(d)])) recorrer(a[k], d[k], ruta ? `${ruta}.${k}` : k);
    } else if (jsonEstable(a) !== jsonEstable(d)) {
      cambios.push(`  ${ruta}: ${recortar(JSON.stringify(a ?? null), 80)} → ${recortar(JSON.stringify(d ?? null), 80)}`);
    }
  };
  recorrer(antes, despues, "");
  return { lineas: [`Campos que cambian: ${cambios.length}.`, ...cambios.slice(0, 30)], detalle: { campos: cambios.slice(0, 60) } };
}

const igual = (a: unknown, b: unknown) => jsonEstable(a ?? null) === jsonEstable(b ?? null);

// ───────── Revertidores ─────────

/** Deshace ediciones de BORRADOR: solo si el borrador sigue como lo dejó la herramienta. */
const revertirBorrador: Revertidor = async ({ db, usuario, ahora, entradas }) => {
  const mensajes: string[] = [];
  for (const e of entradas) {
    const clave = e.entidadId as ClaveContenido;
    if (!(CLAVES_CONTENIDO as readonly string[]).includes(clave)) return { ok: false, mensaje: "No reconozco ese contenido." };
    const antes = (e.antes ?? {}) as { valor?: unknown; sinCopia?: boolean };
    const despues = (e.despues ?? {}) as { valor?: unknown; sinCopia?: boolean };
    if (antes.sinCopia || despues.sinCopia) return { ok: false, mensaje: `El borrador de ${etiqueta(clave)} era muy grande y no guardé copia para deshacer.` };
    const estado = await repo.obtenerEstado(db, clave);
    if (!igual(estado.borrador, despues.valor)) {
      return { ok: false, mensaje: `Alguien cambió el borrador de ${etiqueta(clave)} después; no lo piso. Revísalo antes de deshacer.` };
    }
    if (antes.valor === null || antes.valor === undefined) {
      await repo.descartarBorrador(db, { clave, usuario, ahora });
      mensajes.push(`Borrador de ${etiqueta(clave)} descartado (antes no había).`);
    } else {
      const r = await repo.guardarBorrador(db, { clave, valor: antes.valor, usuario, ahora });
      if (!r.ok) return { ok: false, mensaje: `No pude restaurar el borrador de ${etiqueta(clave)}.` };
      mensajes.push(`Borrador de ${etiqueta(clave)} vuelto a como estaba.`);
    }
  }
  return { ok: true, mensaje: mensajes.join(" ") };
};

/** Deshace publicaciones directas (y cancela solicitudes pendientes de términos y privacidad). */
function crearRevertidorPublicacion(deps: () => DepsContenido): Revertidor {
  return async ({ db, usuario, ahora, entradas }) => {
    const mensajes: string[] = [];
    for (const e of entradas) {
      const clave = e.entidadId as ClaveContenido;
      if (!(CLAVES_CONTENIDO as readonly string[]).includes(clave)) return { ok: false, mensaje: "No reconozco ese contenido." };
      const antes = (e.antes ?? {}) as { version?: number | null };
      const despues = (e.despues ?? {}) as { version?: number; estado?: string };
      const estado = await repo.obtenerEstado(db, clave);
      if (despues.estado === "pendiente") {
        if (estado.pendiente?.version !== despues.version) return { ok: false, mensaje: `La solicitud de ${etiqueta(clave)} ya no está pendiente.` };
        await repo.rechazarPendiente(db, { clave, version: despues.version as number, rechazadoPor: usuario.id, ahora });
        mensajes.push(`Solicitud de publicación de ${etiqueta(clave)} cancelada.`);
        continue;
      }
      if (estado.versionPublicada !== despues.version) {
        return { ok: false, mensaje: `${etiqueta(clave)} ya cambió después (versión ${estado.versionPublicada ?? "del código"}); no lo piso.` };
      }
      if (antes.version === null || antes.version === undefined) {
        return { ok: false, mensaje: `Antes de esa publicación se veía el texto original del código; no se puede volver solo. Edita y publica de nuevo.` };
      }
      if (META_CONTENIDO[clave].requiereAprobacion) {
        return { ok: false, mensaje: `${etiqueta(clave)} es un texto legal: para volver atrás usa restaurar_version_contenido y publícalo con la aprobación de Jorge.` };
      }
      const r = await repo.restaurarVersion(db, { clave, version: antes.version, usuario, destino: "publicado", nota: `Deshacer la versión ${despues.version}`, ahora });
      if (!r.ok || r.estado !== "publicada") return { ok: false, mensaje: `No pude volver a la versión ${antes.version} de ${etiqueta(clave)}.` };
      await deps().revalidar(clave);
      mensajes.push(`${etiqueta(clave)} volvió a la versión ${antes.version} (queda como versión nueva ${r.version}).`);
    }
    return { ok: true, mensaje: mensajes.join(" ") };
  };
}

// ───────── Edición de borrador (compartida) ─────────

async function guardarBorradorAuditado(ctx: ContextoHerramienta, clave: ClaveContenido, nuevo: unknown, base: unknown, baseEsBorrador: boolean): Promise<void> {
  const r = await repo.guardarBorrador(ctx.db, { clave, valor: nuevo, usuario: usuarioDe(ctx), ahora: ctx.ahora });
  if (!r.ok) throw new ErrorHerramienta(`No se guardó nada: ${r.errores.slice(0, 8).join(" | ")}`);
  await ctx.auditar([
    {
      entidad: "contenido_borrador",
      entidadId: clave,
      antes: baseEsBorrador ? await paraAuditar(base) : { valor: null },
      despues: await paraAuditar(nuevo),
    },
  ]);
}

const TEXTO_SIGUIENTE =
  "El borrador NO se ve todavía en la tienda. Para publicarlo: previsualizar_publicacion_contenido y después confirmar_publicacion_contenido.";

/** Base para editar: el borrador si existe; si no, lo que ve la tienda. */
async function baseDeEdicion(db: D1Like, clave: ClaveContenido) {
  const estado = await repo.obtenerEstado(db, clave);
  return { base: estado.borrador ?? estado.efectivo, esBorrador: estado.borrador !== null, estado };
}

// ───────── Esquemas de operaciones ─────────

const textoCorto = (max: number) => z.string().max(max);
const botonSchema = z.strictObject({ texto: textoCorto(40), enlace: textoCorto(300) }).nullable();
const fechaOpc = z.string().max(40).nullable().optional().describe("Fecha y hora: AAAA-MM-DDTHH:MM (hora de Chile) o ISO con zona. null = sin límite. «hasta» no se incluye.");

const camposSlide = {
  activa: z.boolean().optional(),
  imagenDesktop: textoCorto(500).optional().describe("URL de la imagen de escritorio (usa la que devuelve subir_imagen)."),
  imagenMovil: textoCorto(500).nullable().optional().describe("URL de la imagen para celular; null = usa la de escritorio."),
  alt: textoCorto(160).optional().describe("Descripción de la imagen (accesibilidad)."),
  eyebrow: textoCorto(70).optional().describe("Texto chico sobre el título."),
  titulo: textoCorto(80).optional(),
  subtitulo: textoCorto(200).optional(),
  boton: botonSchema.optional(),
  desde: fechaOpc,
  hasta: fechaOpc,
  precio: z.strictObject({ familia: z.enum(["fierro", "tubo", "zinc"]), nota: textoCorto(40) }).nullable().optional(),
};

const operacionSlide = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("agregar"), id: textoCorto(40).optional(), posicion: z.number().int().min(1).max(50).optional().describe("Posición (1 = primera). Si falta, va al final."), ...camposSlide }),
  z.strictObject({ op: z.literal("quitar"), id: textoCorto(40) }),
  z.strictObject({ op: z.literal("ordenar"), ids: z.array(textoCorto(40)).min(1).max(30).describe("Ids en el orden nuevo. Los que no nombres quedan al final.") }),
  z.strictObject({ op: z.literal("activar"), id: textoCorto(40), activa: z.boolean() }),
  z.strictObject({ op: z.literal("editar"), id: textoCorto(40), ...camposSlide }),
]);

const camposAviso = {
  activo: z.boolean().optional(),
  tipo: z.enum(["cierre", "feriado", "despacho", "otro"]).optional(),
  severidad: z.enum(["info", "aviso", "alerta"]).optional(),
  titulo: textoCorto(90).optional(),
  texto: textoCorto(400).optional(),
  desde: fechaOpc,
  hasta: fechaOpc,
  donde: z.array(z.enum(["tienda", "carrito", "checkout"])).min(1).max(3).optional(),
};

const operacionAviso = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("agregar"), id: textoCorto(40).optional(), ...camposAviso }),
  z.strictObject({ op: z.literal("quitar"), id: textoCorto(40) }),
  z.strictObject({ op: z.literal("activar"), id: textoCorto(40), activo: z.boolean() }),
  z.strictObject({ op: z.literal("editar"), id: textoCorto(40), ...camposAviso }),
]);

function sinIndefinidos<T extends Record<string, unknown>>(o: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

function nuevoId(prefijo: string, existentes: string[], ahora: number): string {
  let id = `${prefijo}-${ahora.toString(36)}`.slice(0, 40);
  let n = 1;
  while (existentes.includes(id)) id = `${prefijo}-${ahora.toString(36)}-${n++}`.slice(0, 40);
  return id;
}

type Elemento = Record<string, unknown> & { id: string };

function aplicarOperaciones(lista: Elemento[], ops: Array<Record<string, unknown> & { op: string }>, cfg: { prefijo: string; porDefecto: Record<string, unknown>; flagActivo: "activa" | "activo"; ahora: number }): Elemento[] {
  let items = lista.map((x) => ({ ...x }));
  const buscar = (id: unknown) => {
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) throw new ErrorHerramienta(`No existe el elemento "${String(id)}". Ids actuales: ${items.map((x) => x.id).join(", ") || "(ninguno)"}.`);
    return i;
  };
  for (const op of ops) {
    switch (op.op) {
      case "agregar": {
        const { op: _o, posicion, id, ...campos } = op;
        void _o;
        const nuevo = { ...cfg.porDefecto, ...sinIndefinidos(campos), id: (id as string | undefined) ?? nuevoId(cfg.prefijo, items.map((x) => x.id), cfg.ahora) } as Elemento;
        if (items.some((x) => x.id === nuevo.id)) throw new ErrorHerramienta(`Ya existe un elemento con el id "${nuevo.id}".`);
        const pos = typeof posicion === "number" ? Math.min(Math.max(posicion - 1, 0), items.length) : items.length;
        items.splice(pos, 0, nuevo);
        break;
      }
      case "quitar": items.splice(buscar(op.id), 1); break;
      case "ordenar": {
        const ids = op.ids as string[];
        if (new Set(ids).size !== ids.length) throw new ErrorHerramienta("En «ordenar» hay ids repetidos.");
        ids.forEach(buscar);
        const primeros = ids.map((id) => items.find((x) => x.id === id) as Elemento);
        items = [...primeros, ...items.filter((x) => !ids.includes(x.id))];
        break;
      }
      case "activar": items[buscar(op.id)][cfg.flagActivo] = op[cfg.flagActivo]; break;
      case "editar": {
        const i = buscar(op.id);
        const { op: _o, id: _i, ...campos } = op;
        void _o; void _i;
        items[i] = { ...items[i], ...sinIndefinidos(campos) };
        break;
      }
    }
  }
  return items;
}

// ───────── Fábrica de herramientas ─────────

export function crearHerramientasContenido(depsInyectadas?: Partial<DepsContenido>): Herramienta[] {
  const reales = () => depsContenidoReales();
  const deps = (): DepsContenido => ({ ...reales(), ...depsInyectadas });
  const revertirPublicacion = crearRevertidorPublicacion(deps);

  const ver_contenido = defineHerramienta({
    nombre: "ver_contenido",
    titulo: "Ver contenido de la tienda",
    descripcion:
      "Sin «clave» lista todos los contenidos editables (qué está publicado, si hay borrador o una publicación esperando aprobación). Con «clave» muestra el contenido: «efectivo» es lo que ve hoy la tienda (si nunca se editó, es el texto original del código) y es el punto de partida para editar. Los textos largos (términos, privacidad) vienen por partes.",
    esquema: z.object({
      clave: claveSchema.optional(),
      fuente: z.enum(["efectivo", "borrador", "publicado", "pendiente"]).optional().describe("Cuál versión ver. Por defecto: el borrador si existe; si no, lo que ve la tienda."),
      version: z.number().int().min(1).max(100000).optional().describe("Número de una versión del historial (ver_historial_contenido). Reemplaza a «fuente»."),
      parte: z.number().int().min(1).max(100).optional().describe("Para textos largos: qué parte leer (de a 12.000 caracteres)."),
    }),
    anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ejecutar({ clave, fuente, version, parte }, ctx) {
      if (!clave) {
        const lista = await conGestion(() => repo.listarContenidos(ctx.db));
        const lineas = lista.map((c) =>
          `- ${c.clave} (${c.etiqueta}): ${c.origen === "d1" ? `publicado, versión ${c.versionPublicada}` : "texto original del código"}${c.tieneBorrador ? "; hay borrador" : ""}${c.pendienteVersion ? `; publicación pendiente de aprobación (v${c.pendienteVersion})` : ""}${c.requiereAprobacion ? "; publicar necesita aprobación de Jorge" : ""}`);
        return { texto: lineas.join("\n"), datos: { contenidos: lista } };
      }
      const estado = await conGestion(() => repo.obtenerEstado(ctx.db, clave));
      let valor: unknown;
      let origen: string;
      if (version !== undefined) {
        const v = await repo.obtenerVersion(ctx.db, clave, version);
        if (!v || !v.valor) throw new ErrorHerramienta(`No encontré la versión ${version} de ${etiqueta(clave)}.`);
        valor = v.valor;
        origen = `versión ${version} (${v.resumen.estado})`;
      } else {
        const f = fuente ?? (estado.borrador ? "borrador" : "efectivo");
        if (f === "borrador") { if (!estado.borrador) throw new ErrorHerramienta(`No hay borrador de ${etiqueta(clave)}.`); valor = estado.borrador; origen = "borrador"; }
        else if (f === "publicado") { if (!estado.publicado) throw new ErrorHerramienta(`${etiqueta(clave)} nunca se publicó desde aquí: la tienda usa el texto original del código (fuente: efectivo).`); valor = estado.publicado; origen = `publicado v${estado.versionPublicada}`; }
        else if (f === "pendiente") {
          if (!estado.pendiente) throw new ErrorHerramienta(`No hay publicación pendiente de ${etiqueta(clave)}.`);
          const v = await repo.obtenerVersion(ctx.db, clave, estado.pendiente.version);
          if (!v?.valor) throw new ErrorHerramienta("No pude leer la versión pendiente.");
          valor = v.valor; origen = `pendiente v${estado.pendiente.version}`;
        } else { valor = estado.efectivo; origen = estado.origen === "d1" ? `lo que ve la tienda (v${estado.versionPublicada})` : "lo que ve la tienda (texto original del código)"; }
      }
      const cabecera = `${etiqueta(clave)} — ${origen}. ${estado.borrador ? "Hay un borrador guardado." : "No hay borrador."} ${estado.pendiente ? `Hay una publicación esperando aprobación (v${estado.pendiente.version}).` : ""}`.trim();
      return { texto: `${cabecera}\n\n${mostrarValor(clave, valor, parte ?? 1)}`, datos: { clave, tieneBorrador: !!estado.borrador, versionPublicada: estado.versionPublicada, pendiente: estado.pendiente?.version ?? null } };
    },
  });

  const ver_historial_contenido = defineHerramienta({
    nombre: "ver_historial_contenido",
    titulo: "Ver versiones de un contenido",
    descripcion:
      "Lista las versiones de un contenido (quién, cuándo, si está publicada, reemplazada, pendiente de aprobación o descartada). Para ver el texto de una versión usa ver_contenido con «version»; para volver a una usa restaurar_version_contenido.",
    esquema: z.object({ clave: claveSchema, limite: z.number().int().min(1).max(50).optional() }),
    anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ejecutar({ clave, limite }, ctx) {
      const versiones = await conGestion(() => repo.listarVersiones(ctx.db, clave, limite ?? 20));
      if (versiones.length === 0) return { texto: `${etiqueta(clave)}: nunca se publicó desde aquí (la tienda usa el texto original del código).`, datos: { versiones: [] } };
      const f = (ms: number | null) => (ms ? new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—");
      const lineas = versiones.map((v) => `- v${v.version} · ${v.estado} · ${f(v.creadoEn)} · por ${v.creadoEmail ?? v.creadoPor}${v.aprobadoPor ? ` · aprobada por ${v.aprobadoPor}` : ""}${v.restauradaDe ? ` · restaurada de v${v.restauradaDe}` : ""}${v.nota ? ` · nota: ${recortar(v.nota, 80)}` : ""}`);
      return { texto: `${etiqueta(clave)}\n${lineas.join("\n")}`, datos: { versiones } };
    },
  });

  const guardar_borrador_contenido = defineHerramienta({
    nombre: "guardar_borrador_contenido",
    titulo: "Guardar borrador de contenido",
    descripcion:
      "Guarda el contenido COMPLETO de un tipo como borrador (reemplaza el borrador anterior). No se ve en la tienda hasta publicarlo. Parte siempre de ver_contenido (fuente efectivo) y respeta su forma exacta: los campos desconocidos se rechazan. Para cambiar solo algunos campos usa editar_campos_contenido; para láminas y avisos, editar_slides y editar_avisos. Sin HTML ni scripts: se limpian.",
    esquema: z.object({ clave: claveSchema, valor: z.any().describe("El contenido completo, con la misma forma que muestra ver_contenido (para términos y privacidad: { texto: \"...\" } en markdown).") }),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ejecutar({ clave, valor }, ctx) {
      const limpio = await validarONada(clave, valor);
      const { base, esBorrador } = await conGestion(() => baseDeEdicion(ctx.db, clave));
      if (esBorrador && igual(base, limpio)) return `Sin cambios: el borrador de ${etiqueta(clave)} ya era así.`;
      await guardarBorradorAuditado(ctx, clave, limpio, base, esBorrador);
      return { texto: `Borrador de ${etiqueta(clave)} guardado. ${TEXTO_SIGUIENTE} Se puede deshacer.`, datos: { clave } };
    },
    revertidor: revertirBorrador,
  });

  const editar_campos_contenido = defineHerramienta({
    nombre: "editar_campos_contenido",
    titulo: "Cambiar algunos campos de un contenido",
    descripcion:
      "Cambia solo los campos que indiques de contacto, datos_local (teléfono, WhatsApp, dirección, correo, horario), popup, cinta, portada (secciones, productos y categorías destacados) o textos, y guarda el resultado como borrador. Los objetos anidados (horario, geo, botones) se mezclan campo a campo; las listas se reemplazan completas. Parte del borrador si existe; si no, de lo que ve la tienda. No se publica solo.",
    esquema: z.object({
      clave: z.enum(CLAVES_OBJETO),
      cambios: z.record(z.string().max(60), z.any()).refine((o) => Object.keys(o).length >= 1 && Object.keys(o).length <= 30, "Entre 1 y 30 campos."),
    }),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ejecutar({ clave, cambios }, ctx) {
      const { base, esBorrador } = await conGestion(() => baseDeEdicion(ctx.db, clave));
      const limpio = await validarONada(clave, mezclarProfundo(base, cambios));
      if (igual(base, limpio)) return `Sin cambios: ${etiqueta(clave)} ya estaba así${esBorrador ? " en el borrador" : ""}.`;
      const resumen = resumirCambio(clave, base, limpio);
      await guardarBorradorAuditado(ctx, clave, limpio, base, esBorrador);
      return { texto: `Borrador de ${etiqueta(clave)} guardado.\n${resumen.lineas.join("\n")}\n${TEXTO_SIGUIENTE} Se puede deshacer.`, datos: { clave, ...resumen.detalle } };
    },
    revertidor: revertirBorrador,
  });

  const editar_slides = defineHerramienta({
    nombre: "editar_slides",
    titulo: "Editar el carrusel de la portada",
    descripcion:
      "Cambia las láminas del carrusel de la portada en una o varias operaciones seguidas: agregar, quitar, ordenar, activar (activa true/false), editar (imagen, textos, botón, vigencia desde/hasta). Si algo falla no se guarda nada. Antes mira las láminas actuales con ver_contenido clave slides. Sube las fotos con subir_imagen y usa la URL que devuelve. Queda como borrador; para publicar usa previsualizar_publicacion_contenido.",
    esquema: z.object({ operaciones: z.array(operacionSlide).min(1).max(20) }),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ejecutar({ operaciones }, ctx) {
      const { base, esBorrador } = await conGestion(() => baseDeEdicion(ctx.db, "slides"));
      const lista = aplicarOperaciones(base as unknown as Elemento[], operaciones as never, {
        prefijo: "lamina", flagActivo: "activa", ahora: ctx.ahora,
        porDefecto: { activa: true, imagenMovil: null, eyebrow: "", subtitulo: "", boton: null, desde: null, hasta: null, precio: null },
      });
      const limpio = await validarONada("slides", lista);
      const resumen = resumirCambio("slides", base, limpio);
      if (igual(base, limpio)) return "Sin cambios: las láminas ya estaban así.";
      await guardarBorradorAuditado(ctx, "slides", limpio, base, esBorrador);
      const orden = limpio.map((s, i) => `${i + 1}. ${s.id} — ${s.titulo}${s.activa ? "" : " (apagada)"}`);
      return { texto: `Láminas guardadas como borrador.\n${resumen.lineas.join("\n")}\nOrden actual:\n${orden.join("\n")}\n${TEXTO_SIGUIENTE} Se puede deshacer.`, datos: { ...resumen.detalle } };
    },
    revertidor: revertirBorrador,
  });

  const editar_avisos = defineHerramienta({
    nombre: "editar_avisos",
    titulo: "Editar avisos de cierre, feriados y despacho",
    descripcion:
      "Agrega, quita, activa o edita avisos que se muestran bajo el encabezado (cierre del local, feriados, demoras de despacho). Cada aviso tiene tipo, severidad, texto, dónde se ve (tienda, carrito, checkout) y vigencia (desde/hasta). Solo informan: nunca bloquean una compra. Si algo falla no se guarda nada. Queda como borrador hasta publicarlo con previsualizar_publicacion_contenido.",
    esquema: z.object({ operaciones: z.array(operacionAviso).min(1).max(20) }),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ejecutar({ operaciones }, ctx) {
      const { base, esBorrador } = await conGestion(() => baseDeEdicion(ctx.db, "avisos"));
      const lista = aplicarOperaciones(base as unknown as Elemento[], operaciones as never, {
        prefijo: "aviso", flagActivo: "activo", ahora: ctx.ahora,
        porDefecto: { activo: true, tipo: "otro", severidad: "info", texto: "", desde: null, hasta: null, donde: ["tienda"] },
      });
      const limpio = await validarONada("avisos", lista);
      if (igual(base, limpio)) return "Sin cambios: los avisos ya estaban así.";
      const resumen = resumirCambio("avisos", base, limpio);
      await guardarBorradorAuditado(ctx, "avisos", limpio, base, esBorrador);
      return { texto: `Avisos guardados como borrador.\n${resumen.lineas.join("\n")}\n${TEXTO_SIGUIENTE} Se puede deshacer.`, datos: { ...resumen.detalle } };
    },
    revertidor: revertirBorrador,
  });

  const descartar_borrador_contenido = defineHerramienta({
    nombre: "descartar_borrador_contenido",
    titulo: "Descartar un borrador",
    descripcion: "Borra el borrador de un contenido (lo publicado y lo que ve la tienda no cambia).",
    esquema: z.object({ clave: claveSchema }),
    anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    async ejecutar({ clave }, ctx) {
      const estado = await conGestion(() => repo.obtenerEstado(ctx.db, clave));
      if (!estado.borrador) return `No había borrador de ${etiqueta(clave)}.`;
      const copia = await paraAuditar(estado.borrador);
      await repo.descartarBorrador(ctx.db, { clave, usuario: usuarioDe(ctx), ahora: ctx.ahora });
      await ctx.auditar([{ entidad: "contenido_borrador", entidadId: clave, antes: copia, despues: { valor: null } }]);
      return `Borrador de ${etiqueta(clave)} descartado. Se puede deshacer.`;
    },
    revertidor: async (c) => {
      // Deshacer un descarte = volver a guardar la copia, solo si sigue sin haber borrador.
      const mensajes: string[] = [];
      for (const e of c.entradas) {
        const clave = e.entidadId as ClaveContenido;
        const antes = (e.antes ?? {}) as { valor?: unknown; sinCopia?: boolean };
        if (antes.sinCopia || antes.valor === undefined) return { ok: false, mensaje: "No guardé copia de ese borrador." };
        const estado = await repo.obtenerEstado(c.db, clave);
        if (estado.borrador) return { ok: false, mensaje: `Ya hay un borrador nuevo de ${etiqueta(clave)}; no lo piso.` };
        const r = await repo.guardarBorrador(c.db, { clave, valor: antes.valor, usuario: c.usuario, ahora: c.ahora });
        if (!r.ok) return { ok: false, mensaje: "No pude recuperar el borrador." };
        mensajes.push(`Borrador de ${etiqueta(clave)} recuperado.`);
      }
      return { ok: true, mensaje: mensajes.join(" ") };
    },
  });

  const restaurar_version_contenido = defineHerramienta({
    nombre: "restaurar_version_contenido",
    titulo: "Volver a una versión anterior (como borrador)",
    descripcion:
      "Pone una versión anterior (ver_historial_contenido) como BORRADOR; el historial no se borra. Para que se vea en la tienda hay que publicarla con previsualizar_publicacion_contenido (en términos y privacidad, con aprobación de Jorge).",
    esquema: z.object({ clave: claveSchema, version: z.number().int().min(1).max(100000) }),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ejecutar({ clave, version }, ctx) {
      const { base, esBorrador } = await conGestion(() => baseDeEdicion(ctx.db, clave));
      const v = await repo.obtenerVersion(ctx.db, clave, version);
      if (!v || !v.valor) throw new ErrorHerramienta(`No encontré la versión ${version} de ${etiqueta(clave)}.`);
      if (v.resumen.estado === "pendiente" || v.resumen.estado === "descartada") throw new ErrorHerramienta(`La versión ${version} no se alcanzó a publicar; no se puede restaurar.`);
      if (esBorrador && igual(base, v.valor)) return `El borrador ya es igual a la versión ${version}.`;
      await guardarBorradorAuditado(ctx, clave, v.valor, base, esBorrador);
      return { texto: `La versión ${version} de ${etiqueta(clave)} quedó como borrador. ${TEXTO_SIGUIENTE}`, datos: { clave, version } };
    },
    revertidor: revertirBorrador,
  });

  // ── Publicar en dos pasos ──

  const huellaDePublicacion = async (clave: ClaveContenido, db: D1Like) => {
    const e = await repo.obtenerEstado(db, clave);
    return { estado: e, huella: await huellaDeDatos({ clave, borrador: e.borrador, publicado: e.publicado, version: e.versionPublicada }) };
  };

  const previsualizar_publicacion_contenido = defineHerramienta({
    nombre: "previsualizar_publicacion_contenido",
    titulo: "Previsualizar la publicación de un borrador",
    descripcion:
      "Paso 1 de 2 para publicar. No cambia nada: compara el borrador con lo que ve la tienda hoy, resume qué cambia (líneas agregadas y quitadas, campos modificados), avisa si necesita aprobación de Jorge (términos y privacidad) y entrega un id corto de un solo uso (15 minutos). Muéstrale el resumen al usuario y espera su OK antes de llamar a confirmar_publicacion_contenido.",
    esquema: z.object({ clave: claveSchema, nota: z.string().max(200).optional().describe("Nota corta para el historial.") }),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ejecutar({ clave, nota }, ctx) {
      const { estado, huella } = await conGestion(() => huellaDePublicacion(clave, ctx.db));
      if (!estado.borrador) throw new ErrorHerramienta(`No hay borrador de ${etiqueta(clave)}. Primero guarda uno con guardar_borrador_contenido o editar_campos_contenido.`);
      const v = validarContenido(clave, estado.borrador);
      if (!v.ok) throw new ErrorHerramienta(`El borrador no es válido: ${v.errores.slice(0, 8).join(" | ")}`);
      if (igual(estado.efectivo, v.valor) && estado.origen === "d1") return `Sin cambios: el borrador de ${etiqueta(clave)} es igual a lo que ya ve la tienda. No hay nada que publicar.`;
      if (clave === "portada") {
        const r = await deps().verificarPortada(v.valor);
        if (!r.ok) throw new ErrorHerramienta(`La portada tiene referencias que no existen: ${r.errores.slice(0, 8).join(" | ")}`);
      }
      const resumen = resumirCambio(clave, estado.efectivo, v.valor);
      const decision = requiereAprobacion({ banderas: META_CONTENIDO[clave].requiereAprobacion ? ["texto_legal"] : [] });
      const vp = await crearVistaPrevia(ctx.db, { usuarioId: ctx.usuario.id, tipo: "contenido_publicar", payload: { clave, nota: nota ?? null }, huella }, ctx.ahora);
      const lineas = [
        `Vista previa de publicar ${etiqueta(clave)}:`,
        ...resumen.lineas,
        decision.requiere
          ? `OJO: ${decision.motivos.map((m) => TEXTO_MOTIVO[m]).join("; ")}. Al confirmar NO se publica: queda pendiente y a Jorge le llega un correo para aprobar. Después usa aplicar_aprobacion_contenido.`
          : "No necesita aprobación: al confirmar se publica y se regeneran las páginas.",
        `Id de vista previa: ${vp.id} (un solo uso, vence en 15 minutos). Para aplicar: confirmar_publicacion_contenido con clave ${clave} y ese id, solo cuando el usuario lo apruebe.`,
      ];
      return { texto: lineas.join("\n"), datos: { vistaPreviaId: vp.id, expiraEn: vp.expiraEn, clave, requiereAprobacion: decision.requiere, ...resumen.detalle } };
    },
  });

  const confirmar_publicacion_contenido = defineHerramienta({
    nombre: "confirmar_publicacion_contenido",
    titulo: "Confirmar la publicación (paso 2)",
    descripcion:
      "Paso 2 de 2: publica el borrador con el id que dio previsualizar_publicacion_contenido. Se rechaza si el id es de otro usuario, ya se usó, venció o si el borrador o lo publicado cambió desde la vista previa. Términos y privacidad NO se publican: quedan pendientes y se pide la aprobación de Jorge por correo (si su correo no está configurado, queda bloqueado). Úsala solo con el OK del usuario.",
    esquema: z.object({ clave: claveSchema, vista_previa_id: z.string().min(8).max(20) }),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ejecutar({ clave, vista_previa_id }, ctx) {
      const { estado, huella } = await conGestion(() => huellaDePublicacion(clave, ctx.db));
      const c = await consumirVistaPrevia(ctx.db, { id: vista_previa_id, usuarioId: ctx.usuario.id, tipo: "contenido_publicar", huellaActual: huella }, ctx.ahora);
      if (!c.ok) throw new ErrorHerramienta(textoRechazoVistaPrevia(c.motivo));
      const p = (c.payload ?? {}) as { clave?: string; nota?: string | null };
      if (p.clave !== clave) throw new ErrorHerramienta("Esa vista previa era de otro contenido. No se aplicó nada.");
      if (!estado.borrador) throw new ErrorHerramienta("El borrador ya no existe. No se aplicó nada.");
      if (clave === "portada") {
        const r = await deps().verificarPortada(estado.borrador);
        if (!r.ok) throw new ErrorHerramienta(`La portada tiene referencias que no existen: ${r.errores.slice(0, 8).join(" | ")}`);
      }
      const usuario = usuarioDe(ctx);
      const nota = p.nota ?? undefined;

      if (META_CONTENIDO[clave].requiereAprobacion) {
        const decision = requiereAprobacion({ banderas: ["texto_legal"] });
        const r = await repo.publicar(ctx.db, { clave, usuario, nota, ahora: ctx.ahora });
        if (!r.ok || r.estado !== "pendiente") throw new ErrorHerramienta(r.ok ? "No se pudo dejar la publicación pendiente." : `No se pudo publicar: ${r.motivo}.`);
        const pendiente = await repo.obtenerVersion(ctx.db, clave, r.version);
        const resumen = resumirCambio(clave, estado.efectivo, pendiente?.valor ?? estado.borrador);
        const sol = await deps().solicitarAprobacion(ctx.db, {
          usuario, herramienta: "confirmar_publicacion_contenido", motivos: decision.motivos,
          resumen: `Publicar ${etiqueta(clave)} (versión ${r.version}) en la tienda. ${resumen.lineas[0] ?? ""}`,
          detalle: { clave, version: r.version, ...resumen.detalle },
          huella: await huellaDeDatos({ clave, valor: pendiente?.valor ?? estado.borrador }),
        });
        if (!sol.ok) {
          await repo.rechazarPendiente(ctx.db, { clave, version: r.version, rechazadoPor: usuario.id, ahora: ctx.ahora });
          const porque = sol.motivo === "sin_aprobador" ? "el correo de aprobación de Jorge no está configurado" : sol.motivo === "limite" ? "se pidieron demasiadas aprobaciones en la última hora" : "no pude enviar el correo a Jorge";
          return { texto: `BLOQUEADO: ${porque}. No se publicó nada y la solicitud quedó descartada. Avísale a Jorge.`, datos: { estado: "bloqueada", motivo: sol.motivo } };
        }
        await ctx.auditar([{ entidad: "contenido", entidadId: clave, antes: { version: estado.versionPublicada }, despues: { version: r.version, estado: "pendiente", aprobacionId: sol.id } }]);
        return {
          texto: `${etiqueta(clave)} quedó PENDIENTE de aprobación (versión ${r.version}); la tienda sigue mostrando la versión de hoy. Le mandé un correo a Jorge con el enlace para aprobar o rechazar (vence en 4 horas). Cuando él apruebe, llama a aplicar_aprobacion_contenido con clave ${clave} y aprobacion_id ${sol.id}. No repitas este paso.`,
          datos: { estado: "pendiente", aprobacionId: sol.id, version: r.version, venceEn: sol.venceEn },
        };
      }

      const r = await repo.publicar(ctx.db, { clave, usuario, nota, ahora: ctx.ahora });
      if (!r.ok) throw new ErrorHerramienta(r.motivo === "sin_cambios" ? "Sin cambios: ya estaba publicado así." : `No se pudo publicar${r.errores ? `: ${r.errores.slice(0, 6).join(" | ")}` : ""}.`);
      await ctx.auditar([{ entidad: "contenido", entidadId: clave, antes: { version: estado.versionPublicada }, despues: { version: r.version, estado: r.estado } }]);
      await deps().revalidar(clave);
      return { texto: `${etiqueta(clave)} publicado (versión ${r.version}). Las páginas se regeneran en unos minutos. Se puede deshacer.`, datos: { estado: "publicada", version: r.version } };
    },
    revertidor: revertirPublicacion,
  });

  const aplicar_aprobacion_contenido = defineHerramienta({
    nombre: "aplicar_aprobacion_contenido",
    titulo: "Aplicar una publicación ya aprobada por Jorge",
    descripcion:
      "Después de que Jorge aprobó por correo la publicación de términos o privacidad, publica esa versión pendiente. Si todavía no aprobó, solo informa el estado y no cambia nada. Si el texto cambió después de pedir la aprobación, o venció, hay que pedirla de nuevo (previsualizar y confirmar otra vez). La aprobación sirve una sola vez.",
    esquema: z.object({ clave: z.enum(["terminos", "privacidad"]), aprobacion_id: z.string().min(8).max(64) }),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ejecutar({ clave, aprobacion_id }, ctx) {
      const estado = await conGestion(() => repo.obtenerEstado(ctx.db, clave));
      if (!estado.pendiente) throw new ErrorHerramienta(`No hay una publicación pendiente de ${etiqueta(clave)}. Puede haberse aplicado, rechazado o reemplazado.`);
      const v = await repo.obtenerVersion(ctx.db, clave, estado.pendiente.version);
      if (!v?.valor) throw new ErrorHerramienta("No pude leer la versión pendiente.");
      const huellaActual = await huellaDeDatos({ clave, valor: v.valor });
      const est = await estadoAprobacion(ctx.db, aprobacion_id, { usuarioId: ctx.usuario.id, huellaActual }, ctx.ahora);
      switch (est) {
        case "pendiente": return { texto: "Jorge todavía no aprueba. Dile que revise su correo (el enlace vale 4 horas). No cambié nada.", datos: { estado: "pendiente" } };
        case "rechazada": throw new ErrorHerramienta("Jorge rechazó este cambio. No se publicó.");
        case "vencida": throw new ErrorHerramienta("La aprobación venció. Hay que pedirla de nuevo (previsualizar y confirmar otra vez).");
        case "usada": throw new ErrorHerramienta("Esa aprobación ya se usó.");
        case "datos_cambiaron": throw new ErrorHerramienta("El texto pendiente no es el mismo que Jorge aprobó (o el id es de otro cambio). No se publicó. Pide la aprobación de nuevo.");
        case "no_existe": throw new ErrorHerramienta("No encontré esa aprobación (o no es tuya).");
        case "aprobada": break;
      }
      if (!(await consumirAprobacion(ctx.db, aprobacion_id, { usuarioId: ctx.usuario.id, huellaActual }, ctx.ahora))) {
        throw new ErrorHerramienta("Esa aprobación ya se usó. No se publicó nada.");
      }
      const r = await repo.aprobarPendiente(ctx.db, { clave, version: estado.pendiente.version, aprobadoPor: `aprobacion:${aprobacion_id.slice(0, 12)}`, referencia: aprobacion_id, ahora: ctx.ahora });
      if (!r.ok) throw new ErrorHerramienta("La versión pendiente ya no se podía publicar. Pide el cambio de nuevo.");
      await ctx.auditar([{ entidad: "contenido", entidadId: clave, antes: { version: estado.versionPublicada }, despues: { version: r.version, estado: "publicada", aprobacionId: aprobacion_id } }]);
      await deps().revalidar(clave);
      return { texto: `${etiqueta(clave)} publicado con la aprobación de Jorge (versión ${r.version}). Las páginas se regeneran en unos minutos. Este cambio no se deshace solo: para volver atrás usa restaurar_version_contenido.`, datos: { estado: "publicada", version: r.version } };
    },
    // Sin revertidor a propósito: volver atrás un texto legal también necesita aprobación.
  });

  return [
    ver_contenido, ver_historial_contenido, guardar_borrador_contenido, editar_campos_contenido, editar_slides, editar_avisos,
    descartar_borrador_contenido, restaurar_version_contenido, previsualizar_publicacion_contenido, confirmar_publicacion_contenido,
    aplicar_aprobacion_contenido,
  ] as unknown as Herramienta[];
}

