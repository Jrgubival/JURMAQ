/**
 * Constantes de la conexión de Claude (MCP). Un solo lugar para cambiar
 * tiempos, scopes y las direcciones de retorno permitidas.
 */

export const MIN = 60_000;
export const HORA = 60 * MIN;
export const DIA = 24 * HORA;

/** Vida del código de autorización: muy corta y de un solo uso. */
export const TTL_CODIGO_MS = 60_000;
/** Acceso corto; el refresco lo renueva. */
export const TTL_ACCESO_MS = HORA;
/** Refresco: vida deslizante... */
export const TTL_REFRESCO_MS = 30 * DIA;
/** ...pero la conexión entera vence a los 90 días y hay que volver a autorizar. */
export const TTL_FAMILIA_MS = 90 * DIA;
/** Un acceso ya rotado sigue sirviendo unos segundos (peticiones en vuelo). */
export const GRACIA_ROTACION_MS = 60_000;
/** Vida de la pantalla de autorización firmada. */
export const TTL_SOLICITUD_MS = 10 * MIN;

export const SCOPE_LEER = "tienda:leer";
export const SCOPE_ESCRIBIR = "tienda:escribir";
/**
 * Permiso APARTE para dinero y borrado (confirmar transferencias, cancelar con devolución, archivar y borrar).
 * Nunca se da por defecto ni por pedir «todo»: solo si la persona lo marca en la pantalla de autorización.
 * Implica escribir y leer. Ver docs/MCP-NOTAS.md, «Parte B, base».
 */
export const SCOPE_DINERO = "tienda:dinero";
export const SCOPES_BASE = [SCOPE_LEER, SCOPE_ESCRIBIR] as const;
export const SCOPES_SOPORTADOS = [SCOPE_LEER, SCOPE_ESCRIBIR, SCOPE_DINERO] as const;

/** Callbacks oficiales de las apps de Claude (claude.com puede reemplazar a claude.ai). */
export const REDIRECTS_CLAUDE: readonly string[] = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
];

/** Orígenes que pueden mandar el encabezado Origin al endpoint MCP. */
export const ORIGENES_MCP_EXTRA: readonly string[] = ["https://claude.ai", "https://claude.com"];

export const MAX_BODY_MCP_BYTES = 128 * 1024;
export const MAX_BODY_OAUTH_BYTES = 16 * 1024;
export const MAX_SALIDA_HERRAMIENTA_BYTES = 400 * 1024;

/** Límites de uso (por ventana fija). */
export const LIMITE_MCP_POR_MIN = 120;
export const LIMITE_ESCRITURAS_POR_MIN = 30;
export const LIMITE_REGISTRO_POR_HORA = 20;
export const LIMITE_TOKEN_POR_MIN = 30;
/** Tope de clientes registrados sin haber emitido ningún token (anti llenado de la base). */
export const MAX_CLIENTES_SIN_USO = 500;
export const MAX_REDIRECTS_POR_CLIENTE = 5;

const BASE_POR_DEFECTO = "https://barraca.jurmaq.cl";

/** Origen canónico del sitio (sin barra final). Es el `issuer` y la base del `resource`. */
export function baseCanonica(): string {
  const v = (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_BARRACA_URL : "")?.trim();
  return (v && /^https?:\/\/[^/]+$/.test(v.replace(/\/+$/, "")) ? v.replace(/\/+$/, "") : BASE_POR_DEFECTO);
}

export const RUTA_MCP = "/api/mcp";
/** Pantalla de autorización: vive bajo /admin para reutilizar el login con código por correo. */
export const RUTA_AUTORIZAR = "/admin/conexiones/autorizar";

export function urlRecurso(base = baseCanonica()): string {
  return `${base}${RUTA_MCP}`;
}

/** Compara `resource` ignorando una barra final. */
export function mismoRecurso(a: string, b: string): boolean {
  return a.replace(/\/+$/, "") === b.replace(/\/+$/, "");
}

export function urlMetadataRecurso(base = baseCanonica()): string {
  return `${base}/.well-known/oauth-protected-resource${RUTA_MCP}`;
}

/** Desafío `WWW-Authenticate` que Claude necesita para iniciar el login. */
export function encabezadoNoAutenticado(base = baseCanonica(), error?: { codigo: string; descripcion?: string; scope?: string }): string {
  const partes = ["Bearer"];
  const params: string[] = [];
  if (error) {
    params.push(`error="${error.codigo}"`);
    // Un encabezado HTTP solo admite ASCII: con tildes llegaba como "vÃ¡lido" (se vio en producción). Se quitan las tildes.
    if (error.descripcion) params.push(`error_description="${error.descripcion.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?").replace(/"/g, "'")}"`);
  }
  params.push(`resource_metadata="${urlMetadataRecurso(base)}"`);
  params.push(`scope="${error?.scope ?? SCOPES_SOPORTADOS.join(" ")}"`);
  return `${partes[0]} ${params.join(", ")}`;
}

export function metadataRecursoProtegido(base = baseCanonica()) {
  return {
    resource: urlRecurso(base),
    authorization_servers: [base],
    scopes_supported: [...SCOPES_SOPORTADOS],
    bearer_methods_supported: ["header"],
    resource_name: "Tienda JURMAQ Barraca",
  };
}

export function metadataServidorAutorizacion(base = baseCanonica()) {
  return {
    issuer: base,
    authorization_endpoint: `${base}${RUTA_AUTORIZAR}`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    scopes_supported: [...SCOPES_SOPORTADOS, "offline_access"],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    authorization_response_iss_parameter_supported: true,
  };
}
