import type { OtpProvider, OtpProviderResult } from '../types';
import { transporter } from '../../mail/transport';
import { env } from '@jurmaq/shared/env';

/**
 * Email provider — usa Resend a través del transporter común.
 *
 * Es el **último fallback**: si fallaron whatsapp y sms, este mensaje
 * sí o sí llega (mientras Resend esté saludable). Por eso aceptamos
 * tiempo de delivery más lento que WhatsApp.
 *
 * Env vars: RESEND_API_KEY (ya configurada para el resto del sistema).
 */

function isResendConfigured(): boolean {
  return !!env.RESEND_API_KEY;
}

export const emailProvider: OtpProvider = {
  name: 'email_resend',
  canal: 'email',

  async isHealthy(): Promise<boolean> {
    return isResendConfigured();
  },

  async send(destino: string, mensaje: string, opts?: { subject?: string }): Promise<OtpProviderResult> {
    if (!isResendConfigured()) {
      return { ok: false, error: 'Resend no configurado (RESEND_API_KEY)' };
    }
    if (!destino.includes('@')) {
      return { ok: false, error: 'Email provider requiere destino tipo email, recibió teléfono' };
    }
    try {
      const result = await transporter.sendMail({
        to: destino,
        subject: opts?.subject || 'Tu código JURMAQ',
        html: mensaje,
        // skipAdminBcc: el OTP es secreto, NUNCA copiar al admin (audit A12).
        skipAdminBcc: true,
      });
      const messageId = typeof result === 'object' && result && 'messageId' in result
        ? String((result as { messageId: unknown }).messageId)
        : undefined;
      return { ok: true, messageId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Email send fail: ${msg}` };
    }
  },
};
