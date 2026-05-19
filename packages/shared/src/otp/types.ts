/**
 * OTP unificado multi-canal. Tipos y contratos compartidos.
 *
 * Diseño: dispatcher selecciona el canal según preferencia + health del
 * provider. Cualquiera de los providers puede caer (OpenWA banneado por
 * WhatsApp, Twilio sin saldo, Resend caído) — el dispatcher cascadea al
 * siguiente con prioridad whatsapp > sms > email.
 */

export type OtpCanal = 'whatsapp' | 'sms' | 'email';

export type OtpProviderName =
  | 'openwa'        // OpenWA self-hosted (gratis, riesgo TOS)
  | 'cloud_api'     // Meta WhatsApp Cloud API (oficial)
  | 'twilio'        // Twilio for WhatsApp (oficial vía Twilio)
  | 'wati'          // Wati / Ultramsg reseller
  | 'sms_twilio'    // Twilio SMS (fallback)
  | 'email_resend'  // Resend (fallback final)
  | 'manual';       // Marcador para flujos sin provider (testing)

export type OtpContexto =
  | 'firma_contrato'
  | 'garantia_klap'
  | 'tarjeta_cambio'
  | 'reset_password'
  | 'login_2fa'
  | 'verificacion_email';

/** Resultado de un provider individual. */
export interface OtpProviderResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  raw?: unknown;
}

/** Provider interface: stateless, todas las dependencias por env. */
export interface OtpProvider {
  name: OtpProviderName;
  canal: OtpCanal;
  /** ¿Está disponible / configurado en runtime? */
  isHealthy(): Promise<boolean>;
  /** Envía el mensaje. NO formatea — recibe texto ya armado. */
  send(destino: string, mensaje: string, opts?: { subject?: string }): Promise<OtpProviderResult>;
}

/** Input del dispatcher. El código se genera DENTRO del dispatcher. */
export interface OtpDispatchInput {
  destino: string;                 // email o +56XXXXXXXXX (E.164)
  contexto: OtpContexto;
  contextoId?: string;
  /** Si está seteado, intenta este canal primero antes del orden default. */
  canalPreferido?: OtpCanal;
  /** Datos opcionales para personalizar el mensaje (nombre, monto, etc.). */
  vars?: Record<string, string | number>;
}

/** Resultado del dispatcher. */
export interface OtpDispatchResult {
  ok: boolean;
  canalUsado?: OtpCanal;
  provider?: OtpProviderName;
  messageId?: string;
  /** True si se usó canal de fallback (no el preferido). */
  fallbackUsed?: boolean;
  error?: string;
  /** Cadena de intentos para auditoría (provider → ok/error). */
  intentos: Array<{ provider: OtpProviderName; canal: OtpCanal; ok: boolean; error?: string }>;
}
