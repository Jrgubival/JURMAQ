/**
 * Servidor de autorización OAuth 2.1 de la conexión de Claude (MCP).
 *
 * Por qué a mano y no una librería: @cloudflare/workers-oauth-provider envuelve
 * TODO el worker (aquí es el de OpenNext con cron propio), exige un KV nuevo
 * (recurso en producción) y no calza con el login NextAuth + Supabase; el SDK
 * de MCP trae transportes de Node/Express y la spec cambió en 2026-07-28. Lo
 * que se necesita (PKCE, registro dinámico, tokens opacos hasheados, rotación)
 * son ~400 líneas con WebCrypto y D1, sin criptografía propia: solo SHA-256,
 * HMAC y números al azar de WebCrypto.
 *
 * Reglas: PKCE S256 obligatorio; clientes públicos con redirect_uri de lista
 * blanca; `resource` debe ser este servidor; códigos de un solo uso y 60 s;
 * tokens opacos guardados solo como SHA-256; acceso 1 h; refresco con
 * rotación y detección de reuso (se revoca la familia); revocación inmediata.
 * Las funciones reciben la D1 y el reloj para poder probarse sin red.
 */
import type { D1Like } from "../gestion/index.ts";
import { idUuid } from "../gestion/util.ts";
import {
  desafioValido, pkceCoincide, secretoAleatorio, sha256Hex, verificadorValido,
} from "./cripto.ts";
import {
  GRACIA_ROTACION_MS, MAX_CLIENTES_SIN_USO, MAX_REDIRECTS_POR_CLIENTE, SCOPE_DINERO, SCOPE_ESCRIBIR, SCOPE_LEER,
  TTL_ACCESO_MS, TTL_CODIGO_MS, TTL_FAMILIA_MS, TTL_REFRESCO_MS, baseCanonica, mismoRecurso, urlRecurso,
} from "./config.ts";
import { esRedirectPermitida, redirectCoincide } from "./redirects.ts";

export interface UsuarioMcp {
  id: string;
  email: string | null;
}

export type ResultadoUsuario =
  | { ok: true; usuario: UsuarioMcp }
  | { ok: false; motivo: "no_autorizado" | "no_disponible" };

/** Dependencias externas (Supabase) inyectadas: en pruebas son falsas. */
export interface DepsOauth {
  verificarUsuario: (usuarioId: string) => Promise<ResultadoUsuario>;
  base?: string;
}

const base = (d?: DepsOauth) => d?.base ?? baseCanonica();

// ───────── Errores OAuth (RFC 6749 §5.2) ─────────
export type CodigoErrorOauth =
  | "invalid_request" | "invalid_client" | "invalid_grant" | "unauthorized_client"
  | "unsupported_grant_type" | "invalid_scope" | "invalid_target" | "access_denied" | "server_error";

export interface ErrorOauth {
  ok: false;
  error: CodigoErrorOauth;
  descripcion: string;
}
const err = (error: CodigoErrorOauth, descripcion: string): ErrorOauth => ({ ok: false, error, descripcion });

// ───────── Scopes ─────────
const ORDEN_SCOPES = [SCOPE_LEER, SCOPE_ESCRIBIR, SCOPE_DINERO] as const;

/**
 * Normaliza lo que pide el cliente. Sin `scope` (o solo `offline_access`) = el básico (leer + escribir):
 * NUNCA incluye dinero por omisión. Dinero implica escribir y leer; escribir implica leer.
 */
export function normalizarScope(crudo: string | null | undefined): { ok: true; scope: string } | ErrorOauth {
  const pedidos = (crudo ?? "").split(/\s+/).filter(Boolean).filter((s) => s !== "offline_access");
  if (pedidos.some((s) => !(ORDEN_SCOPES as readonly string[]).includes(s))) return err("invalid_scope", "Permiso no reconocido.");
  const set = new Set(pedidos.length ? pedidos : [SCOPE_LEER, SCOPE_ESCRIBIR]);
  if (set.has(SCOPE_DINERO)) set.add(SCOPE_ESCRIBIR);
  // Escribir implica leer.
  if (set.has(SCOPE_ESCRIBIR)) set.add(SCOPE_LEER);
  return { ok: true, scope: ORDEN_SCOPES.filter((s) => set.has(s)).join(" ") };
}

