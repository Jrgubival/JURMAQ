import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requireRole, forbiddenResponse, unauthorizedResponse } from '@jurmaq/shared/auth/guard';
import { isValidRole } from '@jurmaq/shared/roles';
import { sanitizeString, isValidEmail, isValidOrigin } from '@jurmaq/shared/sanitize';

/**
 * PUT /api/admin/usuarios/[id]
 * Update name, email, role, and/or password of a user.
 * Only `admin` can modify other users.
 *
 * Self-protection: an admin cannot demote themselves to a non-admin role
 * (would lock themselves out of user management). Different admin can do it.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) {
    return forbiddenResponse('Origen no autorizado');
  }
  const session = await requireRole(['admin']);
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 });
  }

  // Look up target user.
  const { data: target } = await supabaseAdmin
    .from('users')
    .select('id, email, role')
    .eq('id', userId)
    .single();
  if (!target) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const sessionUserId = parseInt(String((session.user as { id?: string }).id || '0'), 10);
  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined || body.nombre !== undefined) {
    const name = sanitizeString(body.name ?? body.nombre);
    if (!name) return NextResponse.json({ error: 'Nombre invalido' }, { status: 400 });
    updateData.name = name;
  }

  if (body.email !== undefined) {
    const email = sanitizeString(body.email)?.toLowerCase();
    if (!email || !isValidEmail(email))
      return NextResponse.json({ error: 'Email invalido' }, { status: 400 });
    if (email !== target.email) {
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', userId)
        .maybeSingle();
      if (existing)
        return NextResponse.json({ error: 'El email ya esta en uso' }, { status: 409 });
    }
    updateData.email = email;
  }

  let roleChange: { previous: string; next: string } | null = null;
  if (body.role !== undefined) {
    if (!isValidRole(body.role)) {
      return NextResponse.json({ error: 'Rol invalido' }, { status: 400 });
    }
    // Self-protection: can't demote yourself out of admin.
    if (sessionUserId === userId && target.role === 'admin' && body.role !== 'admin') {
      return NextResponse.json(
        { error: 'No puedes quitarte el rol de admin a ti mismo. Pide a otro admin que lo haga.' },
        { status: 400 }
      );
    }
    if (body.role !== target.role) {
      roleChange = { previous: target.role, next: body.role };
    }
    updateData.role = body.role;
  }

  if (typeof body.password === 'string' && body.password.length > 0) {
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      );
    }
    if (!/[A-Z]/.test(body.password) || !/[0-9]/.test(body.password)) {
      return NextResponse.json(
        { error: 'La contraseña debe incluir al menos una mayúscula y un número' },
        { status: 400 }
      );
    }
    updateData.password = await bcrypt.hash(body.password, 10);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updateData)
    .eq('id', userId)
    .select('id, name, email, role, created_at')
    .single();

  if (error || !data) {
    console.error('[usuarios-update]', error);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }

  // Audit log para cambios de rol — append-only, table protegida por RLS
  // (ver scripts/migrate-role-change-log.sql). Si la tabla no existe aún,
  // el insert falla silencioso para no bloquear la mutación principal.
  if (roleChange) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || null;
    const ua = request.headers.get('user-agent')?.slice(0, 500) || null;
    const reason = typeof body.reason === 'string' ? sanitizeString(body.reason) : null;
    await supabaseAdmin.from('role_change_log').insert({
      target_user_id: userId,
      target_user_email: target.email,
      previous_role: roleChange.previous,
      new_role: roleChange.next,
      changed_by_user_id: sessionUserId || null,
      changed_by_email: (session.user as { email?: string }).email || 'unknown',
      reason,
      ip_address: ip,
      user_agent: ua,
    }).then(({ error: logErr }) => {
      if (logErr) console.error('[role-change-log]', logErr);
    });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/admin/usuarios/[id]
 * Hard-delete an internal user.
 * Self-delete is blocked (you'd lock yourself out).
 * The last admin in the system can't be deleted either.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) {
    return forbiddenResponse('Origen no autorizado');
  }
  const session = await requireRole(['admin']);
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  const sessionUserId = parseInt(String((session.user as { id?: string }).id || '0'), 10);
  if (sessionUserId === userId) {
    return NextResponse.json(
      { error: 'No puedes eliminarte a ti mismo' },
      { status: 400 }
    );
  }

  const { data: target } = await supabaseAdmin
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .single();
  if (!target) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  // If this is an admin, ensure at least one other admin remains.
  if (target.role === 'admin') {
    const { count } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin');
    if ((count || 0) <= 1) {
      return NextResponse.json(
        { error: 'No puedes eliminar al único administrador. Crea otro admin primero.' },
        { status: 400 }
      );
    }
  }

  const { error } = await supabaseAdmin.from('users').delete().eq('id', userId);
  if (error) {
    console.error('[usuarios-delete]', error);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
