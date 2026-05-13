import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requireRole, forbiddenResponse, unauthorizedResponse } from '@jurmaq/shared/auth/guard';
import { isValidRole, ROLE_OPTIONS } from '@jurmaq/shared/roles';
import { sanitizeString, isValidEmail, isValidOrigin } from '@jurmaq/shared/sanitize';

/**
 * GET /api/admin/usuarios
 * List internal users. Only accessible to `admin` role.
 * Returns the role catalogue alongside so the UI can render dropdowns
 * without an extra request.
 */
export async function GET() {
  const session = await requireRole(['admin']);
  if (!session) return forbiddenResponse('Solo el administrador puede ver usuarios');

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, role, created_at')
    .order('id', { ascending: true });

  if (error) {
    console.error('[usuarios-list]', error);
    return NextResponse.json({ error: 'Error al listar usuarios' }, { status: 500 });
  }

  return NextResponse.json({ users: data || [], roles: ROLE_OPTIONS });
}

/**
 * POST /api/admin/usuarios
 * Create a new internal user.
 * Only `admin` can create users — the password is bcrypted with cost 10.
 */
export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return forbiddenResponse('Origen no autorizado');
  }
  const session = await requireRole(['admin']);
  if (!session) return unauthorizedResponse();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 });
  }

  const name = sanitizeString(body.name || body.nombre);
  const email = sanitizeString(body.email)?.toLowerCase();
  const password = typeof body.password === 'string' ? body.password : null;
  const role = body.role;

  if (!name) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  if (!email || !isValidEmail(email))
    return NextResponse.json({ error: 'Email invalido' }, { status: 400 });
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 8 caracteres' },
      { status: 400 }
    );
  }
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json(
      { error: 'La contraseña debe incluir al menos una mayúscula y un número' },
      { status: 400 }
    );
  }
  if (!isValidRole(role)) {
    return NextResponse.json({ error: 'Rol invalido' }, { status: 400 });
  }

  // Email must be unique across users + barraca_usuarios (otherwise
  // login flow is ambiguous). We check both.
  const [{ data: existingAdmin }, { data: existingClient }] = await Promise.all([
    supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle(),
    supabaseAdmin.from('barraca_usuarios').select('id').eq('email', email).maybeSingle(),
  ]);
  if (existingAdmin || existingClient) {
    return NextResponse.json({ error: 'El email ya esta registrado' }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({ name, email, password: hashed, role })
    .select('id, name, email, role, created_at')
    .single();

  if (error || !data) {
    console.error('[usuarios-create]', error);
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
