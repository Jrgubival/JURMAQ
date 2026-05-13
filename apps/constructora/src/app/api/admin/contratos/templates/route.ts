import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeString, isValidOrigin } from '@jurmaq/shared/sanitize';

/**
 * GET /api/admin/contratos/templates
 * List all templates (admin only). Useful to let the admin pick a version.
 */
export async function GET() {
  try {
    const session = await requirePermission('contratos', 'manage_templates');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { data, error } = await supabaseAdmin
      .from('contratos_templates')
      .select('*')
      .order('version', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error al listar templates:', error);
    return NextResponse.json({ error: 'Error al listar templates' }, { status: 500 });
  }
}

/**
 * POST /api/admin/contratos/templates
 * Create a new template. If `activo=true`, unset `activo` on all other templates
 * to guarantee a single active template at a time.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const session = await requirePermission('contratos', 'manage_templates');
    if (!session) return forbiddenResponse('No tienes permiso');

    const body = await request.json();
    const nombre = sanitizeString(body.nombre);
    const contenido = typeof body.contenido === 'string' ? body.contenido : '';
    const activo = body.activo === undefined ? true : !!body.activo;
    const version = Number.isFinite(Number(body.version)) ? Math.max(1, Math.round(Number(body.version))) : 1;

    if (!nombre) {
      return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 });
    }
    if (!contenido || contenido.trim().length < 10) {
      return NextResponse.json({ error: 'contenido es requerido' }, { status: 400 });
    }

    // If activating, clear any previous active flag first.
    if (activo) {
      await supabaseAdmin
        .from('contratos_templates')
        .update({ activo: false })
        .eq('activo', true);
    }

    const { data, error } = await supabaseAdmin
      .from('contratos_templates')
      .insert({ nombre, contenido, activo, version })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error al crear template:', error);
    return NextResponse.json({ error: 'Error al crear template' }, { status: 500 });
  }
}
