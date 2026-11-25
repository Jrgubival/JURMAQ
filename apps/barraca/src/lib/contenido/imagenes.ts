/**
 * Servicio de imágenes del contenido: sube al bucket público `barraca-redes`
 * (carpeta tienda/) desde base64 o desde una URL https pública. Núcleo puro:
 * recibe como dependencias `subir`, `fetch` y `resolver`, así se prueba sin red.
 * La subida real (Supabase Storage) está en imagenes-supabase.ts.
 *
 * Seguridad:
 *   - Tipo REAL por magic bytes (jpeg, png, webp, gif). Nada de SVG ni del
 *     content-type que declare el origen. El nombre lo generamos nosotros.
 *   - Tope de tamaño (5 MB) en base64 y en la descarga (se corta al pasarse).
 *   - Descarga por URL con defensa SSRF: solo https al puerto 443, sin
 *     credenciales en la URL, sin IPs literales privadas, loopback, link-local
 *     ni metadata, sin nombres internos; los nombres se resuelven (DNS sobre
 *     HTTPS) y TODAS las direcciones deben ser públicas; redirecciones a mano
 *     (máx. 3) revalidando cada salto; tiempo máximo total.
 *   - Residual: Workers no permite fijar la IP de la conexión, así que un
 *     DNS rebinding "entre la comprobación y la conexión" lo frena la bandera
 *     global_fetch_strictly_public del Worker (wrangler.jsonc), que prohíbe a
 *     fetch() llegar a redes privadas.
 */

export const MAX_BYTES_IMAGEN = 5 * 1024 * 1024;
export const MAX_REDIRECCIONES = 3;
export const TIMEOUT_DESCARGA_MS = 8_000;
export const CARPETA_BUCKET = "tienda";

export type TipoImagen = "jpeg" | "png" | "webp" | "gif";
export interface InfoImagen {
  tipo: TipoImagen;
  mime: string;
  ext: string;
}

const INFO: Record<TipoImagen, InfoImagen> = {
  jpeg: { tipo: "jpeg", mime: "image/jpeg", ext: "jpg" },
  png: { tipo: "png", mime: "image/png", ext: "png" },
  webp: { tipo: "webp", mime: "image/webp", ext: "webp" },
  gif: { tipo: "gif", mime: "image/gif", ext: "gif" },
};

const ascii = (b: Uint8Array, desde: number, n: number) => String.fromCharCode(...Array.from(b.subarray(desde, desde + n)));

/** Tipo real por los primeros bytes. null = no es una imagen permitida. */
export function detectarTipoImagen(b: Uint8Array): InfoImagen | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return INFO.jpeg;
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return INFO.png;
  if (b.length >= 6 && (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a")) return INFO.gif;
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return INFO.webp;
  return null;
}

// ───────── IPs privadas ─────────

function parsearIpv4(ip: string): number[] | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  return p.every((n) => n >= 0 && n <= 255) ? p : null;
}

function ipv4Privada(p: number[]): boolean {
  const [a, b, c] = p;
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 || // "esta red", privada, loopback, multicast/reservada/broadcast
    (a === 100 && b >= 64 && b <= 127) || // CGNAT (incluye la metadata de Alibaba 100.100.100.200)
    (a === 169 && b === 254) || // link-local (metadata de AWS/GCP/Azure 169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    (a === 168 && b === 63 && c === 129) // metadata de Azure (WireServer)
  );
}

function parsearIpv6(ip: string): number[] | null {
  let t = ip.replace(/^\[|\]$/g, "").toLowerCase();
  const zona = t.indexOf("%");
  if (zona >= 0) t = t.slice(0, zona);
  if (!/^[0-9a-f:.]+$/.test(t)) return null;
  // Cola IPv4 ("::ffff:1.2.3.4") → dos hextetos.
  const v4 = t.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const p = parsearIpv4(v4[1]);
    if (!p) return null;
    t = t.slice(0, t.length - v4[1].length) + ((p[0] << 8) | p[1]).toString(16) + ":" + ((p[2] << 8) | p[3]).toString(16);
  }
  const partes = t.split("::");
  if (partes.length > 2) return null;
  const izq = partes[0] ? partes[0].split(":") : [];
  const der = partes.length === 2 && partes[1] ? partes[1].split(":") : [];
  let hex: string[];
  if (partes.length === 2) {
    const faltan = 8 - izq.length - der.length;
    if (faltan < 1) return null;
    hex = [...izq, ...Array(faltan).fill("0"), ...der];
  } else {
    hex = izq;
  }
  if (hex.length !== 8 || !hex.every((h) => /^[0-9a-f]{1,4}$/.test(h))) return null;
  return hex.map((h) => parseInt(h, 16));
}

