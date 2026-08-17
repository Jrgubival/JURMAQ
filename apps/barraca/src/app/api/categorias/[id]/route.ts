import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin, stripHtml } from '@jurmaq/shared/sanitize';

/**
 * PUT/DELETE de una categoría de barraca.
 *
 * ## Por qué esta ruta no existía
 *
 * `/admin/categorias` llamaba a `/api/categorias/{id}` para las TRES acciones
 * de escritura sobre una categoría existente —editar, activar/desactivar y
 * reordenar— pero solo existía `/api/categorias/route.ts` con GET y POST. O
 * sea: crear funcionaba y todo lo demás daba 404 desde siempre.
 *
 * Y era invisible: el cliente hacía `await fetch(...)` sin mirar `res.ok`, así
 * que el modal se cerraba, la fila no cambiaba y no aparecía ningún error.
 *
 * ## Notas
 *
 * - Whitelist explícita de campos: nunca `.update(body)` (mass assignment).
 * - `nombre` y `descripcion` pasan por `stripHtml` porque terminan inyectados
 *   en el JSON-LD público de las páginas de categoría.
 * - DELETE hace baja lógica (`activa: false`), igual que el de productos: las
 *   categorías están referenciadas por `barraca_productos.categoria_id` y un
 *   borrado físico dejaría productos huérfanos.
 */

const CAMPOS_PERMITIDOS = [
  'nombre',
  'slug',
  'descripcion',
  'imagen',
  'orden',
  'padre_id',
  'activa',
] as const;

async function idValido(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const n = Number.parseInt(id, 10);
  // Number.isFinite y no solo Number(): NaN evade cualquier comparación.
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const id = await idValido(params);
    if (id === null) return NextResponse.json({ error: 'Id inválido' }, { status: 400 });

    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    for (const campo of CAMPOS_PERMITIDOS) {
      if (body[campo] !== undefined) updateData[campo] = body[campo];
    }
    if (typeof updateData.nombre === 'string') updateData.nombre = stripHtml(updateData.nombre);
    if (typeof updateData.descripcion === 'string') {
      updateData.descripcion = stripHtml(updateData.descripcion);
    }
    if (updateData.orden !== undefined) {
      const orden = Number(updateData.orden);
      if (!Number.isFinite(orden)) {
        return NextResponse.json({ error: 'Orden inválido' }, { status: 400 });
      }
      updateData.orden = Math.trunc(orden);
    }
    // Una categoría no puede ser su propia madre: eso deja el árbol en un ciclo
    // y cuelga el render del mega-menú.
    if (updateData.padre_id !== undefined && Number(updateData.padre_id) === id) {
      return NextResponse.json(
        { error: 'Una categoría no puede ser su propia categoría padre' },
        { status: 400 }
      );
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('barraca_categorias')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error al actualizar categoria:', error);
    return NextResponse.json({ error: 'Error al actualizar categoria' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const id = await idValido(params);
    if (id === null) return NextResponse.json({ error: 'Id inválido' }, { status: 400 });

    // Baja lógica: hay productos apuntando a esta categoría.
    const { data, error } = await supabaseAdmin
      .from('barraca_categorias')
      .update({ activa: false })
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });

    return NextResponse.json({ mensaje: 'Categoría desactivada' });
  } catch (error) {
    console.error('Error al eliminar categoria:', error);
    return NextResponse.json({ error: 'Error al eliminar categoria' }, { status: 500 });
  }
}
