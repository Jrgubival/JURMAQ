/**
 * Gestión de productos, precios, ofertas y despacho (lógica compartida de las
 * herramientas MCP). Documentación: docs/MCP-NOTAS.md, sección "Productos, precios, ofertas y despacho".
 *
 * Para otros ejecutores: el CENTRO DE REGLAS es `evaluarCambioPrecios` (reglas.ts) junto con
 * `exigirAprobacion` (aprobacion.ts). Toda herramienta que cambie precios o despacho debe pasar por ahí.
 */
export * from "./modelo.ts";
export * from "./reglas.ts";
export { exigirAprobacion, textoMotivos, type DepsAprobacionGestion, type ResultadoExigir } from "./aprobacion.ts";
export type { CtxGestion, DepsGestion } from "./deps.ts";
