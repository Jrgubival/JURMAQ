/**
 * SEO editable: título y descripción para Google por producto (código), categoría (slug) y página.
 * Lectura: ver_seo, auditar_seo. Escritura: editar_seo (hasta 5, directo) y previsualizar_seo / confirmar_seo
 * (masivo, dos pasos). Nunca tocan canonical, robots, slugs ni URL. Detalle: docs/MCP-NOTAS.md.
 */
import { defineHerramienta, z } from "./registro.ts";
import { aCtxSeo, ejecutarSeo, obtenerDepsSeo } from "./seo-comun.ts";
import { auditarSeo, confirmarSeo, editarSeo, previsualizarSeo, revertirSeo, verSeo, type ItemSeoEntrada } from "../../seo-editable/servicio.ts";
import { guiasVigentesResumen } from "../../seo-editable/servicio-guias.ts";
import { PAGINAS_SEO } from "../../seo-editable/reglas.ts";

const texto = z.string().max(400).nullable().optional();

const item = z.strictObject({
  tipo: z.enum(["producto", "categoria", "pagina"]).describe("producto (clave = CÓDIGO), categoria (clave = slug) o pagina."),
  clave: z.string().trim().min(1).max(80).describe(`Código, slug o id de página (${PAGINAS_SEO.join(", ")}).`),
  titulo: texto.describe("Ideal hasta 60; sin precios, reseñas ni plazos. null o vacío = automático; sin indicar = no tocar."),
  descripcion: texto.describe("Ideal hasta 160; mismas reglas."),
  og_titulo: texto.describe("Título al compartir en redes."),
  og_descripcion: texto.describe("Descripción al compartir en redes."),
  restablecer: z.boolean().optional().describe("true = vuelve al texto automático (sin textos)."),
});

const aEntradas = (items: Array<z.infer<typeof item>>): ItemSeoEntrada[] => items;

export const verSeoHerramienta = defineHerramienta({
  nombre: "ver_seo",
  titulo: "Ver título y descripción para Google",
  descripcion:
    "Muestra, de hasta 10 entradas, el título y la descripción que ve Google hoy (texto propio o el automático del código), lo que genera el código, un texto SUGERIDO que respeta los límites (60 y 160 caracteres, sin precios) y avisos de largo. Usa tipo 'producto' con el código, 'categoria' con el slug o 'pagina' con el id (portada, categorias, guias, calculadora_fierro, envios, nosotros, contacto, sucursales, terminos, privacidad). No cambia nada. En productos el texto del código incluye el precio de hoy; no cuenta promociones de categoría.",
  esquema: z.object({ entradas: z.array(z.strictObject({ tipo: z.enum(["producto", "categoria", "pagina"]), clave: z.string().trim().min(1).max(80) })).min(1).max(10) }),
  anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  ejecutar: async (args, ctx) => ejecutarSeo(async () => verSeo(ctx.db, await obtenerDepsSeo(), args.entradas)),
});

export const auditarSeoHerramienta = defineHerramienta({
  nombre: "auditar_seo",
  titulo: "Auditar el SEO de la tienda",
  descripcion:
    "Revisa por lote qué entradas no tienen título o descripción propios, o los tienen muy largos (más de 60 y 160) o vacíos, y con alcance 'repetidos' qué títulos se repiten. Alcance: 'producto' (lotes de fichas activas; avanza con 'pagina_lote'), 'categoria', 'pagina', 'guia' o 'repetidos'. Devuelve conteos y pocos ejemplos. No cambia nada.",
  esquema: z.object({
    alcance: z.enum(["producto", "categoria", "pagina", "guia", "repetidos"]).describe("Qué revisar."),
    pagina_lote: z.number().int().min(1).max(500).optional().describe("Número de lote (1 por defecto)."),
    por_lote: z.number().int().min(10).max(100).optional().describe("Tamaño del lote (50 por defecto)."),
  }),
  anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) =>
    ejecutarSeo(async () => {
      const deps = await obtenerDepsSeo();
      const guias = a.alcance === "guia" ? await guiasVigentesResumen(ctx.db) : [];
      return auditarSeo(ctx.db, deps, { alcance: a.alcance, pagina: a.pagina_lote ?? 1, porPagina: a.por_lote ?? 50 }, guias);
    }),
});

export const editarSeoHerramienta = defineHerramienta({
  nombre: "editar_seo",
  titulo: "Editar título y descripción para Google",
  descripcion:
    "Cambia título y/o descripción para Google (y opcional los de redes) de hasta 5 entradas: producto por código (todas sus fichas), categoría por slug o página por id. Texto plano: título ideal hasta 60 y descripción hasta 160 (pasarse poco avisa; mucho se rechaza), sin precios, reseñas ni plazos. Avisa si el título se repite. restablecer=true vuelve al texto automático. No toca canonical, robots ni URL. Es libre, salvo términos, privacidad o textos con un teléfono, correo o enlace a otro sitio: quedan PENDIENTES del OK de Jorge (repite la misma llamada). Más de 5: previsualizar_seo y confirmar_seo. Se puede deshacer.",
  esquema: z.object({ entradas: z.array(item).min(1).max(5) }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => editarSeo(await obtenerDepsSeo(), aCtxSeo(ctx), aEntradas(a.entradas))),
  revertidor: async ({ db, usuario, ahora, entradas }) => revertirSeo(await obtenerDepsSeo(), { db, usuario, ahora, entradas }),
});

export const previsualizarSeoHerramienta = defineHerramienta({
  nombre: "previsualizar_seo",
  titulo: "Previsualizar cambio masivo de SEO",
  descripcion:
    "PASO 1 de un cambio de SEO de hasta 200 entradas (mismas reglas que editar_seo): valida todo y NO cambia nada. Con un solo error no crea la vista previa y los lista. Devuelve cuántas cambian, ejemplos, avisos de largo y títulos repetidos, si necesita el OK de Jorge y un id de un solo uso. Aplica con confirmar_seo.",
  esquema: z.object({ entradas: z.array(item).min(1).max(200) }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => previsualizarSeo(await obtenerDepsSeo(), aCtxSeo(ctx), aEntradas(a.entradas))),
});

export const confirmarSeoHerramienta = defineHerramienta({
  nombre: "confirmar_seo",
  titulo: "Confirmar cambio masivo de SEO",
  descripcion:
    "PASO 2: aplica la vista previa de previsualizar_seo con su id (un solo uso, solo tuyo; se rechaza si alguien cambió esos textos). Si necesita el OK de Jorge queda PENDIENTE: repite la misma llamada con el mismo id cuando apruebe. Solo se refrescan las páginas afectadas. Se puede deshacer.",
  esquema: z.object({ vista_previa_id: z.string().trim().min(6).max(20).describe("El id que devolvió previsualizar_seo.") }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => confirmarSeo(await obtenerDepsSeo(), aCtxSeo(ctx), a)),
  revertidor: async ({ db, usuario, ahora, entradas }) => revertirSeo(await obtenerDepsSeo(), { db, usuario, ahora, entradas }),
});
