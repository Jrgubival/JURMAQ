import 'server-only';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@jurmaq/shared/env';
import { rateLimit, rateLimitPersistent } from '../rate-limit';
import { maskEmail, maskIp } from '../logging';
import { generateOtpCode } from '../otp/codigo';

/**
 * Login del panel de barraca.jurmaq.cl con código por correo (nov-2026).
 * Sin contraseña y sin Google. SÓLO se usa cuando AUTH_SCOPE === 'barraca';
 * jurmaq.cl (constructora) sigue con sus providers de siempre.
 *
 * - Sólo pueden entrar los correos de LOGIN_BARRACA_PERMITIDOS que además
 *   existan en public.users (columna `email`, nunca `sso_email`) con scope
 *   'barraca' o 'both'.
 * - Al resto no se le manda nada, pero la respuesta es la misma (sin
 *   enumeración de usuarios): el trabajo real corre después de responder.
 * - Se guardan sólo hashes HMAC-SHA256 (AUTH_SECRET) del correo y del código.
 * - Código: 6 dígitos, 10 minutos, un solo uso, 5 intentos fallidos y muere.
 * - Límites: envío ≤3 por correo y ≤10 por IP cada 15 min; verificación ≤10
 *   por IP cada 15 min. Si el límite no se puede evaluar → se deniega.
 *
 * Desarrollo (PEDIDOS_STORE=archivo, nunca en producción): los códigos van a
 * `.login-codigos-dev.json`, los límites quedan en memoria (no se escribe en
 * la base de producción), no se manda correo y el código se muestra en la
 * consola del servidor y en `.login-codigos-dev-ultimo.txt`.
 */

export const LOGIN_BARRACA_PERMITIDOS: readonly string[] = [
  'contacto@jurmaq.cl',
  'barracajurmaq@gmail.com',
];

export const MENSAJE_CODIGO_ENVIADO = 'Si el correo tiene acceso, te llegó un código.';

const TTL_SEGUNDOS = 10 * 60;
const MAX_INTENTOS = 5;
const VENTANA_LIMITES = 15 * 60;

const ARCHIVO_CODIGOS = path.join(process.cwd(), '.login-codigos-dev.json');
const ARCHIVO_ULTIMO = path.join(process.cwd(), '.login-codigos-dev-ultimo.txt');

export function esScopeBarraca(): boolean {
  return env.AUTH_SCOPE?.trim().toLowerCase() === 'barraca';
}

/** trim + minúsculas + formato básico. null si no es un correo. */
export function normalizarCorreo(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const email = valor.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return null;
  return email;
}

function hmac(etiqueta: string, valor: string): string {
  return crypto
    .createHmac('sha256', env.AUTH_SECRET)
    .update(`barraca-login:${etiqueta}:${valor}`)
    .digest('hex');
}

const hashCorreo = (email: string) => hmac('email', email);
// El hash del código va atado al correo: el mismo código de otro correo no sirve.
const hashCodigo = (emailHash: string, codigo: string) => hmac('codigo', `${emailHash}:${codigo}`);
const hashIp = (ip: string) => hmac('ip', ip).slice(0, 32);

function esProduccion(): boolean {
  return (
    process.env.VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'production'
  );
}

/** Store de archivo sólo en desarrollo con PEDIDOS_STORE=archivo. */
function usarArchivo(): boolean {
  if (env.PEDIDOS_STORE !== 'archivo') return false;
  if (esProduccion()) throw new Error('login-codigo: store de archivo no permitido en producción');
  return true;
}

// Las funciones RPC nuevas aún no están en db-types (migración sin aplicar).
async function db(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import('../supabase');
  return supabaseAdmin as unknown as SupabaseClient;
}

/** true = permitido. Cualquier error → false (fail-closed). */
async function dentroDelLimite(clave: string, max: number): Promise<boolean> {
  try {
    if (usarArchivo()) {
      return rateLimit(clave, { maxAttempts: max, windowSeconds: VENTANA_LIMITES }).success;
    }
    const r = await rateLimitPersistent(await db(), clave, {
      maxAttempts: max,
      windowSeconds: VENTANA_LIMITES,
      failClosedOnError: true,
    });
    return r.success;
  } catch {
    return false;
  }
}

