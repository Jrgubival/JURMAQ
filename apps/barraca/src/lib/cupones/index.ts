/**
 * Cupones de la tienda (checkout, panel y MCP). Documentación: docs/MCP-NOTAS.md ("Cupones").
 * Se importa como "@/lib/cupones/index" (el archivo ../cupones.ts es el flujo antiguo de cotizaciones).
 */
export * from "./calculo.ts";
export * from "./reglas.ts";
export * from "./normalizar.ts";
export * from "./interruptor.ts";
export * from "./reservas.ts";
export * from "./servicio.ts";
export * from "./admin.ts";
export * from "./totales.ts";
export * from "./reportes.ts";
export { cuponPedidoPagado, cuponPedidoCerrado, cuponesActivosEnCheckout } from "./pedidos.ts";
