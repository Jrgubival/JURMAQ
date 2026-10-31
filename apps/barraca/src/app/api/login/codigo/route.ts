import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { NextRequest, NextResponse, after } from 'next/server';
import { z } from '@jurmaq/shared/validation';
import { getClientIp } from '@jurmaq/shared/rate-limit';
import {
  MENSAJE_CODIGO_ENVIADO,
  esScopeBarraca,
  solicitarCodigo,
} from '@jurmaq/shared/auth/codigo-correo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cuerpo = z.object({ email: z.string().max(254) }).strict();

/**
 * POST /api/login/codigo — paso 1 del login del panel: pide un código por
 * correo. Siempre la misma respuesta exista o no el correo (el envío real
 * corre con after(), después de responder).
 */
export async function POST(req: NextRequest) {
  if (!isValidOrigin(req)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  if (!esScopeBarraca()) {
    return NextResponse.json({ error: 'No disponible' }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Escribe un correo válido.' }, { status: 400 });
  }
  const parsed = cuerpo.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Escribe un correo válido.' }, { status: 400 });
  }

  const r = await solicitarCodigo(parsed.data.email, getClientIp(req));
  if (!r.ok) {
    if (r.motivo === 'limite') {
      return NextResponse.json(
        { error: 'Pediste muchos códigos. Espera unos minutos y vuelve a intentar.' },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: 'Escribe un correo válido.' }, { status: 400 });
  }

  after(r.continuar);
  return NextResponse.json({ ok: true, mensaje: MENSAJE_CODIGO_ENVIADO });
}