// --- Store de desarrollo (archivo) -------------------------------------------

type FilaCodigo = {
  id: number;
  email_hash: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  used_at: string | null;
  created_at: string;
  ip_hash: string | null;
};

function leerArchivo(): FilaCodigo[] {
  try {
    return JSON.parse(fs.readFileSync(ARCHIVO_CODIGOS, 'utf8')) as FilaCodigo[];
  } catch {
    return [];
  }
}

function escribirArchivo(filas: FilaCodigo[]): void {
  fs.writeFileSync(ARCHIVO_CODIGOS, JSON.stringify(filas, null, 2));
}

// Lectura-modificación-escritura síncrona: atómica dentro del proceso de dev.
function crearEnArchivo(emailHash: string, codeHash: string, ipHash: string): void {
  const ahora = Date.now();
  const filas = leerArchivo()
    .filter((f) => ahora - Date.parse(f.created_at) < 24 * 3600 * 1000)
    .map((f) => (f.email_hash === emailHash && !f.used_at ? { ...f, used_at: new Date(ahora).toISOString() } : f));
  filas.push({
    id: filas.reduce((m, f) => Math.max(m, f.id), 0) + 1,
    email_hash: emailHash,
    code_hash: codeHash,
    expires_at: new Date(ahora + TTL_SEGUNDOS * 1000).toISOString(),
    attempts: 0,
    used_at: null,
    created_at: new Date(ahora).toISOString(),
    ip_hash: ipHash,
  });
  escribirArchivo(filas);
}

function consumirEnArchivo(emailHash: string, codeHash: string): boolean {
  const ahora = Date.now();
  const filas = leerArchivo();
  const fila = filas
    .filter(
      (f) =>
        f.email_hash === emailHash &&
        !f.used_at &&
        Date.parse(f.expires_at) > ahora &&
        f.attempts < MAX_INTENTOS,
    )
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  if (!fila) return false;
  const ok = crypto.timingSafeEqual(Buffer.from(fila.code_hash), Buffer.from(codeHash));
  if (ok) {
    fila.used_at = new Date(ahora).toISOString();
  } else {
    fila.attempts += 1;
    if (fila.attempts >= MAX_INTENTOS) fila.used_at = new Date(ahora).toISOString();
  }
  escribirArchivo(filas);
  return ok;
}

// --- Store real (Supabase, migración 2026_11_01_barraca_login_codigo.sql) ----

async function crearCodigo(emailHash: string, codeHash: string, ipHash: string): Promise<void> {
  if (usarArchivo()) return crearEnArchivo(emailHash, codeHash, ipHash);
  const { error } = await (await db()).rpc('barraca_login_codigo_crear', {
    p_email_hash: emailHash,
    p_code_hash: codeHash,
    p_ip_hash: ipHash,
    p_ttl_seconds: TTL_SEGUNDOS,
  });
  if (error) throw new Error('login-codigo: no se pudo guardar el código');
}

async function consumirCodigo(emailHash: string, codeHash: string): Promise<boolean> {
  if (usarArchivo()) return consumirEnArchivo(emailHash, codeHash);
  const { data, error } = await (await db()).rpc('barraca_login_codigo_consumir', {
    p_email_hash: emailHash,
    p_code_hash: codeHash,
    p_max_intentos: MAX_INTENTOS,
  });
  if (error) return false;
  return data === true;
}

// --- Usuarios -----------------------------------------------------------------

export type UsuarioBarraca = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  scope: 'barraca' | 'both';
};

/** Fila de public.users por `email` exacto (no sso_email), scope barraca|both, en la allowlist. */
async function buscarUsuario(email: string): Promise<UsuarioBarraca | null> {
  if (!LOGIN_BARRACA_PERMITIDOS.includes(email)) return null;
  const { data, error } = await (await db())
    .from('users')
    .select('id, name, email, role, scope')
    .eq('email', email)
    .in('scope', ['barraca', 'both'])
    .maybeSingle();
  if (error || !data) return null;
  const fila = data as { id: string | number; name: string | null; email: string; role: string; scope: string };
  if (fila.email !== email || (fila.scope !== 'barraca' && fila.scope !== 'both')) return null;
  return {
    id: String(fila.id),
    name: fila.name,
    email: fila.email,
    role: fila.role,
    scope: fila.scope,
  };
}

