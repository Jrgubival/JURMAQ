import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';

/**
 * GET /api/public/productos/[id]/reviews
 *
 * Lista de reviews APROBADAS del producto + agregado (avg, count, breakdown 1-5).
 * Sin auth — endpoint público para la página del producto.
 */

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const productoId = Number(rawId);
  if (!productoId || !Number.isInteger(productoId)) {
    return NextResponse.json({ error: 'producto_id inválido' }, { status: 400 });
  }

  const [reviewsRes, ratingRes] = await Promise.all([
    supabaseAdmin
      .from('barraca_reviews')
      .select('id, rating, titulo, comentario, usuario_nombre, compra_verificada, utiles_count, created_at')
      .eq('producto_id', productoId)
      .eq('estado', 'aprobada')
      .order('utiles_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('barraca_productos_rating')
      .select('total_reviews, rating_promedio, r5, r4, r3, r2, r1')
      .eq('producto_id', productoId)
      .maybeSingle(),
  ]);

  if (reviewsRes.error) {
    console.error('[reviews-public-fail]', reviewsRes.error);
    return NextResponse.json({ error: 'Error cargando reviews' }, { status: 500 });
  }

  return NextResponse.json({
    items: reviewsRes.data ?? [],
    rating: ratingRes.data ?? {
      total_reviews: 0,
      rating_promedio: null,
      r5: 0,
      r4: 0,
      r3: 0,
      r2: 0,
      r1: 0,
    },
  });
}
