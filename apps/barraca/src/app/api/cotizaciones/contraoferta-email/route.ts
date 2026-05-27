import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { sendContraofertaEmail } from '@jurmaq/shared/mail/email';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin, isValidEmail } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import crypto from 'node:crypto';
import { logSafeError } from '@jurmaq/shared/logging';

export async function POST(request: NextRequest) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const session = await requirePermission('barraca_cotizaciones', 'update');
    if (!session) return forbiddenResponse('No tienes permiso');

    // Prevent this endpoint from being used as an open SMTP relay: cap
    // 20 sends per admin session per 15 min.
    const ip = getClientIp(request);
    const limiter = rateLimit(`contraoferta-email:${ip}`, { maxAttempts: 20, windowSeconds: 900 });
    if (!limiter.success) {
      return NextResponse.json({ error: 'Demasiados envios. Intente mas tarde.' }, { status: 429 });
    }

    const body = await request.json();
    const {
      email,
      numero,
      nombre,
      nombreCompetencia,
      itemsOriginales,
      itemsContraoferta,
      totalOriginal,
      totalContraoferta,
      mensaje,
      ahorroTotal,
    } = body;

    if (!email || !numero) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }
    if (typeof email !== 'string' || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Email invalido' }, { status: 400 });
    }

    // Hardening: refuse to email anyone who isn't the registered cotizacion's
    // own customer. Prevents CSRF-triggered phishing from JURMAQ address.
    const numeroStr = String(numero).trim();
    const { data: cot } = await supabaseAdmin
      .from('barraca_cotizaciones')
      .select('id, email')
      .eq('numero', numeroStr)
      .maybeSingle();
    if (!cot || (cot.email || '').toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Email no coincide con la cotización' }, { status: 400 });
    }

    // Genera accept_token unico para esta contraoferta. Reemplaza cualquier
    // token previo (rotacion en cada envio para que un email viejo
    // reenviado no siga siendo aceptable). El cliente recibe el token solo
    // por email; sin el, no puede aceptar/rechazar (Ley 19.496 — el aceptar
    // representa expresion de voluntad y debe estar vinculado al destinatario).
    const acceptToken = crypto.randomUUID();
    const { error: tokenErr } = await supabaseAdmin
      .from('barraca_cotizaciones')
      .update({ accept_token: acceptToken, accept_token_used_at: null })
      .eq('id', cot.id);
    if (tokenErr) {
      // Si la columna no existe, falta migrate-cotizaciones-accept-token.sql
      const code = (tokenErr as { code?: string }).code;
      const msg = (tokenErr as { message?: string }).message || '';
      if (code === 'PGRST204' || /accept_token/.test(msg)) {
        console.error('[contraoferta-email] columna accept_token no existe. Ejecuta migrate-cotizaciones-accept-token.sql');
        return NextResponse.json(
          { error: 'Falta migracion accept_token' },
          { status: 503 }
        );
      }
      throw tokenErr;
    }

    await sendContraofertaEmail(email, {
      numero,
      nombre: nombre || '',
      nombreCompetencia: nombreCompetencia || 'la competencia',
      itemsOriginales: itemsOriginales || [],
      itemsContraoferta: itemsContraoferta || [],
      totalOriginal: totalOriginal || 0,
      totalContraoferta: totalContraoferta || 0,
      mensaje: mensaje || '',
      ahorroTotal: ahorroTotal || 0,
      acceptToken,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al enviar email de contraoferta:', error);
    return NextResponse.json(
      { error: 'Error al enviar email de contraoferta' },
      { status: 500 }
    );
  }
}
