/**
 * Sistema unificado de tokens firmados HMAC-SHA256 + sesiones revocables en DB.
 *
 * REEMPLAZA:
 *   - apps/constructora/src/lib/cuenta-auth.ts (base64 `clienteId:nonce` sin verificación)
 *   - apps/barraca tokens base64 `userId:random` en /api/auth/route.ts
 *
 * REQUISITO DE SEGURIDAD CRÍTICO (revisor):
 *   verifyToken() valida firma + exp + scope + **SELECT en user_sessions** por cada
 *   request sensible. Sin el SELECT, la tabla user_sessions es decoración y la
 *   revocación es ficticia. Fail-closed si la DB query falla.
 *
 * Migration asociada: apps/barraca/scripts/migrate-user-sessions.sql (apply once,
 * tabla compartida entre constructora y barraca via scope).
 *
 * Uso ejemplo:
 *   // emisión (login)
 *   const token = await signToken({
 *     userId: 'usr_123',
 *     scope: 'constructora',
 *     role: 'cliente',
 *     ttlSeconds: 60 * 60 * 24 * 7, // 7 días
 *     ip,
 *     userAgent,
 *   });
 *
 *   // verificación (cada request sensible)
 *   const session = await verifyToken(req.headers.authorization, 'constructora');
 *   if (!session) return new Response('Unauthorized', { status: 401 });
 *
 *   // logout
 *   await revokeSession(session.sid);
 *
 *   // logout-all del usuario
 *   await revokeAllUserSessions('usr_123', 'constructora');
 */

import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type SessionScope = 'constructora' | 'barraca' | 'app';

export interface SessionPayload {
  /** Subject — user ID */
  sub: string;
  /** Scope de la app emisora */
  scope: SessionScope;
  /** Rol opcional (admin, cliente, maestro, etc.) */
  role?: string;
  /** Issued At — UNIX seconds */
  iat: number;
  /** Expires At — UNIX seconds */
  exp: number;
  /** Session ID — referencia a fila en user_sessions */
  sid: string;
}

export interface VerifiedSession {
  userId: string;
  scope: SessionScope;
  role?: string;
  sid: string;
  /** Cuándo expira el JWT (puede ser anterior a la fila DB si lifecycle distinto) */
  expiresAt: Date;
}

export interface SignTokenInput {
  userId: string;
  scope: SessionScope;
  role?: string;
  /** TTL en segundos. Default 7 días. Max 30 días. */
  ttlSeconds?: number;
  ip?: string;
  userAgent?: string;
}

// ---------------------------------------------------------------------------
// Utils JWT raw (HMAC-SHA256, sin lib externa)
// ---------------------------------------------------------------------------

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Buffer {
  // Restore padding
  const pad = str.length % 4 === 2 ? '==' : str.length % 4 === 3 ? '=' : '';
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function getSecret(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set and ≥ 32 chars');
  }
  return Buffer.from(secret, 'utf8');
}

function sign(headerPayload: string): string {
  return base64UrlEncode(
    crypto.createHmac('sha256', getSecret()).update(headerPayload).digest(),
  );
}

