import { GestionEntradaError } from "./tipos.ts";

/** Alfabeto sin 0/O/1/I/L para que el id corto se pueda dictar o copiar sin errores. */
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Tope de JSON guardado por fila (D1 admite 2 MB por fila; dejamos holgura). */
export const MAX_JSON_BYTES = 256 * 1024;

/** Id corto aleatorio (CSPRNG de WebCrypto). 12 caracteres ≈ 59 bits. */
export function idCorto(largo = 12): string {
  const bytes = new Uint8Array(largo);
  crypto.getRandomValues(bytes);
  let s = "";
  // 256 no es múltiplo de 31: se descartan los bytes que sesgarían el reparto.
  const limite = 256 - (256 % ALFABETO.length);
  for (let i = 0; i < largo; i++) {
    let b = bytes[i];
    while (b >= limite) b = crypto.getRandomValues(new Uint8Array(1))[0];
    s += ALFABETO[b % ALFABETO.length];
  }
  return s;
}

export function idUuid(): string {
  return crypto.randomUUID();
}

/** SHA-256 en hexadecimal (WebCrypto). */
export async function sha256Hex(texto: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** JSON con claves ordenadas: el mismo dato siempre da el mismo texto (para huellas). */
export function jsonEstable(valor: unknown): string {
  return JSON.stringify(ordenar(valor));
}

function ordenar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenar);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, ordenar(o[k])]));
  }
  return v === undefined ? null : v;
}

/** Huella (SHA-256) de cualquier dato serializable. Úsala para `huella` de las vistas previas. */
export async function huellaDeDatos(valor: unknown): Promise<string> {
  return sha256Hex(jsonEstable(valor));
}

/** Serializa para guardar en una columna JSON. null/undefined → null. */
export function aJson(valor: unknown, campo: string): string | null {
  if (valor === undefined || valor === null) return null;
  const texto = JSON.stringify(valor);
  if (texto === undefined || new TextEncoder().encode(texto).length > MAX_JSON_BYTES) {
    throw new GestionEntradaError(`El dato de "${campo}" es demasiado grande o no se puede guardar.`);
  }
  return texto;
}

export function desdeJson<T = unknown>(texto: string | null | undefined): T | null {
  if (texto === null || texto === undefined) return null;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null;
  }
}
