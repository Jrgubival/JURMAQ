import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

/**
 * POST /api/admin/cotizaciones-arriendo/[id]/duplicar
 *
 * F1 Tier 6 — clona una cotización existente como nueva en estado='borrador'.
 * Mantiene: datos cliente, maquinaria, ubicación, unidades, traslado.
 * Resetea: numero (se genera nuevo), fecha_servicio (admin elige), estado.
 *
 * Útil cuando un cliente recurrente pide la misma cotización en otra fecha.
 */

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('cotizaciones', 'create');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id } = await params;
  const cotId = parseInt(id, 10);
  if (Number.isNaN(cotId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const { data: original } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .select('*')
    .eq('id', cotId)
    .maybeSingle();

  if (!original) {
    return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
  }

  // Generar nuevo número.
  const { data: numeroRpc, error: numeroErr } = await supabaseAdmin.rpc('next_cot_arriendo_numero');
  if (numeroErr || !numeroRpc) {
    console.error('[duplicar-cot-numero-fail]', numeroErr);
    return NextResponse.json({ error: 'No se pudo generar número' }, { status: 500 });
  }

  // Clonar campos relevantes; resetear lo que se debe re-decidir.
  const {
    id: _id,
    numero: _numero,
    created_at: _ca,
    updated_at: _ua,
    fecha_servicio: _fs,
    fecha_solicitud: _frs,
    estado: _est,
    contrato_id: _ck,
    ...keep
  } = original;
  void _id; void _numero; void _ca; void _ua; void _fs; void _frs; void _est; void _ck;

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .insert({
      ...keep,
      numero: numeroRpc,
      estado: 'borrador',
      fecha_solicitud: new Date().toISOString(),
      fecha_servicio: null,        // admin debe re-elegir
      created_by: session.user?.id ?? null,
    })
    .select('id, numero')
    .single();

  if (insertErr || !inserted) {
    console.error('[duplicar-cot-insert-fail]', insertErr);
    return NextResponse.json({ error: 'No se pudo duplicar' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    numero: inserted.numero,
  });
}
