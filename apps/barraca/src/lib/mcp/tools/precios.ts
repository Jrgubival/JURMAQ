/**
 * Precios masivos en dos pasos: previsualizar_precios (no cambia la tienda) y
 * confirmar_precios (aplica, o deja pendiente de la aprobación de Jorge).
 */
import { confirmarPrecios as confirmarSrv, previsualizarPrecios as previsualizarSrv } from "../../gestion-precios/precios-masivos.ts";
import { defineHerramienta, z } from "./registro.ts";
import { aCtxGestion, ejecutarServicio, obtenerDeps, revertidorGeneral } from "./productos-comun.ts";

const item = z.object({
  codigo: z.string().trim().min(1).max(40).optional().describe("Código del producto (cambia todas sus fichas)."),
  id: z.number().int().positive().optional().describe("Id de una ficha, si no tienes el código."),
  precio_local: z.number().optional().describe("Precio normal del local (se muestra tachado). Pesos enteros mayores a 0."),
  precio_web: z.number().optional().describe("Precio web, lo que se cobra. Pesos enteros mayores a 0; no puede superar al local."),
});

export const previsualizarPrecios = defineHerramienta({
  nombre: "previsualizar_precios",
  titulo: "Previsualizar cambio de precios",
  descripcion:
    "PASO 1 de un cambio masivo de precios: calcula qué pasaría y NO cambia la tienda. Tres formas: por='lista' (items con código o id y precio_local y/o precio_web exactos), por='porcentaje' (codigos y descuento_web_pct: el precio normal queda como el precio local actual y el precio web = precio local menos ese % , redondeado al peso más cercano; la mitad sube; por ejemplo 5 % deja local $1.990 en web $1.891) o por='categoria' (categoria_id con descuento_web_pct igual que arriba, o con reajuste_pct para subir o bajar local y web ese %). Los precios son pesos enteros mayores a 0. Devuelve cuántos productos cambian, mayores subidas y bajadas, los que quedarían bajo el costo o con menos de 15 % sobre el costo, códigos no encontrados, la fórmula y un id de vista previa de un solo uso (vale 15 minutos, 5 horas si necesita aprobación). Para aplicar usa confirmar_precios con ese id. Un cambio por código llega a todas las fichas de ese código.",
  esquema: z.object({
    por: z.enum(["lista", "porcentaje", "categoria"]).describe("Cómo se piden los cambios."),
    items: z.array(item).max(500).optional().describe("Solo con por='lista'."),
    codigos: z.array(z.string().trim().min(1).max(40)).max(500).optional().describe("Solo con por='porcentaje'."),
    categoria_id: z.number().int().positive().optional().describe("Solo con por='categoria'."),
    incluir_subcategorias: z.boolean().optional().describe("Con por='categoria': incluir subcategorías. Por defecto sí."),
    descuento_web_pct: z.number().min(0.01).max(50).optional().describe("Precio web = precio local menos este %. Hasta 2 decimales."),
    reajuste_pct: z.number().min(-90).max(200).optional().describe("Solo con por='categoria': sube (positivo) o baja (negativo) este % el precio local y el web."),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => previsualizarSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
});

export const confirmarPrecios = defineHerramienta({
  nombre: "confirmar_precios",
  titulo: "Confirmar cambio de precios",
  descripcion:
    "PASO 2: aplica la vista previa de previsualizar_precios (el id sirve una sola vez, es solo tuyo y se rechaza si los precios cambiaron desde que se calculó). Si el cambio deja precios bajo el costo o con menos de 15 % sobre el costo, mueve más de 300 productos o algún precio más de 30 % (se suma lo hecho en 24 horas, aunque lo partas en trozos), queda PENDIENTE de la aprobación de Jorge: avísale que revise su correo y repite confirmar_precios con el mismo id cuando apruebe. Cuando se aplica, queda registrado y se puede deshacer desde el panel.",
  esquema: z.object({ vista_previa_id: z.string().trim().min(6).max(20).describe("El id que devolvió previsualizar_precios.") }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => confirmarSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
  revertidor: revertidorGeneral,
});
