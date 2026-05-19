import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { sanitizeString, isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { getClienteFromRequest } from '@/lib/cuenta-auth';

/**
 * PUT /api/cuenta/perfil
 *
 * Actualiza datos personales del cliente logueado. NO permite cambiar email
 * (eso requiere flujo de verificación aparte que no incluimos en Sprint 3).
 *
 * Body soportado:
 *   { nombre?, telefono?, rut?, empresa?, direccion?, current_password?, new_password? }
 *
 * Si se incluye new_password, se requiere current_password para verificar.
 */

export const runtime = 'nodejs';
export const maxDuration = 15;

interface Body {
  nombre?: unknown;
  telefono?: unknown;
  rut?: unknown;
  empresa?: unknown;
  direccion?: unknown;
  current_password?: unknown;
  new_password?: unknown;
}

export async function PUT(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  const cliente = await getClienteFromRequest(request);
  if (!cliente) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const rl = rateLimit(`cuenta-perfil:${cliente.id}:${ip}`, { maxAttempts: 10, windowSeconds: 300 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiadas actualizaciones. Espera unos minutos.' }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.nombre === 'string') {
    const n = sanitizeString(body.nombre);
    if (!n || n.length < 2) {
      return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 });
    }
    update.nombre = n;
  }
  if (typeof body.telefono === 'string') update.telefono = sanitizeString(body.telefono) || null;
  if (typeof body.rut === 'string') update.rut = sanitizeString(body.rut) || null;
  if (typeof body.empresa === 'string') update.empresa = sanitizeString(body.empresa) || null;
  if (typeof body.direccion === 'string') update.direccion = sanitizeString(body.direccion) || null;

  // Cambio de password (opcional).
  if (typeof body.new_password === 'string' && body.new_password.length > 0) {
    const current = typeof body.current_password === 'string' ? body.current_password : '';
    const next = body.new_password;
    if (next.length < 8) {
      return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }, { status: 400 });
    }
    if (current.length < 6) {
      return NextResponse.json({ error: 'Debes ingresar tu contraseña actual' }, { status: 400 });
    }
    const { data: c } = await supabaseAdmin
      .from('clientes')
      .select('password_hash')
      .eq('id', cliente.id)
      .single();
    if (!c || !c.password_hash) {
      return NextResponse.json({ error: 'Cuenta sin password configurado' }, { status: 412 });
    }
    const matches = await bcrypt.compare(current, c.password_hash);
    if (!matches) {
      return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 401 });
    }
    update.password_hash = await bcrypt.hash(next, 10);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No hay cambios para guardar' }, { status: 400 });
  }

  const { error: updErr } = await supabaseAdmin
    .from('clientes')
    .update(update)
    .eq('id', cliente.id);

  if (updErr) {
    console.error('[cuenta-perfil-update-fail]', updErr);
    return NextResponse.json({ error: 'No se pudo actualizar el perfil' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
