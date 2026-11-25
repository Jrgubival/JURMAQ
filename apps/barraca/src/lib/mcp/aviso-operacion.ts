/**
 * AVISOS A JORGE por correo (Parte B, base). Una utilidad compartida para dos cosas:
 *
 *  1. Modo de aprobación `avisar` (tipo `cambio`): un cambio riesgoso se aplicó sin esperar su OK; después le llega un
 *     correo con qué cambió (resumen, cantidades, mayores variaciones, quién y cuándo) y el enlace a /admin/conexiones
 *     para deshacer. Lo registra `consumirAprobacion` (aprobaciones.ts) y lo envía el servidor MCP al terminar la llamada.
 *  2. Operaciones de DINERO y BORRADO (tipo `dinero`), en AMBOS modos: `avisarOperacionDinero(...)`. Uso para quien
 *     construya esas herramientas:
 *
 *       const r = await avisarOperacionDinero(ctx.db, await depsAviso(), {
 *         usuario: ctx.usuario, herramienta: "confirmar_transferencia", operacion: "Confirmar transferencia",
 *         pedidoNumero: 1234, clienteNombre: pedido.nombre, monto: pedido.total, medio: "Transferencia", loteId: ctx.loteId,
 *       }, async () => { ...la operación irreversible, devuelve lo que quiera... });
 *       if (!r.ok) return r.mensaje;           // BLOQUEADA: la operación NO se ejecutó
 *       ... r.resultado (lo que devolvió la operación) y `textoAviso(r.aviso)` para la respuesta.
 *
 *     Orden de cada operación: (a) se comprueba que BARRACA_APROBADOR_EMAIL sea un correo válido (si no, BLOQUEADA);
 *     (b) se REGISTRA el aviso pendiente en D1 (si no se puede registrar, la operación NO se ejecuta); (c) se ejecuta la
 *     operación; (d) se envía el correo. Si el correo falla queda `fallido`, se devuelve en la respuesta y el cron de
 *     30 minutos lo reintenta (`reintentarAvisos`). Si la operación lanza un error, el aviso igual sale (con el resultado
 *     «error») y el error se vuelve a lanzar.
 *
 * Los correos NO llevan datos personales completos: solo nombre de pila (o iniciales), número de pedido, monto y medio.
 * Todo texto libre pasa por `limpiarTextoAviso` (quita correos, RUT, teléfonos y números largos de cuentas).
 *
 * Sin Next ni Cloudflare: el envío real va inyectado (`DepsAviso.enviar`); el cableado vive en aviso-servidor.ts.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { D1Like } from "../gestion/index.ts";
import { desdeJson, idUuid } from "../gestion/util.ts";

export type TipoAviso = "cambio" | "dinero" | "oferta";
export type EstadoAviso = "pendiente" | "enviando" | "enviado" | "fallido" | "cancelado";

/** El correo ya armado como datos (el HTML lo arma aviso-servidor.ts). */
export interface CorreoAviso {
  para: string;
  asunto: string;
  titulo: string;
  intro: string;
  filas: Array<{ etiqueta: string; valor: string }>;
  botones: Array<{ etiqueta: string; href: string }>;
  pie: string;
}

export interface DepsAviso {
  /** Correo de Jorge (BARRACA_APROBADOR_EMAIL). Vacío o inválido = no hay aviso posible. */
  aprobadorEmail: string | undefined;
  /** Manda el correo; true si salió. */
  enviar(correo: CorreoAviso): Promise<boolean>;
  base: string;
}

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
export const MAX_INTENTOS_AVISO = 12;
const REINTENTO_MS = 5 * 60_000;
const ENVIANDO_COLGADO_MS = 10 * 60_000;
const PENDIENTE_VIEJO_MS = 2 * 60_000;

