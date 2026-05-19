import type { OtpProvider, OtpProviderResult } from '../types';

/**
 * WhatsApp Cloud API (Meta oficial) — plan B si OpenWA falla.
 *
 * Requiere: Meta Business verification + número aprobado + templates
 * pre-aprobados (Meta no permite mensajes "freeform" en cold outreach;
 * pero para OTP usamos templates aprobados de la categoría
 * AUTHENTICATION que sí están permitidos).
 *
 * Env vars:
 *   WHATSAPP_CLOUD_PHONE_NUMBER_ID = 1234567890
 *   WHATSAPP_CLOUD_ACCESS_TOKEN    = EAAG...
 *   WHATSAPP_CLOUD_OTP_TEMPLATE    = jurmaq_otp  (nombre del template aprobado)
 *   WHATSAPP_CLOUD_LANG            = es_CL
 */

function getEnv() {
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
  const template = process.env.WHATSAPP_CLOUD_OTP_TEMPLATE || 'jurmaq_otp';
  const lang = process.env.WHATSAPP_CLOUD_LANG || 'es_CL';
  if (!phoneNumberId || !accessToken) return null;
  return { phoneNumberId, accessToken, template, lang };
}

function toE164(destino: string): string {
  const digits = destino.replace(/\D/g, '');
  return digits.startsWith('56') ? digits : `56${digits.replace(/^0+/, '')}`;
}

export const cloudApiProvider: OtpProvider = {
  name: 'cloud_api',
  canal: 'whatsapp',

  async isHealthy(): Promise<boolean> {
    const env = getEnv();
    if (!env) return false;
    // Meta no expone health check trivial. Confiamos en la presencia del
    // env como señal "configurado"; el dispatcher detecta fallos al enviar.
    return true;
  },

  async send(destino: string, mensaje: string): Promise<OtpProviderResult> {
    const env = getEnv();
    if (!env) {
      return { ok: false, error: 'Cloud API no configurado' };
    }
    // OJO: Cloud API requiere usar template aprobado para OTP. El "mensaje"
    // libre que recibimos no se envía como tal; sólo se inyecta el código
    // como variable {{1}} del template. Lo extraemos del mensaje renderizado.
    const codigo = mensaje.match(/\b(\d{6})\b/)?.[1] ?? '';

    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${env.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: toE164(destino),
            type: 'template',
            template: {
              name: env.template,
              language: { code: env.lang },
              components: [
                {
                  type: 'body',
                  parameters: [{ type: 'text', text: codigo }],
                },
                {
                  // OTP button (one-tap autofill) si el template lo soporta.
                  type: 'button',
                  sub_type: 'url',
                  index: '0',
                  parameters: [{ type: 'text', text: codigo }],
                },
              ],
            },
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );

      const raw = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          ok: false,
          error: `CloudAPI HTTP ${res.status}: ${JSON.stringify(raw).slice(0, 200)}`,
          raw,
        };
      }
      const messageId =
        raw && typeof raw === 'object' && 'messages' in raw && Array.isArray((raw as { messages: unknown }).messages)
          ? String(((raw as { messages: Array<{ id?: string }> }).messages[0] || {}).id ?? '') || undefined
          : undefined;
      return { ok: true, messageId, raw };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `CloudAPI fetch fail: ${msg}` };
    }
  },
};
