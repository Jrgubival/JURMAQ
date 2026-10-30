import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { getClientIp, rateLimit } from '@jurmaq/shared/rate-limit';
import { huellaValida, registrarBaja } from '@/lib/baja-correos';

/**
 * POST /api/baja { huella } — deja de enviar correos automáticos a ese correo.
 * Es POST (botón en /baja/<huella>) y no un GET al abrir el enlace, para que
 * los antivirus de correo que visitan los enlaces no den de baja a nadie.
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const rl = rateLimit(`baja:${getClientIp(request)}`, { maxAttempts: 20, windowSeconds: 3600 });
  if (!rl.success) return NextResponse.json({ error: 'Demasiados intentos' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const huella = typeof body?.huella === 'string' ? body.huella.trim() : '';
  if (!huellaValida(huella)) return NextResponse.json({ error: 'Enlace inválido' }, { status: 400 });
  try {
    await registrarBaja(huella);
    return NextResponse.json({ ok: true });
  } catch {
    console.error('[baja-correos-fail]');
    return NextResponse.json({ error: 'No pudimos registrar la baja. Escríbenos a contacto@jurmaq.cl.' }, { status: 500 });
  }
}
