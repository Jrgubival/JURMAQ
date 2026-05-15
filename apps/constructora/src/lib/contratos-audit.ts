import 'server-only';
import { supabaseAdmin } from "@jurmaq/shared/supabase";
import { NextRequest } from 'next/server';
import { getClientIp } from "@jurmaq/shared/rate-limit";
import { hid } from '@jurmaq/shared/logging';

/**
 * Audit log for contract signing flow.
 *
 * Every event in the signing pipeline is recorded so that — if a customer
 * later disputes the contract in court — we can show the exact sequence:
 * when they uploaded their cédula, when they requested the OTP, when they
 * verified it, when they pressed "Sign". Each row captures IP, user-agent
 * and a timestamp the database itself sets (not the application).
 *
 * The table has a CHECK constraint on event_type so callers can't accidentally
 * insert garbage. See `scripts/migrate-firma-fortalecida.sql`.
 *
 * Failures are swallowed: an audit-log write that fails should NOT break the
 * actual signing flow. We log to stderr but never propagate.
 */

export type ContratoAuditEventType =
  | 'identity_uploaded'
  | 'otp_requested'
  | 'otp_verified'
  | 'otp_failed'
  | 'sign_completed'
  | 'sign_failed'
  | 'arrendador_signed'
  | 'arrendador_unsigned';

export interface ContratoAuditMetadata {
  // Free-form JSON for event-specific details. NEVER include the OTP code,
  // password, full PII, or anything that would be more sensitive than
  // already-stored row in `contratos`/`contratos_otp`.
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Resolves a best-effort country/region/city from an IP using ipapi.co.
 * Returns null silently on any failure — geolocation is decorative metadata,
 * never a hard requirement.
 *
 * Note: this hits a public free API with low rate limits. For high-volume
 * signing we'd swap to MaxMind GeoLite2 self-hosted, but at our volume
 * (a few signs per day) the public API is fine.
 */
export async function resolveIpGeolocation(ip: string | null): Promise<{
  pais: string | null;
  region: string | null;
  ciudad: string | null;
}> {
  const empty = { pais: null, region: null, ciudad: null };
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip.startsWith('::')) {
    return empty;
  }
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { 'User-Agent': 'JURMAQ-Audit/1.0' },
      // Don't let geolocation slow down the signing flow if ipapi is
      // unreachable. 2.5s is a hard ceiling.
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return empty;
    const data = await res.json();
    return {
      pais: typeof data.country_code === 'string' ? data.country_code : null,
      region: typeof data.region === 'string' ? data.region : null,
      ciudad: typeof data.city === 'string' ? data.city : null,
    };
  } catch {
    return empty;
  }
}

/**
 * Record a single event in the contratos audit log. Captures IP and
 * user-agent from the request automatically — the caller only needs to
 * supply contract id, event type and any free-form metadata.
 */
export async function logContratoEvent(
  request: NextRequest | null,
  contratoId: number,
  eventType: ContratoAuditEventType,
  metadata?: ContratoAuditMetadata,
  geo?: { pais: string | null; region: string | null; ciudad: string | null }
): Promise<void> {
  try {
    const ip = request ? getClientIp(request) : null;
    const userAgent = request?.headers.get('user-agent') || null;
    await supabaseAdmin.from('contratos_audit_log').insert({
      contrato_id: contratoId,
      event_type: eventType,
      ip,
      user_agent: userAgent,
      pais: geo?.pais ?? null,
      region: geo?.region ?? null,
      ciudad: geo?.ciudad ?? null,
      metadata: metadata ?? null,
    });
  } catch (err) {
    // Never propagate — this is best-effort observability. The signing flow
    // must continue even if the log write fails.
    console.error('[contrato-audit-fail]', hid(contratoId), eventType, err);
  }
}
