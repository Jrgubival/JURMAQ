import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { getClientIp, rateLimit } from '@jurmaq/shared/rate-limit';
import { validarCupon } from '@/lib/cupones';

/**
 * POST /api/public/cupones/validar
 *
 * Body: { codigo, monto_compra, email }
 * Response: { ok: true, descuento, descripcion } | { ok: false, error }
 *
 * Valida sin "consumir" — solo chequea reglas.
 * El uso real se registra al momento de crear la cotización.
 */

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Origen no autorizado' }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rl = rateLimit(`cupon-validar:${ip}`, { maxAttempts: 20, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: 'Demasiadas validaciones' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const codigo = sanitizeString(body?.codigo) || '';
  const monto = Number(body?.monto_compra) || 0;
  const email = sanitizeString(body?.email) || '';

  const resultado = await validarCupon({ codigo, monto, email });
  if (!resultado.ok) {
    return NextResponse.json({ ok: false, error: resultado.error }, { status: resultado.status });
  }

  return NextResponse.json({
    ok: true,
    cupon_id: resultado.cupon_id,
    codigo: resultado.codigo,
    descripcion: resultado.descripcion,
    descuento: resultado.descuento,
    monto_final: resultado.monto_final,
  });
}
