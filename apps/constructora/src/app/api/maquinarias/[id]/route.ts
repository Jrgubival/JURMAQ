import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, unauthorizedResponse, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { can } from '@jurmaq/shared/roles';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Campos internos (garantia_monto, tipo_combustible) SOLO para quien puede
    // editar maquinarias; el catálogo público sigue recibiendo la proyección
    // acotada de siempre.
    //
    // Esto existe porque el modal de edición del admin se llenaba desde la
    // respuesta pública: `maq.garantia_monto || 0` daba `undefined || 0` = 0 y
    // el PUT lo guardaba, poniendo la garantía en 0 en CADA guardado. Lo mismo
    // dejaba `tipo_combustible` en null. Dar el dato real al formulario es la
    // única forma de que no vuelva a pisar lo que no mostró.
    const puedeEditar = await requirePermission('maquinarias', 'update');
    const columnas = puedeEditar
      ? 'id, nombre, tipo, descripcion, especificaciones, precio_dia, precio_semana, precio_mes, estado, imagen, garantia_monto, tipo_combustible'
      : 'id, nombre, tipo, descripcion, especificaciones, precio_dia, precio_semana, precio_mes, estado, imagen';

    const { data: result, error } = await supabaseAdmin
      .from('maquinarias')
      .select(columnas)
      .eq('id', parseInt(id))
      .single();

    if (error || !result) {
      return NextResponse.json(
        { error: 'Maquinaria no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching maquinaria:', error);
    return NextResponse.json(
      { error: 'Error al obtener maquinaria' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    // Requiere update_estado como mínimo. Operador solo puede cambiar
    // estado; admin/gerente pueden todo. Lo decidimos por rol abajo.
    const session = await requireAuth();
    if (!session) return unauthorizedResponse();

    const role = (session.user as { role?: string }).role;
    const canFullEdit = can(role, 'maquinarias', 'update');
    const canEstadoOnly = can(role, 'maquinarias', 'update_estado');
    if (!canFullEdit && !canEstadoOnly) {
      return forbiddenResponse('No tienes permiso para editar máquinas');
    }

    const { id } = await params;
    const body = await request.json();

    const { data: existing } = await supabaseAdmin
      .from('maquinarias')
      .select('id')
      .eq('id', parseInt(id))
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Maquinaria no encontrada' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (canFullEdit) {
      // Admin / gerente pueden modificar todos los campos.
      if (body.nombre !== undefined) updateData.nombre = body.nombre;
      if (body.tipo !== undefined) updateData.tipo = body.tipo;
      if (body.descripcion !== undefined) updateData.descripcion = body.descripcion;
      if (body.especificaciones !== undefined) {
        // `JSON.stringify(null)` devuelve el string "null" —cuatro letras— y eso
        // era lo que quedaba guardado cuando el formulario mandaba null,
        // destruyendo marca/modelo/serie/año (los campos que salen impresos en
        // el contrato). null tiene que llegar a la columna como NULL de verdad.
        const espec = body.especificaciones;
        updateData.especificaciones =
          espec === null || espec === undefined
            ? null
            : typeof espec === 'string'
              ? espec
              : JSON.stringify(espec);
      }
      if (body.precioDia !== undefined) updateData.precio_dia = body.precioDia;
      if (body.precio_dia !== undefined) updateData.precio_dia = body.precio_dia;
      if (body.precioSemana !== undefined) updateData.precio_semana = body.precioSemana;
      if (body.precio_semana !== undefined) updateData.precio_semana = body.precio_semana;
      if (body.precioMes !== undefined) updateData.precio_mes = body.precioMes;
      if (body.precio_mes !== undefined) updateData.precio_mes = body.precio_mes;
      if (body.garantiaMonto !== undefined) updateData.garantia_monto = body.garantiaMonto;
      if (body.garantia_monto !== undefined) updateData.garantia_monto = body.garantia_monto;
      const ALLOWED_COMBUSTIBLE = new Set(['diesel', 'gasolina_93', 'gasolina_95', 'gasolina_97', 'kerosene', 'otro']);
      const tipoCombustibleIn = body.tipoCombustible ?? body.tipo_combustible;
      if (tipoCombustibleIn !== undefined) {
        updateData.tipo_combustible =
          typeof tipoCombustibleIn === 'string' && tipoCombustibleIn && ALLOWED_COMBUSTIBLE.has(tipoCombustibleIn)
            ? tipoCombustibleIn
            : null;
      }
      if (body.imagen !== undefined) updateData.imagen = body.imagen;
    }
    // Estado lo puede cambiar tanto admin/gerente como operador.
    if (body.estado !== undefined) {
      const ALLOWED_ESTADO = new Set(['disponible', 'arrendada', 'mantencion']);
      if (!ALLOWED_ESTADO.has(body.estado)) {
        return NextResponse.json({ error: 'Estado invalido' }, { status: 400 });
      }
      updateData.estado = body.estado;
    }

    const { data: result, error } = await supabaseAdmin
      .from('maquinarias')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating maquinaria:', error);
    return NextResponse.json(
      { error: 'Error al actualizar maquinaria' },
      { status: 500 }
    );
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
    // Solo admin/gerente eliminan máquinas.
    const session = await requirePermission('maquinarias', 'delete');
    if (!session) return forbiddenResponse('Solo administradores pueden eliminar máquinas');
    void session;

    const { id } = await params;

    const { data: existing } = await supabaseAdmin
      .from('maquinarias')
      .select('id')
      .eq('id', parseInt(id))
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Maquinaria no encontrada' },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from('maquinarias')
      .delete()
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({ message: 'Maquinaria eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting maquinaria:', error);
    return NextResponse.json(
      { error: 'Error al eliminar maquinaria' },
      { status: 500 }
    );
  }
}