// --- API ----------------------------------------------------------------------

export type ResultadoSolicitud =
  | { ok: true; continuar: () => Promise<void> }
  | { ok: false; motivo: 'invalido' | 'limite' };

/**
 * Paso 1. Valida el correo y los límites (iguales para cualquier correo, así
 * la respuesta no delata si existe). Devuelve `continuar`, que hace el
 * trabajo real (buscar usuario, guardar código, mandar correo) y que el
 * route handler corre con `after()` DESPUÉS de responder, para que el tiempo
 * de respuesta sea el mismo exista o no el correo.
 */
export async function solicitarCodigo(emailCrudo: unknown, ip: string): Promise<ResultadoSolicitud> {
  const email = normalizarCorreo(emailCrudo);
  if (!email) return { ok: false, motivo: 'invalido' };
  const emailHash = hashCorreo(email);
  const ipHash = hashIp(ip);

  const porIp = await dentroDelLimite(`login-codigo-envio-ip:${ipHash}`, 10);
  const porCorreo = porIp && (await dentroDelLimite(`login-codigo-envio-correo:${emailHash}`, 6));
  if (!porIp || !porCorreo) {
    console.warn('[login-codigo] envío limitado', { email: maskEmail(email), ip: maskIp(ip) });
    return { ok: false, motivo: 'limite' };
  }

  return {
    ok: true,
    continuar: async () => {
      try {
        const usuario = await buscarUsuario(email);
        if (!usuario) {
          console.info('[login-codigo] correo sin acceso, no se envía', { email: maskEmail(email) });
          return;
        }
        const codigo = generateOtpCode();
        await crearCodigo(emailHash, hashCodigo(emailHash, codigo), ipHash);

        if (usarArchivo() && !esProduccion()) {
          // SÓLO desarrollo local: no se manda correo; el código queda a mano.
          console.log(`\n[login-codigo DEV] código para ${maskEmail(email)}: ${codigo}\n`);
          fs.writeFileSync(ARCHIVO_ULTIMO, `${codigo}\n`);
          return;
        }

        const { sendLoginBarracaEmail } = await import('../mail/templates/login-barraca');
        const r = await sendLoginBarracaEmail(email, codigo);
        console.info('[login-codigo] código enviado', { email: maskEmail(email), ok: r.success });
      } catch {
        console.error('[login-codigo] no se pudo generar/enviar el código', { email: maskEmail(email) });
      }
    },
  };
}

export type ResultadoVerificacion =
  | { ok: true; usuario: UsuarioBarraca }
  | { ok: false; motivo: 'invalido' | 'limite' };

/** Paso 2. Verifica y consume el código (un solo uso). */
export async function verificarCodigo(
  emailCrudo: unknown,
  codigoCrudo: unknown,
  ip: string,
): Promise<ResultadoVerificacion> {
  const ipHash = hashIp(ip);
  if (!(await dentroDelLimite(`login-codigo-verifica-ip:${ipHash}`, 10))) {
    console.warn('[login-codigo] verificación limitada', { ip: maskIp(ip) });
    return { ok: false, motivo: 'limite' };
  }

  const email = normalizarCorreo(emailCrudo);
  const codigo = typeof codigoCrudo === 'string' ? codigoCrudo.trim() : '';
  if (!email || !/^\d{6}$/.test(codigo)) return { ok: false, motivo: 'invalido' };

  const emailHash = hashCorreo(email);
  let ok = false;
  try {
    ok = await consumirCodigo(emailHash, hashCodigo(emailHash, codigo));
  } catch {
    ok = false;
  }
  if (!ok) {
    console.warn('[login-codigo] código incorrecto o vencido', { email: maskEmail(email), ip: maskIp(ip) });
    return { ok: false, motivo: 'invalido' };
  }

  const usuario = await buscarUsuario(email).catch(() => null);
  if (!usuario) return { ok: false, motivo: 'invalido' };
  console.log('[admin-login-ok]', { user: usuario.id, email: maskEmail(email), ip: maskIp(ip), provider: 'codigo-correo' });
  return { ok: true, usuario };
}
