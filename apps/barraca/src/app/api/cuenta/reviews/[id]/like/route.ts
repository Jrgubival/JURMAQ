import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

/**
 * POST   /api/cuenta/reviews/[id]/like   — cliente marca "me sirvió"
 * DELETE /api/cuenta/reviews/[id]/like   — cliente retira su like
 *
 * El trigger trg_barraca_review_like_count actualiza el contador automático.
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

async function requireUsuario(request: NextRequest): Promise<number | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const userId = parseTokenUserId(auth.slice(7));
  if (userId === null) return null;
  const { data } = await supabaseAdmin
    .from('barraca_usuarios')
    .select('id, activo')
    .eq('id', userId)
    .eq('activo', true)
    .maybeSingle();
  return data ? userId : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const uid = await requireUsuario(request);
  if (!uid) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id: reviewId } = await params;
  const { error } = await supabaseAdmin
    .from('barraca_reviews_likes')
    .insert({ review_id: reviewId, usuario_id: uid });

  if (error) {
    if (error.code === '23505') {
      // Ya tenía el like — ignorar idempotentemente.
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Error marcando útil' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const uid = await requireUsuario(request);
  if (!uid) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id: reviewId } = await params;
  const { error } = await supabaseAdmin
    .from('barraca_reviews_likes')
    .delete()
    .eq('review_id', reviewId)
    .eq('usuario_id', uid);

  if (error) return NextResponse.json({ error: 'Error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
