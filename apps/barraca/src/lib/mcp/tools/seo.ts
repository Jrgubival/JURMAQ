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
  tipo: z.enum(["producto", "categoria", "pagina"]).describe("producto (la clave es el CÓDIGO: se aplica a todas sus fichas), categoria (la clave es el slug) o pagina."),
  clave: z.string().trim().min(1).max(80).describe(`Código del producto, slug de la categoría o id de la página (${PAGINAS_SEO.join(", ")}).`),
  titulo: texto.describe("Título para Google (ideal hasta 60 caracteres). Texto plano, sin precios, reseñas ni plazos. null o vacío = volver al automático en ese campo; sin indicar = no tocar."),
  descripcion: texto.describe("Descripción para Google (ideal hasta 160 caracteres). Mismas reglas."),
  og_titulo: texto.describe("Título al compartir en redes (opcional)."),
  og_descripcion: texto.describe("Descripción al compartir en redes (opcional)."),
  restablecer: z.boolean().optional().describe("true = borra el texto propio y vuelve al que genera el código. No se combina con textos."),
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
    "Revisa por lote (paginado) qué entradas no tienen título o descripción propios, cuáles tienen título de más de 60 caracteres o descripción de más de 160 o vacía, y (con alcance 'repetidos') qué títulos propios se repiten. Alcance: 'producto' (lotes de fichas activas, los códigos repetidos cuentan una vez; usa 'pagina_lote' para avanzar), 'categoria', 'pagina', 'guia' o 'repetidos'. Devuelve conteos y pocos ejemplos, nunca la lista completa. No cambia nada.",
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
    "Cambia el título y/o la descripción para Google (y opcionalmente los de redes) de hasta 5 entradas: producto por código (todas sus fichas), categoría por slug o página por id. Texto plano; título ideal hasta 60 caracteres y descripción hasta 160 (pasarse poco es solo un aviso, mucho se rechaza); sin precios, reseñas ni plazos de entrega. Avisa si el título se repite con otra entrada. Con restablecer=true vuelve al texto automático. No toca canonical, robots, slugs ni URL. Es libre, salvo términos y privacidad, o textos que agreguen un teléfono, un correo o un enlace a otro sitio: eso queda PENDIENTE del OK de Jorge (repite la misma llamada cuando apruebe). Para más de 5 entradas usa previsualizar_seo y confirmar_seo. Se puede deshacer.",
  esquema: z.object({ entradas: z.array(item).min(1).max(5) }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => editarSeo(await obtenerDepsSeo(), aCtxSeo(ctx), aEntradas(a.entradas))),
  revertidor: async ({ db, usuario, ahora, entradas }) => revertirSeo(await obtenerDepsSeo(), { db, usuario, ahora, entradas }),
});

export const previsualizarSeoHerramienta = defineHerramienta({
  nombre: "previsualizar_seo",
  titulo: "Previsualizar cambio masivo de SEO",
  descripcion:
    "PASO 1 de un cambio de SEO de hasta 200 entradas (mismas entradas y reglas que editar_seo): valida todo y NO cambia la tienda. Si hay un solo error en una entrada no crea la vista previa y los lista. Devuelve cuántas cambian, ejemplos, avisos de largo y de títulos repetidos, si necesita el OK de Jorge, y un id de un solo uso (15 minutos; 5 horas si necesita aprobación). Para aplicar usa confirmar_seo con ese id.",
  esquema: z.object({ entradas: z.array(item).min(1).max(200) }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => previsualizarSeo(await obtenerDepsSeo(), aCtxSeo(ctx), aEntradas(a.entradas))),
});

export const confirmarSeoHerramienta = defineHerramienta({
  nombre: "confirmar_seo",
  titulo: "Confirmar cambio masivo de SEO",
  descripcion:
    "PASO 2: aplica la vista previa de previsualizar_seo (el id sirve una sola vez, es solo tuyo y se rechaza si alguien cambió esos textos desde que se calculó). Si incluye términos o privacidad, o agrega un teléfono, un correo o un enlace a otro sitio, queda PENDIENTE del OK de Jorge: repite confirmar_seo con el mismo id cuando apruebe. Se refrescan solo las fichas, categorías o páginas afectadas. Se puede deshacer desde el historial.",
  esquema: z.object({ vista_previa_id: z.string().trim().min(6).max(20).describe("El id que devolvió previsualizar_seo.") }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  ejecutar: async (a, ctx) => ejecutarSeo(async () => confirmarSeo(await obtenerDepsSeo(), aCtxSeo(ctx), a)),
  revertidor: async ({ db, usuario, ahora, entradas }) => revertirSeo(await obtenerDepsSeo(), { db, usuario, ahora, entradas }),
});
