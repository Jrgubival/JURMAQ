/**
 * Helpers compartidos por todos los templates de email.
 */

export function formatCLP(amount: number): string {
  return "$" + amount.toLocaleString("es-CL");
}

/**
 * Escape básico para HTML inyectado en templates de email.
 * Cubre los 5 caracteres que pueden romper el render o introducir XSS
 * a través de un cliente de correo (algunos renderean ciertos atributos
 * con scripts si no se sanitiza).
 */
export function escapeHtml(s: string): string {
  return String(s).replace(/[<>&"']/g, (c) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&#39;",
  }[c] || c));
}
