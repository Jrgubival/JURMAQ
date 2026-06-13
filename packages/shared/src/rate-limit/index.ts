/**
 * Simple in-memory rate limiter for auth routes.
 * Tracks requests by IP address with a sliding window.
 */

import { env } from '@jurmaq/shared/env';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  /** Maximum number of requests allowed in the window */
  maxAttempts: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /**
   * Si un error de DB inesperado impide contar, ¿denegar (fail-closed) en vez
   * de permitir (fail-open)? Default false (fail-open, mejor UX en endpoints
   * no sensibles). Poner true SOLO en paths críticos como el login admin, donde
   * permitir intentos ilimitados durante un incidente de DB es peor que negar.
   */
  failClosedOnError?: boolean;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Auto-prefix por scope para aislar contadores entre apps.
 *
 * El store es in-memory por lambda; en serverless cada cold start arranca con
 * Map vacío. Aún así, si barraca y constructora corren en el MISMO proceso
 * (dev local, o un edge worker compartido en el futuro), key colisiones tipo
 * `cot-create:1.2.3.4` podrían contar requests de una app contra el límite
 * de la otra. El prefijo del scope evita eso sin que cada call site tenga
 * que recordar agregarlo.
 *
 * Lee `AUTH_SCOPE` del env (lo seteamos por app en .env.local + Vercel).
 * Si no está, fallback a 'app' — comportamiento idéntico al pre-prefix
 * para compat hacia atrás durante el rollout.
 */
function getScopePrefix(): string {
  const scope = env.AUTH_SCOPE;
  return scope === 'barraca' || scope === 'constructora' ? scope : 'app';
}

export function rateLimit(
  key: string,
  options: RateLimitOptions = { maxAttempts: 10, windowSeconds: 60 }
): RateLimitResult {
  const scopedKey = `${getScopePrefix()}:${key}`;
  const now = Date.now();
  const entry = store.get(scopedKey);

  if (!entry || now > entry.resetAt) {
    // First request or window expired
    store.set(scopedKey, {
      count: 1,
      resetAt: now + options.windowSeconds * 1000,
    });
    return { success: true, remaining: options.maxAttempts - 1, resetAt: now + options.windowSeconds * 1000 };
  }

  if (entry.count >= options.maxAttempts) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { success: true, remaining: options.maxAttempts - entry.count, resetAt: entry.resetAt };
}

/**
 * Extract client IP from a NextRequest.
 * Uses x-forwarded-for (set by proxies/Vercel) or falls back to x-real-ip.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Persistent (DB-backed) rate limit. Para endpoints sensibles donde el
 * rate-limit en memoria de proceso (rateLimit) NO sirve por el modelo
 * serverless de Vercel — cada lambda tiene su propio Map y los contadores
 * no se comparten. Login admin usa esta version para que aunque MP active
 * 10 lambdas en paralelo, el limite se aplica a nivel global.
 *
 * Requiere migrate-rate-limit-persistente.sql aplicada (crea tabla y
 * funcion `rate_limit_check_and_increment`). Si la migracion no esta
 * aplicada, hace fallback al rateLimit() en memoria (degradado pero
 * funcional). En ningun caso el endpoint que lo usa falla por esto.
 */
// Wider supabaseAdmin shape: the real SupabaseClient.rpc returns a
// PostgrestFilterBuilder which IS thenable (resolves to {data, error}) but its
// TypeScript signature doesn't match a plain `Promise<...>`. Using a permissive
// rpc return type avoids type friction without changing runtime behavior.
type SupabaseRpcShape = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

export async function rateLimitPersistent(
  supabaseAdmin: SupabaseRpcShape,
  key: string,
  options: RateLimitOptions = { maxAttempts: 10, windowSeconds: 60 }
): Promise<RateLimitResult> {
  // Mismo namespace que el limiter en memoria — barraca y constructora no
  // compiten por el mismo contador en DB aunque usen la misma key lógica.
  const scopedKey = `${getScopePrefix()}:${key}`;
  try {
    const { data, error } = await supabaseAdmin.rpc('rate_limit_check_and_increment', {
      p_key: scopedKey,
      p_max_attempts: options.maxAttempts,
      p_window_seconds: options.windowSeconds,
    });
    if (error) {
      // Funcion no existe (PGRST202) o tabla missing → fallback al limiter en memoria.
      const code = error.code || '';
      const msg = error.message || '';
      if (code === 'PGRST202' || /rate_limit_check_and_increment|rate_limit_attempts/.test(msg)) {
        console.warn('[rate-limit] funcion DB no existe, fallback a limiter en memoria. Ejecuta migrate-rate-limit-persistente.sql');
        return rateLimit(key, options);
      }
      // Otros errores DB inesperados. En paths críticos (failClosedOnError)
      // denegamos; en el resto fail-open (mejor permitir que bloquear todo).
      if (options.failClosedOnError) {
        console.error('[rate-limit] error DB, FAIL-CLOSED (path crítico):', error);
        return { success: false, remaining: 0, resetAt: Date.now() + options.windowSeconds * 1000 };
      }
      console.error('[rate-limit] error DB, fail-open:', error);
      return { success: true, remaining: options.maxAttempts, resetAt: Date.now() + options.windowSeconds * 1000 };
    }
    // data es un array por la signatura RETURNS TABLE de la funcion.
    const row = Array.isArray(data) ? (data as Array<{ count: number; reset_at: string; allowed: boolean }>)[0] : null;
    if (!row) {
      return rateLimit(key, options);
    }
    const resetAtMs = new Date(row.reset_at).getTime();
    return {
      success: row.allowed,
      remaining: Math.max(0, options.maxAttempts - row.count),
      resetAt: resetAtMs,
    };
  } catch (err) {
    console.error('[rate-limit] excepcion no esperada, fallback memoria:', err);
    return rateLimit(key, options);
  }
}
