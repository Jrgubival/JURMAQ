/**
 * Precios masivos en dos pasos: previsualizar_precios (no cambia la tienda) y
 * confirmar_precios (aplica, o deja pendiente de la aprobación de Jorge).
 */
import { confirmarPrecios as confirmarSrv, previsualizarPrecios as previsualizarSrv } from "../../gestion-precios/precios-masivos.ts";
import { defineHerramienta, z } from "./registro.ts";
import { aCtxGestion, ejecutarServicio, obtenerDeps, revertidorGeneral } from "./productos-comun.ts";

const item = z.object({
  codigo: z.string().trim().min(1).max(40).optional().describe("Código (cambia todas sus fichas)."),
  id: z.number().int().positive().optional().describe("Id de ficha, si no hay código."),
  precio_local: z.number().optional().describe("Precio normal (tachado), pesos enteros."),
  precio_web: z.number().optional().describe("Precio web (se cobra), pesos enteros; no mayor al local."),
});

export const previsualizarPrecios = defineHerramienta({
  nombre: "previsualizar_precios",
  titulo: "Previsualizar cambio de precios",
  descripcion:
    "PASO 1 de un cambio masivo de precios: calcula y NO cambia nada. por='lista' (items con código o id y precio_local y/o precio_web exactos), por='porcentaje' (codigos + descuento_web_pct: el precio local actual queda como precio normal y el web = local menos ese %, al peso más cercano) o por='categoria' (categoria_id + descuento_web_pct, o reajuste_pct para subir o bajar local y web). Pesos enteros. Devuelve cuántos cambian, mayores subidas y bajadas, los bajo el costo o con menos de 15 % de utilidad, códigos no encontrados y un id de un solo uso. Aplica con confirmar_precios. Un cambio por código llega a todas sus fichas.",
  esquema: z.object({
    por: z.enum(["lista", "porcentaje", "categoria"]).describe("Cómo se piden los cambios."),
    items: z.array(item).max(500).optional().describe("Solo con por='lista'."),
    codigos: z.array(z.string().trim().min(1).max(40)).max(500).optional().describe("Solo con por='porcentaje'."),
    categoria_id: z.number().int().positive().optional().describe("Solo con por='categoria'."),
    incluir_subcategorias: z.boolean().optional().describe("Con categoria: incluir subcategorías (sí por defecto)."),
    descuento_web_pct: z.number().min(0.01).max(50).optional().describe("Precio web = local menos este % (2 decimales)."),
    reajuste_pct: z.number().min(-90).max(200).optional().describe("Con categoria: sube (+) o baja (-) local y web este %."),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => previsualizarSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
});

export const confirmarPrecios = defineHerramienta({
  nombre: "confirmar_precios",
  titulo: "Confirmar cambio de precios",
  descripcion:
    "PASO 2: aplica la vista previa de previsualizar_precios con su id (un solo uso, solo tuyo; se rechaza si los precios cambiaron). Si necesita el OK de Jorge (tema «aprobaciones» de guia) queda PENDIENTE: avísale y repite la misma llamada con el mismo id cuando apruebe. Se puede deshacer.",
  esquema: z.object({ vista_previa_id: z.string().trim().min(6).max(20).describe("El id que devolvió previsualizar_precios.") }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => confirmarSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
  revertidor: revertidorGeneral,
});
