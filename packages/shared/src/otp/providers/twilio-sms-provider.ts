import type { OtpProvider, OtpProviderResult } from '../types';
import { env } from '@jurmaq/shared/env';

/**
 * Twilio SMS — fallback si WhatsApp no funciona.
 *
 * Env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER   (E.164, ej +14155238886)
 *
 * Si falta cualquiera, isHealthy() = false.
 */

function getEnv() {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return null;
  return { sid, token, from };
}

function toE164(destino: string): string {
  const digits = destino.replace(/\D/g, '');
  return digits.startsWith('56') ? `+${digits}` : `+56${digits.replace(/^0+/, '')}`;
}

export const twilioSmsProvider: OtpProvider = {
  name: 'sms_twilio',
  canal: 'sms',

  async isHealthy(): Promise<boolean> {
    return !!getEnv();
  },

  async send(destino: string, mensaje: string): Promise<OtpProviderResult> {
    const env = getEnv();
    if (!env) return { ok: false, error: 'Twilio SMS no configurado' };

    try {
      const body = new URLSearchParams({
        To: toE164(destino),
        From: env.from,
        Body: mensaje,
      });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.sid}:${env.token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(10_000),
      });
      const raw = await res.json().catch(() => null);
      if (!res.ok) {
        return { ok: false, error: `Twilio HTTP ${res.status}`, raw };
      }
      const messageId =
        raw && typeof raw === 'object' && 'sid' in raw && typeof (raw as { sid: unknown }).sid === 'string'
          ? (raw as { sid: string }).sid
          : undefined;
      return { ok: true, messageId, raw };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Twilio fetch fail: ${msg}` };
    }
  },
};
