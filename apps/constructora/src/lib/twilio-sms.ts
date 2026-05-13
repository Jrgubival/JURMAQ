/**
 * Generador de OTP de 6 digitos crypto-random.
 *
 * Este archivo se llamaba "twilio-sms.ts" cuando el flow de firma usaba SMS
 * via Twilio. La firma electronica ahora usa email (Resend) — ver
 * `src/lib/email.ts:sendOtpEmail` y la doc en
 * `src/app/api/public/contratos/firmar/[token]/request-otp/route.ts`.
 *
 * Lo unico que quedo util de aqui es `generateOtpCode()`. El resto del
 * modulo (sendOtpSms, dev fallback, normalizacion +56) se removio en la
 * limpieza D2 de la auditoria de 2026-05.
 */
import crypto from 'crypto';

export function generateOtpCode(): string {
  // 6 digitos, crypto-random.
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, '0');
}
