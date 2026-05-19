import { NextRequest, NextResponse } from 'next/server';
import { verifyOtp } from '@jurmaq/shared/otp';
import type { OtpContexto } from '@jurmaq/shared/otp';
import { getClientIp, rateLimit } from '@jurmaq/shared/rate-limit';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

/**
 * POST /api/otp/verificar
 *
 * Body: { destino, codigo, contexto, contextoId? }
 * Response 200: { ok: true } | { ok: false, error: string, intentos_usados?: number }
 *
 * Comparación bcrypt constant-time. Incrementa `intentos` en cada fallo y
 * bloquea al 3er intento (configurable en otp_codigos.max_intentos).
 *
 * Rate-limit: 10 intentos por (destino, contexto) cada 5 min. Esto es además
 * del max_intentos del código, para evitar attackers que abren múltiples
 * códigos en paralelo.
 */

export const runtime = 'nodejs';
export const maxDuration = 15;

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
  codigo?: unknown;
  contexto?: unknown;
  contextoId?: unknown;
}

export async function POST(request: NextRequest) {
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
  const codigo = typeof body.codigo === 'string' ? body.codigo.trim() : '';
  const contexto = typeof body.contexto === 'string' ? body.contexto : '';
  const contextoId = typeof body.contextoId === 'string' ? body.contextoId.trim() : undefined;

  if (!destino || !codigo) {
    return NextResponse.json({ ok: false, error: 'destino y codigo son requeridos' }, { status: 400 });
  }
  if (!/^\d{4,8}$/.test(codigo)) {
    return NextResponse.json({ ok: false, error: 'Código inválido' }, { status: 400 });
  }
  if (!CONTEXTOS_VALIDOS.includes(contexto as OtpContexto)) {
    return NextResponse.json({ ok: false, error: 'contexto inválido' }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rl = rateLimit(`otp-verificar:${destino}:${contexto}:${ip}`, { maxAttempts: 10, windowSeconds: 300 });
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: 'Demasiados intentos. Espera unos minutos.' },
      { status: 429 },
    );
  }

  const result = await verifyOtp({
    destino,
    codigo,
    contexto: contexto as OtpContexto,
    contextoId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, intentos_usados: result.intentos_usados },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
