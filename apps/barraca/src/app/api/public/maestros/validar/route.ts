import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { getClientIp, rateLimit } from '@jurmaq/shared/rate-limit';

/**
 * POST /api/public/maestros/validar
 *
 * Body: { codigo }
 * Response: { ok: true, maestro_id, nombre } | { ok: false, error }
 *
 * Valida que el código MAE-YYYY-NNN existe + está activo. NO expone
 * datos bancarios ni RUT — solo lo mínimo para confirmar al usuario
 * que el maestro existe.
 *
 * Tier 2 B1: usado en /carrito y /cotizar para asignar referido.
 */

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Origen no autorizado' }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rl = rateLimit(`maestro-validar:${ip}`, { maxAttempts: 30, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: 'Demasiadas validaciones' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const codigo = sanitizeString(body?.codigo)?.toUpperCase().trim() || '';

  if (!codigo || !/^MAE-[0-9]{4}-[0-9]+$/.test(codigo)) {
    return NextResponse.json(
      { ok: false, error: 'Formato inválido (esperado: MAE-AAAA-NNN)' },
      { status: 400 },
    );
  }

  const { data: maestro, error } = await supabaseAdmin
    .from('maestros')
    .select('id, codigo, nombre, activo')
    .eq('codigo', codigo)
    .maybeSingle();

  if (error) {
    console.error('[maestro-validar-fail]', error);
    return NextResponse.json({ ok: false, error: 'Error validando código' }, { status: 500 });
  }
  if (!maestro || !maestro.activo) {
    return NextResponse.json(
      { ok: false, error: 'Código no encontrado o inactivo' },
      { status: 404 },
    );
  }

  // OJO: solo devolvemos nombre + id. NO devolvemos rut/email/banco.
  return NextResponse.json({
    ok: true,
    maestro_id: maestro.id,
    codigo: maestro.codigo,
    nombre: maestro.nombre,
  });
}
