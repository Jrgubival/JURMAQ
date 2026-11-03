import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@jurmaq/shared/rate-limit';
import { huellaValida, origenValido, registrarBaja } from '@/lib/baja-correos';

/**
 * POST /api/baja/<huella>?o=<origen> — baja "de un clic" (RFC 8058), la que
 * usa Gmail con el encabezado List-Unsubscribe-Post de las campañas.
 *
 * Sin chequeo de origen a propósito: el POST lo hace el servidor de correo,
 * no la tienda. Lo protege la huella (HMAC de 256 bits del correo: no se puede
 * adivinar ni sacar el correo de ella). Sólo POST: un GET (antivirus que
 * visitan enlaces) no da de baja a nadie. Responde igual exista o no la huella.
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ huella: string }> }) {
  const rl = rateLimit(`baja-1clic:${getClientIp(request)}`, { maxAttempts: 30, windowSeconds: 3600 });
  if (!rl.success) return NextResponse.json({ error: 'Demasiados intentos' }, { status: 429 });
  const { huella } = await params;
  if (!huellaValida(huella)) return NextResponse.json({ error: 'Enlace inválido' }, { status: 400 });
  try {
    await registrarBaja(huella, origenValido(request.nextUrl.searchParams.get('o')) ?? 'un-clic');
    return NextResponse.json({ ok: true });
  } catch {
    console.error('[baja-un-clic-fail]');
    return NextResponse.json({ error: 'No pudimos registrar la baja' }, { status: 500 });
  }
}
