/**
 * Aprobaciones de Jorge para cambios riesgosos (servicio base).
 *
 * Flujo: la herramienta calcula el cambio y llama a `requiereAprobacion(...)`.
 * Si hace falta, llama a `solicitarAprobacion(...)`: se guarda una solicitud
 * ligada al contenido exacto del cambio (`huella`) y se manda UN enlace de un
 * solo uso al correo del secreto BARRACA_APROBADOR_EMAIL. Jorge abre
 * /aprobar/<token>, ve el detalle (el GET no cambia nada) y aprueba o rechaza
 * con un botón (POST + CSRF). La herramienta, al repetirse, pregunta
 * `estadoAprobacion(...)` con la huella ACTUAL de los datos y, si está
 * 'aprobada', la gasta con `consumirAprobacion(...)` (una sola vez) y recién
 * ahí aplica el cambio. Si los datos cambiaron o pasó el plazo, no sirve.
 *
 * Sin BARRACA_APROBADOR_EMAIL (o con un correo inválido) las acciones quedan
 * BLOQUEADAS: nunca se aprueban solas.
 */
import type { D1Like } from "../gestion/index.ts";
import { desdeJson, huellaDeDatos, idUuid } from "../gestion/util.ts";
import { secretoAleatorio, sha256Hex } from "./cripto.ts";
import { HORA, DIA } from "./config.ts";

export const UMBRAL_PRODUCTOS_24H = 300;
export const UMBRAL_VARIACION_PCT = 30;
/** Precio mínimo sobre el costo: bajo 15 % exige aprobación (precio < costo * 1.15). */
export const MARGEN_MINIMO = 0.15;
/** El enlace del correo vive poco. */
export const TTL_APROBACION_MS = 4 * HORA;
const MAX_SOLICITUDES_POR_HORA = 10;
/** Tope del detalle que ve Jorge. Si se pasa, NO se recorta en silencio: queda marcado como incompleto y la página y el correo lo avisan. */
export const MAX_DETALLE_BYTES = 256 * 1024;

export type MotivoAprobacion =
  | "masivo_cantidad"          // más de 300 productos en 24 h
  | "variacion_precio"         // algún precio movido más de 30 % en 24 h
  | "precio_bajo_costo"
  | "margen_menor_15"
  | "descuento_transferencia"  // cambia el 2 % por transferencia
  | "despacho"                 // tarifas de despacho
  | "envio_gratis"             // umbral de envío gratis
  | "texto_legal"              // publicar términos o privacidad
  | "cupones_interruptor"      // encender el interruptor de cupones
  | "correo_cliente"          // textos de correos al cliente
  | "cupon_activo"            // cupón creado, editado o activado por la IA que queda activo
  | "datos_local"             // WhatsApp, teléfono, correo, dirección o RUT del local
  | "sin_costo_baja";         // baja de precio de un producto sin costo cargado (no se puede medir el margen)

export const TEXTO_MOTIVO: Record<MotivoAprobacion, string> = {
  masivo_cantidad: "Cambia más de 300 productos en 24 horas",
  variacion_precio: "Mueve un precio más de 30 % en 24 horas",
  precio_bajo_costo: "Deja un precio bajo el costo",
  margen_menor_15: "Deja un precio con menos de 15 % sobre el costo",
  descuento_transferencia: "Cambia el descuento por transferencia",
  despacho: "Cambia el despacho",
  envio_gratis: "Cambia el envío gratis",
  texto_legal: "Publica términos o privacidad",
  cupones_interruptor: "Enciende los cupones",
  correo_cliente: "Cambia un correo que reciben los clientes",
  cupon_activo: "Deja un cupón activo (puede dar descuentos a los clientes)",
  datos_local: "Cambia datos de contacto del local (WhatsApp, teléfono, correo, dirección o RUT)",
  sin_costo_baja: "Baja el precio de un producto sin costo cargado (no se puede medir el margen)",
};

