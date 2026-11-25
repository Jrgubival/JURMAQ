/**
 * Productos relacionados fijados a mano por código. Libres (no tocan precios ni textos legales), con
 * auditoría y deshacer. Sin lista fijada, la ficha usa el criterio automático de siempre.
 */
import { defineHerramienta, z, type ContextoRevertidor } from "./registro.ts";
import { aCtxSeo, ejecutarSeo, obtenerDepsSeo } from "./seo-comun.ts";
import { fijarRelacionados, revertirRelacionados, verRelacionados } from "../../seo-editable/relacionados.ts";

const codigo = z.string().trim().min(1).max(40).describe("Código del producto (se aplica a todas sus fichas repetidas).");
const revertidor = async ({ db, usuario, ahora, entradas }: ContextoRevertidor) => revertirRelacionados(await obtenerDepsSeo(), { db, usuario, ahora, entradas });

export const verRelacionadosHerramienta = defineHerramienta({
  nombre: "ver_relacionados",
  titulo: "Ver productos relacionados de una ficha",
  descripcion:
    "Muestra los relacionados fijados de un producto (en orden, con su estado) y qué mostraría hoy el criterio automático (misma categoría, con más stock). No cambia nada.",
  esquema: z.object({ codigo }),
  anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => verRelacionados(ctx.db, await obtenerDepsSeo(), a.codigo)),
});

export const fijarRelacionadosHerramienta = defineHerramienta({
  nombre: "fijar_relacionados",
  titulo: "Fijar productos relacionados de una ficha",
  descripcion:
    "Fija en orden hasta 8 productos relacionados (por código) para un producto, en todas sus fichas. Cada código debe existir, estar activo y no repetirse; avisa si alguno no se puede comprar hoy (la ficha lo oculta hasta que haya stock). La ficha muestra los primeros 4 comprables; si ninguno, vuelve al criterio automático. Reemplaza la lista anterior. Se puede deshacer.",
  esquema: z.object({ codigo, relacionados: z.array(z.string().trim().min(1).max(40)).min(1).max(8).describe("Códigos de los productos relacionados, en el orden en que deben aparecer.") }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => fijarRelacionados(await obtenerDepsSeo(), aCtxSeo(ctx), a.codigo, a.relacionados)),
  revertidor,
});

export const quitarRelacionadosHerramienta = defineHerramienta({
  nombre: "quitar_relacionados",
  titulo: "Volver a los relacionados automáticos",
  descripcion:
    "Borra los relacionados fijados de un producto: la ficha vuelve al criterio automático. Se puede deshacer.",
  esquema: z.object({ codigo }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => fijarRelacionados(await obtenerDepsSeo(), aCtxSeo(ctx), a.codigo, null)),
  revertidor,
});
