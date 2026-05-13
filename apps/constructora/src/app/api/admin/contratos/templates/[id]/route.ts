import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeString, isValidOrigin } from '@jurmaq/shared/sanitize';

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * GET /api/admin/contratos/templates/[id]
 * Fetch a single template (admin only).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission('contratos', 'manage_templates');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const numericId = parseId(id);
    if (!numericId) return NextResponse.json({ error: 'ID invalido' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('contratos_templates')
      .select('*')
      .eq('id', numericId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Template no encontrado' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error al obtener template:', error);
    return NextResponse.json({ error: 'Error al obtener template' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/contratos/templates/[id]
 * Update template fields. If marking activo=true, unset activo on others.
 * NOTE: we intentionally do NOT support DELETE — existing contracts reference
 * templates and deleting would break audit trails.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const session = await requirePermission('contratos', 'manage_templates');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const numericId = parseId(id);
    if (!numericId) return NextResponse.json({ error: 'ID invalido' }, { status: 400 });

    const { data: existing } = await supabaseAdmin
      .from('contratos_templates')
      .select('id')
      .eq('id', numericId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Template no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const update: Record<string, unknown> = {};

    if (body.nombre !== undefined) {
      const n = sanitizeString(body.nombre);
      if (!n) return NextResponse.json({ error: 'nombre invalido' }, { status: 400 });
      update.nombre = n;
    }
    if (body.contenido !== undefined) {
      if (typeof body.contenido !== 'string' || body.contenido.trim().length < 10) {
        return NextResponse.json({ error: 'contenido invalido' }, { status: 400 });
      }
      update.contenido = body.contenido;
    }
    if (body.version !== undefined) {
      const v = Math.max(1, Math.round(Number(body.version) || 0));
      if (v <= 0) return NextResponse.json({ error: 'version invalida' }, { status: 400 });
      update.version = v;
    }
    if (body.activo !== undefined) update.activo = !!body.activo;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron campos para actualizar' }, { status: 400 });
    }

    // Enforce single active template invariant.
    if (update.activo === true) {
      await supabaseAdmin
        .from('contratos_templates')
        .update({ activo: false })
        .neq('id', numericId)
        .eq('activo', true);
    }

    const { data, error } = await supabaseAdmin
      .from('contratos_templates')
      .update(update)
      .eq('id', numericId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error al actualizar template:', error);
    return NextResponse.json({ error: 'Error al actualizar template' }, { status: 500 });
  }
}
