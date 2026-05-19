import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest } from 'next/server';

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

export function generateClienteToken(clienteId: number): string {
  const random = crypto.randomBytes(32).toString('hex');
  return Buffer.from(`${clienteId}:${random}`).toString('base64');
}

export function parseClienteToken(token: string): number | null {
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

  const clienteId = parseClienteToken(token);
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
