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
  descripcion: "Muestra los relacionados fijados a mano de un producto (en orden, con su estado: se muestra, sin stock o ya no existe) y qué mostraría hoy el criterio automático (misma categoría, con más stock). No cambia nada.",
  esquema: z.object({ codigo }),
  anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => verRelacionados(ctx.db, await obtenerDepsSeo(), a.codigo)),
});

export const fijarRelacionadosHerramienta = defineHerramienta({
  nombre: "fijar_relacionados",
  titulo: "Fijar productos relacionados de una ficha",
  descripcion: "Fija, en orden, hasta 8 productos relacionados (por código) para la ficha del producto dado, en todas sus fichas repetidas. Cada código debe existir, estar activo y no ser el mismo producto ni repetirse; avisa si alguno hoy no se puede comprar (la ficha lo oculta hasta que vuelva el stock). La ficha muestra los primeros 4 que se pueden comprar; si ninguno se puede, vuelve al criterio automático. Reemplaza la lista anterior. No cambia el diseño de la ficha. Se puede deshacer.",
  esquema: z.object({ codigo, relacionados: z.array(z.string().trim().min(1).max(40)).min(1).max(8).describe("Códigos de los productos relacionados, en el orden en que deben aparecer.") }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => fijarRelacionados(await obtenerDepsSeo(), aCtxSeo(ctx), a.codigo, a.relacionados)),
  revertidor,
});

export const quitarRelacionadosHerramienta = defineHerramienta({
  nombre: "quitar_relacionados",
  titulo: "Volver a los relacionados automáticos",
  descripcion: "Borra la lista de relacionados fijada a mano de un producto: la ficha vuelve al criterio automático (misma categoría, con más stock). Se puede deshacer.",
  esquema: z.object({ codigo }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => fijarRelacionados(await obtenerDepsSeo(), aCtxSeo(ctx), a.codigo, null)),
  revertidor,
});
