import 'server-only';
import { Resend } from 'resend';
import { env } from '@jurmaq/shared/env';
import { maskEmail } from '../logging';

/**
 * Cliente Resend + wrapper de envio. Audit D5: extraido de `lib/email.ts`
 * para separar el cliente HTTP de los templates de negocio. Antes
 * `lib/email.ts` (953 lineas) mezclaba transport + 11 templates HTML
 * inline + politica de BCC; cualquier cambio del transport requeria
 * tocar el archivo gigante.
 *
 * Las funciones `send*Email` siguen viviendo en `lib/email.ts` y delegan
 * en este modulo via `transporter.sendMail()`. Nuevos canales (SMS,
 * push) se agregarian aqui con la misma interfaz.
 */

const resend = new Resend(env.RESEND_API_KEY);
const EMAIL_FROM = env.EMAIL_FROM || 'JURMAQ <noreply@jurmaq.cl>';

/**
 * BCC automatico a casillas internas para auditoria/respaldo. Configurable
 * via env ADMIN_BCC_EMAILS (separado por comas).
 */
const ADMIN_BCC_EMAILS: string[] = (env.ADMIN_BCC_EMAILS ||
  `${env.ADMIN_EMAIL || 'contacto@jurmaq.cl'},constructora@jurmaq.cl`)
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export type SendMailOptions = {
  from?: string;
  to: string;
  subject: string;
  html: string;
  bcc?: string | string[];
  /**
   * Audit A12: si true, NO se agrega BCC automatico a contacto@/constructora@.
   * Usar para correos sensibles donde el BCC seria fuga de privacidad:
   * codigos OTP de firma, contratos firmados, recovery passwords, etc.
   */
  skipAdminBcc?: boolean;
};

export type SendMailResult = Awaited<ReturnType<typeof resend.emails.send>>;

/**
 * Envia un email via Resend con BCC admin (a menos que skipAdminBcc=true).
 * Logea exito/fallo. NO lanza si Resend retorna error en `result.error`
 * para que el caller decida si reintentar/encolar.
 */
async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  const bccSet = new Set<string>();
  if (options.bcc) {
    if (Array.isArray(options.bcc)) options.bcc.forEach((b) => b && bccSet.add(b.toLowerCase()));
    else bccSet.add(options.bcc.toLowerCase());
  }
  const toLower = options.to.trim().toLowerCase();
  if (!options.skipAdminBcc) {
    for (const admin of ADMIN_BCC_EMAILS) {
      if (admin && admin !== toLower) bccSet.add(admin);
    }
  }
  bccSet.delete(toLower);
  const bcc = Array.from(bccSet);

  try {
    const result = await resend.emails.send({
      from: options.from || EMAIL_FROM,
      to: [options.to],
      ...(bcc.length > 0 ? { bcc } : {}),
      subject: options.subject,
      html: options.html,
    });
    if (result.error) {
      // PII masked: emails de destinatarios no van cleartext a logs (Ley 21.719 H1)
      console.error('[email-send-fail]', {
        to: maskEmail(options.to),
        subject: options.subject,
        bcc_count: bcc.length,
        error: result.error,
      });
      return result;
    }
    console.log('[email-send-ok]', {
      id: result.data?.id,
      to: maskEmail(options.to),
      bcc_count: bcc.length,
      subject: options.subject,
    });
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email-send-throw]', {
      to: maskEmail(options.to),
      subject: options.subject,
      bcc_count: bcc.length,
      message,
    });
    throw err;
  }
}

/**
 * Wrapper compatible con la API previa de `lib/email.ts:transporter`.
 * Mantiene la misma forma `transporter.sendMail({...})` para no romper
 * los ~10 archivos que la importan directo.
 */
export const transporter = {
  sendMail,
};

export { EMAIL_FROM, ADMIN_BCC_EMAILS };