function ipv6Privada(h: number[]): boolean {
  const v4 = (a: number, b: number) => [a >> 8, a & 255, b >> 8, b & 255];
  if (h.every((x) => x === 0)) return true; // ::
  if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return true; // ::1
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) return ipv4Privada(v4(h[6], h[7])); // ::ffff:a.b.c.d
  if (h.slice(0, 6).every((x) => x === 0)) return true; // ::a.b.c.d (compatible, en desuso)
  if (h[0] === 0x64 && h[1] === 0xff9b) return ipv4Privada(v4(h[6], h[7])); // NAT64
  if (h[0] === 0x2002) return ipv4Privada(v4(h[1], h[2])); // 6to4
  if ((h[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 (incluye fd00:ec2::254, metadata de AWS)
  if ((h[0] & 0xffc0) === 0xfe80) return true; // link-local
  if ((h[0] & 0xffc0) === 0xfec0) return true; // site-local
  if ((h[0] & 0xff00) === 0xff00) return true; // multicast
  if (h[0] === 0x2001 && h[1] === 0x0db8) return true; // documentación
  if (h[0] === 0x0100 && h[1] === 0 && h[2] === 0 && h[3] === 0) return true; // descarte
  return false;
}

/** ¿Es una IP (v4 o v6) que NO se debe contactar? Un texto que no es IP también devuelve true (fail-closed). */
export function esIpPrivada(ip: string): boolean {
  const t = ip.trim();
  const v4 = parsearIpv4(t);
  if (v4) return ipv4Privada(v4);
  const v6 = parsearIpv6(t);
  if (v6) return ipv6Privada(v6);
  return true;
}

function esIpLiteral(host: string): boolean {
  return parsearIpv4(host) !== null || host.startsWith("[") || host.includes(":");
}

const SUFIJOS_INTERNOS = [".localhost", ".local", ".internal", ".localdomain", ".home.arpa", ".lan", ".intranet", ".corp", ".private"];

export class ImagenError extends Error {
  readonly codigo: string;
  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.name = "ImagenError";
    this.codigo = codigo;
  }
}

export interface UrlRemotaValida {
  url: URL;
  host: string;
  /** El host es una IP escrita directamente (ya comprobada). */
  esIp: boolean;
}

/** Reglas de la URL, sin red. Lanza ImagenError. */
export function validarUrlRemota(texto: string): UrlRemotaValida {
  if (typeof texto !== "string" || texto.length > 2000 || /[\s\u0000-\u001F]/.test(texto)) throw new ImagenError("url_invalida", "La dirección de la imagen no es válida.");
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    throw new ImagenError("url_invalida", "La dirección de la imagen no es válida.");
  }
  if (u.protocol !== "https:") throw new ImagenError("solo_https", "Solo se aceptan direcciones https.");
  if (u.username || u.password) throw new ImagenError("credenciales", "La dirección no puede llevar usuario ni clave.");
  if (u.port && u.port !== "443") throw new ImagenError("puerto", "Solo se acepta el puerto 443.");
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) throw new ImagenError("url_invalida", "La dirección de la imagen no es válida.");
  if (esIpLiteral(host)) {
    if (esIpPrivada(host)) throw new ImagenError("ip_privada", "La dirección apunta a una red interna: no se permite.");
    return { url: u, host, esIp: true };
  }
  if (host === "localhost" || SUFIJOS_INTERNOS.some((s) => host.endsWith(s)) || !host.includes(".")) {
    throw new ImagenError("host_interno", "La dirección apunta a un nombre interno: no se permite.");
  }
  if (!/^[a-z0-9.-]+$/.test(host) && !/^xn--/.test(host)) {
    // Punycode ya viene normalizado por URL; cualquier otro símbolo se rechaza.
    throw new ImagenError("url_invalida", "La dirección de la imagen no es válida.");
  }
  return { url: u, host, esIp: false };
}

