import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { sendWelcomeEmail } from '@jurmaq/shared/mail/email';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { sanitizeString, isValidEmail, isValidOrigin } from '@jurmaq/shared/sanitize';

// Generate secure token: base64 of (userId + ':' + randomBytes)
function generateToken(userId: number): string {
  const random = crypto.randomBytes(32).toString('hex');
  return Buffer.from(`${userId}:${random}`).toString('base64');
}

// Parse token to extract userId with format validation
function parseToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) return null;
    const idStr = decoded.substring(0, colonIdx);
    const random = decoded.substring(colonIdx + 1);
    // Require the random part to be at least 32 chars (our tokens use 64 hex chars)
    if (random.length < 32) return null;
    const id = parseInt(idStr, 10);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    // === PROFILE: fetch user data + cotizaciones ===
    if (action === 'profile') {
      const token = extractToken(request);
      if (!token) {
        return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
      }

      const userId = parseToken(token);
      if (userId === null) {
        return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
      }

      const { data: user } = await supabaseAdmin
        .from('barraca_usuarios')
        .select('id, nombre, email, telefono, empresa, rut, rol, created_at')
        .eq('id', userId)
        .eq('activo', true)
        .single();

      if (!user) {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
      }

      // Fetch by usuario_id
      const { data: cotByUser } = await supabaseAdmin
        .from('barraca_cotizaciones')
        .select('id, numero, created_at, total, estado')
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch by email (backward compat for old cotizaciones without usuario_id)
      const { data: cotByEmail } = await supabaseAdmin
        .from('barraca_cotizaciones')
        .select('id, numero, created_at, total, estado')
        .eq('email', user.email)
        .order('created_at', { ascending: false })
        .limit(20);

      // Deduplicate
      const seen = new Set<number>();
      const cotizaciones = [...(cotByUser || []), ...(cotByEmail || [])]
        .filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20);

      return NextResponse.json({
        user,
        cotizaciones: cotizaciones.map((c: any) => ({
          id: c.id,
          numero: c.numero,
          fecha: c.created_at,
          total: c.total,
          estado: c.estado,
        })),
      });
    }

    // === UPDATE: update user profile ===
    if (action === 'update') {
      const token = extractToken(request);
      if (!token) {
        return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
      }

      const userId = parseToken(token);
      if (userId === null) {
        return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
      }

      const updateData: Record<string, any> = {};
      if (body.nombre) updateData.nombre = sanitizeString(body.nombre);
      if (body.telefono !== undefined) updateData.telefono = sanitizeString(body.telefono);
      if (body.empresa !== undefined) updateData.empresa = sanitizeString(body.empresa);
      if (body.rut !== undefined) updateData.rut = sanitizeString(body.rut);

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('barraca_usuarios')
        .update(updateData)
        .eq('id', userId)
        .eq('activo', true);

      if (error) throw error;

      return NextResponse.json({ mensaje: 'Perfil actualizado' });
    }

    // === LOGIN & REGISTER require email + password ===
    const email = sanitizeString(body.email);
    const password = typeof body.password === 'string' ? body.password : null;

    if (!action || !email || !password) {
      return NextResponse.json(
        { error: 'action, email y password son requeridos' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Formato de email invalido' }, { status: 400 });
    }

    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: 'La contrasena debe tener entre 8 y 128 caracteres' }, { status: 400 });
    }

    // Two-layer rate limit: IP-level (catches scrapers) + email-level (catches
    // distributed credential-stuffing across multiple IPs targeting the same
    // account). Email lockout is intentionally stricter so a single account
    // can't be brute-forced via a botnet.
    const ip = getClientIp(request);
    const ipLimiter = rateLimit(`auth:${ip}`, { maxAttempts: 5, windowSeconds: 900 });
    if (!ipLimiter.success) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Intente nuevamente en un momento.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((ipLimiter.resetAt - Date.now()) / 1000)) } }
      );
    }
    const emailLimiter = rateLimit(`auth-email:${email.toLowerCase()}`, { maxAttempts: 5, windowSeconds: 1800 });
    if (!emailLimiter.success) {
      return NextResponse.json(
        { error: 'Demasiados intentos sobre esta cuenta. Espera 30 minutos.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((emailLimiter.resetAt - Date.now()) / 1000)) } }
      );
    }

    if (action === 'register') {
      const nombre = sanitizeString(body.nombre);
      if (!nombre) {
        return NextResponse.json({ error: 'El nombre es requerido para registrarse' }, { status: 400 });
      }

      const { data: existingUser } = await supabaseAdmin
        .from('barraca_usuarios')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return NextResponse.json({ error: 'El email ya esta registrado' }, { status: 409 });
      }

      const { data: existingAdmin } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingAdmin) {
        return NextResponse.json({ error: 'El email ya esta registrado' }, { status: 409 });
      }

      // 12 rounds: NIST 2024 recommendation. Existing 10-round hashes stay
      // valid because bcrypt.compare reads the round count from the hash
      // itself, so this only affects new accounts.
      const hashedPassword = await bcrypt.hash(password, 12);

      const { data: user, error } = await supabaseAdmin
        .from('barraca_usuarios')
        .insert({
          nombre,
          email,
          password: hashedPassword,
          telefono: sanitizeString(body.telefono),
          empresa: sanitizeString(body.empresa),
          rut: sanitizeString(body.rut),
          rol: 'cliente',
          activo: true,
        })
        .select('id, nombre, email, telefono, empresa, rut, rol, activo, created_at')
        .single();

      if (error) throw error;

      // Send welcome email (non-blocking)
      try {
        await sendWelcomeEmail(email, nombre);
      } catch (emailError) {
        console.error('Error al enviar email de bienvenida:', emailError);
      }

      // Return secure token for session persistence
      return NextResponse.json({
        usuario: user,
        token: generateToken(user.id),
        mensaje: 'Registro exitoso',
      }, { status: 201 });

    } else if (action === 'login') {
      // Password hash needs bcrypt.compare so we DO need to read it, but we
      // explicitly enumerate columns rather than `select('*')` so that any
      // future sensitive column added (mfa secret, recovery codes, etc.) is
      // not silently exposed through this hot path.
      const BARRACA_USER_COLS = 'id,nombre,email,telefono,empresa,rut,rol,activo,created_at,password' as const;
      const ADMIN_USER_COLS = 'id,name,email,role,created_at,password' as const;

      // 1. Try barraca_usuarios table
      const { data: barracaUser, error: barracaError } = await supabaseAdmin
        .from('barraca_usuarios')
        .select(BARRACA_USER_COLS)
        .eq('email', email)
        .eq('activo', true)
        .single();

      if (barracaUser && !barracaError) {
        const isValid = await bcrypt.compare(password, barracaUser.password);
        if (!isValid) {
          return NextResponse.json({ error: 'Credenciales invalidas' }, { status: 401 });
        }

        const { password: _, ...userWithoutPassword } = barracaUser;
        return NextResponse.json({
          usuario: userWithoutPassword,
          token: generateToken(barracaUser.id),
          source: 'barraca',
          mensaje: 'Login exitoso',
        });
      }

      // 2. Try users table (admin/vendedor)
      const { data: adminUser, error: adminError } = await supabaseAdmin
        .from('users')
        .select(ADMIN_USER_COLS)
        .eq('email', email)
        .single();

      if (adminUser && !adminError) {
        const isValid = await bcrypt.compare(password, adminUser.password);
        if (!isValid) {
          return NextResponse.json({ error: 'Credenciales invalidas' }, { status: 401 });
        }

        const { password: _, ...userWithoutPassword } = adminUser;
        return NextResponse.json({
          usuario: {
            ...userWithoutPassword,
            nombre: adminUser.name,
            rol: adminUser.role || 'admin',
          },
          // Use the same secure token format as clients so that endpoints
          // relying on parseToken() (e.g. /cuenta profile) work consistently.
          token: generateToken(adminUser.id),
          source: 'admin',
          mensaje: 'Login exitoso',
        });
      }

      // Email no existe en ninguna tabla. Hacemos un bcrypt.compare dummy
      // para igualar timing con el camino "email existe pero password
      // incorrecta". Sin esto el atacante puede enumerar emails válidos
      // midiendo response time: hit (~200ms bcrypt) vs miss (~10ms).
      // El hash dummy tiene rounds=12 (mismo costo que producción).
      await bcrypt.compare(
        password,
        '$2b$12$abcdefghijklmnopqrstuuVUlT15WTcLZyQqo2kBQJOsJHZrFRrGq'
      );
      return NextResponse.json({ error: 'Credenciales invalidas' }, { status: 401 });

    } else {
      return NextResponse.json({ error: 'Accion no valida' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error en autenticacion barraca:', error);
    return NextResponse.json(
      { error: 'Error en el proceso de autenticacion' },
      { status: 500 }
    );
  }
}
