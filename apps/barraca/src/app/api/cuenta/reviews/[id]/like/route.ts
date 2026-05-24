import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { parseBarracaUserToken, extractBearerToken } from '@/lib/barraca-auth';

/**
 * POST   /api/cuenta/reviews/[id]/like   — cliente marca "me sirvió"
 * DELETE /api/cuenta/reviews/[id]/like   — cliente retira su like
 *
 * El trigger trg_barraca_review_like_count actualiza el contador automático.
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
