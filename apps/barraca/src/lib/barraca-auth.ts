import 'server-only';
import { verifyToken as verifySessionJWT } from '@jurmaq/shared/auth/session-token';
import { env } from '@jurmaq/shared/env';

/**
 * Shared parser dual-mode para tokens de barraca (audit fase 2A.1).
 *
 * Reemplaza las copias inline de `parseToken(token: string)` en cada endpoint
 * `apps/barraca/src/app/api/cuenta/*`. Esa duplicación tenía dos problemas:
 *
 *  1. Cada copia solo entendía el formato LEGACY base64("userId:random64"),
 *     forjable trivialmente.
 *  2. Al migrar a JWT firmado HMAC (Fase 2A.1), había que tocar 5+ archivos.
 *     Esta función centraliza la lógica.
 *
 * Acepta AMBOS formatos durante la transición:
 *  - JWT firmado (3 segmentos delimitados por "."): verifica firma HMAC +
 *    DB lookup en `user_sessions` + scope check 'barraca'.
 *  - base64 legacy: parsea "id:random", solo retorna id si random.length >= 32.
 *
 * Importante: el legacy es FORJABLE. La migración a JWT se activa al setear
 * `AUTH_SESSIONS_ENABLED=true` + aplicar `migrate-user-sessions.sql`. Hasta
 * entonces ambos formatos funcionan, después de la activación los tokens
 * legacy quedan invalidados al expirar y el JWT es el único path seguro.
 */
export async function parseBarracaUserToken(token: string): Promise<number | null> {
  if (!token || typeof token !== 'string') return null;

  // JWT firmado
  if (token.split('.').length === 3) {
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

  // Legacy base64 "id:random" → FORJABLE. Audit 1.2: solo se acepta mientras
  // AUTH_SESSIONS_ENABLED esté apagado. Con el flag encendido (Fase 0 aplicada)
  // se rechaza → cierra la impersonación. Fail-safe: la emisión también pasa a
  // firmada con el mismo flag, así que desplegar con el flag apagado no cambia nada.
  if (env.AUTH_SESSIONS_ENABLED) return null;
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

/** Extrae token desde header Authorization: Bearer XXX */
export function extractBearerToken(request: { headers: { get(name: string): string | null } }): string | null {
  const auth = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!auth) return null;
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim() || null;
}
