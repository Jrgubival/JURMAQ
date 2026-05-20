import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';

/**
 * GET /api/admin/reviews?estado=pendiente
 *
 * Lista reviews para moderación. Embed producto + usuario para que el
 * moderador tenga contexto.
 *
 * Tier 4 D2: Reviews/Ratings.
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await requirePermission('barraca_reviews', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado'); // 'pendiente' | 'aprobada' | 'rechazada' | null
  const productoId = searchParams.get('producto_id');

  let query = supabaseAdmin
    .from('barraca_reviews')
    .select(`
      id, usuario_id, producto_id, rating, titulo, comentario,
      estado, usuario_nombre, compra_verificada, utiles_count,
      moderado_at, notas_moderacion, created_at,
      barraca_productos:producto_id ( id, nombre, slug ),
      barraca_usuarios:usuario_id ( email )
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (estado && ['pendiente', 'aprobada', 'rechazada'].includes(estado)) {
    query = query.eq('estado', estado);
  }
  if (productoId) {
    query = query.eq('producto_id', Number(productoId));
  }

  const { data, error } = await query;
  if (error) {
    console.error('[reviews-list-fail]', error);
    return NextResponse.json({ error: 'Error listando reviews' }, { status: 500 });
  }

  // Conteos por estado (cards arriba).
  const { count: pendientesCount } = await supabaseAdmin
    .from('barraca_reviews')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'pendiente');

  return NextResponse.json({ items: data ?? [], pendientesCount: pendientesCount ?? 0 });
}
