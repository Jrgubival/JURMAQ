/**
 * Lector de lo editable para la TIENDA (metas, relacionados, guías). Misma regla
 * de oro que el contenido: nunca lanza y nunca demora de más. Si D1 falla, no
 * está, tarda más del tiempo máximo, está vacía o el valor guardado no valida,
 * devuelve «nada» y la tienda muestra EXACTAMENTE lo que genera el código.
 *
 * - Una consulta por entrada, con caché corta por isla (isolate) de Workers.
 * - Tras un fallo no se reintenta por `reintentoMs`: una D1 caída no agrega
 *   latencia a cada página.
 * - Dependencias inyectadas para probarlo con D1 caída, lenta o vacía.
 */
import type { D1Like } from "../gestion/tipos.ts";
import { desdeJson } from "../gestion/util.ts";
import { validarGuia, type GuiaEditable } from "./guias.ts";
import { leerGuiasPublicadasCrudas, leerRelacionadosGuardados, leerSeoGuardado } from "./repositorio.ts";
import { hayTexto, validarSeo, type CamposSeo, type TipoSeo } from "./reglas.ts";

export interface OpcionesLectorSeo {
  /** La D1 de gestión o null si no hay. Puede lanzar: se atrapa. */
  obtenerDb: () => Promise<D1Like | null>;
  timeoutMs?: number;
  ttlMs?: number;
  reintentoMs?: number;
  ahora?: () => number;
  alFallar?: (motivo: "timeout" | "error") => void;
}

export interface LectorSeo {
  leerSeo(tipo: TipoSeo, clave: string): Promise<CamposSeo | null>;
  leerRelacionados(codigo: string): Promise<string[] | null>;
  leerGuias(): Promise<Map<string, GuiaEditable>>;
  invalidar(): void;
}

const MAX_ENTRADAS_CACHE = 500;

export function crearLectorSeo(opciones: OpcionesLectorSeo): LectorSeo {
  const timeoutMs = opciones.timeoutMs ?? 1200;
  const ttlMs = opciones.ttlMs ?? 30_000;
  const reintentoMs = opciones.reintentoMs ?? 15_000;
  const ahora = opciones.ahora ?? Date.now;

  const cache = new Map<string, { valor: unknown; hasta: number }>();
  let sinReintentarHasta = 0;

  /** Corre una consulta con tope de tiempo, caché y pausa tras un fallo. `vacio` es lo que se devuelve si no hay nada o falla. */
  async function consultar<T>(clave: string, vacio: T, fn: (db: D1Like) => Promise<T>): Promise<T> {
    const t = ahora();
    const guardado = cache.get(clave);
    if (guardado && t < guardado.hasta) return guardado.valor as T;
    if (t < sinReintentarHasta) return (guardado?.valor as T | undefined) ?? vacio;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // El tope de tiempo cubre también la obtención de la D1 (el binding puede tardar).
      const limite = new Promise<never>((_, rechazar) => {
        timer = setTimeout(() => rechazar(new Error("timeout")), timeoutMs);
      });
      const trabajo = (async (): Promise<{ hay: true; valor: T } | { hay: false }> => {
        const db = await opciones.obtenerDb();
        return db ? { hay: true, valor: await fn(db) } : { hay: false };
      })();
      const r = await Promise.race([trabajo, limite]);
      if (!r.hay) {
        guardar(clave, vacio, t + ttlMs);
        return vacio;
      }
      guardar(clave, r.valor, ahora() + ttlMs);
      return r.valor;
    } catch (e) {
      opciones.alFallar?.(e instanceof Error && e.message === "timeout" ? "timeout" : "error");
      sinReintentarHasta = ahora() + reintentoMs;
      return (guardado?.valor as T | undefined) ?? vacio;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function guardar(clave: string, valor: unknown, hasta: number) {
    if (cache.size >= MAX_ENTRADAS_CACHE) cache.clear();
    cache.set(clave, { valor, hasta });
  }

  return {
    leerSeo: (tipo, clave) =>
      consultar<CamposSeo | null>(`seo:${tipo}:${clave}`, null, async (db) => {
        const g = await leerSeoGuardado(db, tipo, clave);
        if (!g) return null;
        // Lo guardado se vuelve a validar al leer: si no valida (o solo trae advertencias), solo cuentan los textos válidos.
        const v = validarSeo({ titulo: g.titulo, descripcion: g.descripcion, ogTitulo: g.ogTitulo, ogDescripcion: g.ogDescripcion });
        if (!v.ok || !hayTexto(v.valor)) return null;
        return v.valor;
      }),
    leerRelacionados: (codigo) =>
      consultar<string[] | null>(`rel:${codigo}`, null, async (db) => {
        const r = await leerRelacionadosGuardados(db, codigo);
        return r && r.lista.length > 0 ? r.lista : null;
      }),
    leerGuias: () =>
      consultar<Map<string, GuiaEditable>>("guias", new Map(), async (db) => {
        const mapa = new Map<string, GuiaEditable>();
        for (const f of await leerGuiasPublicadasCrudas(db)) {
          const v = validarGuia(desdeJson(f.json));
          if (v.ok && v.valor.slug === f.slug) mapa.set(f.slug, v.valor);
          // Si no valida, esa guía usa la de código (o no existe, si era nueva).
        }
        return mapa;
      }),
    invalidar() {
      cache.clear();
      sinReintentarHasta = 0;
    },
  };
}
