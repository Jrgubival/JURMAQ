import 'server-only';
import { twilioSmsProvider } from '../otp/providers/twilio-sms-provider';

/**
 * Helper de envío SMS para flows que no son OTP (cart recovery, alertas,
 * recordatorios). Reusa el provider Twilio del módulo OTP.
 *
 * Env vars necesarias:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 *
 * Si Twilio no está configurado, sendSms() retorna { ok: false, skipped: true }
 * (no falla — el caller decide si reintenta).
 */

export interface SendSmsResult {
  ok: boolean;
  /** True si se intentó enviar y Twilio respondió OK. */
  sent?: boolean;
  /** True si Twilio no está configurado (no fue un error real). */
  skipped?: boolean;
  /** Provider ID retornado por Twilio (sid del mensaje). */
  provider_id?: string;
  /** Error del provider, si lo hubo. */
  error?: string;
}

/**
 * Envía un SMS via Twilio. El mensaje se trunca a 160 chars (1 SMS standard
 * para evitar split en multi-part y costos x2/x3).
 */
export async function sendSms(args: {
  to: string;
  message: string;
}): Promise<SendSmsResult> {
  const healthy = await twilioSmsProvider.isHealthy();
  if (!healthy) {
    return { ok: false, skipped: true, error: 'Twilio no configurado' };
  }
  // Trunca al límite estándar para evitar cobros multi-SMS (Chile).
  const mensaje = args.message.length > 160 ? args.message.slice(0, 157) + '...' : args.message;

  try {
    const result = await twilioSmsProvider.send(args.to, mensaje);
    if (!result.ok) {
      return { ok: false, sent: false, error: result.error };
    }
    return {
      ok: true,
      sent: true,
      provider_id: result.messageId,
    };
  } catch (err) {
    return {
      ok: false,
      sent: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Valida que el formato del teléfono sea utilizable para envío Chile. */
export function isValidChileanPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '');
  // +56 9 XXXX XXXX o sin el 56. Mínimo 8 dígitos de número, máximo 12 con cc.
  if (digits.length < 8 || digits.length > 12) return false;
  return true;
}
