import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { isValidEmail, isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { getClientIp, rateLimit } from '@jurmaq/shared/rate-limit';
import { transporter } from '@jurmaq/shared/mail/transport';
import {
  generateClienteToken,
  generateClienteTokenAsync,
  setClienteSessionCookie,
  clearClienteSessionCookie,
  generateResetToken,
} from '@/lib/cuenta-auth';

/**
 * POST /api/cuenta/auth
 *
 * Multi-action endpoint del portal cliente:
 *   { action: 'login',    email, password }
 *   { action: 'register', email, password, nombre, telefono?, rut?, empresa? }
 *   { action: 'forgot',   email }                        # envía email con reset_token
 *   { action: 'reset',    reset_token, new_password }    # cambia password + login
 *   { action: 'logout' }                                  # borra cookie
 *
 * Diseño:
 *   - Custom token base64(clienteId:random32) en cookie HttpOnly.
 *   - Rate-limit por IP + por email.
 *   - bcrypt cost 10 (estándar 2026).
 *   - Email enumeration protection: 'forgot' siempre responde igual (200 ok)
 *     aunque el email no exista — para evitar que un atacante use este
 *     endpoint para enumerar emails.
 *   - Reset token TTL 1h, válido 1 sola vez (se borra al usarse).
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

const RESET_TTL_MIN = 60;
const BCRYPT_COST = 10;

interface AuthBody {
  action?: string;
  email?: string;
  password?: string;
  nombre?: string;
  telefono?: string;
  rut?: string;
  empresa?: string;
  reset_token?: string;
  new_password?: string;
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  let body: AuthBody;
  try {
    body = (await request.json()) as AuthBody;
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const ip = getClientIp(request);

  switch (body.action) {
    case 'login':
      return await handleLogin(body, ip);
    case 'register':
      return await handleRegister(body, ip);
    case 'forgot':
      return await handleForgot(body, ip);
    case 'reset':
      return await handleReset(body, ip);
    case 'logout':
      return await handleLogout();
    default:
      return NextResponse.json({ error: 'action inválida' }, { status: 400 });
  }
}

async function handleLogin(body: AuthBody, ip: string): Promise<NextResponse> {
  const email = sanitizeString(body.email)?.toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Contraseña inválida' }, { status: 400 });
  }

  // Rate-limit estricto: 5 intentos / 15 min por (IP, email).
  const limiter = rateLimit(`cuenta-login:${ip}:${email}`, { maxAttempts: 5, windowSeconds: 900 });
  if (!limiter.success) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera unos minutos antes de volver a intentar.' },
      { status: 429 },
    );
  }

  const { data: cliente } = await supabaseAdmin
    .from('clientes')
    .select('id, email, nombre, password_hash, activo')
    .ilike('email', email)
    .maybeSingle();

  if (!cliente || !cliente.activo) {
    // Respuesta genérica — no revelar si el email existe.
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  if (!cliente.password_hash) {
    // Cliente histórico sin password — disparar flow de "configura tu contraseña".
    return NextResponse.json(
      {
        error: 'configurar_password',
        message: 'Tu cuenta existe pero no tiene contraseña configurada. Te enviamos un correo para configurarla.',
      },
      { status: 412 }, // Precondition Failed
    );
  }

  const ok = await bcrypt.compare(password, cliente.password_hash);
  if (!ok) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  // Login exitoso. Generar token + setear cookie.
  const token = await generateClienteTokenAsync(cliente.id, { ip });
  await setClienteSessionCookie(token);

  // Actualizar ultimo_login_at (best-effort).
  await supabaseAdmin
    .from('clientes')
    .update({ ultimo_login_at: new Date().toISOString() })
    .eq('id', cliente.id)
    .then(() => undefined, () => undefined);

  return NextResponse.json({
    ok: true,
    cliente: {
      id: cliente.id,
      email: cliente.email,
      nombre: cliente.nombre,
    },
    // Para clientes móvil que prefieren Bearer en lugar de cookie.
    token,
  });
}

async function handleRegister(body: AuthBody, ip: string): Promise<NextResponse> {
  const email = sanitizeString(body.email)?.toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const nombre = sanitizeString(body.nombre);
  const telefono = sanitizeString(body.telefono);
  const rut = sanitizeString(body.rut);
  const empresa = sanitizeString(body.empresa);

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }
  if (!nombre || nombre.length < 2) {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
  }

  const limiter = rateLimit(`cuenta-register:${ip}`, { maxAttempts: 5, windowSeconds: 3600 });
  if (!limiter.success) {
    return NextResponse.json(
      { error: 'Demasiados registros desde tu IP. Espera una hora.' },
      { status: 429 },
    );
  }

  // ¿Ya existe el cliente?
  const { data: existing } = await supabaseAdmin
    .from('clientes')
    .select('id, password_hash')
    .ilike('email', email)
    .maybeSingle();

  if (existing) {
    if (existing.password_hash) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con este email. Inicia sesión.' },
        { status: 409 },
      );
    }
    // Cliente histórico sin password — completarlo en lugar de crear nuevo.
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const { error: updErr } = await supabaseAdmin
      .from('clientes')
      .update({
        password_hash: hash,
        nombre: nombre,
        telefono: telefono ?? null,
        rut: rut ?? null,
        empresa: empresa ?? null,
        email_verificado_at: new Date().toISOString(),
        ultimo_login_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (updErr) {
      console.error('[cuenta-register-update-fail]', updErr);
      return NextResponse.json({ error: 'No se pudo completar el registro' }, { status: 500 });
    }
    const token = await generateClienteTokenAsync(existing.id, { ip });
    await setClienteSessionCookie(token);
    return NextResponse.json({ ok: true, cliente: { id: existing.id, email, nombre }, token });
  }

  // Crear cliente nuevo.
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const { data: created, error: insertErr } = await supabaseAdmin
    .from('clientes')
    .insert({
      email,
      nombre,
      telefono: telefono ?? null,
      rut: rut ?? null,
      empresa: empresa ?? null,
      password_hash: hash,
      activo: true,
      created_via: 'self_signup',
      email_verificado_at: new Date().toISOString(),
      ultimo_login_at: new Date().toISOString(),
    })
    .select('id, email, nombre')
    .single();

  if (insertErr || !created) {
    console.error('[cuenta-register-insert-fail]', insertErr);
    return NextResponse.json({ error: 'No se pudo crear la cuenta' }, { status: 500 });
  }

  const token = await generateClienteTokenAsync(created.id, { ip });
  await setClienteSessionCookie(token);

  // Enviar email de bienvenida (best-effort).
  void transporter
    .sendMail({
      to: email,
      subject: 'Bienvenido a JURMAQ — Cuenta creada',
      html: `<p>Hola ${nombre},</p><p>Tu cuenta en JURMAQ ha sido creada. Ya puedes ver tus cotizaciones y contratos en <a href="https://jurmaq.cl/cuenta">jurmaq.cl/cuenta</a>.</p>`,
      skipAdminBcc: true,
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true, cliente: created, token });
}

async function handleForgot(body: AuthBody, ip: string): Promise<NextResponse> {
  const email = sanitizeString(body.email)?.toLowerCase();
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }

  // Rate-limit por IP — 3 / hora.
  const limiter = rateLimit(`cuenta-forgot:${ip}`, { maxAttempts: 3, windowSeconds: 3600 });
  if (!limiter.success) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta en una hora.' },
      { status: 429 },
    );
  }

  // Lookup discreto — siempre respondemos 200 aunque no exista.
  const { data: cliente } = await supabaseAdmin
    .from('clientes')
    .select('id, email, nombre, activo')
    .ilike('email', email)
    .maybeSingle();

  if (cliente && cliente.activo) {
    // Security (audit fase 2A.3): el reset token se guarda HASHEADO con bcrypt,
    // nunca en plaintext. El raw token solo se envía en el email del usuario.
    // Si la DB se compromete, los tokens activos son inutilizables sin el raw
    // (no se puede revertir bcrypt). Migration: migrate-reset-token-hash.sql.
    const resetToken = generateResetToken();
    const resetTokenHash = await bcrypt.hash(resetToken, BCRYPT_COST);
    const expiraAt = new Date(Date.now() + RESET_TTL_MIN * 60_000).toISOString();
    await supabaseAdmin
      .from('clientes')
      .update({
        reset_token_hash: resetTokenHash,
        reset_token: null, // limpiamos legacy plaintext si quedó alguno
        reset_token_expira_at: expiraAt,
      })
      .eq('id', cliente.id);

    const url = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://jurmaq.cl'}/cuenta/reset?token=${resetToken}`;
    void transporter
      .sendMail({
        to: cliente.email,
        subject: 'JURMAQ — Configura tu contraseña',
        html: `<p>Hola ${cliente.nombre},</p>
<p>Recibimos una solicitud para configurar/restablecer tu contraseña.</p>
<p><a href="${url}" style="display:inline-block;padding:10px 20px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px">Configurar mi contraseña</a></p>
<p>O copia este link: ${url}</p>
<p>Vence en ${RESET_TTL_MIN} minutos. Si no fuiste tú, ignora este mensaje.</p>`,
        skipAdminBcc: true,
      })
      .catch(() => undefined);
  }

  // Respuesta genérica — anti-enumeración.
  return NextResponse.json({
    ok: true,
    message: 'Si el email existe, te enviamos un correo con instrucciones.',
  });
}

async function handleReset(body: AuthBody, ip: string): Promise<NextResponse> {
  const resetToken = sanitizeString(body.reset_token);
  const newPassword = typeof body.new_password === 'string' ? body.new_password : '';

  if (!resetToken || resetToken.length < 32) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
  }

  const limiter = rateLimit(`cuenta-reset:${ip}`, { maxAttempts: 10, windowSeconds: 3600 });
  if (!limiter.success) {
    return NextResponse.json({ error: 'Demasiados intentos.' }, { status: 429 });
  }

  // Security (audit fase 2A.3): tokens están hasheados con bcrypt.
  // bcrypt.compare no es indexable → scan O(n) sobre tokens activos no expirados.
  // En la práctica n es muy pequeño (típicamente <10 simultáneos).
  const { data: candidates } = await supabaseAdmin
    .from('clientes')
    .select('id, email, nombre, reset_token_hash, reset_token_expira_at, activo')
    .not('reset_token_hash', 'is', null)
    .gt('reset_token_expira_at', new Date().toISOString());

  type ClienteCandidate = {
    id: number;
    email: string;
    nombre: string;
    reset_token_hash: string | null;
    reset_token_expira_at: string | null;
    activo: boolean;
  };
  let cliente: ClienteCandidate | null = null;
  for (const c of (candidates ?? []) as ClienteCandidate[]) {
    if (!c.activo || !c.reset_token_hash) continue;
    try {
      const matches = await bcrypt.compare(resetToken, c.reset_token_hash);
      if (matches) {
        cliente = c;
        break;
      }
    } catch {
      /* hash inválido, saltamos */
    }
  }

  if (!cliente) {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
  }

  const hash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await supabaseAdmin
    .from('clientes')
    .update({
      password_hash: hash,
      reset_token: null,
      reset_token_hash: null,
      reset_token_expira_at: null,
      email_verificado_at: cliente && new Date().toISOString(),
      ultimo_login_at: new Date().toISOString(),
    })
    .eq('id', cliente.id);

  const token = await generateClienteTokenAsync(cliente.id, { ip });
  await setClienteSessionCookie(token);

  return NextResponse.json({
    ok: true,
    cliente: { id: cliente.id, email: cliente.email, nombre: cliente.nombre },
    token,
  });
}

async function handleLogout(): Promise<NextResponse> {
  await clearClienteSessionCookie();
  return NextResponse.json({ ok: true });
}