export function scopeIncluye(scopeToken: string, requerido: string): boolean {
  const set = new Set(scopeToken.split(" "));
  if (requerido === SCOPE_DINERO) return set.has(SCOPE_DINERO); // solo explícito: nada lo implica
  if (requerido === SCOPE_ESCRIBIR) return set.has(SCOPE_ESCRIBIR) || set.has(SCOPE_DINERO);
  return set.has(requerido) || (requerido === SCOPE_LEER && (set.has(SCOPE_ESCRIBIR) || set.has(SCOPE_DINERO)));
}

/**
 * Lo que de verdad se concede: lo pedido (ya normalizado y firmado en la pantalla) menos el permiso de dinero y
 * borrado si la persona NO lo marcó. La casilla jamás agrega algo que el cliente no pidió. Falla cerrado: sin
 * `consentimientoDinero === true` (solo ese valor exacto) no hay dinero.
 */
export function scopeConcedido(scopePedido: string, consentimientoDinero: unknown): string {
  const n = normalizarScope(scopePedido);
  if (!n.ok) return [SCOPE_LEER].join(" ");
  const set = new Set(n.scope.split(" "));
  if (consentimientoDinero !== true) set.delete(SCOPE_DINERO);
  return ORDEN_SCOPES.filter((s) => set.has(s)).join(" ");
}

// ───────── Clientes (registro dinámico, RFC 7591) ─────────
export interface ClienteOauth {
  id: string;
  nombre: string;
  redirectUris: string[];
  creadoEn: number;
}

function limpiarNombre(n: unknown): string {
  const s = typeof n === "string" ? n.replace(/[\u0000-\u001f<>]/g, "").trim() : "";
  return s.slice(0, 80) || "Aplicación sin nombre";
}

export async function registrarCliente(
  db: D1Like,
  entrada: { nombre?: unknown; redirectUris: unknown; ipHash?: string },
  ahora: number = Date.now(),
): Promise<{ ok: true; cliente: ClienteOauth } | { ok: false; error: "invalid_redirect_uri" | "invalid_client_metadata" | "limite"; descripcion: string }> {
  const uris = entrada.redirectUris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > MAX_REDIRECTS_POR_CLIENTE || uris.some((u) => typeof u !== "string")) {
    return { ok: false, error: "invalid_redirect_uri", descripcion: "redirect_uris inválidas." };
  }
  const lista = [...new Set(uris as string[])].sort();
  if (!lista.every(esRedirectPermitida)) {
    return { ok: false, error: "invalid_redirect_uri", descripcion: "Alguna redirect_uri no está permitida." };
  }
  // Mismo nombre y mismas redirect_uris: se reutiliza el cliente (no se llena el cupo registrando lo mismo).
  const nombreLimpio = limpiarNombre(entrada.nombre);
  const igual = await db
    .prepare("SELECT id, nombre, redirect_uris, creado_en FROM oauth_clientes WHERE nombre = ? AND redirect_uris = ? ORDER BY creado_en DESC LIMIT 1")
    .bind(nombreLimpio, JSON.stringify(lista))
    .first<{ id: string; nombre: string; redirect_uris: string; creado_en: number }>();
  if (igual) return { ok: true, cliente: { id: igual.id, nombre: igual.nombre, redirectUris: lista, creadoEn: igual.creado_en } };
  // Anti llenado: tope de clientes que nunca emitieron un token.
  const sinUso = await db
    .prepare(`SELECT COUNT(*) AS n FROM oauth_clientes c WHERE NOT EXISTS (SELECT 1 FROM oauth_tokens t WHERE t.cliente_id = c.id)`)
    .first<{ n: number }>();
  if ((sinUso?.n ?? 0) >= MAX_CLIENTES_SIN_USO) {
    return { ok: false, error: "limite", descripcion: "Demasiados registros pendientes. Intenta más tarde." };
  }
  const cliente: ClienteOauth = { id: `mcpcli_${idUuid()}`, nombre: nombreLimpio, redirectUris: lista, creadoEn: ahora };
  await db
    .prepare("INSERT INTO oauth_clientes (id, nombre, redirect_uris, creado_en, ip_hash) VALUES (?, ?, ?, ?, ?)")
    .bind(cliente.id, cliente.nombre, JSON.stringify(lista), ahora, entrada.ipHash ?? null)
    .run();
  return { ok: true, cliente };
}

