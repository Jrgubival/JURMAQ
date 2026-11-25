/**
 * Base de gestión (D1 GESTION_DB): auditoría y vistas previas compartidas por
 * las herramientas del MCP y el panel. Documentación: docs/MCP-NOTAS.md.
 */
export * from "./tipos.ts";
export { obtenerGestionDb, requerirGestionDb, usarGestion } from "./d1.ts";
export * from "./auditoria.ts";
export * from "./vistas-previas.ts";
export { huellaDeDatos, sha256Hex, jsonEstable, idCorto } from "./util.ts";
