/**
 * Guías de construcción editables (/guias y /guias/<slug>): borrador libre, publicación en dos pasos,
 * versiones y deshacer. Sin nada publicado, la tienda muestra la guía escrita en código.
 * El texto de cada sección es markdown seguro; no se cambia el diseño de la página.
 */
import { defineHerramienta, z, type ContextoRevertidor } from "./registro.ts";
import { aCtxSeo, ejecutarSeo, obtenerDepsSeo } from "./seo-comun.ts";
import {
  confirmarPublicacionGuia, descartarBorradorGuia, guardarBorradorGuia, listarGuias, previsualizarPublicacionGuia, restaurarVersionGuia, revertirGuias, verGuia,
} from "../../seo-editable/servicio-guias.ts";

const slug = z.string().trim().min(2).max(80).describe("Slug de la guía (minúsculas, números y guiones; es la parte final de la URL).");
const revertidor = async ({ db, usuario, ahora, entradas }: ContextoRevertidor) => revertirGuias(await obtenerDepsSeo(), { db, usuario, ahora, entradas });

export const listarGuiasHerramienta = defineHerramienta({
  nombre: "listar_guias",
  titulo: "Listar las guías de construcción",
  descripcion: "Lista las guías de /guias: las escritas en código, las publicadas desde acá y las nuevas con borrador, con su estado. No cambia nada.",
  esquema: z.object({}),
  anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  ejecutar: async (_a, ctx) => ejecutarSeo(async () => listarGuias(ctx.db)),
});

export const verGuiaHerramienta = defineHerramienta({
  nombre: "ver_guia",
  titulo: "Ver una guía de construcción",
  descripcion: "Muestra una guía completa en la forma editable (título, descripción para Google, h1, introducción, secciones en markdown, preguntas frecuentes, categoría relacionada, guías relacionadas), con sus versiones. Si hay borrador, muestra el borrador; si no, lo vigente (publicado o el de código). Se lee por partes de 12.000 caracteres. Es el punto de partida para editar: copia, cambia lo que haga falta y envíalo con guardar_borrador_guia. No cambia nada.",
  esquema: z.object({ slug, parte: z.number().int().min(1).max(50).optional().describe("Parte a leer (1 por defecto).") }),
  anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => verGuia(ctx.db, a.slug, a.parte ?? 1)),
});

const seccion = z.strictObject({ h2: z.string().max(200), md: z.string().max(9000).describe("Markdown seguro: párrafos, «- » listas, «1. » listas numeradas, **negrita**, ### subtítulo, enlaces https o internos. El HTML se descarta.") });
const guiaEsquema = z.strictObject({
  slug,
  titulo: z.string().max(300).describe("Título corto (ideal hasta 60; la página agrega «· Barraca JURMAQ»)."),
  descripcionMeta: z.string().max(600).describe("Descripción para Google (ideal hasta 160)."),
  h1: z.string().max(300),
  intro: z.string().max(4000).describe("Introducción en texto plano."),
  secciones: z.array(seccion).min(1).max(20),
  faq: z.array(z.strictObject({ q: z.string().max(400), a: z.string().max(3000) })).max(20),
  categoriaSlugRelacionada: z.string().trim().min(2).max(80).describe("Slug de una categoría activa donde se compra lo que explica la guía."),
  categoriaNombre: z.string().max(200),
  guiasRelacionadas: z.array(z.string().trim().min(2).max(80)).max(6).optional(),
});

export const guardarBorradorGuiaHerramienta = defineHerramienta({
  nombre: "guardar_borrador_guia",
  titulo: "Guardar el borrador de una guía",
  descripcion: "Guarda el borrador COMPLETO de una guía (reemplaza el borrador anterior). Con el slug de una guía existente edita esa; con un slug nuevo crea una guía nueva (la página y la URL /guias/<slug> funcionan igual, sin cambiar el diseño). Valida todo: texto plano sin HTML, markdown seguro, que la categoría exista y que las guías relacionadas existan. NO cambia la tienda: para publicar usa previsualizar_publicacion_guia y confirmar_publicacion_guia. No inventes datos ni reseñas. Se puede deshacer.",
  esquema: guiaEsquema,
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => guardarBorradorGuia(await obtenerDepsSeo(), aCtxSeo(ctx), a)),
  revertidor,
});

export const descartarBorradorGuiaHerramienta = defineHerramienta({
  nombre: "descartar_borrador_guia",
  titulo: "Descartar el borrador de una guía",
  descripcion: "Borra el borrador de una guía; lo publicado no cambia. Se puede deshacer.",
  esquema: z.object({ slug }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => descartarBorradorGuia(aCtxSeo(ctx), a.slug)),
  revertidor,
});

export const restaurarVersionGuiaHerramienta = defineHerramienta({
  nombre: "restaurar_version_guia",
  titulo: "Restaurar una versión anterior de una guía",
  descripcion: "Pone una versión publicada anterior (mira las versiones con ver_guia) como BORRADOR; no cambia la tienda hasta que se publique con previsualizar_publicacion_guia y confirmar_publicacion_guia. Reemplaza el borrador actual. El historial no se borra.",
  esquema: z.object({ slug, version: z.number().int().min(1).max(100_000) }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => restaurarVersionGuia(await obtenerDepsSeo(), aCtxSeo(ctx), a.slug, a.version)),
  // Audita como guardar_borrador_guia: usa su deshacer.
});

export const previsualizarPublicacionGuiaHerramienta = defineHerramienta({
  nombre: "previsualizar_publicacion_guia",
  titulo: "Previsualizar la publicación de una guía",
  descripcion: "PASO 1 de publicar una guía: compara el borrador con lo que se ve hoy (campos, secciones nuevas, quitadas o cambiadas, preguntas), avisa de títulos o descripciones largos, dice si necesita el OK de Jorge (si agrega un teléfono, un correo o un enlace a otro sitio) y da un id de un solo uso (15 minutos). No cambia la tienda. Para publicar usa confirmar_publicacion_guia.",
  esquema: z.object({ slug }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => previsualizarPublicacionGuia(await obtenerDepsSeo(), aCtxSeo(ctx), a.slug)),
});

export const confirmarPublicacionGuiaHerramienta = defineHerramienta({
  nombre: "confirmar_publicacion_guia",
  titulo: "Publicar una guía",
  descripcion: "PASO 2: publica el borrador de la guía con el id de previsualizar_publicacion_guia (un solo uso, solo tuyo; se rechaza si el borrador o lo publicado cambiaron). Crea una versión nueva y regenera /guias, la guía y el sitemap. Si agrega un teléfono, un correo o un enlace a otro sitio queda PENDIENTE del OK de Jorge: repite la misma llamada cuando apruebe. Se puede deshacer.",
  esquema: z.object({ vista_previa_id: z.string().trim().min(6).max(20).describe("El id que devolvió previsualizar_publicacion_guia.") }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => confirmarPublicacionGuia(await obtenerDepsSeo(), aCtxSeo(ctx), a)),
  revertidor,
});
