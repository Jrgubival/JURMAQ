import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

export async function PUT(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await requirePermission('barraca_imagenes', 'update');
    if (!session) return forbiddenResponse('No tienes permiso');

    // Bulk image update touches many rows; cap to 5/min/IP.
    const ip = getClientIp(request);
    const limiter = rateLimit(`bulk-image:${ip}`, { maxAttempts: 5, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json({ error: 'Demasiadas operaciones masivas. Espera un minuto.' }, { status: 429 });
    }

    const body = await request.json();
    const { action, categoriaId, ids, namePrefix, imagen } = body;

    if (!imagen) {
      return NextResponse.json({ error: 'imagen es requerida' }, { status: 400 });
    }

    let updated = 0;

    if (action === 'by_category') {
      if (!categoriaId) {
        return NextResponse.json({ error: 'categoriaId es requerido para action by_category' }, { status: 400 });
      }

      // Update products in this category that have null or local-path images
      const { data, error } = await supabaseAdmin
        .from('barraca_productos')
        .update({ imagen })
        .eq('categoria_id', categoriaId)
        .or('imagen.is.null,imagen.like./images/barraca/%')
        .select('id');

      if (error) throw error;
      updated = data?.length || 0;

    } else if (action === 'by_ids') {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'ids es requerido para action by_ids' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('barraca_productos')
        .update({ imagen })
        .in('id', ids)
        .select('id');

      if (error) throw error;
      updated = data?.length || 0;

    } else if (action === 'by_name_prefix') {
      if (!namePrefix) {
        return NextResponse.json({ error: 'namePrefix es requerido para action by_name_prefix' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('barraca_productos')
        .update({ imagen })
        .ilike('nombre', `${namePrefix}%`)
        .select('id');

      if (error) throw error;
      updated = data?.length || 0;

    } else {
      return NextResponse.json({ error: 'action debe ser by_category, by_ids, o by_name_prefix' }, { status: 400 });
    }

    return NextResponse.json({ updated });
  } catch (error) {
    console.error('Error en bulk-image:', error);
    return NextResponse.json(
      { error: 'Error al actualizar imagenes' },
      { status: 500 }
    );
  }
}
