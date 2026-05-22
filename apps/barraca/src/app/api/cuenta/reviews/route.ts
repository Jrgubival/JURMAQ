import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { getClientIp, rateLimit } from '@jurmaq/shared/rate-limit';
import { createAdminNotification } from '@jurmaq/shared/notifications/admin';

/**
 * GET    /api/cuenta/reviews                — lista MIS reviews
 * POST   /api/cuenta/reviews { producto_id, rating, titulo?, comentario? }
 * DELETE /api/cuenta/reviews?id=...         — borrar mi propio review
 *
 * Tier 4 D2: solo clientes logueados pueden reseñar. Servidor verifica que
 * el cliente tiene al menos una cotización 'pagada' que incluye ese producto
 * para marcar `compra_verificada = true`. Si no, igual permite (review no
 * verificada) pero con badge distinto en la UI pública.
 */

export const runtime = 'nodejs';

function parseTokenUserId(token: string): number | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) return null;
    const idStr = decoded.substring(0, colonIdx);
    const random = decoded.substring(colonIdx + 1);
    if (random.length < 32) return null;
    const id = parseInt(idStr, 10);
    return Number.isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

async function requireUsuario(request: NextRequest): Promise<{ id: number; nombre: string } | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const userId = parseTokenUserId(auth.slice(7));
  if (userId === null) return null;
  const { data } = await supabaseAdmin
    .from('barraca_usuarios')
    .select('id, nombre, activo')
    .eq('id', userId)
    .eq('activo', true)
    .maybeSingle();
  return data ? { id: data.id as number, nombre: (data.nombre as string) || 'Cliente' } : null;
}

export async function GET(request: NextRequest) {
  const user = await requireUsuario(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('barraca_reviews')
    .select('id, producto_id, rating, titulo, comentario, estado, created_at, barraca_productos:producto_id(id, nombre, slug)')
    .eq('usuario_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Error' }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const user = await requireUsuario(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  // Anti-spam: máximo 10 reviews por usuario por hora.
  const ip = getClientIp(request);
  const rl = rateLimit(`review-create:${user.id}:${ip}`, { maxAttempts: 10, windowSeconds: 3600 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiados reviews. Intenta más tarde.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const productoId = Number(body?.producto_id);
  const rating = Number(body?.rating);
  if (!productoId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'producto_id + rating (1-5) requeridos' }, { status: 400 });
  }

  const titulo = sanitizeString(body?.titulo)?.trim().slice(0, 100) || null;
  const comentario = sanitizeString(body?.comentario)?.trim().slice(0, 2000) || null;

  // Verifica que el producto exista.
  const { data: producto } = await supabaseAdmin
    .from('barraca_productos')
    .select('id')
    .eq('id', productoId)
    .maybeSingle();
  if (!producto) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
  }

  // Verifica si el cliente compró este producto (cotización 'pagada' con
  // este producto_id en items JSON). Si sí, marca compra_verificada.
  let compraVerificada = false;
  try {
    const { data: cots } = await supabaseAdmin
      .from('barraca_cotizaciones')
      .select('items')
      .eq('usuario_id', user.id)
      .eq('estado', 'pagada')
      .limit(50);
    if (cots && cots.length > 0) {
      for (const c of cots) {
        try {
          const items = typeof c.items === 'string' ? JSON.parse(c.items) : c.items;
          if (Array.isArray(items) && items.some((it: { producto_id?: number; id?: number }) =>
            Number(it?.producto_id) === productoId || Number(it?.id) === productoId,
          )) {
            compraVerificada = true;
            break;
          }
        } catch {
          // items mal formado en una cotización antigua; sigue buscando.
        }
      }
    }
  } catch {
    // No bloquear creación si la verificación falla.
  }

  const { data, error } = await supabaseAdmin
    .from('barraca_reviews')
    .insert({
      usuario_id: user.id,
      producto_id: productoId,
      rating,
      titulo,
      comentario,
      usuario_nombre: user.nombre,
      compra_verificada: compraVerificada,
      // Política: si compra verificada, auto-aprobado. Si no, va a moderación.
      estado: compraVerificada ? 'aprobada' : 'pendiente',
      moderado_at: compraVerificada ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya reseñaste este producto' }, { status: 409 });
    }
    console.error('[review-create-fail]', error);
    return NextResponse.json({ error: 'Error creando review' }, { status: 500 });
  }

  // Tier 6 F4: notificar admins si la review no es de compra verificada
  // (queda 'pendiente' y necesita moderación). NO bloquear el flujo si
  // falla.
  if (!compraVerificada && data?.id) {
    void createAdminNotification({
      kind: 'review_pendiente',
      title: 'Nueva review esperando moderación',
      body: `${producto ? `Producto #${productoId}` : 'Producto desconocido'} — ${rating}★ — sin compra verificada`,
      link: '/admin/reviews?estado=pendiente',
      severity: 'warning',
      ref_type: 'review',
      ref_id: String(data.id),
    });
  }

  return NextResponse.json({ ok: true, review: data });
}

export async function DELETE(request: NextRequest) {
  const user = await requireUsuario(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  // Solo permite borrar reviews PROPIAS (RLS de facto via usuario_id check).
  const { error } = await supabaseAdmin
    .from('barraca_reviews')
    .delete()
    .eq('id', id)
    .eq('usuario_id', user.id);

  if (error) return NextResponse.json({ error: 'Error eliminando' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
