import "server-only";
/**
 * Dependencias reales de la gestión: Supabase (service role), aprobaciones por
 * correo y refresco de la tienda. Solo para código de servidor (herramientas
 * MCP y cron); las pruebas usan dependencias falsas con la misma forma.
 */
import { solicitarAprobacionReal } from "../mcp/aprobaciones-servidor.ts";
import type { DepsGestion } from "./deps.ts";
import { repoCategoriasSupabase, repoProductosSupabase, repoZonasSupabase } from "./repo-supabase.ts";

/** Hasta aquí se refrescan solo esas fichas; más allá es más barato marcar el catálogo completo. */
const MAX_FICHAS_PUNTUALES = 40;

let memo: DepsGestion | null = null;

export function depsReales(): DepsGestion {
  if (memo) return memo;
  memo = {
    productos: repoProductosSupabase,
    categorias: repoCategoriasSupabase,
    zonas: repoZonasSupabase,
    aprobacion: { solicitar: (db, datos) => solicitarAprobacionReal(db, datos) },
    async revalidar(ids) {
      try {
        const m = await import("../revalidar.ts");
        if (ids.length > MAX_FICHAS_PUNTUALES) m.revalidarCatalogo();
        else await m.revalidarFichas(ids);
      } catch {
        // Refrescar la tienda nunca debe romper un cambio ya guardado: las fichas se regeneran solas con el tiempo.
      }
    },
    async zonasCambiadas() {
      try {
        const m = await import("../despacho/tarifas-db.ts");
        m.invalidarCacheZonas();
      } catch {
        // La caché de tarifas dura 60 s.
      }
    },
  };
  return memo;
}
