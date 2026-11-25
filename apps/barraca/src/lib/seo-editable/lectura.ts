import "server-only";
/**
 * Lectura de lo editable (metas, relacionados, guías) para páginas y rutas de la
 * tienda (servidor). Toma la D1 de gestión vía OpenNext y cae a lo que genera el
 * código ante cualquier falla. La lógica está en lector.ts (probada con D1
 * simulada, caída, lenta y vacía).
 *
 * Igual que el contenido editable: al compilar (`next build`) y en `next dev` NO
 * se toca D1 (OpenNext levantaría un miniflare por worker de generación); ahí
 * las páginas salen con lo que genera el código y ya en el Worker se regeneran
 * leyendo D1.
 */
import { obtenerGestionDb } from "../gestion/d1.ts";
import { GUIAS, type GuiaSEO } from "../guias-seo-data.ts";
import { fusionarGuias } from "./guias.ts";
import { crearLectorSeo } from "./lector.ts";
import { aplicarSeo, type MetaBase, type TipoSeo } from "./reglas.ts";

function sinLecturaDeD1(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build" || process.env.NODE_ENV === "development";
}

const lector = crearLectorSeo({
  obtenerDb: async () => (sinLecturaDeD1() ? null : obtenerGestionDb()),
  alFallar: (motivo) => console.warn(`[seo] D1 no respondió (${motivo}): se usan los textos del código.`),
});

/** Aplica el texto propio (si hay) sobre los metadatos que ya genera el código. Nunca lanza. */
export async function metaConSeo<T extends MetaBase>(tipo: TipoSeo, clave: string | null | undefined, meta: T): Promise<T> {
  if (!clave) return meta;
  try {
    return aplicarSeo(meta, await lector.leerSeo(tipo, clave));
  } catch {
    return meta;
  }
}

/** Códigos de los relacionados fijados a mano para este código de producto, o null (criterio automático). */
export async function leerRelacionadosManual(codigo: string | null | undefined): Promise<string[] | null> {
  if (!codigo) return null;
  try {
    return await lector.leerRelacionados(codigo);
  } catch {
    return null;
  }
}

/** Todas las guías vigentes: las de código con las publicadas encima. */
export async function leerGuiasEfectivas(): Promise<GuiaSEO[]> {
  try {
    return fusionarGuias(GUIAS, await lector.leerGuias());
  } catch {
    return GUIAS;
  }
}

export async function leerGuiaEfectiva(slug: string): Promise<GuiaSEO | undefined> {
  return (await leerGuiasEfectivas()).find((g) => g.slug === slug);
}

export function invalidarLecturaSeo(): void {
  lector.invalidar();
}
