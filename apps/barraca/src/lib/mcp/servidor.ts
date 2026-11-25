/**
 * Servidor MCP (Streamable HTTP, solo POST, sin sesiones) sobre JSON-RPC 2.0.
 * Habla las revisiones 2024-11-05 a 2025-11-25 (initialize + tools). La
 * revisión 2026-07-28 (sin initialize) se rechaza con la lista de versiones
 * soportadas, que es lo que su spec pide a un servidor que no la implementa.
 *
 * La función `manejarSolicitudMcp` no toca Next ni Cloudflare: recibe la
 * petición ya leída y devuelve estado + cuerpo. Así se prueba entera.
 *
 * Orden de cada llamada: Origin → token (hash, vigencia, audiencia) → usuario
 * revalidado en Supabase (admin con scope barraca) → límite de uso → tamaño y
 * JSON → método. Nada de eso se salta ni con `initialize` o `tools/list`.
 */
import { registrarLote, nuevoLoteId, esGestionNoDisponible, type CambioAuditado, type D1Like } from "../gestion/index.ts";
import {
  LIMITE_ESCRITURAS_POR_MIN, LIMITE_MCP_POR_MIN, MAX_BODY_MCP_BYTES, MAX_SALIDA_HERRAMIENTA_BYTES, MIN,
  ORIGENES_MCP_EXTRA, SCOPE_ESCRIBIR, baseCanonica, encabezadoNoAutenticado,
} from "./config.ts";
import { consultarLimite, limitar } from "./limites.ts";
import { sha256Hex } from "./cripto.ts";
import { herramientaPideOk } from "./escrituras-libres.ts";
import { huellaDeDatos } from "../gestion/util.ts";
import { exigirAprobacion } from "../gestion-precios/aprobacion.ts";
import type { DatosSolicitud, ResultadoSolicitud } from "./aprobaciones.ts";
import { autenticarAcceso, revocarFamilia, scopeIncluye, type AccesoValido, type ResultadoUsuario } from "./oauth.ts";
import { ErrorHerramienta, z, type ContextoHerramienta, type Herramienta, type Registro } from "./tools/registro.ts";

export const VERSIONES_SOPORTADAS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;

export interface DepsServidor {
  db: D1Like;
  registro: Registro;
  verificarUsuario: (usuarioId: string) => Promise<ResultadoUsuario>;
  base?: string;
  ahora?: number;
  /** Pide el OK de Jorge (correo). Solo se usa si el interruptor de escrituras libres lo exige; por defecto, el real. */
  solicitarAprobacion?: (db: D1Like, datos: DatosSolicitud) => Promise<ResultadoSolicitud>;
}

export interface PeticionMcp {
  metodo: string;
  cabecera: (nombre: string) => string | null;
  /** Cuerpo ya leído como texto (la ruta corta antes lo que pase de MAX_BODY_MCP_BYTES). */
  texto: string;
}

export interface RespuestaMcp {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
}

const jsonrpcError = (id: unknown, code: number, message: string, data?: unknown) =>
  ({ jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data !== undefined ? { data } : {}) } });

function noAutenticado(base: string, codigo?: string, descripcion?: string): RespuestaMcp {
  return {
    status: 401,
    headers: { "WWW-Authenticate": encabezadoNoAutenticado(base, codigo ? { codigo, descripcion } : undefined) },
    body: { error: codigo ?? "unauthorized", error_description: descripcion ?? "Autenticación requerida." },
  };
}

function extraerBearer(valor: string | null): string | null {
  const m = /^Bearer ([^\s]{1,200})$/i.exec(valor ?? "");
  return m ? m[1] : null;
}

const esquemasEstrictos = new WeakMap<Herramienta, z.ZodObject>();
const jsonSchemas = new WeakMap<Herramienta, Record<string, unknown>>();

