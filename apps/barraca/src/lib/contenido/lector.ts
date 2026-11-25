/**
 * Lector del contenido para la TIENDA. Regla de oro: nunca lanza y nunca
 * demora de más. Si D1 falla, no está, tarda más del tiempo máximo, está vacía
 * o tiene un valor que no valida, devuelve el respaldo en código (respaldo.ts),
 * que es exactamente lo que la tienda mostraba antes de esta pieza.
 *
 * - UNA consulta a D1 trae todo lo publicado (tabla `contenido`).
 * - Caché por isla (isolate) de Workers: `ttlMs` si fue bien; si falló, no se
 *   reintenta durante `reintentoMs` (una D1 caída no agrega latencia a cada
 *   página) y mientras tanto se sigue mostrando lo último bueno (o el respaldo).
 * - Fábrica con dependencias inyectadas para probarla con D1 caída/vacía.
 */
import type { D1Like } from "../gestion/tipos.ts";
import { validarContenido } from "./esquemas.ts";
import { leerPublicadosCrudos } from "./repositorio.ts";
import { respaldoDe } from "./respaldo.ts";
import { CLAVES_CONTENIDO, esClaveContenido, type ClaveContenido, type ValoresContenido } from "./tipos.ts";
import { desdeJson } from "../gestion/util.ts";

export interface OpcionesLector {
  /** La D1 de gestión o null si no hay. Puede lanzar: se atrapa. */
  obtenerDb: () => Promise<D1Like | null>;
  /** Máximo que se espera a D1 (ms). */
  timeoutMs?: number;
  /** Cuánto vale una lectura buena (ms). */
  ttlMs?: number;
  /** Tras un fallo, cuánto se espera antes de volver a intentar (ms). */
  reintentoMs?: number;
  ahora?: () => number;
  /** Aviso de fallos sin datos sensibles (logs). */
  alFallar?: (motivo: "sin_db" | "timeout" | "error") => void;
}

export interface Lector {
  /** Valor vigente de una clave: lo publicado o el respaldo. Nunca lanza. */
  leer<K extends ClaveContenido>(clave: K): Promise<ValoresContenido[K]>;
  /** Igual que leer, indicando de dónde salió. */
  leerConOrigen<K extends ClaveContenido>(clave: K): Promise<{ valor: ValoresContenido[K]; origen: "d1" | "codigo"; version: number | null }>;
  /** Olvida la caché (después de publicar, en la misma isla). */
  invalidar(): void;
}

type Publicados = Map<string, { valor: unknown; version: number | null }>;

const VACIO: Publicados = new Map();

export function crearLector(opciones: OpcionesLector): Lector {
  const timeoutMs = opciones.timeoutMs ?? 1200;
  const ttlMs = opciones.ttlMs ?? 30_000;
  const reintentoMs = opciones.reintentoMs ?? 15_000;
  const ahora = opciones.ahora ?? Date.now;

  let cache: { publicados: Publicados; hasta: number } | null = null;
  let ultimoBueno: Publicados | null = null;
  let enVuelo: Promise<Publicados> | null = null;

  async function consultar(): Promise<Publicados> {
    const db = await opciones.obtenerDb();
    if (!db) {
      opciones.alFallar?.("sin_db");
      return VACIO;
    }
    const filas = await leerPublicadosCrudos(db);
    const mapa: Publicados = new Map();
    for (const f of filas) {
      if (!esClaveContenido(f.clave)) continue;
      const v = validarContenido(f.clave, desdeJson(f.json));
      if (v.ok) mapa.set(f.clave, { valor: v.valor, version: f.version });
      // Si no valida: se ignora y esa clave usa el respaldo.
    }
    return mapa;
  }

  async function cargar(): Promise<Publicados> {
    const t = ahora();
    if (cache && t < cache.hasta) return cache.publicados;
    if (enVuelo) return enVuelo;
    enVuelo = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const limite = new Promise<never>((_, rechazar) => {
          timer = setTimeout(() => rechazar(new Error("timeout")), timeoutMs);
        });
        const publicados = await Promise.race([consultar(), limite]);
        // Sin db no es un fallo de D1: se cachea el vacío igual que un éxito.
        ultimoBueno = publicados;
        cache = { publicados, hasta: ahora() + ttlMs };
        return publicados;
      } catch (e) {
        opciones.alFallar?.(e instanceof Error && e.message === "timeout" ? "timeout" : "error");
        const respaldo = ultimoBueno ?? VACIO;
        cache = { publicados: respaldo, hasta: ahora() + reintentoMs };
        return respaldo;
      } finally {
        if (timer) clearTimeout(timer);
        enVuelo = null;
      }
    })();
    return enVuelo;
  }

  async function leerConOrigen<K extends ClaveContenido>(clave: K) {
    let publicados: Publicados = VACIO;
    try {
      publicados = await cargar();
    } catch {
      publicados = VACIO;
    }
    const p = publicados.get(clave);
    if (p) return { valor: p.valor as ValoresContenido[K], origen: "d1" as const, version: p.version };
    return { valor: respaldoDe(clave), origen: "codigo" as const, version: null };
  }

  return {
    leerConOrigen,
    async leer(clave) {
      return (await leerConOrigen(clave)).valor;
    },
    invalidar() {
      cache = null;
    },
  };
}

export { CLAVES_CONTENIDO };
