import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { isValidOrigin, isValidEmail, sanitizeString, escapeLikePattern } from '@jurmaq/shared/sanitize';
import { getClientIp, rateLimit } from '@jurmaq/shared/rate-limit';
import { esquemaTrack, itemsDesdeCatalogo, type ProductoTrack } from '@/lib/carritos/track';

/**
 * POST /api/public/carrito-abandonado/track
 *
 * El front llama acá cuando el usuario agrega items al carrito o
 * permanece > 60s sin checkout. Crea/actualiza un registro en
 * barraca_carrito_abandonado con snapshot del carrito.
 *
 * Body: { email, session_id, items: [{producto_id, cantidad}] }. Del cliente solo se toman ids y
 * cantidades: nombre, precio y total salen de la tabla de productos (lib/carritos/track.ts).
 *
 * Cuando el usuario completa la compra, otra parte del código marca
 * converted_at=now en el record correspondiente.
 */

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Origen no autorizado' }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rl = rateLimit(`carrito-track:${ip}`, { maxAttempts: 30, windowSeconds: 300 });
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: 'Demasiados tracks' }, { status: 429 });
  }

  const parsed = esquemaTrack.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 });
  }
  const body = parsed.data;
  // Sin cuentas de cliente (oct-2026): nunca hay usuario_id (y jamás del body).
  const usuarioId: number | null = null;
  const email = sanitizeString(body.email)?.toLowerCase();
  const telefono = sanitizeString(body.telefono)?.trim();
  const sessionId = sanitizeString(body.session_id);

  // Necesitamos al menos email o session_id para trackear.
  if (!email && !sessionId) {
    return NextResponse.json({ ok: false, error: 'Email o session_id requerido' }, { status: 400 });
  }
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: 'Email inválido' }, { status: 400 });
  }
  // Nombres y precios desde la tabla de productos, nunca del navegador.
  const ids = [...new Set(body.items.map((i) => i.producto_id))];
  const { data: filas } = await supabaseAdmin.from('barraca_productos').select('id, nombre, precio').in('id', ids).eq('activo', true);
  const catalogo = new Map<number, ProductoTrack>((filas ?? []).map((f: ProductoTrack) => [Number(f.id), { id: Number(f.id), nombre: String(f.nombre ?? ''), precio: Number(f.precio) }]));
  const { items, total } = itemsDesdeCatalogo(body.items, catalogo);
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
      .ilike('email', escapeLikePattern(email))
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
        telefono: telefono || undefined,
        session_id: sessionId || undefined,
      })
      .eq('id', existing.id);
  } else {
    await supabaseAdmin.from('barraca_carrito_abandonado').insert({
      email: email || '',
      telefono: telefono || null,
      session_id: sessionId,
      usuario_id: usuarioId,
      items,
      total,
      last_activity: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}
