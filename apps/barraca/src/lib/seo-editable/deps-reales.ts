import "server-only";
/**
 * Dependencias reales del SEO editable, los relacionados y las guías: las de la gestión (Supabase con service
 * role, aprobaciones por correo) más refrescar rutas de la tienda y leer los datos del local. Solo para
 * código de servidor (herramientas MCP); las pruebas usan dependencias falsas con la misma forma.
 */
import { depsReales } from "../gestion-precios/deps-reales.ts";
import { leerLocalSeguro } from "../contenido/local-seguro.ts";
import { localParaMeta } from "./defecto.ts";
import type { DepsSeo } from "./deps.ts";
import { invalidarLecturaSeo } from "./lectura.ts";

let memo: DepsSeo | null = null;

export function depsSeoReales(): DepsSeo {
  if (memo) return memo;
  memo = {
    ...depsReales(),
    async revalidarRutas(rutas) {
      try {
        invalidarLecturaSeo();
        const { revalidatePath } = await import("next/cache");
        for (const r of new Set(rutas)) revalidatePath(r);
      } catch {
        // Refrescar la tienda nunca debe romper un cambio ya guardado: las páginas se regeneran solas con el tiempo.
      }
    },
    async local() {
      return localParaMeta(await leerLocalSeguro());
    },
  };
  return memo;
}