export async function obtenerCliente(db: D1Like, id: unknown): Promise<ClienteOauth | null> {
  if (typeof id !== "string" || id.length > 80) return null;
  const f = await db
    .prepare("SELECT id, nombre, redirect_uris, creado_en FROM oauth_clientes WHERE id = ?")
    .bind(id)
    .first<{ id: string; nombre: string; redirect_uris: string; creado_en: number }>();
  if (!f) return null;
  try {
    return { id: f.id, nombre: f.nombre, redirectUris: JSON.parse(f.redirect_uris) as string[], creadoEn: f.creado_en };
  } catch {
    return null;
  }
}

// ───────── Solicitud de autorización ─────────
export interface SolicitudAutorizacion {
  cliente: ClienteOauth;
  redirectUri: string;
  scope: string;
  resource: string;
  codeChallenge: string;
  state: string | null;
}

export type ValidacionAutorizacion =
  | { ok: true; solicitud: SolicitudAutorizacion }
  /** El cliente o la redirect no sirven: NO se redirige (pantalla de error). */
  | { ok: false; modo: "pagina"; error: CodigoErrorOauth; descripcion: string }
  /** Parámetros malos pero la redirect es confiable: se vuelve con `error`. */
  | { ok: false; modo: "redirigir"; error: CodigoErrorOauth; descripcion: string; redirectUri: string; state: string | null };

export async function validarSolicitudAutorizacion(
  db: D1Like, p: Record<string, string | undefined>, deps?: DepsOauth,
): Promise<ValidacionAutorizacion> {
  const cliente = await obtenerCliente(db, p.client_id);
  if (!cliente) return { ok: false, modo: "pagina", error: "invalid_client", descripcion: "Aplicación desconocida." };
  const ru = p.redirect_uri ?? "";
  if (!ru || !cliente.redirectUris.some((r) => redirectCoincide(r, ru)) || !esRedirectPermitida(ru)) {
    return { ok: false, modo: "pagina", error: "invalid_request", descripcion: "La dirección de retorno no coincide con la registrada." };
  }
  const state = typeof p.state === "string" && p.state.length <= 512 ? p.state : null;
  const rebote = (error: CodigoErrorOauth, descripcion: string): ValidacionAutorizacion =>
    ({ ok: false, modo: "redirigir", error, descripcion, redirectUri: ru, state });
  if (p.response_type !== "code") return rebote("invalid_request", "response_type debe ser code.");
  if (p.code_challenge_method !== "S256" || !desafioValido(p.code_challenge)) {
    return rebote("invalid_request", "Se exige PKCE con S256.");
  }
  const recurso = p.resource ?? urlRecurso(base(deps));
  if (!mismoRecurso(recurso, urlRecurso(base(deps)))) return rebote("invalid_target", "El recurso no es este servidor.");
  const sc = normalizarScope(p.scope);
  if (!sc.ok) return rebote(sc.error, sc.descripcion);
  return {
    ok: true,
    solicitud: { cliente, redirectUri: ru, scope: sc.scope, resource: urlRecurso(base(deps)), codeChallenge: p.code_challenge as string, state },
  };
}

