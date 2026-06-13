/**
 * Schema Zod centralizado de variables de entorno.
 *
 * Por qué:
 * - Single source of truth de qué env vars existen, cuáles son requeridas, y
 *   qué tipo tienen (URL, secret, boolean string).
 * - Validación al startup (al primer import en SSR): si falta una required en
 *   prod, el build / first request falla con un error EXPLÍCITO de Zod en
 *   lugar de un crash silencioso o un `undefined` propagado.
 * - Tipado: `env.NEXT_PUBLIC_SUPABASE_URL` es `string` (no `string | undefined`),
 *   así el resto del código no necesita guards defensivos.
 *
 * Diseño server/client (Next.js):
 * - `serverEnvSchema` se valida solo en server (typeof window === 'undefined').
 *   En el bundle del cliente, Next.js strippea cualquier env sin prefijo
 *   `NEXT_PUBLIC_*` — son `undefined` en `process.env` del cliente, así que
 *   no podemos validarlas allí.
 * - `clientEnvSchema` se valida siempre (server + client).
 * - `env` exporta ambos schemas unificados; los accesos a vars server-only
 *   desde código que también corre en cliente fallarán en TypeScript (uso
 *   incorrecto) o en runtime con `undefined` (escaparon a un client component).
 *
 * Convenciones:
 * - Required: `.string().min(1)` o `.url()`.
 * - Optional con default: `.default('foo')` o `.optional()`.
 * - Boolean flags: `.string().transform(v => v === 'true')`.
 *
 * Para migrar un call site:
 *   - antes: `const x = process.env.NEXT_PUBLIC_SUPABASE_URL;`
 *   - ahora: `import { env } from '@jurmaq/shared/env'; const x = env.NEXT_PUBLIC_SUPABASE_URL;`
 */

import { z } from 'zod';

// ============================================================================
// Client-safe env vars (prefijo NEXT_PUBLIC_*) — bundled al cliente
// ============================================================================
const clientEnvSchema = z.object({
  /** URL de Supabase — usado por el cliente para anon queries. */
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({
    message: 'NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida (ej. https://xxx.supabase.co)',
  }),

  /** Anon key de Supabase — públicamente visible, protegida por RLS. */
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY es requerida'),

  /** Measurement ID de GA4 (`G-XXXXXXXXXX`). Si está vacío, analytics no carga. */
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),

  /** Base URL pública (sin trailing slash). Usado para construir absolute URLs en emails. */
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),

  /** URL del dominio constructora (https://jurmaq.cl). */
  NEXT_PUBLIC_CONSTRUCTORA_URL: z.string().url().optional(),

  /** URL del dominio barraca (https://barraca.jurmaq.cl). */
  NEXT_PUBLIC_BARRACA_URL: z.string().url().optional(),

  /** Fallback de NEXT_PUBLIC_BASE_URL — algunas pages la usan en lugar. */
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  /** RUT de la empresa (legacy — preferir LEGAL_INFO.rut desde @jurmaq/shared/seo). */
  NEXT_PUBLIC_COMPANY_RUT: z.string().optional(),

  /** Modo KLAP: 'production' | 'sandbox'. */
  NEXT_PUBLIC_KLAP_MODE: z.enum(['production', 'sandbox']).optional(),

  /** Token Google Search Console (meta name="google-site-verification"). Opcional. */
  NEXT_PUBLIC_GSC_VERIFICATION: z.string().optional(),

  /** Token Bing Webmaster (meta name="msvalidate.01"). Opcional. */
  NEXT_PUBLIC_BING_VERIFICATION: z.string().optional(),
});