function verifySignature(headerPayload: string, signature: string): boolean {
  const expected = sign(headerPayload);
  // Timing-safe compare
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

const MAX_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 días hard cap
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 días

/**
 * Emite un JWT firmado y registra la sesión en `user_sessions`.
 *
 * - Genera `sid` UUID
 * - INSERT en user_sessions con expires_at = now + ttl
 * - Firma JWT incluyendo `sid` en payload
 * - Retorna string `header.payload.signature` base64url
 */
export async function signToken(input: SignTokenInput): Promise<string> {
  const ttl = Math.min(input.ttlSeconds ?? DEFAULT_TTL_SECONDS, MAX_TTL_SECONDS);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttl;
  const sid = crypto.randomUUID();

  // INSERT user_sessions ANTES de devolver el token (si falla, no emitimos)
  const { supabaseAdmin } = await import('../supabase');
  const { error } = await supabaseAdmin.from('user_sessions').insert({
    id: sid,
    user_id: input.userId,
    scope: input.scope,
    role: input.role ?? null,
    expires_at: new Date(exp * 1000).toISOString(),
    ip: input.ip ?? null,
    user_agent: input.userAgent ?? null,
  });
  if (error) {
    throw new Error(`Failed to persist session: ${error.message}`);
  }

  const header = base64UrlEncode(
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
  );
  const payload: SessionPayload = {
    sub: input.userId,
    scope: input.scope,
    role: input.role,
    iat: now,
    exp,
    sid,
  };
  const payloadEncoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const headerPayload = `${header}.${payloadEncoded}`;
  const signature = sign(headerPayload);

  return `${headerPayload}.${signature}`;
}

/**
 * Verifica un token. **CRÍTICO**: valida contra DB user_sessions.
 *
 * Pasos:
 *   1. Parsea formato Bearer / cookie raw / `header.payload.signature`
 *   2. Verifica firma HMAC con AUTH_SECRET
 *   3. Verifica exp > now
 *   4. Verifica scope === expectedScope (aislamiento cross-app)
 *   5. **SELECT en user_sessions** WHERE id = payload.sid AND revoked_at IS NULL AND expires_at > now AND scope = expectedScope
 *   6. UPDATE last_used_at (best-effort)
 *   7. Retorna sesión o null
 *
 * Fail-closed: cualquier error retorna null. NO se asume válido bajo ningún caso.
 */
export async function verifyToken(
  authHeaderOrToken: string | null | undefined,
  expectedScope: SessionScope,
): Promise<VerifiedSession | null> {
  if (!authHeaderOrToken || typeof authHeaderOrToken !== 'string') return null;

  // Strip "Bearer " prefix if present
  const token = authHeaderOrToken.startsWith('Bearer ')
    ? authHeaderOrToken.slice(7).trim()
    : authHeaderOrToken.trim();

  // Format: header.payload.signature
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payloadEncoded, signature] = parts;

  // 1. Firma
  if (!verifySignature(`${header}.${payloadEncoded}`, signature)) return null;

  // 2. Parse payload
  let payload: SessionPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadEncoded).toString('utf8'));
  } catch {
    return null;
  }
  if (
    typeof payload?.sub !== 'string' ||
    typeof payload.scope !== 'string' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    typeof payload.sid !== 'string'
  ) {
    return null;
  }

  // 3. Exp check
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return null;

  // 4. Scope check (aislamiento cross-app)
  if (payload.scope !== expectedScope) return null;

  // 5. DB session lookup (CRÍTICO — sin esto la revocación no funciona)
  let sessionRow: { revoked_at: string | null; expires_at: string } | null = null;
  try {
    const { supabaseAdmin } = await import('../supabase');
    const { data, error } = await supabaseAdmin
      .from('user_sessions')
      .select('revoked_at, expires_at')
      .eq('id', payload.sid)
      .eq('scope', expectedScope)
      .eq('user_id', payload.sub)
      .maybeSingle();

    if (error) {
      // Fail-closed
      console.error('[verifyToken] DB query failed', { sid: payload.sid, error });
      return null;
    }
    sessionRow = data ?? null;
  } catch (e) {
    console.error('[verifyToken] DB import/query exception', e);
    return null;
  }

  if (!sessionRow) return null;
  if (sessionRow.revoked_at) return null;
  if (new Date(sessionRow.expires_at).getTime() <= Date.now()) return null;

  // 6. UPDATE last_used_at best-effort (no falla la auth si esto rompe)
  try {
    const { supabaseAdmin } = await import('../supabase');
    void supabaseAdmin
      .from('user_sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', payload.sid);
  } catch {
    /* swallow */
  }

  return {
    userId: payload.sub,
    scope: payload.scope,
    role: payload.role,
    sid: payload.sid,
    expiresAt: new Date(payload.exp * 1000),
  };
}

/**
 * Marca una sesión como revocada. Idempotente.
 */
export async function revokeSession(sid: string): Promise<void> {
  const { supabaseAdmin } = await import('../supabase');
  const { error } = await supabaseAdmin
    .from('user_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', sid)
    .is('revoked_at', null);
  if (error) {
    throw new Error(`revokeSession failed: ${error.message}`);
  }
}

/**
 * Revoca TODAS las sesiones activas de un usuario en un scope.
 * Útil para "cerrar sesión en todos los dispositivos" o forzar logout-all
 * tras cambio de password / sospecha de compromiso.
 */
export async function revokeAllUserSessions(
  userId: string,
  scope: SessionScope,
): Promise<{ revokedCount: number }> {
  const { supabaseAdmin } = await import('../supabase');
  const { error, count } = await supabaseAdmin
    .from('user_sessions')
    .update({ revoked_at: new Date().toISOString() }, { count: 'exact' })
    .eq('user_id', userId)
    .eq('scope', scope)
    .is('revoked_at', null);
  if (error) {
    throw new Error(`revokeAllUserSessions failed: ${error.message}`);
  }
  return { revokedCount: count ?? 0 };
}

/**
 * Cron-friendly cleanup de sesiones expiradas o revocadas viejas.
 * Llamar cada ~24h desde /api/cron/cleanup-sessions.
 */
export async function purgeOldSessions(maxAgeDays = 90): Promise<{ deleted: number }> {
  const { supabaseAdmin } = await import('../supabase');
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  const { error, count } = await supabaseAdmin
    .from('user_sessions')
    .delete({ count: 'exact' })
    .or(`expires_at.lt.${cutoff},revoked_at.lt.${cutoff}`);
  if (error) {
    throw new Error(`purgeOldSessions failed: ${error.message}`);
  }
  return { deleted: count ?? 0 };
}
