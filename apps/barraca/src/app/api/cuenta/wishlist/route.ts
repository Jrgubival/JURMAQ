import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { parseBarracaUserToken, extractBearerToken } from '@/lib/barraca-auth';

/**
 * Wishlist barraca (D3 Tier 4).
 *
 * GET    /api/cuenta/wishlist                 → lista del cliente logueado
 * POST   /api/cuenta/wishlist  { producto_id } → agregar
 * DELETE /api/cuenta/wishlist?producto_id=N   → quitar
 *
 * Auth: token barraca (header Authorization: Bearer <token>) — patrón
 * existente del /api/auth de barraca.
 */

export const runtime = 'nodejs';

async function requireUsuario(request: NextRequest): Promise<number | null> {
  // Token parsing dual-mode (audit fase 2A.1).
  const token = extractBearerToken(request);
  if (!token) return null;
  const userId = await parseBarracaUserToken(token);
  if (userId === null) return null;
  const { data } = await supabaseAdmin
    .from('barraca_usuarios')
    .select('id, activo')
    .eq('id', userId)
    .eq('activo', true)
    .maybeSingle();
  return data ? userId : null;
}

export async function GET(request: NextRequest) {
  const uid = await requireUsuario(request);
  if (!uid) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data } = await supabaseAdmin
    .from('barraca_wishlist')
    .select(
      'id, producto_id, created_at, barraca_productos!inner(id, nombre, slug, precio, imagen, stock)',
    )
    .eq('usuario_id', uid)
    .order('created_at', { ascending: false });

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const uid = await requireUsuario(request);
  if (!uid) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const producto_id = Number(body?.producto_id);
  if (!Number.isInteger(producto_id) || producto_id <= 0) {
    return NextResponse.json({ error: 'producto_id inválido' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('barraca_wishlist')
    .insert({ usuario_id: uid, producto_id })
    .select('id')
    .maybeSingle();

  if (error && error.code !== '23505') {
    // 23505 = unique violation (ya estaba en wishlist) → idempotente OK
    return NextResponse.json({ error: 'No se pudo agregar' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const uid = await requireUsuario(request);
  if (!uid) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const producto_id = parseInt(searchParams.get('producto_id') || '0', 10);
  if (!producto_id) {
    return NextResponse.json({ error: 'producto_id inválido' }, { status: 400 });
  }

  await supabaseAdmin
    .from('barraca_wishlist')
    .delete()
    .eq('usuario_id', uid)
    .eq('producto_id', producto_id);

  return NextResponse.json({ ok: true });
}
