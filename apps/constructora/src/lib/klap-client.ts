import 'server-only';
import crypto from 'crypto';
import {
  mockCancel,
  mockCapture,
  mockOffsessionCharge,
  mockPreauth,
} from './klap-mock';
import type {
  KlapCancelRequest,
  KlapCancelResponse,
  KlapCaptureRequest,
  KlapCaptureResponse,
  KlapChargeResponse,
  KlapOffsessionChargeRequest,
  KlapPreauthRequest,
  KlapPreauthResponse,
  KlapResult,
} from './klap-types';

/**
 * Cliente Klap. Wrapper único alrededor de la API + mock.
 *
 * Estado del rollout (Fase A / Fase B):
 *   - Si KLAP_ENABLED != 'true' → modo mock (responses canned, no llamadas externas).
 *   - Si KLAP_ENABLED='true' + KLAP_API_KEY + KLAP_BASE_URL → modo producción real.
 *
 * Genera Idempotency-Key automáticamente por llamada. Maneja AES-256
 * encryption del network_token según la spec de Klap.
 *
 * Audit: cada llamada (incluso en mock) debe loggear en klap_eventos vía el
 * caller — este módulo NO toca DB, solo emite la request HTTP.
 */

function isEnabled(): boolean {
  return process.env.KLAP_ENABLED === 'true' && !!process.env.KLAP_API_KEY && !!process.env.KLAP_BASE_URL;
}

function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Api-Key': process.env.KLAP_API_KEY || '',
    'Idempotency-Key': generateIdempotencyKey(),
  };
}

function base(): string {
  return (process.env.KLAP_BASE_URL || 'https://api.pasarela.multicaja.cl').replace(/\/$/, '');
}

/** Crea un hold (pre-autorización). */
export async function klapPreauth(req: KlapPreauthRequest): Promise<KlapResult<KlapPreauthResponse>> {
  if (!isEnabled()) {
    return mockPreauth(req);
  }
  try {
    const res = await fetch(`${base()}/card-payments/v4/preauth`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(raw).slice(0, 200)}`, raw };
    }
    return { ok: true, data: raw as KlapPreauthResponse, raw };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Captura parcial o total. monto ≤ monto del hold. */
export async function klapCapture(req: KlapCaptureRequest): Promise<KlapResult<KlapCaptureResponse>> {
  if (!isEnabled()) {
    return mockCapture(req);
  }
  try {
    const res = await fetch(`${base()}/card-payments/v4/preauth/completion`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(raw).slice(0, 200)}`, raw };
    }
    return { ok: true, data: raw as KlapCaptureResponse, raw };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Cancela / libera un hold. */
export async function klapCancel(req: KlapCancelRequest): Promise<KlapResult<KlapCancelResponse>> {
  if (!isEnabled()) {
    return mockCancel(req);
  }
  try {
    const res = await fetch(`${base()}/card-payments/v4/preauth/cancel`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(raw).slice(0, 200)}`, raw };
    }
    return { ok: true, data: raw as KlapCancelResponse, raw };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Cargo off-session con token guardado (card-on-file). */
export async function klapOffsessionCharge(
  req: KlapOffsessionChargeRequest,
): Promise<KlapResult<KlapChargeResponse>> {
  if (!isEnabled()) {
    return mockOffsessionCharge(req);
  }
  try {
    const res = await fetch(`${base()}/card-payments/v4/charges`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(raw).slice(0, 200)}`, raw };
    }
    return { ok: true, data: raw as KlapChargeResponse, raw };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Verifica la firma HMAC de un webhook de Klap. */
export function verifyKlapWebhookSignature(payload: string, signatureHeader: string | null): boolean {
  const secret = process.env.KLAP_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signatureHeader) return false;

  // Formato esperado: 'ts=<unix>,v1=<hex>' (mismo patrón que MercadoPago).
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => {
      const [k, v] = p.split('=');
      return [k?.trim(), v?.trim()];
    }),
  );
  const ts = parts.ts;
  const sig = parts.v1;
  if (!ts || !sig) return false;

  // 5 min skew máximo.
  const tsNum = parseInt(ts, 10);
  if (Number.isNaN(tsNum)) return false;
  if (Math.abs(Date.now() / 1000 - tsNum) > 300) return false;

  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}

/** Helper para auditar en klap_eventos. */
export interface KlapEventLog {
  evento_tipo: string;
  contrato_id?: number | null;
  hold_id?: string | null;
  klap_transaction_id?: string | null;
  request_id?: string | null;
  raw_response?: unknown;
  origen: 'api' | 'webhook' | 'cron' | 'admin' | 'mock';
  triggered_by?: string | null;
}
