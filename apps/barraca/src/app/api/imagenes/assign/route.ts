import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { productoId, imagen, similarIds } = body;

    if (!productoId || !imagen) {
      return NextResponse.json(
        { error: 'productoId e imagen son requeridos' },
        { status: 400 }
      );
    }

    // Update the main product
    const { error: mainError } = await supabaseAdmin
      .from('barraca_productos')
      .update({ imagen })
      .eq('id', productoId);

    if (mainError) throw mainError;

    let updatedCount = 1;

    // Update similar products if provided
    if (similarIds && Array.isArray(similarIds) && similarIds.length > 0) {
      const { data: similarUpdated, error: similarError } = await supabaseAdmin
        .from('barraca_productos')
        .update({ imagen })
        .in('id', similarIds)
        .select('id');

      if (similarError) throw similarError;
      updatedCount += similarUpdated?.length || 0;
    }

    return NextResponse.json({ updated: updatedCount });
  } catch (error) {
    console.error('Error asignando imagen:', error);
    return NextResponse.json(
      { error: 'Error al asignar imagen' },
      { status: 500 }
    );
  }
}