function esquemaEstricto(h: Herramienta): z.ZodObject {
  let e = esquemasEstrictos.get(h);
  if (!e) { e = z.strictObject(h.esquema.shape); esquemasEstrictos.set(h, e); }
  return e;
}

/**
 * Achica el JSON Schema que ve Claude (el contexto se paga por cada token de `tools/list`) SIN cambiar lo
 * que el servidor valida: la validación real sigue siendo el esquema zod estricto. Quita lo redundante:
 * `additionalProperties:false` de los objetos anidados (el de arriba se conserva), topes de largo/valor
 * que solo son resguardos (maxLength >= 100, maximum >= 1000), «anyOf [X, null]» pasa a `type: [X, "null"]`
 * y una descripción que ya apareció en la misma herramienta no se repite.
 */
export function compactarEsquema(nodo: unknown, vistas: Set<string>, raiz = true): Record<string, unknown> {
  const o = { ...(nodo as Record<string, unknown>) };
  if (!raiz && o.type === "object") delete o.additionalProperties;
  if (typeof o.maxLength === "number" && o.maxLength >= 100) delete o.maxLength;
  if (typeof o.maximum === "number" && o.maximum >= 1000) delete o.maximum;
  if (typeof o.description === "string") {
    if (vistas.has(o.description)) delete o.description;
    else vistas.add(o.description);
  }
  if (Array.isArray(o.anyOf) && o.anyOf.length === 2) {
    const nulo = o.anyOf.find((x) => (x as { type?: unknown })?.type === "null") as Record<string, unknown> | undefined;
    const otro = o.anyOf.find((x) => x !== nulo) as Record<string, unknown> | undefined;
    if (nulo && otro && Object.keys(nulo).length === 1 && ["string", "integer", "number", "boolean"].includes(otro.type as string)) {
      delete o.anyOf;
      Object.assign(o, compactarEsquema(otro, vistas, false), { type: [otro.type, "null"] });
    }
  }
  for (const k of ["properties", "$defs"]) {
    const props = o[k];
    if (props && typeof props === "object") {
      o[k] = Object.fromEntries(Object.entries(props as Record<string, unknown>).map(([n, v]) => [n, compactarEsquema(v, vistas, false)]));
    }
  }
  for (const k of ["items", "additionalProperties"]) if (o[k] && typeof o[k] === "object") o[k] = compactarEsquema(o[k], vistas, false);
  for (const k of ["anyOf", "oneOf", "allOf"]) if (Array.isArray(o[k])) o[k] = (o[k] as unknown[]).map((v) => compactarEsquema(v, vistas, false));
  return o;
}

function jsonSchemaDe(h: Herramienta): Record<string, unknown> {
  let s = jsonSchemas.get(h);
  if (!s) {
    const { $schema: _omitido, ...resto } = z.toJSONSchema(esquemaEstricto(h)) as Record<string, unknown>;
    void _omitido;
    s = compactarEsquema(resto, new Set());
    jsonSchemas.set(h, s);
  }
  return s;
}

/** Lo que devuelve `tools/list` (también lo mide una prueba: tope de tamaño). */
export function listarHerramientasMcp(registro: Registro, puedeEscribir: boolean) {
  return registro.lista().filter((h) => puedeEscribir || !esEscritura(h)).map((h) => ({
    name: h.nombre,
    title: h.titulo,
    description: h.descripcion,
    inputSchema: jsonSchemaDe(h),
    annotations: { ...h.anotaciones, openWorldHint: false },
  }));
}

const LIMITE_TOKENS_MALOS_POR_MIN = 30;
const esEscritura = (h: Herramienta) => !h.anotaciones.readOnlyHint;

function origenPermitido(origen: string | null, base: string): boolean {
  if (origen === null) return true; // Claude llama de servidor a servidor, sin Origin.
  return origen === new URL(base).origin || ORIGENES_MCP_EXTRA.includes(origen);
}

