/**
 * Barrel module — preserva la API histórica de `@/lib/email` mientras los
 * templates viven cada uno en su propio archivo bajo `src/lib/mail/templates/`.
 *
 * Audit D5 (refactor profundo): templates separados por dominio
 *   - mail/templates/otp.ts
 *   - mail/templates/signed-contract.ts
 *   - mail/templates/cotizacion.ts
 *   - mail/templates/cotizacion-admin.ts
 *   - mail/templates/payment-link.ts
 *   - mail/templates/contraoferta.ts
 *   - mail/templates/welcome.ts
 *
 * Para código nuevo, importa directo desde `@/lib/mail/templates/<x>` o
 * desde `@/lib/mail/transport`. Este archivo existe sólo para no romper
 * los importadores actuales.
 */

export { transporter, ADMIN_BCC_EMAILS, EMAIL_FROM } from "./transport";
export { formatCLP, escapeHtml } from "./utils";

export { sendOtpEmail } from "./templates/otp";
export { sendSignedContractEmail } from "./templates/signed-contract";
export { sendCotizacionEmail } from "./templates/cotizacion";
export { sendCotizacionAdminEmail } from "./templates/cotizacion-admin";
export { sendPaymentLinkEmail } from "./templates/payment-link";
export { sendContraofertaEmail } from "./templates/contraoferta";
export { sendWelcomeEmail } from "./templates/welcome";
// Tier 4 D6: Post-purchase email automation (barraca).
export { sendPurchaseThankYouEmail } from "./templates/purchase-thank-you";
export { sendReviewRequestEmail } from "./templates/review-request";
export { sendReplenishmentEmail } from "./templates/replenishment";