// ───────── Código de autorización ─────────
export async function emitirCodigo(
  db: D1Like,
  s: { clienteId: string; usuario: UsuarioMcp; redirectUri: string; codeChallenge: string; scope: string; resource: string },
  ahora: number = Date.now(),
): Promise<string> {
  const codigo = `mcpc_${secretoAleatorio(32)}`;
  await db
    .prepare(
      `INSERT INTO oauth_codigos (codigo_hash, cliente_id, usuario_id, usuario_email, redirect_uri, code_challenge, scope, resource, creado_en, expira_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(await sha256Hex(codigo), s.clienteId, s.usuario.id, s.usuario.email, s.redirectUri, s.codeChallenge, s.scope, s.resource, ahora, ahora + TTL_CODIGO_MS)
    .run();
  return codigo;
}

// ───────── Tokens ─────────
export interface ParTokens {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface FilaToken {
  id: string; familia_id: string; cliente_id: string; usuario_id: string; usuario_email: string | null;
  scope: string; resource: string; codigo_hash: string | null; access_hash: string; access_expira_en: number;
  refresh_hash: string; refresh_expira_en: number; creado_en: number; familia_creada_en: number;
  ultimo_uso: number | null; rotado_en: number | null; revocado_en: number | null; revocado_motivo: string | null;
}

async function crearPar(
  db: D1Like,
  d: { familiaId: string; familiaCreadaEn: number; clienteId: string; usuario: UsuarioMcp; scope: string; resource: string; codigoHash: string | null },
  ahora: number,
): Promise<ParTokens> {
  const acceso = `mcpa_${secretoAleatorio(32)}`;
  const refresco = `mcpr_${secretoAleatorio(32)}`;
  const refrescoExpira = Math.min(ahora + TTL_REFRESCO_MS, d.familiaCreadaEn + TTL_FAMILIA_MS);
  await db
    .prepare(
      `INSERT INTO oauth_tokens (id, familia_id, cliente_id, usuario_id, usuario_email, scope, resource, codigo_hash,
         access_hash, access_expira_en, refresh_hash, refresh_expira_en, creado_en, familia_creada_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      idUuid(), d.familiaId, d.clienteId, d.usuario.id, d.usuario.email, d.scope, d.resource, d.codigoHash,
      await sha256Hex(acceso), ahora + TTL_ACCESO_MS, await sha256Hex(refresco), refrescoExpira, ahora, d.familiaCreadaEn,
    )
    .run();
  return { access_token: acceso, token_type: "Bearer", expires_in: Math.floor(TTL_ACCESO_MS / 1000), refresh_token: refresco, scope: d.scope };
}

/** Revoca todas las filas de una familia (la conexión completa). Devuelve cuántas tocó. */
export async function revocarFamilia(db: D1Like, familiaId: string, motivo: string, ahora: number = Date.now()): Promise<number> {
  const r = await db
    .prepare("UPDATE oauth_tokens SET revocado_en = ?, revocado_motivo = ? WHERE familia_id = ? AND revocado_en IS NULL")
    .bind(ahora, motivo, familiaId)
    .run();
  return r.meta?.changes ?? 0;
}

export async function canjearCodigo(
  db: D1Like,
  p: { code?: string; clientId?: string; redirectUri?: string; codeVerifier?: string; resource?: string },
  deps: DepsOauth,
  ahora: number = Date.now(),
): Promise<{ ok: true; tokens: ParTokens } | ErrorOauth> {
  if (!p.code || !p.clientId || !p.redirectUri || !verificadorValido(p.codeVerifier)) {
    return err("invalid_request", "Faltan parámetros o el code_verifier no es válido.");
  }
  const hash = await sha256Hex(p.code);
  // Un solo uso, atómico: el UPDATE solo pega si nadie lo gastó y no venció.
  const fila = await db
    .prepare("UPDATE oauth_codigos SET usado_en = ? WHERE codigo_hash = ? AND usado_en IS NULL AND expira_en > ? RETURNING *")
    .bind(ahora, hash, ahora)
    .first<{ cliente_id: string; usuario_id: string; usuario_email: string | null; redirect_uri: string; code_challenge: string; scope: string; resource: string }>();
  if (!fila) {
    // ¿Reuso de un código ya canjeado? Se revocan los tokens que nacieron de él.
    const previa = await db.prepare("SELECT usado_en FROM oauth_codigos WHERE codigo_hash = ?").bind(hash).first<{ usado_en: number | null }>();
    if (previa?.usado_en) {
      const t = await db.prepare("SELECT familia_id FROM oauth_tokens WHERE codigo_hash = ?").bind(hash).first<{ familia_id: string }>();
      if (t) await revocarFamilia(db, t.familia_id, "reuso_de_codigo", ahora);
    }
    return err("invalid_grant", "Código inválido, vencido o ya usado.");
  }
  if (fila.cliente_id !== p.clientId) return err("invalid_grant", "El código es de otra aplicación.");
  if (fila.redirect_uri !== p.redirectUri) return err("invalid_grant", "La dirección de retorno no coincide.");
  if (p.resource !== undefined && !mismoRecurso(p.resource, fila.resource)) return err("invalid_target", "El recurso no coincide.");
  if (!(await pkceCoincide(p.codeVerifier as string, fila.code_challenge))) return err("invalid_grant", "PKCE: verificador incorrecto.");
  // El usuario debe seguir siendo admin ahora mismo.
  const u = await deps.verificarUsuario(fila.usuario_id);
  if (!u.ok) return u.motivo === "no_disponible" ? err("server_error", "Servicio no disponible.") : err("invalid_grant", "La cuenta ya no puede autorizar.");
  const tokens = await crearPar(db, {
    familiaId: idUuid(), familiaCreadaEn: ahora, clienteId: fila.cliente_id, usuario: u.usuario,
    scope: fila.scope, resource: fila.resource, codigoHash: hash,
  }, ahora);
  return { ok: true, tokens };
}

export async function refrescar(
  db: D1Like,
  p: { refreshToken?: string; clientId?: string; scope?: string; resource?: string },
  deps: DepsOauth,
  ahora: number = Date.now(),
): Promise<{ ok: true; tokens: ParTokens } | ErrorOauth> {
  if (!p.refreshToken || !p.clientId) return err("invalid_request", "Faltan parámetros.");
  const hash = await sha256Hex(p.refreshToken);
  const fila = await db.prepare("SELECT * FROM oauth_tokens WHERE refresh_hash = ?").bind(hash).first<FilaToken>();
  if (!fila || fila.cliente_id !== p.clientId) return err("invalid_grant", "Refresco inválido.");
  if (fila.revocado_en) return err("invalid_grant", "La conexión fue revocada.");
  if (fila.rotado_en) {
    // Reuso de un refresco viejo: alguien lo copió. Se corta toda la familia.
    await revocarFamilia(db, fila.familia_id, "reuso_de_refresco", ahora);
    return err("invalid_grant", "Refresco ya usado; la conexión se cerró por seguridad.");
  }
  if (fila.refresh_expira_en <= ahora || fila.familia_creada_en + TTL_FAMILIA_MS <= ahora) return err("invalid_grant", "Refresco vencido.");
  if (p.resource !== undefined && !mismoRecurso(p.resource, fila.resource)) return err("invalid_target", "El recurso no coincide.");
  let scope = fila.scope;
  if (p.scope) {
    const pedido = normalizarScope(p.scope);
    if (!pedido.ok) return pedido;
    // Solo se puede achicar, nunca ampliar.
    const tiene = new Set(fila.scope.split(" "));
    if (pedido.scope.split(" ").some((s) => !tiene.has(s))) return err("invalid_scope", "No se puede ampliar el permiso.");
    scope = pedido.scope;
  }
  const u = await deps.verificarUsuario(fila.usuario_id);
  if (!u.ok) {
    if (u.motivo === "no_disponible") return err("server_error", "Servicio no disponible.");
    await revocarFamilia(db, fila.familia_id, "usuario_sin_permiso", ahora);
    return err("invalid_grant", "La cuenta ya no puede autorizar.");
  }
  // Rotación atómica: solo uno de dos pedidos simultáneos gana.
  const gano = await db
    .prepare("UPDATE oauth_tokens SET rotado_en = ? WHERE id = ? AND rotado_en IS NULL AND revocado_en IS NULL RETURNING id")
    .bind(ahora, fila.id)
    .first<{ id: string }>();
  if (!gano) {
    await revocarFamilia(db, fila.familia_id, "reuso_de_refresco", ahora);
    return err("invalid_grant", "Refresco ya usado; la conexión se cerró por seguridad.");
  }
  const tokens = await crearPar(db, {
    familiaId: fila.familia_id, familiaCreadaEn: fila.familia_creada_en, clienteId: fila.cliente_id,
    usuario: u.usuario, scope, resource: fila.resource, codigoHash: null,
  }, ahora);
  return { ok: true, tokens };
}

// ───────── Uso del token de acceso ─────────
export interface AccesoValido {
  tokenId: string;
  familiaId: string;
  clienteId: string;
  usuarioId: string;
  usuarioEmail: string | null;
  scope: string;
  resource: string;
}

export type ResultadoAcceso =
  | { ok: true; acceso: AccesoValido }
  | { ok: false; motivo: "ausente" | "invalido" | "vencido" | "revocado" | "audiencia" };

const MARCA_USO_CADA_MS = 60_000;

export async function autenticarAcceso(
  db: D1Like, token: string | null, ahora: number = Date.now(), deps?: { base?: string },
): Promise<ResultadoAcceso> {
  if (!token) return { ok: false, motivo: "ausente" };
  if (!/^mcpa_[A-Za-z0-9_-]{43}$/.test(token)) return { ok: false, motivo: "invalido" };
  const f = await db.prepare("SELECT * FROM oauth_tokens WHERE access_hash = ?").bind(await sha256Hex(token)).first<FilaToken>();
  if (!f) return { ok: false, motivo: "invalido" };
  if (f.revocado_en) return { ok: false, motivo: "revocado" };
  if (f.access_expira_en <= ahora || f.familia_creada_en + TTL_FAMILIA_MS <= ahora) return { ok: false, motivo: "vencido" };
  if (f.rotado_en && ahora - f.rotado_en > GRACIA_ROTACION_MS) return { ok: false, motivo: "vencido" };
  // Audiencia: el token debe haberse emitido para ESTE servidor.
  if (!mismoRecurso(f.resource, urlRecurso(deps?.base ?? baseCanonica()))) return { ok: false, motivo: "audiencia" };
  if (!f.ultimo_uso || ahora - f.ultimo_uso > MARCA_USO_CADA_MS) {
    // Mejor esfuerzo: un fallo aquí no debe tumbar la llamada.
    await db.prepare("UPDATE oauth_tokens SET ultimo_uso = ? WHERE familia_id = ? AND revocado_en IS NULL").bind(ahora, f.familia_id).run().catch(() => {});
  }
  return {
    ok: true,
    acceso: {
      tokenId: f.id, familiaId: f.familia_id, clienteId: f.cliente_id, usuarioId: f.usuario_id,
      usuarioEmail: f.usuario_email, scope: f.scope, resource: f.resource,
    },
  };
}

/** RFC 7009: revoca la conexión a la que pertenece el token (acceso o refresco). Siempre "ok" hacia afuera. */
export async function revocarPorToken(db: D1Like, token: string, ahora: number = Date.now()): Promise<boolean> {
  const hash = await sha256Hex(token);
  const f = await db
    .prepare("SELECT familia_id FROM oauth_tokens WHERE access_hash = ? OR refresh_hash = ?")
    .bind(hash, hash)
    .first<{ familia_id: string }>();
  if (!f) return false;
  await revocarFamilia(db, f.familia_id, "revocado_por_cliente", ahora);
  return true;
}

// ───────── Conexiones (para /admin/conexiones) ─────────
export interface Conexion {
  familiaId: string;
  clienteId: string;
  clienteNombre: string;
  usuarioId: string;
  usuarioEmail: string | null;
  scope: string;
  creadaEn: number;
  ultimoUso: number | null;
  venceEn: number;
}

/** Conexiones activas: familias no revocadas con un refresco vigente. */
export async function listarConexiones(db: D1Like, ahora: number = Date.now()): Promise<Conexion[]> {
  const r = await db
    .prepare(
      `SELECT t.familia_id, t.cliente_id, COALESCE(c.nombre, 'Aplicación') AS cliente_nombre, t.usuario_id, t.usuario_email,
              t.scope, t.familia_creada_en AS creada_en,
              (SELECT MAX(x.ultimo_uso) FROM oauth_tokens x WHERE x.familia_id = t.familia_id) AS ultimo_uso,
              t.refresh_expira_en AS vence_en
         FROM oauth_tokens t LEFT JOIN oauth_clientes c ON c.id = t.cliente_id
        WHERE t.rotado_en IS NULL AND t.revocado_en IS NULL AND t.refresh_expira_en > ?
        ORDER BY t.familia_creada_en DESC LIMIT 100`,
    )
    .bind(ahora)
    .all<{ familia_id: string; cliente_id: string; cliente_nombre: string; usuario_id: string; usuario_email: string | null; scope: string; creada_en: number; ultimo_uso: number | null; vence_en: number }>();
  return r.results.map((f) => ({
    familiaId: f.familia_id, clienteId: f.cliente_id, clienteNombre: f.cliente_nombre, usuarioId: f.usuario_id,
    usuarioEmail: f.usuario_email, scope: f.scope, creadaEn: f.creada_en, ultimoUso: f.ultimo_uso, venceEn: f.vence_en,
  }));
}

/** Limpieza periódica: códigos viejos, tokens muertos y clientes registrados que nunca se usaron. */
export async function limpiarOauth(db: D1Like, ahora: number = Date.now()): Promise<void> {
  const DIA = 86_400_000;
  await db.batch([
    db.prepare("DELETE FROM oauth_codigos WHERE expira_en < ?").bind(ahora - 3600_000),
    db.prepare("DELETE FROM oauth_tokens WHERE (revocado_en IS NOT NULL AND revocado_en < ?) OR refresh_expira_en < ?").bind(ahora - 30 * DIA, ahora - 30 * DIA),
    // Clientes registrados que nunca emitieron un token y tienen más de 24 h: se barren (liberan el cupo).
    db.prepare("DELETE FROM oauth_clientes WHERE creado_en < ? AND NOT EXISTS (SELECT 1 FROM oauth_tokens t WHERE t.cliente_id = oauth_clientes.id)").bind(ahora - DIA),
  ]);
}