const Llamada = z.object({
  name: z.string().min(1).max(64),
  arguments: z.record(z.string(), z.unknown()).optional(),
});

export async function manejarSolicitudMcp(p: PeticionMcp, deps: DepsServidor): Promise<RespuestaMcp> {
  const base = deps.base ?? baseCanonica();
  const ahora = deps.ahora ?? Date.now();

  if (p.metodo !== "POST") return { status: 405, headers: { Allow: "POST" }, body: jsonrpcError(null, -32000, "Método no permitido.") };
  if (!origenPermitido(p.cabecera("origin"), base)) return { status: 403, body: jsonrpcError(null, -32000, "Origen no permitido.") };

  // 1. Token. Los tokens con forma válida pero que no existen consultan D1: tienen tope por IP (solo los fallidos
  // suman; Claude, que llega desde pocas IPs con tokens buenos, no se ve afectado).
  const ipHash = (await sha256Hex(`mcp-ip:${p.cabecera("cf-connecting-ip") || p.cabecera("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida"}`)).slice(0, 32);
  const claveMalos = `mcp-tok-malo:${ipHash}`;
  const bearer = extraerBearer(p.cabecera("authorization"));
  if (bearer) {
    const antes = await consultarLimite(deps.db, claveMalos, LIMITE_TOKENS_MALOS_POR_MIN, MIN, ahora);
    if (!antes.permitido) return limitado(antes.reintentarEnSeg);
  }
  const a = await autenticarAcceso(deps.db, bearer, ahora, { base });
  if (!a.ok) {
    if (a.motivo === "invalido") await limitar(deps.db, claveMalos, LIMITE_TOKENS_MALOS_POR_MIN, MIN, ahora).catch(() => undefined);
    return a.motivo === "ausente" ? noAutenticado(base) : noAutenticado(base, "invalid_token", "El token no es válido o venció.");
  }
  const acceso = a.acceso;

  // 2. Usuario revalidado en CADA llamada.
  const u = await deps.verificarUsuario(acceso.usuarioId);
  if (!u.ok) {
    if (u.motivo === "no_disponible") return { status: 503, headers: { "Retry-After": "10" }, body: jsonrpcError(null, -32603, "Servicio no disponible.") };
    await revocarFamilia(deps.db, acceso.familiaId, "usuario_sin_permiso", ahora);
    return noAutenticado(base, "invalid_token", "La cuenta ya no tiene acceso.");
  }

  // 3. Límite de uso por conexión.
  const lim = await limitar(deps.db, `mcp:${acceso.familiaId}`, LIMITE_MCP_POR_MIN, MIN, ahora);
  if (!lim.permitido) return limitado(lim.reintentarEnSeg);

  // 4. Tamaño y JSON.
  if (new TextEncoder().encode(p.texto).length > MAX_BODY_MCP_BYTES) {
    return { status: 413, body: jsonrpcError(null, -32600, "La petición es demasiado grande.") };
  }
  let msg: unknown;
  try { msg = JSON.parse(p.texto); } catch { return { status: 400, body: jsonrpcError(null, -32700, "JSON inválido.") }; }
  if (!msg || typeof msg !== "object" || Array.isArray(msg) || (msg as { jsonrpc?: unknown }).jsonrpc !== "2.0") {
    return { status: 400, body: jsonrpcError(null, -32600, "Se espera un mensaje JSON-RPC 2.0 (sin lotes).") };
  }
  const m = msg as { id?: unknown; method?: unknown; params?: unknown };
  if (typeof m.method !== "string" || m.method.length > 100) return { status: 400, body: jsonrpcError(null, -32600, "Falta el método.") };
  const tieneId = typeof m.id === "string" || typeof m.id === "number";

  // 5. Versión del protocolo (la de initialize se negocia en el cuerpo).
  const version = p.cabecera("mcp-protocol-version");
  if (version && !(VERSIONES_SOPORTADAS as readonly string[]).includes(version)) {
    return { status: 400, body: jsonrpcError(m.id, -32602, "Versión de protocolo no soportada.", { supported: VERSIONES_SOPORTADAS, requested: version.slice(0, 20) }) };
  }

  // Notificaciones (sin id): se aceptan y no se responden.
  if (!tieneId) return { status: 202 };

  const params = (m.params && typeof m.params === "object" ? m.params : {}) as Record<string, unknown>;
  switch (m.method) {
    case "initialize": {
      const pedida = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      const negociada = (VERSIONES_SOPORTADAS as readonly string[]).includes(pedida) ? pedida : VERSIONES_SOPORTADAS[0];
      return ok(m.id, {
        protocolVersion: negociada,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "jurmaq-barraca", title: "Tienda JURMAQ Barraca", version: "1.0.0" },
        instructions: "Administra la tienda en línea de JURMAQ Barraca. Empieza llamando a la herramienta guia. Los cambios riesgosos piden aprobación de Jorge por correo y todo cambio se puede deshacer desde el panel.",
      });
    }
    case "ping":
      return ok(m.id, {});
    case "tools/list": {
      const puedeEscribir = scopeIncluye(acceso.scope, SCOPE_ESCRIBIR);
      return ok(m.id, { tools: listarHerramientasMcp(deps.registro, puedeEscribir) });
    }
    case "tools/call":
      return llamarHerramienta(m.id, params, acceso, u.usuario, deps, base, ahora);
    case "resources/list":
      return ok(m.id, { resources: [] });
    case "resources/templates/list":
      return ok(m.id, { resourceTemplates: [] });
    case "prompts/list":
      return ok(m.id, { prompts: [] });
    default:
      return { status: 200, body: jsonrpcError(m.id, -32601, "Método no encontrado.") };
  }
}

