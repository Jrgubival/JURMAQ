import 'server-only';
import { verifyToken as verifySessionJWT } from '@jurmaq/shared/auth/session-token';

/**
 * Parser de tokens del portal de clientes de barraca.
 *
 * SOLO acepta JWT firmados HMAC con sesión vigente en `user_sessions` (scope
 * 'barraca'). La rama legacy base64("id:random") se ELIMINÓ (audit jun-2026,
 * hallazgo C-1): era FORJABLE — cualquiera podía impersonar a un cliente por
 * su id secuencial y leer su PII. Ahora es fail-closed: un flag apagado o un
 * error transitorio ya no pueden reabrir el vector.
 */
export async function parseBarracaUserToken(token: string): Promise<number | null> {
  if (!token || typeof token !== 'string') return null;
  if (token.split('.').length !== 3) return null;
  try {
    const session = await verifySessionJWT(token, 'barraca');
    if (!session) return null;
    const id = parseInt(session.userId, 10);
    return Number.isNaN(id) ? null : id;
  } catch (err) {
    console.error('[parseBarracaUserToken] verifySessionJWT exception', err);
    return null;
  }
}

/** Extrae token desde header Authorization: Bearer XXX */
export function extractBearerToken(request: { headers: { get(name: string): string | null } }): string | null {
  const auth = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!auth) return null;
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim() || null;
}
