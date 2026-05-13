import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeString, isValidOrigin, isValidEmail } from '@jurmaq/shared/sanitize';

const EDITABLE_STATES = new Set(['borrador', 'pendiente_firma']);
const DELETABLE_STATES = new Set(['borrador']);
const ALLOWED_PRECIO_UNIDAD = new Set(['dia', 'semana', 'mes']);
const ALLOWED_TIPO = new Set(['natural', 'juridica']);
const ALLOWED_ESTADOS = new Set([
  'borrador',
  'pendiente_firma',
  'firmado',
  'vigente',
  'vencido',
  'anulado',
]);

/** Parse :id param into a numeric DB id. */
function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * GET /api/admin/contratos/[id]
 * Fetch a single contract with maquinaria joined. Admin only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission('contratos', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const numericId = parseId(id);
    if (!numericId) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('contratos')
      .select('*, maquinarias(*)')
      .eq('id', numericId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error al obtener contrato:', error);
    return NextResponse.json({ error: 'Error al obtener contrato' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/contratos/[id]
 * Update mutable fields. Only allowed while estado is borrador or pendiente_firma
 * (so already-signed contracts are immutable).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const session = await requirePermission('contratos', 'update');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const numericId = parseId(id);
    if (!numericId) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('contratos')
      .select('id, estado')
      .eq('id', numericId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    if (!EDITABLE_STATES.has(existing.estado)) {
      return NextResponse.json(
        { error: `No se puede editar un contrato en estado "${existing.estado}"` },
        { status: 409 }
      );
    }

    const body = await request.json();
    const update: Record<string, unknown> = {};

    // --- Whitelist updatable fields. Read-only: numero, firma_token, firma_*, template_id, timestamps.
    if (body.maquinaria_id !== undefined) {
      const mid = parseInt(String(body.maquinaria_id), 10);
      if (!Number.isFinite(mid) || mid <= 0) {
        return NextResponse.json({ error: 'maquinaria_id invalido' }, { status: 400 });
      }
      update.maquinaria_id = mid;
    }

    if (body.arrendatario_tipo !== undefined) {
      const tipo = sanitizeString(body.arrendatario_tipo);
      if (!tipo || !ALLOWED_TIPO.has(tipo)) {
        return NextResponse.json({ error: 'arrendatario_tipo invalido' }, { status: 400 });
      }
      update.arrendatario_tipo = tipo;
    }

    for (const field of [
      'arrendatario_nombre',
      'arrendatario_rut',
      'arrendatario_domicilio',
      'arrendatario_telefono',
      'arrendatario_profesion',
      'arrendatario_giro',
      'arrendatario_rep_legal',
      'arrendatario_rep_rut',
      'operador_nombre',
      'direccion_entrega',
      'direccion_retiro',
      'observaciones',
      'notas_internas',
    ] as const) {
      if (body[field] !== undefined) update[field] = sanitizeString(body[field]);
    }

    // razon_social alias
    if (body.razon_social !== undefined || body.arrendatario_razon_social !== undefined) {
      update.arrendatario_razon_social = sanitizeString(
        body.razon_social ?? body.arrendatario_razon_social
      );
    }

    if (body.arrendatario_email !== undefined) {
      const email = sanitizeString(body.arrendatario_email);
      if (!email || !isValidEmail(email)) {
        return NextResponse.json({ error: 'Email invalido' }, { status: 400 });
      }
      update.arrendatario_email = email;
    }

    if (body.con_operador !== undefined) update.con_operador = !!body.con_operador;

    if (body.fecha_inicio !== undefined) {
      const d = sanitizeString(body.fecha_inicio);
      if (!d || isNaN(new Date(d).getTime())) {
        return NextResponse.json({ error: 'fecha_inicio invalida' }, { status: 400 });
      }
      update.fecha_inicio = d;
    }
    if (body.fecha_termino !== undefined) {
      const d = sanitizeString(body.fecha_termino);
      if (!d || isNaN(new Date(d).getTime())) {
        return NextResponse.json({ error: 'fecha_termino invalida' }, { status: 400 });
      }
      update.fecha_termino = d;
    }

    if (body.precio_unidad !== undefined) {
      const pu = sanitizeString(body.precio_unidad);
      if (!pu || !ALLOWED_PRECIO_UNIDAD.has(pu)) {
        return NextResponse.json({ error: 'precio_unidad invalida' }, { status: 400 });
      }
      update.precio_unidad = pu;
    }
    if (body.precio_por_unidad !== undefined) {
      const v = Math.max(0, Math.round(Number(body.precio_por_unidad) || 0));
      if (v <= 0) return NextResponse.json({ error: 'precio_por_unidad debe ser positivo' }, { status: 400 });
      update.precio_por_unidad = v;
    }
    if (body.precio_total !== undefined) {
      const v = Math.max(0, Math.round(Number(body.precio_total) || 0));
      if (v <= 0) return NextResponse.json({ error: 'precio_total debe ser positivo' }, { status: 400 });
      update.precio_total = v;
    }
    if (body.garantia_monto !== undefined) {
      update.garantia_monto = Math.max(0, Math.round(Number(body.garantia_monto) || 0));
    }

    // Admin-controlled state transitions.
    if (body.estado !== undefined) {
      const e = sanitizeString(body.estado);
      if (!e || !ALLOWED_ESTADOS.has(e)) {
        return NextResponse.json({ error: 'estado invalido' }, { status: 400 });
      }
      // Don't allow PUT to flip to firmado — that's reserved for the signature flow.
      if (e === 'firmado') {
        return NextResponse.json(
          { error: 'No se puede marcar como firmado manualmente' },
          { status: 400 }
        );
      }
      update.estado = e;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron campos para actualizar' }, { status: 400 });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('contratos')
      .update(update)
      .eq('id', numericId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error al actualizar contrato:', error);
    return NextResponse.json({ error: 'Error al actualizar contrato' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/contratos/[id]
 * Only allowed while estado is 'borrador'. Signed/pending contracts must be anulados via PUT.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const session = await requirePermission('contratos', 'delete');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const numericId = parseId(id);
    if (!numericId) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('contratos')
      .select('id, estado')
      .eq('id', numericId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    if (!DELETABLE_STATES.has(existing.estado)) {
      return NextResponse.json(
        { error: `Solo se pueden eliminar contratos en borrador (estado actual: ${existing.estado})` },
        { status: 409 }
      );
    }

    const { error } = await supabaseAdmin.from('contratos').delete().eq('id', numericId);
    if (error) throw error;

    return NextResponse.json({ message: 'Contrato eliminado' });
  } catch (error) {
    console.error('Error al eliminar contrato:', error);
    return NextResponse.json({ error: 'Error al eliminar contrato' }, { status: 500 });
  }
}
