import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { isValidOrigin, isValidEmail, sanitizeString } from '@jurmaq/shared/sanitize';
import { getClientIp, rateLimit } from '@jurmaq/shared/rate-limit';

/**
 * POST /api/public/carrito-abandonado/track
 *
 * El front llama acá cuando el usuario agrega items al carrito o
 * permanece > 60s sin checkout. Crea/actualiza un registro en
 * barraca_carrito_abandonado con snapshot del carrito.
 *
 * Body: { email, session_id, items: [{producto_id, nombre, precio, cantidad}], total }
 *
 * Cuando el usuario completa la compra, otra parte del código marca
 * converted_at=now en el record correspondiente.
 */

export const runtime = 'nodejs';

interface Item {
  producto_id?: number;
  nombre?: string;
  precio?: number;
  cantidad?: number;
}

interface Body {
  email?: string;
  session_id?: string;
  usuario_id?: number;
  items?: Item[];
  total?: number;
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Origen no autorizado' }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rl = rateLimit(`carrito-track:${ip}`, { maxAttempts: 30, windowSeconds: 300 });
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: 'Demasiados tracks' }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const email = sanitizeString(body.email)?.toLowerCase();
  const sessionId = sanitizeString(body.session_id);
  const items = Array.isArray(body.items) ? body.items : [];
  const total = Number(body.total) || 0;

  // Necesitamos al menos email o session_id para trackear.
  if (!email && !sessionId) {
    return NextResponse.json({ ok: false, error: 'Email o session_id requerido' }, { status: 400 });
  }
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: 'Email inválido' }, { status: 400 });
  }
  if (items.length === 0 || total <= 0) {
    return NextResponse.json({ ok: false, error: 'Items requeridos' }, { status: 400 });
  }

  // Upsert: si existe un registro pendiente de este email/session, lo actualizamos.
  // Si no, creamos uno nuevo.
  let existing = null;
  if (email) {
    const { data } = await supabaseAdmin
      .from('barraca_carrito_abandonado')
      .select('id')
      .ilike('email', email)
      .is('converted_at', null)
      .order('last_activity', { ascending: false })
      .limit(1)
      .maybeSingle();
    existing = data;
  }
  if (!existing && sessionId) {
    const { data } = await supabaseAdmin
      .from('barraca_carrito_abandonado')
      .select('id')
      .eq('session_id', sessionId)
      .is('converted_at', null)
      .order('last_activity', { ascending: false })
      .limit(1)
      .maybeSingle();
    existing = data;
  }

  if (existing) {
    await supabaseAdmin
      .from('barraca_carrito_abandonado')
      .update({
        items,
        total,
        last_activity: new Date().toISOString(),
        email: email || undefined,
        session_id: sessionId || undefined,
      })
      .eq('id', existing.id);
  } else {
    await supabaseAdmin.from('barraca_carrito_abandonado').insert({
      email: email || '',
      session_id: sessionId,
      usuario_id: body.usuario_id ?? null,
      items,
      total,
      last_activity: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}