export type Resolver = (host: string) => Promise<string[]>;

/** Resuelve A y AAAA con DNS sobre HTTPS (Workers no tiene resolvedor propio). */
export const resolverDoH: Resolver = async (host) => {
  const ips: string[] = [];
  for (const tipo of ["A", "AAAA"]) {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${tipo}`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) throw new ImagenError("dns", "No se pudo comprobar la dirección de la imagen.");
    const j = (await r.json()) as { Answer?: { type: number; data: string }[] };
    for (const a of j.Answer ?? []) if ((a.type === 1 || a.type === 28) && typeof a.data === "string") ips.push(a.data);
  }
  return ips;
};

/** Comprueba que el nombre resuelva SOLO a IPs públicas. */
export async function comprobarHost(v: UrlRemotaValida, resolver: Resolver): Promise<void> {
  if (v.esIp) return;
  let ips: string[];
  try {
    ips = await resolver(v.host);
  } catch (e) {
    if (e instanceof ImagenError) throw e;
    throw new ImagenError("dns", "No se pudo comprobar la dirección de la imagen.");
  }
  if (ips.length === 0) throw new ImagenError("dns", "La dirección de la imagen no existe.");
  if (ips.some(esIpPrivada)) throw new ImagenError("ip_privada", "La dirección apunta a una red interna: no se permite.");
}

export interface DepsDescarga {
  fetch?: typeof fetch;
  resolver?: Resolver;
  maxBytes?: number;
  maxRedirecciones?: number;
  timeoutMs?: number;
}

async function leerConTope(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declarado = Number(res.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > maxBytes) throw new ImagenError("muy_grande", "La imagen pesa demasiado (máximo 5 MB).");
  if (!res.body) {
    const b = new Uint8Array(await res.arrayBuffer());
    if (b.length > maxBytes) throw new ImagenError("muy_grande", "La imagen pesa demasiado (máximo 5 MB).");
    return b;
  }
  const lector = res.body.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await lector.cancel().catch(() => {});
      throw new ImagenError("muy_grande", "La imagen pesa demasiado (máximo 5 MB).");
    }
    trozos.push(value);
  }
  const salida = new Uint8Array(total);
  let pos = 0;
  for (const t of trozos) {
    salida.set(t, pos);
    pos += t.length;
  }
  return salida;
}

/** Descarga una imagen de una URL https pública con todas las defensas. */
export async function descargarImagenRemota(texto: string, deps: DepsDescarga = {}): Promise<Uint8Array> {
  const hacerFetch = deps.fetch ?? fetch;
  const resolver = deps.resolver ?? resolverDoH;
  const maxBytes = deps.maxBytes ?? MAX_BYTES_IMAGEN;
  const maxRedir = deps.maxRedirecciones ?? MAX_REDIRECCIONES;
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), deps.timeoutMs ?? TIMEOUT_DESCARGA_MS);
  try {
    let actual = texto;
    for (let salto = 0; salto <= maxRedir; salto++) {
      const v = validarUrlRemota(actual);
      await comprobarHost(v, resolver);
      let res: Response;
      try {
        res = await hacerFetch(v.url.toString(), {
          method: "GET",
          redirect: "manual",
          credentials: "omit",
          headers: { accept: "image/jpeg,image/png,image/webp,image/gif", "user-agent": "jurmaq-barraca-imagenes/1" },
          signal: control.signal,
        });
      } catch (e) {
        if (e instanceof ImagenError) throw e;
        if (control.signal.aborted) throw new ImagenError("timeout", "La imagen tardó demasiado en descargarse.");
        throw new ImagenError("descarga", "No se pudo descargar la imagen.");
      }
      if (res.status >= 300 && res.status < 400) {
        const destino = res.headers.get("location");
        await res.body?.cancel().catch(() => {});
        if (!destino) throw new ImagenError("descarga", "No se pudo descargar la imagen.");
        if (salto === maxRedir) throw new ImagenError("demasiadas_redirecciones", "La dirección redirige demasiadas veces.");
        try {
          actual = new URL(destino, v.url).toString();
        } catch {
          throw new ImagenError("url_invalida", "La dirección de la imagen no es válida.");
        }
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        throw new ImagenError("descarga", "No se pudo descargar la imagen.");
      }
      try {
        return await leerConTope(res, maxBytes);
      } catch (e) {
        if (e instanceof ImagenError) throw e;
        if (control.signal.aborted) throw new ImagenError("timeout", "La imagen tardó demasiado en descargarse.");
        throw new ImagenError("descarga", "No se pudo descargar la imagen.");
      }
    }
    throw new ImagenError("demasiadas_redirecciones", "La dirección redirige demasiadas veces.");
  } finally {
    clearTimeout(timer);
  }
}

// ───────── Base64 ─────────

/** Decodifica base64 (con o sin prefijo data:...;base64,). El tipo declarado se ignora. */
export function decodificarBase64(entrada: string, maxBytes = MAX_BYTES_IMAGEN): Uint8Array {
  if (typeof entrada !== "string") throw new ImagenError("base64", "La imagen no viene en base64.");
  let t = entrada.trim();
  const prefijo = t.match(/^data:[a-z0-9.+/-]*;base64,/i);
  if (prefijo) t = t.slice(prefijo[0].length);
  t = t.replace(/\s+/g, "");
  if (!t || !/^[A-Za-z0-9+/]*={0,2}$/.test(t) || t.length % 4 === 1) throw new ImagenError("base64", "La imagen no viene en base64 válido.");
  // Se mide ANTES de decodificar.
  const estimado = Math.floor((t.length * 3) / 4) - (t.endsWith("==") ? 2 : t.endsWith("=") ? 1 : 0);
  if (estimado > maxBytes) throw new ImagenError("muy_grande", "La imagen pesa demasiado (máximo 5 MB).");
  const bin = atob(t);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

// ───────── Subida ─────────

export interface DepsSubida extends DepsDescarga {
  /** Sube los bytes a la ruta y devuelve la URL pública. */
  subir: (ruta: string, bytes: Uint8Array, mime: string) => Promise<string>;
  ahora?: () => Date;
  azar?: () => string;
}

export interface ImagenSubida {
  url: string;
  ruta: string;
  mime: string;
  bytes: number;
}

function azarHex(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Nombre generado por nosotros: tienda/AAAA-MM/<azar>.<ext>. Nunca viene del usuario. */
export function nombreDeArchivo(info: InfoImagen, fecha: Date, azar: () => string = azarHex): string {
  const mes = `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${CARPETA_BUCKET}/${mes}/${azar()}.${info.ext}`;
}

async function validarYSubir(bytes: Uint8Array, deps: DepsSubida): Promise<ImagenSubida> {
  const maxBytes = deps.maxBytes ?? MAX_BYTES_IMAGEN;
  if (bytes.length === 0) throw new ImagenError("vacia", "La imagen está vacía.");
  if (bytes.length > maxBytes) throw new ImagenError("muy_grande", "La imagen pesa demasiado (máximo 5 MB).");
  const info = detectarTipoImagen(bytes);
  if (!info) throw new ImagenError("tipo", "Solo se aceptan imágenes jpg, png, webp o gif (no SVG).");
  const ruta = nombreDeArchivo(info, (deps.ahora ?? (() => new Date()))(), deps.azar);
  const url = await deps.subir(ruta, bytes, info.mime);
  return { url, ruta, mime: info.mime, bytes: bytes.length };
}

export async function subirImagenDesdeBase64(base64: string, deps: DepsSubida): Promise<ImagenSubida> {
  return validarYSubir(decodificarBase64(base64, deps.maxBytes), deps);
}

export async function subirImagenDesdeUrl(url: string, deps: DepsSubida): Promise<ImagenSubida> {
  return validarYSubir(await descargarImagenRemota(url, deps), deps);
}
