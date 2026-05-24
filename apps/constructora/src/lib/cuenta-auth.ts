import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { signToken as signSessionJWT, verifyToken as verifySessionJWT } from '@jurmaq/shared/auth/session-token';
import { NextRequest } from 'next/server';

/**
 * SECURITY MIGRATION (audit fase 2A.1):
 * El sistema histórico de tokens era base64("clienteId:randomHex") — sin firma,
 * forjable por cualquiera que pueda enumerar IDs. Lo reemplazamos por JWT
 * firmados HMAC-SHA256 con revocación contra `user_sessions`.
 *
 * Activación dual-mode:
 *   - Default (sin env var): tokens nuevos seguen siendo base64 LEGACY.
 *   - Si AUTH_SESSIONS_ENABLED=true + migrate-user-sessions.sql aplicada:
 *     tokens nuevos son JWT firmados.
 * `parseClienteTokenAsync` siempre acepta AMBOS formatos durante la transición.
 */
const USE_SIGNED_TOKENS = process.env.AUTH_SESSIONS_ENABLED === 'true';

/**
 * Auth helpers para el portal cliente arriendo (constructora).
 *
 * Patrón: custom token (NO NextAuth) — replica el patrón de barraca_usuarios
 * para mantener consistencia y evitar mezclar auth de admin con auth de
 * cliente final.
 *
 * Token = base64(`clienteId:randomHex64`). El random no se persiste (es solo
 * un nonce para evitar adivinanza de tokens por bruteforce). La validez se
 * deriva de existir el cliente con `activo=true` y de las cookies HttpOnly.
 *
 * Almacenamiento:
 *   - Production: cookie HttpOnly `__Host-cuenta.session` (Secure + Path=/ + sin Domain).
 *   - Dev: cookie `dev-cuenta.session`.
 *
 * Por qué cookie y NO localStorage:
 *   - Resistencia a XSS: si el atacante inyecta JS, no puede leer la cookie.
 *   - SSR: el server puede leer la cookie sin viaje al cliente.
 *   - Logout: borrar la cookie es atómico.
 */

const COOKIE_NAME = process.env.NODE_ENV === 'production'
  ? '__Host-cuenta.session'
  : 'dev-cuenta.session';

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 días

export interface ClienteSession {
  id: number;
  email: string;
  nombre: string;
  rut: string | null;
  empresa: string | null;
  telefono: string | null;
}

/**
 * Sync emisor LEGACY. Mantenido para retrocompatibilidad. Si quieres usar
 * el sistema nuevo firmado, usa `generateClienteTokenAsync`.
 */
export function generateClienteToken(clienteId: number): string {
  const random = crypto.randomBytes(32).toString('hex');
  return Buffer.from(`${clienteId}:${random}`).toString('base64');
}

/**
 * Async emisor que elige el sistema según AUTH_SESSIONS_ENABLED:
 *   - true + user_sessions table presente → JWT firmado HMAC + DB-tracked
 *   - false (default) → base64 legacy (forjable, pero compatible con código viejo)
 */
export async function generateClienteTokenAsync(
  clienteId: number,
  opts?: { ip?: string; userAgent?: string },
): Promise<string> {
  if (USE_SIGNED_TOKENS) {
    try {
      return await signSessionJWT({
        userId: String(clienteId),
        scope: 'constructora',
        role: 'cliente',
        ttlSeconds: COOKIE_MAX_AGE,
        ip: opts?.ip,
        userAgent: opts?.userAgent,
      });
    } catch (e) {
      console.error('[cuenta-auth] signSessionJWT falló, fallback a legacy', e);
      // No bloquea el flow — si user_sessions table aún no se aplicó, caemos al legacy.
      return generateClienteToken(clienteId);
    }
  }
  return generateClienteToken(clienteId);
}

/**
 * Sync parser legacy — solo acepta el formato base64 viejo.
 * Para uso en código que no puede await. Si el token es JWT, retorna null.
 */
export function parseClienteToken(token: string): number | null {
  // Si parece JWT (3 partes con dots), NO es nuestro formato legacy
  if (token.split('.').length === 3) return null;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) return null;
    const idStr = decoded.substring(0, colonIdx);
    const random = decoded.substring(colonIdx + 1);
    if (random.length < 32) return null;
    const id = parseInt(idStr, 10);
    return Number.isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

/**
 * Async parser dual-mode. Acepta tanto JWT firmado nuevo como base64 legacy.
 * Es el path que usan los endpoints durante la transición.
 */
export async function parseClienteTokenAsync(token: string): Promise<number | null> {
  // 1. Intento JWT firmado (3 segmentos delimitados por ".")
  if (token.split('.').length === 3) {
    try {
      const session = await verifySessionJWT(token, 'constructora');
      if (!session) return null;
      const id = parseInt(session.userId, 10);
      return Number.isNaN(id) ? null : id;
    } catch (e) {
      console.error('[cuenta-auth] verifySessionJWT exception', e);
      return null;
    }
  }
  // 2. Fallback legacy
  return parseClienteToken(token);
}

/** Setea la cookie de sesión del cliente. Usar en /api/cuenta/auth. */
export async function setClienteSessionCookie(token: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

/** Borra la cookie de sesión (logout). */
export async function clearClienteSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

/**
 * Lee la sesión del cliente desde cookies/headers y valida contra DB.
 * Devuelve null si no hay token, token inválido, cliente inactivo, o cualquier
 * otro fallo. NUNCA throws — los callers asumen `null = no autenticado`.
 *
 * Acepta:
 *   - Cookie del portal (común)
 *   - Header Authorization: Bearer <token> (para APIs llamadas desde fuera del browser)
 */
export async function getClienteFromRequest(request?: NextRequest): Promise<ClienteSession | null> {
  let token: string | null = null;

  // 1. Header Authorization (móvil / API consumers).
  if (request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  // 2. Cookie (browser).
  if (!token) {
    const c = await cookies();
    token = c.get(COOKIE_NAME)?.value ?? null;
  }

  if (!token) return null;

  // Dual-mode parser: acepta JWT firmado nuevo o base64 legacy (audit fase 2A.1)
  const clienteId = await parseClienteTokenAsync(token);
  if (clienteId === null) return null;

  const { data, error } = await supabaseAdmin
    .from('clientes')
    .select('id, email, nombre, rut, empresa, telefono, activo')
    .eq('id', clienteId)
    .eq('activo', true)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.email) return null; // sin email no hay sesión válida

  return {
    id: data.id,
    email: data.email,
    nombre: data.nombre,
    rut: data.rut,
    empresa: data.empresa,
    telefono: data.telefono,
  };
}

/**
 * Helper para endpoints API: requiere cliente autenticado, devuelve 401
 * Response si no. Si autenticado, devuelve la sesión.
 */
export async function requireCliente(
  request: NextRequest,
): Promise<{ ok: true; cliente: ClienteSession } | { ok: false; response: Response }> {
  const cliente = await getClienteFromRequest(request);
  if (!cliente) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }
  return { ok: true, cliente };
}

/** Genera un reset_token criptográficamente fuerte. Persistir hasheado o no
 *  (decidimos no hashear porque es de un solo uso + se invalida al usarse,
 *  y el TTL corto + secret length compensan). */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex'); // 64 hex chars
}
