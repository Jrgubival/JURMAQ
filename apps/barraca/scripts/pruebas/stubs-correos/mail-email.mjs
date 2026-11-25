// Reemplaza @jurmaq/shared/mail/email: layout y utils reales, transporte que solo captura.
export { renderEmailLayout, renderButton, renderOrderItems } from "../../../../../packages/shared/src/mail/layout.ts";
export { escapeHtml, formatCLP } from "../../../../../packages/shared/src/mail/utils.ts";
export const transporter = {
  async sendMail(correo) {
    (globalThis.__CORREOS_ENVIADOS__ ??= []).push(correo);
    return { error: null };
  },
};
