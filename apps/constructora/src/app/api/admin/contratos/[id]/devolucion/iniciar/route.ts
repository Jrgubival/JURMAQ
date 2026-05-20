import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { logContratoEvent } from '@/lib/contratos-audit';

/**
 * POST /api/admin/contratos/[id]/devolucion/iniciar
 *
 * Cambia el contrato a estado='en_devolucion'. Sólo desde 'vigente' o
 * 'en_entrega' (este último por si admin se equivocó y necesita devolver
 * temprano).
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('contratos', 'update');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id } = await params;
  const contratoId = parseInt(id, 10);
  if (Number.isNaN(contratoId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const { data: contrato } = await supabaseAdmin
    .from('contratos')
    .select('id, estado')
    .eq('id', contratoId)
    .maybeSingle();
  if (!contrato) {
    return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
  }
  if (!['vigente', 'en_entrega'].includes(contrato.estado)) {
    return NextResponse.json(
      { error: `No se puede iniciar devolución desde '${contrato.estado}'` },
      { status: 409 },
    );
  }

  const { error } = await supabaseAdmin
    .from('contratos')
    .update({ estado: 'en_devolucion' })
    .eq('id', contratoId);
  if (error) {
    return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 });
  }

  await logContratoEvent(request, contratoId, 'return_registered');

  return NextResponse.json({ ok: true });
}
