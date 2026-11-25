/**
 * Copia mínima de `escapeHtml` y `formatCLP` de @jurmaq/shared/mail/utils para que el armado de los
 * correos (puro) no dependa de ese import (los scripts de prueba con el resolvedor de Node no lo
 * resuelven). Salida idéntica; scripts/correos-cliente.test.mjs lo compara con el original.
 */
export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCLP(amount: number): string {
  return "$" + amount.toLocaleString("es-CL");
}