/** Correo del aprobador normalizado, o null si falta o no es un correo. */
export function correoAprobadorValido(email: string | undefined | null): string | null {
  const e = String(email ?? "").trim().toLowerCase();
  return e.length > 0 && e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

/**
 * Correo de Jorge tal como está configurado AHORA en el worker (secreto BARRACA_APROBADOR_EMAIL), o null si falta o no
 * es válido. Lo usa el modo `avisar` para decidir si puede avisar (si no, se comporta como `exigir`, que bloquea).
 */
export function correoAprobadorDeEntorno(): string | null {
  try {
    return correoAprobadorValido(typeof process !== "undefined" ? process.env.BARRACA_APROBADOR_EMAIL : undefined);
  } catch {
    return null;
  }
}

// ───────── Limpieza de datos personales ─────────
/** Quita correos, RUT, teléfonos y números largos (cuentas) de un texto libre. */
export function limpiarTextoAviso(texto: unknown, max = 400): string {
  return String(texto ?? "")
    .replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, " ")
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[oculto]")
    .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}\s?-\s?[\dkK]\b/g, "[oculto]")
    .replace(/(?:\+?56[\s-]?)?(?:\d[\s-]?){7,}\d/g, (m) => (m.replace(/\D/g, "").length >= 8 ? "[oculto]" : m))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Solo el nombre de pila, con mayúscula inicial; null si no hay uno razonable. */