// ───────── Reglas (puras) ─────────
/** Lo ya tocado por el usuario en las últimas 24 h (sin contar lo aprobado): producto → suma de variaciones %. */
export interface Acumulado24h { porClave: Record<string, number> }

export interface EntradaRequiere {
  /** Resultado de `leerAcumulado` (omitir = nada previo). */
  acumulado?: Acumulado24h;
  /** Productos que toca ESTE cambio; `clave` = código del producto (todas sus fichas cuentan como uno). */
  productos?: Array<{ clave: string; variacionPct?: number }>;
  /** Precios finales y costo, para revisar el margen. costo null/0 = no se evalúa. */
  precios?: Array<{ precio: number; costo?: number | null; /** El cambio BAJA el precio respecto de hoy. */ baja?: boolean }>;
  /** Reglas que la herramienta ya sabe por su cuenta (transferencia, despacho, texto legal, etc.). */
  banderas?: MotivoAprobacion[];
}

export interface DecisionAprobacion { requiere: boolean; motivos: MotivoAprobacion[] }

export function requiereAprobacion(e: EntradaRequiere): DecisionAprobacion {
  const motivos = new Set<MotivoAprobacion>(e.banderas ?? []);
  // Acumulado 24 h + esta vez, por producto.
  const suma: Record<string, number> = { ...(e.acumulado?.porClave ?? {}) };
  for (const p of e.productos ?? []) {
    const v = Number.isFinite(p.variacionPct) ? Math.abs(p.variacionPct as number) : 0;
    suma[p.clave] = (suma[p.clave] ?? 0) + v;
  }
  if (Object.keys(suma).length > UMBRAL_PRODUCTOS_24H) motivos.add("masivo_cantidad");
  if (Object.values(suma).some((v) => v > UMBRAL_VARIACION_PCT)) motivos.add("variacion_precio");
  for (const { precio, costo, baja } of e.precios ?? []) {
    const sinCosto = !costo || !Number.isFinite(costo) || costo <= 0;
    // Sin costo cargado no se puede medir el margen: una baja de precio queda pendiente de Jorge.
    if (sinCosto && baja) motivos.add("sin_costo_baja");
    if (!Number.isFinite(precio) || sinCosto) continue;
    if (precio < costo) motivos.add("precio_bajo_costo");
    else if (precio < costo * (1 + MARGEN_MINIMO)) motivos.add("margen_menor_15");
  }
  const lista = [...motivos];
  return { requiere: lista.length > 0, motivos: lista };
}