// ============================================================================
// Server-only env vars (no se exponen al cliente)
// ============================================================================
const serverEnvSchema = z.object({
  /** Secret de NextAuth — usado para firmar JWTs/cookies. CRÍTICO. */
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET debe tener al menos 16 caracteres'),

  /** URL base de NextAuth para callbacks. */
  NEXTAUTH_URL: z.string().url().optional(),

  /**
   * SSO Google para admins (allowlist contra public.users). Opcionales:
   * si faltan, el provider Google no se monta y el login cae al flujo
   * de credenciales de siempre.
   */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  /** Service role key de Supabase — bypassa RLS. CRÍTICO. NUNCA exponer al cliente. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY es requerida'),

  /** API key de Resend (envío de correos transaccionales). */
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY es requerida'),

  /** Sender por defecto para correos transaccionales (ej. "JURMAQ <contacto@jurmaq.cl>"). */
  EMAIL_FROM: z.string().min(1).optional(),

  /** Email del admin principal — recibe notificaciones críticas (errores, alertas). */
  ADMIN_EMAIL: z.string().email().optional(),

  /** BCC adicional en notificaciones admin (lista coma-separada). */
  ADMIN_BCC_EMAILS: z.string().optional(),

  /** Email de notificaciones admin (legacy). */
  ADMIN_NOTIF_EMAIL: z.string().email().optional(),

  /** Password legacy del admin (si está en uso). */
  ADMIN_PASSWORD: z.string().optional(),

  /** Access token de MercadoPago (production o test según ambiente). */
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),

  /** Secret para verificar firma de webhook de MercadoPago. */
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),

  /** Secret para autenticar invocaciones de cron jobs (Vercel Cron / GitHub Actions). */
  CRON_SECRET: z.string().min(16).optional(),

  /** API key de KLAP (procesador de garantías). */
  KLAP_API_KEY: z.string().optional(),

  /** URL base de KLAP API. */
  KLAP_BASE_URL: z.string().url().optional(),

  /** Feature flag KLAP: 'true' habilita el flujo de garantías KLAP. */
  KLAP_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  /** Secret para verificar webhooks de KLAP. */
  KLAP_WEBHOOK_SECRET: z.string().optional(),

  /** API key de OpenWA (proveedor OTP alternativo). */
  OPENWA_API_KEY: z.string().optional(),

  /** URL base de OpenWA. */
  OPENWA_BASE_URL: z.string().url().optional(),

  /** Sesión OpenWA. */
  OPENWA_SESSION: z.string().optional(),

  /** Account SID de Twilio (proveedor SMS alternativo). */
  TWILIO_ACCOUNT_SID: z.string().optional(),

  /** Auth token de Twilio. */
  TWILIO_AUTH_TOKEN: z.string().optional(),

  /** Número origen de Twilio en formato E.164 (ej. +14155238886). */
  TWILIO_FROM_NUMBER: z.string().optional(),

  /** WhatsApp Cloud API (Meta): phone number ID del número aprobado. */
  WHATSAPP_CLOUD_PHONE_NUMBER_ID: z.string().optional(),

  /** WhatsApp Cloud API: access token de larga duración. */
  WHATSAPP_CLOUD_ACCESS_TOKEN: z.string().optional(),

  /** Nombre del template aprobado de Meta para OTP. */
  WHATSAPP_CLOUD_OTP_TEMPLATE: z.string().optional(),

  /** Locale del template (ej. es_CL). */
  WHATSAPP_CLOUD_LANG: z.string().optional(),

  /** Access key de Unsplash API (búsqueda de imágenes para fichas de maestros). */
  UNSPLASH_ACCESS_KEY: z.string().optional(),

  /** URL auto-inyectada por Vercel en el deploy (sin scheme). Fallback para construir absolute URLs. */
  VERCEL_URL: z.string().optional(),

  /** API key de Gemini (AI features). */
  GEMINI_API_KEY: z.string().optional(),

  /** API key de Groq (AI features alternativas). */
  GROQ_API_KEY: z.string().optional(),

  /** API key de OpenRouteService (cálculo de fletes). */
  ORS_API_KEY: z.string().optional(),

  /** Banco para datos de transferencia mostrados en payment-link emails. */
  BANK_NAME: z.string().optional(),
  /** Número de cuenta corriente. */
  BANK_ACCOUNT: z.string().optional(),
  /** RUT del titular de la cuenta. */
  BANK_RUT: z.string().optional(),
  /** Email del titular para notificar transferencias. */
  BANK_EMAIL: z.string().email().optional(),

  /** Scope de autenticación legacy (cuenta vs constructora vs admin). */
  AUTH_SCOPE: z.string().optional(),

  /**
   * Feature flag: habilita sesiones firmadas (JWT HMAC) para el portal de
   * clientes. CRÍTICO: con el flag apagado, los tokens caen al formato legacy
   * base64 FORJABLE. Se hace `.trim()` a propósito — un valor pegado en Vercel
   * como "true\n" (con salto de línea) rompía el `=== 'true'` estricto y
   * desactivaba silenciosamente este control de seguridad. Nunca dejar que un
   * espacio en blanco apague una protección.
   */
  AUTH_SESSIONS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v?.trim() === 'true'),

  /** Estandar NODE_ENV — Next.js lo setea automáticamente. */
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
});

// ============================================================================
// Validación
// ============================================================================

const isServer = typeof window === 'undefined';

function formatErrors(errors: z.ZodError): string {
  return errors.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
}

function parseClient() {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_CONSTRUCTORA_URL: process.env.NEXT_PUBLIC_CONSTRUCTORA_URL,
    NEXT_PUBLIC_BARRACA_URL: process.env.NEXT_PUBLIC_BARRACA_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_COMPANY_RUT: process.env.NEXT_PUBLIC_COMPANY_RUT,
    NEXT_PUBLIC_KLAP_MODE: process.env.NEXT_PUBLIC_KLAP_MODE,
    NEXT_PUBLIC_GSC_VERIFICATION: process.env.NEXT_PUBLIC_GSC_VERIFICATION,
    NEXT_PUBLIC_BING_VERIFICATION: process.env.NEXT_PUBLIC_BING_VERIFICATION,
  });
  if (!result.success) {
    throw new Error(
      `❌ Invalid client environment variables (NEXT_PUBLIC_*):\n${formatErrors(result.error)}\n\nVerifica tu .env.local o las variables de entorno de Vercel/producción.`,
    );
  }
  return result.data;
}

function parseServer() {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `❌ Invalid server environment variables:\n${formatErrors(result.error)}\n\nVerifica tu .env.local o las variables de entorno de Vercel/producción.`,
    );
  }
  return result.data;
}

const clientEnv = parseClient();
const serverEnv = isServer ? parseServer() : ({} as z.infer<typeof serverEnvSchema>);

/**
 * Variables de entorno validadas y tipadas.
 *
 * En código de **servidor** (route handlers, server components, middleware):
 * acceso completo a todas las vars.
 *
 * En código de **cliente** (componentes `'use client'`): solo las `NEXT_PUBLIC_*`
 * están disponibles. Las server-only son `undefined` (Next.js las strippea del
 * bundle).
 *
 * @example
 *   import { env } from '@jurmaq/shared/env';
 *   const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;  // ambos
 *   const resendKey = env.RESEND_API_KEY;              // solo server
 */
export const env = { ...clientEnv, ...serverEnv };

export type Env = typeof env;
