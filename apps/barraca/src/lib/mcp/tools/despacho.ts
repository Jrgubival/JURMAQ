/**
 * Despacho: ver zonas y tarifas (lectura) y cambiarlas (SIEMPRE con aprobación de Jorge).
 */
import { verZonasDespacho as verSrv } from "../../gestion-precios/consultas.ts";
import { cambiarDespacho as cambiarSrv } from "../../gestion-precios/despacho-servicio.ts";
import { defineHerramienta, z } from "./registro.ts";
import { aCtxGestion, ejecutarServicio, obtenerDeps, revertidorGeneral } from "./productos-comun.ts";

export const verZonasDespacho = defineHerramienta({
  nombre: "ver_zonas_despacho",
  titulo: "Ver zonas y costos de despacho",
  descripcion: "Muestra las zonas de despacho con el costo que se cobra, el monto de productos desde el que el despacho sale gratis y si la zona está activa. Úsala antes de proponer cambios de despacho.",
  esquema: z.object({}),
  anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  ejecutar: async () => ejecutarServicio(async () => verSrv(await obtenerDeps())),
});

export const cambiarDespacho = defineHerramienta({
  nombre: "cambiar_despacho",
  titulo: "Cambiar despacho de una zona",
  descripcion:
    "Cambia el costo de despacho de una zona, el monto desde el que es gratis (null = nunca) o la activa o desactiva. SIEMPRE necesita el OK de Jorge: deja la solicitud (le llega un correo) y NO cambia nada hasta que apruebe; entonces repite la misma llamada. Pesos enteros. Se puede deshacer.",
  esquema: z.object({
    zona_id: z.string().trim().regex(/^[a-z][a-z-]{1,29}$/, "Id de zona no válido").describe("Id de la zona (ver_zonas_despacho)."),
    costo: z.number().optional().describe("Costo de despacho en pesos enteros (0 = sin costo)."),
    gratis_desde: z.number().nullable().optional().describe("Total de productos desde el que el despacho es gratis, en pesos enteros; null = nunca."),
    activo: z.boolean().optional().describe("Activar o desactivar el despacho a esa zona."),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => cambiarSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
  revertidor: revertidorGeneral,
});