// ───────── Acumulado 24 h ─────────
export async function registrarAcumulado(
  db: D1Like, usuarioId: string, items: Array<{ clave: string; variacionPct?: number }>,
  opciones: { aprobado?: boolean; ahora?: number } = {},
): Promise<void> {
  const ahora = opciones.ahora ?? Date.now();
  const sentencias = items.map((i) =>
    db.prepare("INSERT INTO cambios_acumulados (id, usuario_id, clave, variacion_pct, aprobado, creado_en) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(idUuid(), usuarioId, String(i.clave).slice(0, 120), Number.isFinite(i.variacionPct) ? Math.abs(i.variacionPct as number) : 0, opciones.aprobado ? 1 : 0, ahora));
  for (let i = 0; i < sentencias.length; i += 90) await db.batch(sentencias.slice(i, i + 90));
}

export async function leerAcumulado(db: D1Like, usuarioId: string, ahora: number = Date.now()): Promise<Acumulado24h> {
  const r = await db
    .prepare("SELECT clave, SUM(variacion_pct) AS v FROM cambios_acumulados WHERE usuario_id = ? AND creado_en > ? AND aprobado = 0 GROUP BY clave LIMIT 5000")
    .bind(usuarioId, ahora - DIA)
    .all<{ clave: string; v: number }>();
  const porClave: Record<string, number> = {};
  for (const f of r.results) porClave[f.clave] = f.v;
  return { porClave };
}

// ───────── Solicitudes ─────────
export interface DatosSolicitud {
  usuario: { id: string; email?: string | null };
  herramienta: string;
  motivos: MotivoAprobacion[];
  /** Texto simple de lo que se va a hacer: lo ve Jorge en el correo y en la página. */
  resumen: string;
  /** Detalle mínimo del cambio (se muestra en la página). */
  detalle?: unknown;
  /** Huella (huellaDeDatos) del contenido exacto del cambio. */
  huella: string;
}

export interface AvisoAprobacion {
  para: string;
  enlace: string;
  solicitante: string | null;
  herramienta: string;
  resumen: string;
  motivos: MotivoAprobacion[];
  venceEn: number;
  /** Datos clave del cambio (cuántos productos, mayor variación, bajo costo…). */
  cifras?: Record<string, number>;
  /** El detalle completo no cupo y no se guardó: Jorge no debe aprobar a ciegas. */
  detalleIncompleto?: boolean;
}

/** Saca de `detalle.cifras` solo números sanos (el detalle lo arma la herramienta, pero se revisa igual). */
export function cifrasDeDetalle(detalle: unknown): Record<string, number> | undefined {
  const c = (detalle && typeof detalle === "object" ? (detalle as { cifras?: unknown }).cifras : undefined);
  if (!c || typeof c !== "object" || Array.isArray(c)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(c as Record<string, unknown>).slice(0, 12)) {
    if (typeof v === "number" && Number.isFinite(v) && /^[A-Za-z0-9_]{1,30}$/.test(k)) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export interface DepsAprobacion {
  /** Correo del aprobador (BARRACA_APROBADOR_EMAIL). Vacío = acciones bloqueadas. */
  aprobadorEmail: string | undefined;
  /** Manda el correo; devuelve true si salió. */
  enviar: (aviso: AvisoAprobacion) => Promise<boolean>;
  base: string;
}

export type ResultadoSolicitud =
  | { ok: true; id: string; estado: "pendiente"; venceEn: number; nueva: boolean }
  | { ok: false; estado: "bloqueada"; motivo: "sin_aprobador" | "limite" | "correo_fallo" | "mismo_usuario" };

/** Compara correos sin importar mayúsculas, espacios ni "+etiqueta". */
export function mismoCorreo(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (x: string | null | undefined) => {
    const e = String(x ?? "").trim().toLowerCase();
    const i = e.lastIndexOf("@");
    if (i < 1) return e;
    const local = e.slice(0, i);
    const mas = local.indexOf("+");
    return `${mas > 0 ? local.slice(0, mas) : local}@${e.slice(i + 1)}`;
  };
  const x = n(a);
  return x !== "" && x === n(b);
}

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export async function solicitarAprobacion(
  db: D1Like, d: DatosSolicitud, deps: DepsAprobacion, ahora: number = Date.now(),
): Promise<ResultadoSolicitud> {
  const para = deps.aprobadorEmail?.trim().toLowerCase();
  if (!para || para.length > 254 || !EMAIL_RE.test(para)) return { ok: false, estado: "bloqueada", motivo: "sin_aprobador" };
  // Quien pide no puede ser quien aprueba: si el correo del aprobador es el del usuario que solicita, no es aprobable.
  if (mismoCorreo(para, d.usuario.email)) return { ok: false, estado: "bloqueada", motivo: "mismo_usuario" };

  // Misma solicitud todavía pendiente: no se manda otro correo.
  const existente = await db
    .prepare("SELECT id, expira_en FROM aprobaciones WHERE usuario_id = ? AND herramienta = ? AND huella = ? AND estado = 'pendiente' AND expira_en > ?")
    .bind(d.usuario.id, d.herramienta, d.huella, ahora)
    .first<{ id: string; expira_en: number }>();
  if (existente) return { ok: true, id: existente.id, estado: "pendiente", venceEn: existente.expira_en, nueva: false };

  const recientes = await db
    .prepare("SELECT COUNT(*) AS n FROM aprobaciones WHERE usuario_id = ? AND creado_en > ?")
    .bind(d.usuario.id, ahora - HORA)
    .first<{ n: number }>();
  if ((recientes?.n ?? 0) >= MAX_SOLICITUDES_POR_HORA) return { ok: false, estado: "bloqueada", motivo: "limite" };

  const token = `mcpv_${secretoAleatorio(32)}`;
  const id = idUuid();
  const venceEn = ahora + TTL_APROBACION_MS;
  let detalle: string | null = null;
  // Sin aJson (si se pasaba del tope fallaba en silencio y la solicitud salía SIN detalle): aquí, si se pasa, se marca como incompleto.
  try { detalle = d.detalle === undefined || d.detalle === null ? null : (JSON.stringify(d.detalle) ?? null); } catch { detalle = null; }
  let incompleto = false;
  if (detalle && new TextEncoder().encode(detalle).length > MAX_DETALLE_BYTES) {
    incompleto = true;
    detalle = JSON.stringify({ detalleIncompleto: true, cifras: cifrasDeDetalle(d.detalle) ?? null });
  }
  const resumen = d.resumen.replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").slice(0, 600);
  await db
    .prepare(
      `INSERT INTO aprobaciones (id, token_hash, usuario_id, usuario_email, herramienta, motivos, resumen, detalle, huella, estado, creado_en, expira_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)`,
    )
    .bind(id, await sha256Hex(token), d.usuario.id, d.usuario.email ?? null, d.herramienta, JSON.stringify(d.motivos), resumen, detalle, d.huella, ahora, venceEn)
    .run();

  let salio = false;
  try {
    salio = await deps.enviar({
      para, enlace: `${deps.base}/aprobar/${token}`, solicitante: d.usuario.email ?? null,
      herramienta: d.herramienta, resumen, motivos: d.motivos, venceEn,
      cifras: cifrasDeDetalle(d.detalle), detalleIncompleto: incompleto,
    });
  } catch { salio = false; }
  if (!salio) {
    await db.prepare("DELETE FROM aprobaciones WHERE id = ?").bind(id).run();
    return { ok: false, estado: "bloqueada", motivo: "correo_fallo" };
  }
  return { ok: true, id, estado: "pendiente", venceEn, nueva: true };
}

export type EstadoAprobacion =
  | "no_existe" | "pendiente" | "aprobada" | "rechazada" | "usada" | "vencida" | "datos_cambiaron";

interface FilaAprobacion {
  id: string; usuario_id: string; usuario_email: string | null; herramienta: string; motivos: string; resumen: string;
  detalle: string | null; huella: string; estado: string; creado_en: number; expira_en: number;
}

/**
 * Estado de una solicitud. Pasa `huellaActual` (huella de los datos de AHORA):
 * si difiere de la guardada, la solicitud no sirve ('datos_cambiaron').
 * Solo ve las del propio usuario.
 */
export async function estadoAprobacion(
  db: D1Like, id: string, o: { usuarioId: string; huellaActual?: string }, ahora: number = Date.now(),
): Promise<EstadoAprobacion> {
  const f = await db.prepare("SELECT * FROM aprobaciones WHERE id = ? AND usuario_id = ?").bind(id, o.usuarioId).first<FilaAprobacion>();
  if (!f) return "no_existe";
  return estadoEfectivo(f, ahora, o.huellaActual);
}

function estadoEfectivo(f: FilaAprobacion, ahora: number, huellaActual?: string): EstadoAprobacion {
  if (f.estado === "usada" || f.estado === "rechazada") return f.estado;
  if (f.expira_en <= ahora) return "vencida";
  if (huellaActual !== undefined && huellaActual !== f.huella) return "datos_cambiaron";
  return f.estado as EstadoAprobacion;
}

/** Gasta una aprobación 'aprobada' (una sola vez, atómico). Devuelve true si la gastó. */
export async function consumirAprobacion(
  db: D1Like, id: string, o: { usuarioId: string; huellaActual: string }, ahora: number = Date.now(),
): Promise<boolean> {
  const f = await db
    .prepare("UPDATE aprobaciones SET estado = 'usada', usada_en = ? WHERE id = ? AND usuario_id = ? AND estado = 'aprobada' AND expira_en > ? AND huella = ? RETURNING id")
    .bind(ahora, id, o.usuarioId, ahora, o.huellaActual)
    .first<{ id: string }>();
  return !!f;
}

// ───────── Página pública /aprobar/[token] ─────────
export interface VistaAprobacion {
  id: string;
  herramienta: string;
  motivos: MotivoAprobacion[];
  resumen: string;
  detalle: unknown;
  solicitante: string | null;
  estado: EstadoAprobacion;
  creadoEn: number;
  venceEn: number;
  /** Huella del cambio (primeros caracteres sirven para cotejar con lo que mostró Claude). */
  huella: string;
}

const TOKEN_RE = /^mcpv_[A-Za-z0-9_-]{43}$/;

/** Solo lectura: lo que muestra el GET. No cambia nada. */
export async function verAprobacionPorToken(db: D1Like, token: string, ahora: number = Date.now()): Promise<VistaAprobacion | null> {
  if (!TOKEN_RE.test(token)) return null;
  const f = await db.prepare("SELECT * FROM aprobaciones WHERE token_hash = ?").bind(await sha256Hex(token)).first<FilaAprobacion>();
  if (!f) return null;
  return {
    id: f.id, herramienta: f.herramienta, motivos: (desdeJson<MotivoAprobacion[]>(f.motivos) ?? []).filter((m: string) => m in TEXTO_MOTIVO),
    resumen: f.resumen, detalle: desdeJson(f.detalle), solicitante: f.usuario_email, estado: estadoEfectivo(f, ahora),
    creadoEn: f.creado_en, venceEn: f.expira_en, huella: f.huella,
  };
}

/** Decide (POST). Atómico y de un solo uso: solo funciona sobre 'pendiente' sin vencer. */
export async function resolverAprobacion(
  db: D1Like, token: string, decision: "aprobar" | "rechazar", ahora: number = Date.now(),
): Promise<{ ok: true; estado: "aprobada" | "rechazada" } | { ok: false; motivo: "no_existe" | "ya_resuelta" | "vencida" }> {
  if (!TOKEN_RE.test(token)) return { ok: false, motivo: "no_existe" };
  const hash = await sha256Hex(token);
  const nuevo = decision === "aprobar" ? "aprobada" : "rechazada";
  const gano = await db
    .prepare("UPDATE aprobaciones SET estado = ?, resuelto_en = ? WHERE token_hash = ? AND estado = 'pendiente' AND expira_en > ? RETURNING id")
    .bind(nuevo, ahora, hash, ahora)
    .first<{ id: string }>();
  if (gano) return { ok: true, estado: nuevo };
  const f = await db.prepare("SELECT estado, expira_en FROM aprobaciones WHERE token_hash = ?").bind(hash).first<{ estado: string; expira_en: number }>();
  if (!f) return { ok: false, motivo: "no_existe" };
  return { ok: false, motivo: f.estado === "pendiente" ? "vencida" : "ya_resuelta" };
}

/** Borra solicitudes viejas y acumulados de más de 2 días. */
export async function limpiarAprobaciones(db: D1Like, ahora: number = Date.now()): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM aprobaciones WHERE creado_en < ?").bind(ahora - 30 * DIA),
    db.prepare("DELETE FROM cambios_acumulados WHERE creado_en < ?").bind(ahora - 2 * DIA),
  ]);
}

export { huellaDeDatos };
