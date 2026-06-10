/**
 * Fuente de verdad sobre quién opera cada tipo de máquina (valores de la
 * columna `tipo` en la tabla `maquinarias`).
 *
 * Módulo liviano y client-safe: NO importar acá el dataset SEO completo —
 * lo consumen componentes "use client" (wizard de cotización) y templates
 * de email, donde el bundle importa.
 *
 * `TIPOS_MAQUINA[].operadorIncluido` (./index.ts) debe mantenerse consistente
 * con estos sets.
 */

/** Tarifa publicada incluye operador/conductor de JURMAQ. */
export const TIPOS_DB_CON_OPERADOR: ReadonlySet<string> = new Set([
  "retroexcavadora",
  "miniexcavadora",
  "minicargador",
  "camion",
]);

/**
 * Se entregan listas para operar; las opera el personal del cliente (con
 * curso de operación vigente). rodillo/placa_compactadora quedan fuera a
 * propósito: sobre esos tipos no afirmamos nada de operador.
 */
export const TIPOS_DB_OPERA_CLIENTE: ReadonlySet<string> = new Set([
  "brazo_articulado",
  "plataforma_elevadora",
  "alzahombre",
]);

/** true si la tarifa publicada para este tipo incluye operador/conductor. */
export function tieneOperadorIncluido(tipoDb: string | null | undefined): boolean {
  return !!tipoDb && TIPOS_DB_CON_OPERADOR.has(tipoDb);
}

/** true si el equipo lo opera el personal del cliente. */
export function operaElCliente(tipoDb: string | null | undefined): boolean {
  return !!tipoDb && TIPOS_DB_OPERA_CLIENTE.has(tipoDb);
}
