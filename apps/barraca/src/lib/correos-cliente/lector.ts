/**
 * Lector de las plantillas PUBLICADAS para el envío de correos. Regla de oro: nunca lanza y nunca
 * demora de más: si D1 falta, falla, tarda más de `timeoutMs`, está vacía o sin migrar, devuelve
 * "nada publicado" y el correo sale con el texto del código. Una consulta trae todo lo publicado;
 * caché corta por isla; tras un fallo no se reintenta por `reintentoMs`.
 */
import type { D1Like } from "../gestion/tipos.ts";
import { desdeJson } from "../gestion/util.ts";

export interface OpcionesLectorCorreos {
  obtenerDb: () => Promise<D1Like | null>;
  timeoutMs?: number;
  ttlMs?: number;
  reintentoMs?: number;
  ahora?: () => number;
  alFallar?: (motivo: "sin_db" | "timeout" | "error") => void;
}

type Publicadas = Map<string, unknown>;
const VACIO: Publicadas = new Map();

export interface LectorCorreos {
  /** Lo publicado de ese correo (objeto {campo: texto}) o null. Nunca lanza. */
  publicado(clave: string): Promise<unknown>;
  invalidar(): void;
}

export function crearLectorCorreos(opc: OpcionesLectorCorreos): LectorCorreos {
  const timeoutMs = opc.timeoutMs ?? 1200;
  const ttlMs = opc.ttlMs ?? 30_000;
  const reintentoMs = opc.reintentoMs ?? 15_000;
  const ahora = opc.ahora ?? Date.now;
  let cache: { datos: Publicadas; hasta: number } | null = null;
  let ultimoBueno: Publicadas | null = null;
  let enVuelo: Promise<Publicadas> | null = null;

  async function consultar(): Promise<Publicadas> {
    const db = await opc.obtenerDb();
    if (!db) {
      opc.alFallar?.("sin_db");
      return VACIO;
    }
    const r = await db.prepare("SELECT clave, publicado FROM correo_plantillas WHERE publicado IS NOT NULL").all<{ clave: string; publicado: string }>();
    const mapa: Publicadas = new Map();
    for (const f of r.results) mapa.set(f.clave, desdeJson(f.publicado));
    return mapa;
  }

  async function cargar(): Promise<Publicadas> {
    const t = ahora();
    if (cache && t < cache.hasta) return cache.datos;
    if (enVuelo) return enVuelo;
    enVuelo = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const limite = new Promise<never>((_, rechazar) => { timer = setTimeout(() => rechazar(new Error("timeout")), timeoutMs); });
        const datos = await Promise.race([consultar(), limite]);
        ultimoBueno = datos;
        cache = { datos, hasta: ahora() + ttlMs };
        return datos;
      } catch (e) {
        opc.alFallar?.(e instanceof Error && e.message === "timeout" ? "timeout" : "error");
        const respaldo = ultimoBueno ?? VACIO;
        cache = { datos: respaldo, hasta: ahora() + reintentoMs };
        return respaldo;
      } finally {
        if (timer) clearTimeout(timer);
        enVuelo = null;
      }
    })();
    return enVuelo;
  }

  return {
    async publicado(clave) {
      try {
        return (await cargar()).get(clave) ?? null;
      } catch {
        return null;
      }
    },
    invalidar() { cache = null; },
  };
}
