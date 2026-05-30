import { NextRequest, NextResponse } from 'next/server';
import { dispatchOtp } from '@jurmaq/shared/otp';
import type { OtpContexto } from '@jurmaq/shared/otp';
import { getClientIp, rateLimitPersistent } from '@jurmaq/shared/rate-limit';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { supabaseAdmin } from '@jurmaq/shared/supabase';

/**
 * POST /api/otp/enviar
 *
 * Endpoint genérico para iniciar un flujo OTP. Selecciona canal vía
 * dispatcher (whatsapp → sms → email) y persiste el código (bcrypt hash)
 * en otp_codigos.
 *
 * Body:
 *   {
 *     destino: string,          // email o +56XXXXXXXXX
 *     contexto: 'firma_contrato' | 'garantia_klap' | 'tarjeta_cambio' | 'reset_password' | 'login_2fa' | 'verificacion_email',
 *     contextoId?: string,      // ej. número de contrato
 *     canalPreferido?: 'whatsapp' | 'sms' | 'email',
 *     vars?: Record<string, string|number>   // ej. { nombre, numero, monto, last4 }
 *   }
 *
 * Response 200:
 *   { ok: true, canal: 'whatsapp', provider: 'openwa', expiraEnSeg: 300 }
 *
 * Response 400/429/500 con `{ ok:false, error: string }`.
 *
 * Rate limit: 3 OTP por (destino, contexto) cada 5 minutos. Evita abuso
 * vía resend / spam.
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

const CONTEXTOS_VALIDOS: OtpContexto[] = [
  'firma_contrato',
  'garantia_klap',
  'tarjeta_cambio',
  'reset_password',
  'login_2fa',
  'verificacion_email',
];

interface Body {
  destino?: unknown;
  contexto?: unknown;
  contextoId?: unknown;
  canalPreferido?: unknown;
  vars?: unknown;
}

export async function POST(request: NextRequest) {
  // CSRF / origin check.
  if (!isValidOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Origen inválido' }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Body inválido' }, { status: 400 });
  }

  const destino = typeof body.destino === 'string' ? body.destino.trim() : '';
  const contexto = typeof body.contexto === 'string' ? body.contexto : '';
  if (!destino) {
    return NextResponse.json({ ok: false, error: 'destino es requerido' }, { status: 400 });
  }
  if (!CONTEXTOS_VALIDOS.includes(contexto as OtpContexto)) {
    return NextResponse.json({ ok: false, error: 'contexto inválido' }, { status: 400 });
  }

  // Rate limit: 3 envíos por destino+contexto en 5 min. Persistente (DB) para
  // que el límite valga en serverless (cae a in-memory si falta la migración).
  const ip = getClientIp(request);
  const rl = await rateLimitPersistent(supabaseAdmin, `otp-enviar:${destino}:${contexto}`, { maxAttempts: 3, windowSeconds: 300 });
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: 'Demasiadas solicitudes. Espera unos minutos.' },
      { status: 429 },
    );
  }

  // Vars y canalPreferido son opcionales.
  const vars =
    body.vars && typeof body.vars === 'object'
      ? (body.vars as Record<string, string | number>)
      : undefined;
  const canalPreferido =
    body.canalPreferido === 'whatsapp' || body.canalPreferido === 'sms' || body.canalPreferido === 'email'
      ? body.canalPreferido
      : undefined;
  const contextoId =
    typeof body.contextoId === 'string' && body.contextoId.trim()
      ? body.contextoId.trim()
      : undefined;

  const result = await dispatchOtp(
    {
      destino,
      contexto: contexto as OtpContexto,
      contextoId,
      canalPreferido,
      vars,
    },
    {
      ip,
      userAgent: request.headers.get('user-agent') ?? undefined,
    },
  );

  if (!result.ok) {
    console.error('[otp-enviar-fail]', {
      destino: destino.includes('@') ? destino.replace(/(.{2}).*(@.*)/, '$1***$2') : destino.slice(0, 4) + '***',
      contexto,
      intentos: result.intentos,
    });
    return NextResponse.json({ ok: false, error: result.error || 'No se pudo enviar OTP' }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    canal: result.canalUsado,
    provider: result.provider,
    fallbackUsed: result.fallbackUsed || false,
    expiraEnSeg: 300,
  });
}
