/**
 * Descuento por transferencia: ver (lectura) y cambiar en dos pasos. El cambio
 * SIEMPRE necesita la aprobación de Jorge, también deshacerlo.
 */
import {
  confirmarDescuentoTransferencia as confirmarSrv, previsualizarDescuentoTransferencia as previsualizarSrv,
  revertirDescuentoTransferencia, verDescuentoTransferencia as verSrv,
} from "../../gestion-precios/descuento-servicio.ts";
import { defineHerramienta, z } from "./registro.ts";
import { aCtxGestion, ejecutarServicio, obtenerDeps } from "./productos-comun.ts";

export const verDescuentoTransferencia = defineHerramienta({
  nombre: "ver_descuento_transferencia",
  titulo: "Ver el descuento por transferencia",
  descripcion:
    "Muestra el descuento por pagar con transferencia que se aplica hoy (por defecto 2 %), si es un valor configurado o el de respaldo del código, un ejemplo numérico con un carrito y dónde se muestra (checkout, cálculo del pedido, cupones, textos legales). No cambia nada. Úsala antes de proponer un cambio.",
  esquema: z.object({
    subtotal_ejemplo: z.number().int().min(1).max(10_000_000).optional().describe("Carrito de ejemplo en pesos enteros (por defecto $100.000)."),
  }),
  anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => verSrv(ctx.db, args)),
});

export const previsualizarDescuentoTransferencia = defineHerramienta({
  nombre: "previsualizar_descuento_transferencia",
  titulo: "Previsualizar cambio del descuento por transferencia",
  descripcion:
    "PASO 1 para cambiar el descuento por transferencia: NO cambia nada. Recibe el porcentaje nuevo (de 0 a 10, con un decimal como máximo; 0 lo apaga) y muestra un ejemplo con un carrito (hoy contra después) y qué textos cambian en la tienda. Si el valor deja de ser 2 %, advierte que los Términos y Condiciones (puntos 14.2 y 16.1) dicen «2%» y hay que actualizarlos aparte. Devuelve un id de vista previa de un solo uso (vale 5 horas). Para aplicar usa confirmar_descuento_transferencia.",
  esquema: z.object({
    pct: z.number().min(0).max(10).describe("Porcentaje nuevo, de 0 a 10 con un decimal como máximo (por ejemplo 2 o 2.5)."),
    subtotal_ejemplo: z.number().int().min(1).max(10_000_000).optional().describe("Carrito de ejemplo en pesos enteros (por defecto $100.000)."),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => previsualizarSrv(aCtxGestion(ctx), args)),
});

export const confirmarDescuentoTransferencia = defineHerramienta({
  nombre: "confirmar_descuento_transferencia",
  titulo: "Confirmar cambio del descuento por transferencia",
  descripcion:
    "PASO 2: aplica la vista previa de previsualizar_descuento_transferencia (el id sirve una sola vez, es solo tuyo y se rechaza si el descuento cambió desde que se calculó). TODO cambio de este descuento necesita la aprobación de Jorge: esta herramienta deja la solicitud (le llega un correo con el enlace) y NO cambia nada hasta que él apruebe; entonces repite la misma llamada con el mismo id y se aplica. Los pedidos ya creados no cambian. Queda registrado y se puede deshacer (deshacer también necesita la aprobación de Jorge). Recuerda avisar que los Términos y Condiciones dicen «2%».",
  esquema: z.object({ vista_previa_id: z.string().trim().min(6).max(20).describe("El id que devolvió previsualizar_descuento_transferencia.") }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => confirmarSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
  revertidor: async ({ db, usuario, ahora, entradas }) => revertirDescuentoTransferencia(await obtenerDeps(), { db, usuario, ahora }, entradas),
});

export const herramientasDescuentoTransferencia = [verDescuentoTransferencia, previsualizarDescuentoTransferencia, confirmarDescuentoTransferencia];
