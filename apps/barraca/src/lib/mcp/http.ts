/**
 * Utilidades HTTP de las rutas del MCP: lectura de cuerpo con tope, huella de
 * IP, respuestas JSON sin caché y páginas HTML con encabezados anti-clickjacking.
 * Solo usa la API web estándar (Request/Response): corre igual en Workers.
 */
import { sha256Hex } from "./cripto.ts";

/** Lee el cuerpo como texto sin pasarse de `max` bytes. null = demasiado grande. */
export async function leerTextoLimitado(req: Request, max: number): Promise<string | null> {
  const declarado = Number(req.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > max) return null;
  if (!req.body) return "";
  const lector = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lector.cancel().catch(() => {});
      return null;
    }
    partes.push(value);
  }
  const unido = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) { unido.set(p, pos); pos += p.byteLength; }
  return new TextDecoder().decode(unido);
}

/** IP del cliente tal como la ve Cloudflare, ya hasheada (nunca se guarda en claro). */
export async function huellaIp(req: Request): Promise<string> {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
  return (await sha256Hex(`mcp-ip:${ip}`)).slice(0, 32);
}

const SIN_CACHE = { "Cache-Control": "no-store", Pragma: "no-cache" } as const;

export function respuestaJson(cuerpo: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...SIN_CACHE, "X-Content-Type-Options": "nosniff", ...extra },
  });
}

export function respuestaOauthError(error: string, descripcion: string, status = 400, extra: Record<string, string> = {}): Response {
  return respuestaJson({ error, error_description: descripcion }, status, extra);
}

export function escapar(texto: unknown): string {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

const CSS = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#f3f4f6;color:#1f2933;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.marca{background:#081428;padding:18px 20px;text-align:center}
.marca b{color:#fff;font-size:21px;letter-spacing:.06em}
.marca span{display:block;margin:6px auto 0;width:60px;height:3px;background:#c90319}
main{max-width:560px;margin:0 auto;padding:20px 16px 40px}
.tarjeta{background:#fff;border-radius:14px;padding:24px 20px;box-shadow:0 1px 3px rgba(8,20,40,.12)}
h1{margin:0 0 6px;font-size:22px;color:#081428}
h2{margin:22px 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:.05em;color:#4a4945}
p{margin:8px 0}
ul{margin:6px 0;padding-left:20px}
li{margin:4px 0}
.si li::marker{color:#15803d}
.no li::marker{color:#c90319}
.dato{background:#f3f4f6;border-radius:10px;padding:10px 12px;margin:10px 0;word-break:break-word}
.aviso{background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:10px 12px;margin:12px 0;font-size:15px}
.error{background:#fef2f3;border:1px solid #c90319;border-radius:10px;padding:10px 12px;margin:12px 0}
.dinero{background:#fef2f3;border:3px solid #c90319;border-radius:12px;padding:6px 14px 14px;margin:18px 0}
.dinero h2{color:#c90319;margin-top:12px}
.casilla{display:flex;gap:12px;align-items:flex-start;background:#fff;border:2px solid #c90319;border-radius:10px;padding:12px;margin-top:12px;font-weight:600;cursor:pointer}
.casilla input{width:26px;height:26px;flex:0 0 26px;margin:0;accent-color:#c90319}
.botones{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}
button,.boton{flex:1 1 180px;min-height:52px;border:0;border-radius:10px;font:600 17px/1 inherit;cursor:pointer;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;padding:0 18px}
.primario{background:#081428;color:#fff}
.secundario{background:#fff;color:#081428;border:2px solid #081428}
.peligro{background:#fff;color:#c90319;border:2px solid #c90319}
button:focus-visible,a:focus-visible{outline:3px solid #c90319;outline-offset:2px}
small{color:#6b7280}
pre{white-space:pre-wrap;word-break:break-word;margin:0;font:14px/1.45 ui-monospace,Menlo,monospace}
`;

export function paginaHtml(opciones: { titulo: string; cuerpo: string; cabeza?: string }): string {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="same-origin">
<title>${escapar(opciones.titulo)}</title>${opciones.cabeza ?? ""}<style>${CSS}</style></head>
<body><div class="marca"><b>JURMAQ</b><span></span></div><main>${opciones.cuerpo}</main></body></html>`;
}

/** Encabezados de una pantalla con botones: sin caché, sin marcos, Referer solo hacia nuestro origen, sin indexar. */
export function respuestaHtml(html: string, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...SIN_CACHE,
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      // same-origin (NO no-referrer): con no-referrer el navegador manda "Origin: null" en el POST del
      // formulario y mismoOrigen lo rechaza ("La solicitud no vino de esta página"). Fuera de nuestro
      // origen no se manda nada, así que los enlaces con token no se filtran a terceros.
      "Referrer-Policy": "same-origin",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
}

export function paginaError(titulo: string, mensaje: string, status = 400): Response {
  return respuestaHtml(
    paginaHtml({ titulo, cuerpo: `<div class="tarjeta"><h1>${escapar(titulo)}</h1><div class="error">${escapar(mensaje)}</div><p><small>Puedes cerrar esta ventana.</small></p></div>` }),
    status,
  );
}

/** ¿La petición viene de nuestro propio sitio? (anti CSRF junto con el paquete firmado). */
export function mismoOrigen(req: Request, base: string): boolean {
  const origen = req.headers.get("origin");
  // Solo el origen canónico (https://barraca.jurmaq.cl): nunca otro host por el que haya llegado la petición (p. ej. workers.dev).
  const canonico = new URL(base).origin;
  if (origen) return origen === canonico;
  const sitio = req.headers.get("sec-fetch-site");
  return sitio === "same-origin" && new URL(req.url).origin === canonico;
}

export function secretoFirma(): string | null {
  const s = (typeof process !== "undefined" ? process.env.AUTH_SECRET : "")?.trim();
  return s && s.length >= 16 ? s : null;
}