export function nombrePila(nombre: unknown): string | null {
  const primero = String(nombre ?? "").trim().split(/\s+/)[0] ?? "";
  if (!/^[\p{L}][\p{L}'’-]{0,24}$/u.test(primero)) return null;
  return primero.charAt(0).toLocaleUpperCase("es") + primero.slice(1).toLocaleLowerCase("es");
}

/** Iniciales («J. P.»), por si no hay un nombre de pila presentable. */
export function iniciales(nombre: unknown): string | null {
  const ini = String(nombre ?? "").trim().split(/\s+/).filter((p) => /^\p{L}/u.test(p)).slice(0, 2).map((p) => `${p.charAt(0).toLocaleUpperCase("es")}.`);
  return ini.length ? ini.join(" ") : null;
}

const quienEs = (nombre: unknown) => nombrePila(nombre) ?? iniciales(nombre);

// ───────── Seguimiento de los avisos de una llamada (cambios en modo avisar) ─────────
const almacen = new AsyncLocalStorage<{ ids: string[] }>();

/** Ejecuta `fn` recordando qué avisos de cambio se registraron dentro (el servidor MCP los envía al terminar la llamada). */
export async function conSeguimientoDeAvisos<T>(fn: () => Promise<T>): Promise<{ valor: T; ids: string[] }> {
  const contenedor = { ids: [] as string[] };
  const valor = await almacen.run(contenedor, fn);
  return { valor, ids: contenedor.ids };
}

function anotarAviso(id: string): void {
  almacen.getStore()?.ids.push(id);
}

// ───────── Filas ─────────
interface FilaAviso {
  id: string; tipo: TipoAviso; estado: EstadoAviso; usuario_id: string; usuario_email: string | null; herramienta: string;
  operacion: string; resumen: string; detalle: string | null; aprobacion_id: string | null; pedido_numero: string | null;
  cliente_nombre: string | null; monto: number | null; medio: string | null; resultado: string | null; lote_id: string | null;
  creado_en: number; actualizado_en: number; enviado_en: number | null; intentos: number; ultimo_error: string | null;
  proximo_intento_en: number | null;
}

export interface DatosAvisoCambio {
  aprobacionId: string;
  usuario: { id: string; email?: string | null };
  herramienta: string;
  /** Los motivos YA en palabras (TEXTO_MOTIVO). */
  motivosTexto: string[];
  resumen: string;
  /** Detalle de la aprobación (de ahí salen las cifras y las mayores variaciones). */
  detalle?: unknown;
  ahora?: number;
}

type Linea = Record<string, unknown>;

/** Hasta 5 mayores variaciones (en %) de las líneas del detalle de una aprobación de precios. */
export function mayoresVariaciones(detalle: unknown): Array<{ codigo: string; antes: number; despues: number; pct: number }> {
  const lineas = (detalle && typeof detalle === "object" ? (detalle as { lineas?: unknown }).lineas : undefined);
  if (!Array.isArray(lineas)) return [];
  const out: Array<{ codigo: string; antes: number; despues: number; pct: number }> = [];
  for (const l of lineas as Linea[]) {
    const antes = Number(l.antes);
    const despues = Number(l.despues);
    if (!Number.isFinite(antes) || !Number.isFinite(despues) || antes <= 0) continue;
    out.push({ codigo: limpiarTextoAviso(l.codigo, 40), antes, despues, pct: Math.round(((despues - antes) / antes) * 1000) / 10 });
  }
  return out.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 5);
}

function cifrasSanas(detalle: unknown): Record<string, number> {
  const c = (detalle && typeof detalle === "object" ? (detalle as { cifras?: unknown }).cifras : undefined);
  const out: Record<string, number> = {};
  if (c && typeof c === "object" && !Array.isArray(c)) {
    for (const [k, v] of Object.entries(c as Record<string, unknown>).slice(0, 12)) {
      if (typeof v === "number" && Number.isFinite(v) && /^[A-Za-z0-9_]{1,30}$/.test(k)) out[k] = v;
    }
  }
  return out;
}

/**
 * Registra el aviso de un cambio aplicado en modo `avisar` (queda `pendiente`; el servidor lo envía al terminar la llamada
 * y el cron lo reintenta). Si la aprobación ya tuvo un aviso cancelado (se devolvió y se volvió a gastar), lo reactiva.
 * Lanza si D1 falla: quien llama no debe aplicar el cambio.
 */
export async function registrarAvisoCambio(db: D1Like, d: DatosAvisoCambio): Promise<string> {
  const ahora = d.ahora ?? Date.now();
  const detalle = JSON.stringify({
    motivos: d.motivosTexto.slice(0, 12).map((m) => limpiarTextoAviso(m, 200)),
    cifras: cifrasSanas(d.detalle),
    mayores: mayoresVariaciones(d.detalle),
  });
  const resumen = limpiarTextoAviso(d.resumen, 600);
  const reactivado = await db
    .prepare("UPDATE avisos_operacion SET estado = 'pendiente', actualizado_en = ?, detalle = ?, resumen = ?, intentos = 0, ultimo_error = NULL WHERE aprobacion_id = ? AND estado = 'cancelado' RETURNING id")
    .bind(ahora, detalle, resumen, d.aprobacionId)
    .first<{ id: string }>();
  if (reactivado) { anotarAviso(reactivado.id); return reactivado.id; }
  const id = idUuid();
  await db
    .prepare(
      `INSERT INTO avisos_operacion (id, tipo, estado, usuario_id, usuario_email, herramienta, operacion, resumen, detalle, aprobacion_id, creado_en, actualizado_en)
       VALUES (?, 'cambio', 'pendiente', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, d.usuario.id, d.usuario.email ?? null, d.herramienta, limpiarTextoAviso(d.herramienta.replace(/_/g, " "), 80), resumen, detalle, d.aprobacionId, ahora, ahora)
    .run();
  anotarAviso(id);
  return id;
}

/**
 * Aviso a Jorge de una oferta programada que NO se activó porque con los costos de hoy rompe un tope duro de precios.
 * Queda `pendiente` (lo envía el cron de mantenimiento al terminar la corrida, y lo reintenta si falla) y se ve en
 * Conexiones mientras no salga. Nunca lanza: la oferta ya quedó omitida y su motivo se ve en `ver_ofertas`.
 */
export async function registrarAvisoOfertaBloqueada(
  db: D1Like, d: { ofertaId: string; codigo: string; usuario: { id: string; email?: string | null }; motivo: string; ahora?: number },
): Promise<string | null> {
  const ahora = d.ahora ?? Date.now();
  const id = idUuid();
  try {
    await db
      .prepare(
        `INSERT INTO avisos_operacion (id, tipo, estado, usuario_id, usuario_email, herramienta, operacion, resumen, aprobacion_id, resultado, creado_en, actualizado_en)
         VALUES (?, 'oferta', 'pendiente', ?, ?, 'oferta_programada', 'Oferta NO activada por un tope de precios', ?, ?, 'bloqueado', ?, ?)`,
      )
      .bind(id, d.usuario.id, d.usuario.email ?? null, limpiarTextoAviso(`Producto ${d.codigo}. ${d.motivo}`, 600), `oferta:${d.ofertaId}`.slice(0, 80), ahora, ahora)
      .run();
  } catch {
    return null;
  }
  anotarAviso(id);
  return id;
}

/** El cambio no se aplicó (la aprobación se devolvió): el aviso pendiente de esa aprobación se cancela, sin correo. */
export async function cancelarAvisosDeAprobacion(db: D1Like, aprobacionId: string, ahora: number = Date.now()): Promise<void> {
  await db.prepare("UPDATE avisos_operacion SET estado = 'cancelado', actualizado_en = ? WHERE aprobacion_id = ? AND estado = 'pendiente'").bind(ahora, aprobacionId).run();
}

// ───────── Armado del correo ─────────
const CHILE = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" });
const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

const ETIQUETAS_CIFRAS: Record<string, string> = {
  productos: "Productos que cambian", fichas: "Fichas que cambian", mayorVariacionPct: "Mayor variación de precio (%)",
  bajoCosto: "Productos bajo el costo", menos15: "Productos con menos de 15 % sobre el costo", sinCosto: "Productos sin costo cargado",
};

export function construirCorreoAviso(f: FilaAviso, para: string, base: string): CorreoAviso {
  const cuando = CHILE.format(new Date(f.creado_en));
  // Quien pidió es el administrador de la conexión (la cuenta de la tienda, no un cliente): se muestra su correo.
  const quien = String(f.usuario_email ?? "usuario desconocido").replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ").trim().slice(0, 120);
  const panel = { etiqueta: "Ver el historial y deshacer", href: `${base}/admin/conexiones` };
  if (f.tipo === "oferta") {
    return {
      para, asunto: "Aviso: una oferta programada NO se activó (tope de precios)", titulo: "Oferta no activada",
      intro: "Una oferta que estaba programada y aprobada no se puso en la tienda porque, con el costo de hoy, el precio rompe un tope duro (nada en $0 y nada bajo el 50 % del costo). No se cambió ningún precio.",
      filas: [
        { etiqueta: "Qué pasó", valor: f.resumen },
        { etiqueta: "Quién la programó", valor: quien },
        { etiqueta: "Cuándo", valor: cuando },
      ],
      botones: [panel],
      pie: "Revisa el costo o el precio de la oferta y vuelve a programarla si corresponde. El motivo también aparece en ver_ofertas.",
    };
  }
  if (f.tipo === "cambio") {
    const d = (desdeJson<{ motivos?: string[]; cifras?: Record<string, number>; mayores?: Array<{ codigo: string; antes: number; despues: number; pct: number }> }>(f.detalle) ?? {});
    const filas: CorreoAviso["filas"] = [
      { etiqueta: "Qué se hizo", valor: f.operacion },
      { etiqueta: "Resumen", valor: f.resumen },
      ...(d.motivos?.length ? [{ etiqueta: "Normalmente pedía tu OK porque", valor: d.motivos.join("; ") }] : []),
      ...Object.entries(d.cifras ?? {}).map(([k, v]) => ({ etiqueta: ETIQUETAS_CIFRAS[k] ?? k, valor: String(v) })),
      ...(d.mayores?.length ? [{ etiqueta: "Mayores variaciones", valor: d.mayores.map((m) => `${m.codigo}: ${pesos(m.antes)} → ${pesos(m.despues)} (${m.pct > 0 ? "+" : ""}${String(m.pct).replace(".", ",")} %)`).join(" · ") }] : []),
      { etiqueta: "Quién lo pidió", valor: quien },
      { etiqueta: "Cuándo", valor: cuando },
    ];
    return {
      para, asunto: "Aviso: Claude hizo un cambio en la tienda (modo avisar)", titulo: "Aviso de cambio en la tienda",
      intro: "Claude aplicó (o intentó aplicar) este cambio. Estás en modo avisar: no esperó tu OK, pero queda registrado y se puede deshacer.",
      filas, botones: [panel],
      pie: "Si no esperabas este cambio, entra a Administración, Conexiones para deshacerlo o revocar el acceso de Claude.",
    };
  }
  const estado = f.resultado === "ok" ? "Hecho" : f.resultado === "bloqueado" ? "BLOQUEADO por un tope de seguridad: no se hizo nada" : f.resultado === "error" ? "Se intentó, pero falló: revisa el pedido" : "Registrado; no se pudo confirmar si terminó: revisa el pedido";
  const cliente = quienEs(f.cliente_nombre);
  const filas: CorreoAviso["filas"] = [
    { etiqueta: "Operación", valor: f.operacion },
    ...(f.pedido_numero ? [{ etiqueta: "Pedido", valor: `N° ${f.pedido_numero}` }] : []),
    ...(cliente ? [{ etiqueta: "Cliente", valor: cliente }] : []),
    ...(f.monto !== null ? [{ etiqueta: "Monto", valor: pesos(f.monto) }] : []),
    ...(f.medio ? [{ etiqueta: "Medio", valor: f.medio }] : []),
    { etiqueta: "Estado", valor: estado },
    ...(f.resumen ? [{ etiqueta: "Detalle", valor: f.resumen }] : []),
    { etiqueta: "Quién lo pidió", valor: quien },
    { etiqueta: "Cuándo", valor: cuando },
  ];
  return {
    para, asunto: `Aviso de dinero: ${f.operacion}${f.pedido_numero ? ` (pedido N° ${f.pedido_numero})` : ""}`, titulo: "Aviso de operación de dinero o borrado",
    intro: "Claude hizo (o intentó hacer) una operación de dinero o borrado. Este aviso sale siempre, también cuando no hace falta tu OK.",
    filas,
    botones: [...(f.pedido_numero && /^[A-Za-z0-9_-]{1,40}$/.test(f.pedido_numero) ? [{ etiqueta: "Ver el pedido", href: `${base}/admin/ventas/${f.pedido_numero}` }] : []), panel],
    pie: "Este correo no trae datos personales del cliente. Si no esperabas esta operación, revisa el historial y corta el acceso de Claude desde Conexiones.",
  };
}

// ───────── Envío ─────────
export interface ResultadoAviso {
  id: string;
  estado: "enviado" | "fallido" | "cancelado" | "en_curso";
  /** Texto en español para la respuesta de la herramienta. */
  mensaje: string;
}

const MENSAJE_OK = "Aviso enviado a Jorge por correo.";
const mensajeFallo = (id: string) =>
  `ATENCIÓN: el aviso a Jorge NO se pudo enviar. Quedó registrado (${id.slice(0, 8)}) y se reintenta solo cada 30 minutos; también se ve en Administración, Conexiones. Avísale a Jorge.`;

/**
 * Envía un aviso (lo reclama de forma atómica: dos envíos a la vez no duplican el correo). Nunca lanza.
 * Reintentable: un aviso `fallido` o `pendiente` se vuelve a intentar hasta MAX_INTENTOS_AVISO veces.
 */
export async function enviarAviso(db: D1Like, deps: DepsAviso, id: string, ahora: number = Date.now()): Promise<ResultadoAviso> {
  let f: FilaAviso | null = null;
  try {
    f = await db
      .prepare(
        `UPDATE avisos_operacion SET estado = 'enviando', intentos = intentos + 1, actualizado_en = ?
          WHERE id = ? AND (estado = 'pendiente'
             OR (estado = 'fallido' AND intentos < ? AND COALESCE(proximo_intento_en, 0) <= ?)
             OR (estado = 'enviando' AND actualizado_en < ?)) RETURNING *`,
      )
      .bind(ahora, id, MAX_INTENTOS_AVISO, ahora, ahora - ENVIANDO_COLGADO_MS)
      .first<FilaAviso>();
  } catch {
    return { id, estado: "fallido", mensaje: mensajeFallo(id) };
  }
  if (!f) {
    const actual = await db.prepare("SELECT estado FROM avisos_operacion WHERE id = ?").bind(id).first<{ estado: string }>().catch(() => null);
    if (actual?.estado === "enviado") return { id, estado: "enviado", mensaje: MENSAJE_OK };
    if (actual?.estado === "cancelado") return { id, estado: "cancelado", mensaje: "El aviso se canceló porque el cambio no se aplicó." };
    if (actual?.estado === "enviando") return { id, estado: "en_curso", mensaje: "El aviso a Jorge se está enviando." };
    return { id, estado: "fallido", mensaje: mensajeFallo(id) };
  }
  let codigoError: string | null = null;
  const para = correoAprobadorValido(deps.aprobadorEmail);
  if (!para) codigoError = "sin_aprobador";
  else {
    try {
      if (!(await deps.enviar(construirCorreoAviso(f, para, deps.base)))) codigoError = "envio_rechazado";
    } catch {
      codigoError = "envio_error";
    }
  }
  if (!codigoError) {
    await db.prepare("UPDATE avisos_operacion SET estado = 'enviado', enviado_en = ?, actualizado_en = ?, ultimo_error = NULL WHERE id = ?").bind(ahora, ahora, id).run().catch(() => undefined);
    return { id, estado: "enviado", mensaje: MENSAJE_OK };
  }
  await db
    .prepare("UPDATE avisos_operacion SET estado = 'fallido', ultimo_error = ?, proximo_intento_en = ?, actualizado_en = ? WHERE id = ?")
    .bind(codigoError, ahora + REINTENTO_MS, ahora, id)
    .run()
    .catch(() => undefined);
  return { id, estado: "fallido", mensaje: mensajeFallo(id) };
}

/** Texto para anexar a la respuesta de una herramienta. */
export function textoAviso(r: ResultadoAviso | null | undefined): string {
  return r ? r.mensaje : "";
}

/** Cron de 30 minutos: reintenta los avisos fallidos, colgados o pendientes que nadie envió. */
export async function reintentarAvisos(db: D1Like, deps: DepsAviso, ahora: number = Date.now()): Promise<{ intentados: number; enviados: number; fallidos: number }> {
  const r = await db
    .prepare(
      `SELECT id FROM avisos_operacion
        WHERE (estado = 'pendiente' AND creado_en < ?)
           OR (estado = 'fallido' AND intentos < ? AND COALESCE(proximo_intento_en, 0) <= ?)
           OR (estado = 'enviando' AND actualizado_en < ?)
        ORDER BY creado_en LIMIT 25`,
    )
    .bind(ahora - PENDIENTE_VIEJO_MS, MAX_INTENTOS_AVISO, ahora, ahora - ENVIANDO_COLGADO_MS)
    .all<{ id: string }>();
  let enviados = 0;
  let fallidos = 0;
  for (const { id } of r.results) {
    const x = await enviarAviso(db, deps, id, ahora);
    if (x.estado === "enviado") enviados++;
    else if (x.estado === "fallido") fallidos++;
  }
  return { intentados: r.results.length, enviados, fallidos };
}

/** Avisos con problemas para /admin/conexiones: fallidos y pendientes que llevan rato sin salir. */
export interface AvisoConProblema {
  id: string; tipo: TipoAviso; estado: EstadoAviso; herramienta: string; operacion: string; pedidoNumero: string | null;
  creadoEn: number; intentos: number; ultimoError: string | null;
}

export async function avisosConProblemas(db: D1Like, ahora: number = Date.now()): Promise<AvisoConProblema[]> {
  const r = await db
    .prepare(
      `SELECT id, tipo, estado, herramienta, operacion, pedido_numero, creado_en, intentos, ultimo_error FROM avisos_operacion
        WHERE estado = 'fallido' OR (estado IN ('pendiente','enviando') AND creado_en < ?)
        ORDER BY creado_en DESC LIMIT 30`,
    )
    .bind(ahora - 15 * 60_000)
    .all<{ id: string; tipo: TipoAviso; estado: EstadoAviso; herramienta: string; operacion: string; pedido_numero: string | null; creado_en: number; intentos: number; ultimo_error: string | null }>();
  return r.results.map((f) => ({
    id: f.id, tipo: f.tipo, estado: f.estado, herramienta: f.herramienta, operacion: f.operacion, pedidoNumero: f.pedido_numero,
    creadoEn: f.creado_en, intentos: f.intentos, ultimoError: f.ultimo_error,
  }));
}

/**
 * Envía los avisos de cambio que quedaron registrados durante una llamada (servidor MCP). Nunca lanza.
 * Devuelve los resultados para anexarlos a la respuesta de la herramienta.
 */
export async function enviarAvisosDeLlamada(db: D1Like, deps: DepsAviso | null, ids: string[], ahora: number = Date.now()): Promise<ResultadoAviso[]> {
  const out: ResultadoAviso[] = [];
  for (const id of ids) {
    if (!deps) out.push({ id, estado: "fallido", mensaje: mensajeFallo(id) });
    else out.push(await enviarAviso(db, deps, id, ahora));
  }
  return out.filter((r) => r.estado !== "cancelado");
}

// ───────── Operaciones de dinero y borrado ─────────
export interface DatosAvisoDinero {
  usuario: { id: string; email?: string | null };
  /** Nombre de la herramienta que hace la operación. */
  herramienta: string;
  /** Título corto en español: «Confirmar transferencia», «Cancelar pedido con devolución», «Borrar pedido»... */
  operacion: string;
  pedidoNumero?: number | string | null;
  /** Se reduce a nombre de pila (o iniciales): pasa el nombre completo sin miedo, nunca sale entero. */
  clienteNombre?: string | null;
  /** Pesos chilenos enteros. */
  monto?: number | null;
  /** «Transferencia», «Webpay»... */
  medio?: string | null;
  /** Una o dos frases sin datos personales. */
  resumen?: string;
  loteId?: string;
  ahora?: number;
}

export type ResultadoEncolar =
  | { ok: true; id: string }
  | { ok: false; motivo: "sin_aprobador" | "no_registrado"; mensaje: string };

/** Paso (a)+(b): comprueba el correo de Jorge y REGISTRA el aviso pendiente. Si falla, la operación no debe ejecutarse. */
export async function encolarAvisoDinero(db: D1Like, deps: DepsAviso, d: DatosAvisoDinero): Promise<ResultadoEncolar> {
  if (!correoAprobadorValido(deps.aprobadorEmail)) {
    return {
      ok: false, motivo: "sin_aprobador",
      mensaje: "BLOQUEADO: las operaciones de dinero y borrado avisan siempre a Jorge por correo y falta configurar su correo (BARRACA_APROBADOR_EMAIL). No se hizo nada. Avísale a Jorge.",
    };
  }
  const ahora = d.ahora ?? Date.now();
  const id = idUuid();
  try {
    await db
      .prepare(
        `INSERT INTO avisos_operacion (id, tipo, estado, usuario_id, usuario_email, herramienta, operacion, resumen, pedido_numero, cliente_nombre, monto, medio, lote_id, creado_en, actualizado_en)
         VALUES (?, 'dinero', 'pendiente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id, d.usuario.id, d.usuario.email ?? null, d.herramienta.slice(0, 64), limpiarTextoAviso(d.operacion, 100), limpiarTextoAviso(d.resumen ?? "", 500),
        d.pedidoNumero === undefined || d.pedidoNumero === null ? null : limpiarTextoAviso(String(d.pedidoNumero), 40),
        quienEs(d.clienteNombre),
        typeof d.monto === "number" && Number.isFinite(d.monto) ? Math.round(d.monto) : null,
        d.medio ? limpiarTextoAviso(d.medio, 60) : null, d.loteId ?? null, ahora, ahora,
      )
      .run();
  } catch {
    return {
      ok: false, motivo: "no_registrado",
      mensaje: "BLOQUEADO: no pude registrar el aviso previo a Jorge, y sin él las operaciones de dinero y borrado no se hacen. No se hizo nada; intenta de nuevo en un momento.",
    };
  }
  return { ok: true, id };
}

/** Paso (d): marca cómo terminó la operación y envía el correo (el aviso ya está registrado; si falla se reintenta en el cron). */
export async function despacharAvisoDinero(db: D1Like, deps: DepsAviso, id: string, resultado: "ok" | "error" | "bloqueado" | null, ahora: number = Date.now()): Promise<ResultadoAviso> {
  await db.prepare("UPDATE avisos_operacion SET resultado = ?, actualizado_en = ? WHERE id = ?").bind(resultado, ahora, id).run().catch(() => undefined);
  return enviarAviso(db, deps, id, ahora);
}

export type ResultadoOperacionDinero<T> =
  | { ok: true; resultado: T; aviso: ResultadoAviso }
  | { ok: false; motivo: "sin_aprobador" | "no_registrado"; mensaje: string };

/**
 * UTILIDAD COMPARTIDA para toda operación de dinero o borrado (ambos modos de aprobación): registra el aviso, ejecuta
 * `operacion`, envía el correo. Ver el uso en el encabezado de este archivo.
 * `exito(resultado)` decide si el resultado cuenta como «ok» en el correo (por defecto sí: lanzar es lo que cuenta como error).
 */
export async function avisarOperacionDinero<T>(
  db: D1Like, deps: DepsAviso, datos: DatosAvisoDinero, operacion: () => Promise<T>,
  exito: (r: T) => boolean = () => true,
): Promise<ResultadoOperacionDinero<T>> {
  const enc = await encolarAvisoDinero(db, deps, datos);
  if (!enc.ok) return enc;
  let resultado: T;
  try {
    resultado = await operacion();
  } catch (e) {
    await despacharAvisoDinero(db, deps, enc.id, "error");
    throw e;
  }
  const aviso = await despacharAvisoDinero(db, deps, enc.id, exito(resultado) ? "ok" : "error");
  return { ok: true, resultado, aviso };
}
