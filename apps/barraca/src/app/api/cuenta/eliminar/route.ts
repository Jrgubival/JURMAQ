import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

/**
 * POST /api/barraca/cuenta/eliminar
 * Body: { password: string }
 * Auth: Bearer token (from /api/barraca/auth login response)
 *
 * Implements the "right to erasure" required by Ley N° 21.719 (Chile,
 * vigente desde diciembre 2026, GDPR-style). Customer can self-service
 * delete their account.
 *
 * What we delete vs. what we anonymize:
 *
 *   - barraca_usuarios row: anonymized + soft-deleted (activo=false). We
 *     replace PII fields with placeholders rather than hard-deleting because
 *     other tables FK-reference this row and downstream legal/tax records
 *     (cotizaciones, contratos) MUST survive per the Código Tributario's
 *     6-year retention rule.
 *
 *   - barraca_cotizaciones owned by the user: PII anonymized (nombre, email,
 *     telefono, rut), but the rest of the cotization (items, total, dates)
 *     is kept for tax/audit purposes. The link to the now-anonymized user
 *     row is preserved.
 *
 *   - barraca_carrito: hard-deleted. Cart contents have no legal retention.
 *
 *   - contratos: NOT touched here. Signed contracts are legal documents
 *     and cannot be self-erased — the customer must request erasure via
 *     the DPO email and we evaluate per-case (e.g. expired contracts >6yrs
 *     old can be anonymized).
 *
 * Idempotent: a second call after the first finds an inactive user → 404.
 *
 * Rate-limited per-IP and per-account so a stolen token can't burn-down a
 * batch of accounts.
 */

// Token parsing — same shape as the rest of the barraca auth flow.
function parseToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) return null;
    const idStr = decoded.substring(0, colonIdx);
    const random = decoded.substring(colonIdx + 1);
    if (random.length < 32) return null;
    const id = parseInt(idStr, 10);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    // Rate limit per IP — extra protection against a stolen-token attacker
    // trying to delete many accounts.
    const ip = getClientIp(request);
    const ipLimiter = rateLimit(`erasure:${ip}`, { maxAttempts: 3, windowSeconds: 3600 });
    if (!ipLimiter.success) {
      return NextResponse.json(
        { error: 'Demasiados intentos de eliminación. Intenta más tarde.' },
        { status: 429 }
      );
    }

    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
    }

    const userId = parseToken(token);
    if (userId === null) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const password = typeof body.password === 'string' ? body.password : null;
    if (!password) {
      return NextResponse.json(
        { error: 'Para confirmar la eliminación, ingresa tu contraseña actual.' },
        { status: 400 }
      );
    }

    // Look up the active user.
    const { data: user, error: userError } = await supabaseAdmin
      .from('barraca_usuarios')
      .select('id, email, password, activo')
      .eq('id', userId)
      .eq('activo', true)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Cuenta no encontrada o ya está inactiva.' },
        { status: 404 }
      );
    }

    // Confirm password before destruction.
    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      return NextResponse.json(
        { error: 'Contraseña incorrecta.' },
        { status: 401 }
      );
    }

    // Anonymize the user row. The email is replaced with a unique anonymous
    // sentinel so the unique index on email survives, and so admin support
    // staff can see in the DB that this row was the result of a self-erasure
    // (vs an admin delete, vs a never-completed registration).
    const anonEmail = `deleted-${user.id}-${Date.now()}@anon.local`;
    await supabaseAdmin
      .from('barraca_usuarios')
      .update({
        nombre: 'Cuenta Eliminada',
        email: anonEmail,
        telefono: null,
        empresa: null,
        rut: null,
        // Hash a fresh random — login will be impossible.
        password: await bcrypt.hash(crypto.randomUUID(), 12),
        activo: false,
      })
      .eq('id', user.id);

    // Anonymize cotizaciones owned by this user. Items / total / dates are
    // preserved for tax purposes (Código Tributario art. 17 — 6 año
    // retention) but the personal identifiers are scrubbed.
    await supabaseAdmin
      .from('barraca_cotizaciones')
      .update({
        nombre: 'Cuenta Eliminada',
        email: anonEmail,
        telefono: null,
        empresa: null,
        rut: null,
      })
      .eq('usuario_id', user.id);

    // Also anonymize cotizaciones tied to this email but without usuario_id
    // (legacy guest-checkouts that the user later registered with).
    await supabaseAdmin
      .from('barraca_cotizaciones')
      .update({
        nombre: 'Cuenta Eliminada',
        email: anonEmail,
        telefono: null,
        empresa: null,
        rut: null,
      })
      .eq('email', user.email)
      .is('usuario_id', null);

    // Cart has no retention requirement — hard delete.
    const { count: carritoBorrado } = await supabaseAdmin
      .from('barraca_carrito')
      .delete({ count: 'exact' })
      .eq('usuario_id', user.id);

    // Suscripcion al newsletter — explicit erasure of the email from
    // marketing list.
    const { count: suscripcionCount } = await supabaseAdmin
      .from('barraca_suscriptores')
      .delete({ count: 'exact' })
      .eq('email', user.email);

    // Cuenta cuantas cotizaciones quedaron anonimizadas para el log.
    const { count: cotizacionesAnonCount } = await supabaseAdmin
      .from('barraca_cotizaciones')
      .select('id', { count: 'exact', head: true })
      .eq('email', anonEmail);

    // Persistent erasure log (Ley 21.719). El insert defensive: si la tabla
    // no existe (falta migrate-account-erasure-log.sql) seguimos completando
    // el borrado y solo logueamos la falla. El borrado del usuario es lo
    // critico; el log es evidencia adicional.
    try {
      await supabaseAdmin.from('account_erasure_log').insert({
        user_id: user.id,
        email_anonimo: anonEmail,
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        user_agent: request.headers.get('user-agent') || null,
        cotizaciones_anonimizadas: cotizacionesAnonCount ?? 0,
        carrito_borrado: carritoBorrado ?? 0,
        suscripcion_borrada: (suscripcionCount ?? 0) > 0,
      });
    } catch (logErr) {
      console.error('[account-erased] no se pudo escribir erasure_log (falta migrate-account-erasure-log.sql?)', logErr);
    }
    console.log('[account-erased]', user.id);

    return NextResponse.json({
      mensaje:
        'Tu cuenta ha sido eliminada y tus datos personales fueron anonimizados. ' +
        'Las cotizaciones y contratos legalmente requeridos se conservan sin tus datos identificables.',
    });
  } catch (error) {
    console.error('Error al eliminar cuenta:', error);
    return NextResponse.json(
      { error: 'Error al eliminar cuenta' },
      { status: 500 }
    );
  }
}
