import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

/**
 * PUT /api/admin/contratos/[id]/garantia/metodo
 *
 * Setea el método de garantía del contrato (klap_hold | cheque | etc).
 * Sólo permitido cuando el contrato está en borrador o pendiente_firma; una
 * vez en estado vigente / en_entrega no se puede cambiar el método para
 * proteger la integridad del flow operativo.
 *
 * Body: { metodo: 'klap_hold' | 'cheque' | 'deposito_efectivo' | 'transferencia' | 'pagare' }
 */

const METODOS_VALIDOS = ['klap_hold', 'cheque', 'deposito_efectivo', 'transferencia', 'pagare'] as const;
const ESTADOS_PERMITIDOS = ['borrador', 'pendiente_firma', 'firmado'];

export async function PUT(
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

  const body = await request.json().catch(() => null);
  const metodo = typeof body?.metodo === 'string' ? body.metodo : '';
  if (!METODOS_VALIDOS.includes(metodo as (typeof METODOS_VALIDOS)[number])) {
    return NextResponse.json({ error: 'metodo inválido' }, { status: 400 });
  }

  const { data: contrato } = await supabaseAdmin
    .from('contratos')
    .select('id, estado, garantia_metodo')
    .eq('id', contratoId)
    .maybeSingle();

  if (!contrato) {
    return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
  }
  if (!ESTADOS_PERMITIDOS.includes(contrato.estado)) {
    return NextResponse.json(
      { error: `No se puede cambiar el método cuando el contrato está en estado '${contrato.estado}'` },
      { status: 409 },
    );
  }

  const { error: updErr } = await supabaseAdmin
    .from('contratos')
    .update({ garantia_metodo: metodo })
    .eq('id', contratoId);
  if (updErr) {
    return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, garantia_metodo: metodo });
}
