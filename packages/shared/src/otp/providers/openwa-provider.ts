import type { OtpProvider, OtpProviderResult } from '../types';

/**
 * OpenWA self-hosted provider.
 *
 * OpenWA expone una HTTP API local (default :2785) que recibe el mensaje y
 * lo envía por WhatsApp Web. Lo corremos en una VM separada (Vercel
 * serverless NO sirve: WhatsApp Web requiere conexión persistente).
 *
 * Env vars:
 *   OPENWA_BASE_URL = https://openwa.jurmaq.cl   (o IP de la VM)
 *   OPENWA_SESSION  = jurmaq
 *   OPENWA_API_KEY  = secret de autorización (no es de WhatsApp)
 *
 * Si alguno falta, isHealthy() devuelve false y el dispatcher cascadea al
 * siguiente provider.
 */

function getEnv() {
  const baseUrl = process.env.OPENWA_BASE_URL;
  const session = process.env.OPENWA_SESSION || 'jurmaq';
  const apiKey = process.env.OPENWA_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ''), session, apiKey };
}

/** Normaliza un teléfono chileno a JID de WhatsApp (e.g. 56912345678@c.us). */
function toJid(destino: string): string {
  const digits = destino.replace(/\D/g, '');
  // Default a Chile (+56) si vino sin código país.
  const e164 = digits.startsWith('56') ? digits : `56${digits.replace(/^0+/, '')}`;
  return `${e164}@c.us`;
}

export const openwaProvider: OtpProvider = {
  name: 'openwa',
  canal: 'whatsapp',

  async isHealthy(): Promise<boolean> {
    const env = getEnv();
    if (!env) return false;
    try {
      // OpenWA exposes /api/sessions/<id>/health o similar. Usamos un ping
      // genérico que SI devuelve 401 sin API key igual nos confirma que hay
      // un proceso vivo escuchando.
      const res = await fetch(`${env.baseUrl}/api/sessions/${env.session}/me`, {
        method: 'GET',
        headers: { 'x-api-key': env.apiKey },
        signal: AbortSignal.timeout(3500),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async send(destino: string, mensaje: string): Promise<OtpProviderResult> {
    const env = getEnv();
    if (!env) {
      return { ok: false, error: 'OpenWA no configurado (env OPENWA_BASE_URL/OPENWA_API_KEY)' };
    }
    try {
      const res = await fetch(`${env.baseUrl}/api/sessions/${env.session}/messages/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.apiKey,
        },
        body: JSON.stringify({
          to: toJid(destino),
          body: mensaje,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      const raw = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          ok: false,
          error: `OpenWA HTTP ${res.status}: ${typeof raw === 'object' && raw && 'error' in raw ? (raw as { error: string }).error : 'unknown'}`,
          raw,
        };
      }
      const messageId =
        raw && typeof raw === 'object' && 'id' in raw && typeof (raw as { id: unknown }).id === 'string'
          ? ((raw as { id: string }).id)
          : undefined;
      return { ok: true, messageId, raw };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `OpenWA fetch fail: ${msg}` };
    }
  },
};