const ok = (id: unknown, result: unknown): RespuestaMcp => ({ status: 200, body: { jsonrpc: "2.0", id, result } });
const limitado = (seg: number): RespuestaMcp => ({
  status: 429,
  headers: { "Retry-After": String(seg) },
  body: jsonrpcError(null, -32000, "Demasiadas llamadas seguidas. Espera un momento."),
});

function resultadoError(id: unknown, texto: string): RespuestaMcp {
  return ok(id, { isError: true, content: [{ type: "text", text: texto }] });
}

async function llamarHerramienta(
  id: unknown, params: Record<string, unknown>, acceso: AccesoValido, usuario: { id: string; email: string | null },
  deps: DepsServidor, base: string, ahora: number,
): Promise<RespuestaMcp> {
  const llamada = Llamada.safeParse(params);
  if (!llamada.success) return { status: 200, body: jsonrpcError(id, -32602, "Parámetros inválidos.") };
  const h = deps.registro.obtener(llamada.data.name);
  if (!h) return { status: 200, body: jsonrpcError(id, -32602, "Herramienta desconocida.") };

  if (esEscritura(h)) {
    if (!scopeIncluye(acceso.scope, SCOPE_ESCRIBIR)) {
      return {
        status: 403,
        headers: { "WWW-Authenticate": encabezadoNoAutenticado(base, { codigo: "insufficient_scope", descripcion: "Falta el permiso para cambiar datos.", scope: SCOPE_ESCRIBIR }) },
        body: { error: "insufficient_scope" },
      };
    }
    const l = await limitar(deps.db, `mcp-esc:${acceso.familiaId}`, LIMITE_ESCRITURAS_POR_MIN, MIN, ahora);
    if (!l.permitido) return limitado(l.reintentarEnSeg);
  }

  const args = esquemaEstricto(h).safeParse(llamada.data.arguments ?? {});
  if (!args.success) {
    const campos = [...new Set(args.error.issues.map((i) => i.path.join(".") || "(general)"))].slice(0, 8).join(", ");
    return resultadoError(id, `Los datos no son válidos. Revisa estos campos: ${campos}.`);
  }

  const loteId = nuevoLoteId();
  const ctx: ContextoHerramienta = {
    usuario, clienteId: acceso.clienteId, loteId, db: deps.db, ahora,
    async auditar(cambios) {
      await registrarLote(deps.db, loteId, usuario, cambios.map((c): CambioAuditado => ({ ...c, herramienta: c.herramienta ?? h.nombre })), ahora);
    },
    catalogo: deps.registro.lista()
      .filter((x) => scopeIncluye(acceso.scope, SCOPE_ESCRIBIR) || !esEscritura(x))
      .map((x) => ({ nombre: x.nombre, titulo: x.titulo, descripcion: x.descripcion, soloLectura: x.anotaciones.readOnlyHint })),
  };

  // Escrituras libres que Jorge pidió aprobar (mcp/escrituras-libres.ts): primero el OK, después se aplica una sola vez.
  let devolverOk: (() => Promise<boolean>) | null = null;
  if (herramientaPideOk(h.nombre)) {
    try {
      const solicitar = deps.solicitarAprobacion ?? ((db: D1Like, d: DatosSolicitud) => import("./aprobaciones-servidor.ts").then((m) => m.solicitarAprobacionReal(db, d)));
      const resumenArgs = JSON.parse(JSON.stringify(args.data, (_k, v) => (typeof v === "string" && v.length > 300 ? `${v.slice(0, 300)}… [${v.length} caracteres]` : v)));
      const r = await exigirAprobacion(deps.db, { solicitar }, {
        usuario, herramienta: h.nombre, motivos: ["escritura_libre"],
        resumen: `${h.titulo}: ${JSON.stringify(resumenArgs).slice(0, 400)}`,
        detalle: { argumentos: resumenArgs },
        huella: await huellaDeDatos({ v: 1, h: h.nombre, a: args.data }),
      }, ahora);
      if (r.tipo !== "aprobada") return ok(id, { content: [{ type: "text", text: r.mensaje }], structuredContent: { aplicado: false, estado: r.tipo } });
      if (!(await r.gastar())) return resultadoError(id, "La aprobación de Jorge ya se había usado. No se cambió nada; vuelve a pedirlo.");
      devolverOk = r.devolver;
    } catch (e) {
      if (esGestionNoDisponible(e)) return resultadoError(id, "La base de gestión todavía no está disponible. Avísale a Jorge.");
      console.error("[mcp-aprobacion-fallo]", { herramienta: h.nombre, tipo: e instanceof Error ? e.name : typeof e });
      return resultadoError(id, "No pude pedir la aprobación de Jorge. No se cambió nada.");
    }
  }

  let salida;
  try {
    salida = await h.ejecutar(args.data, ctx);
  } catch (e) {
    if (devolverOk) await devolverOk().catch(() => false);
    if (e instanceof ErrorHerramienta) return resultadoError(id, e.message);
    if (esGestionNoDisponible(e)) return resultadoError(id, "La base de gestión todavía no está disponible. Avísale a Jorge.");
    // Sin mensaje ni detalles: podrían traer datos personales o internos.
    console.error("[mcp-herramienta-fallo]", { herramienta: h.nombre, tipo: e instanceof Error ? e.name : typeof e });
    return resultadoError(id, "No pude completar la acción. No se confirmó ningún cambio; revisa el historial antes de repetir.");
  }
  const texto = typeof salida === "string" ? salida : salida.texto;
  const datos = typeof salida === "string" ? undefined : salida.datos;
  const resultado = { content: [{ type: "text", text: texto }], ...(datos ? { structuredContent: datos } : {}) };
  if (new TextEncoder().encode(JSON.stringify(resultado)).length > MAX_SALIDA_HERRAMIENTA_BYTES) {
    return resultadoError(id, "La respuesta es demasiado grande. Pide menos datos o filtra más.");
  }
  return ok(id, resultado);
}
