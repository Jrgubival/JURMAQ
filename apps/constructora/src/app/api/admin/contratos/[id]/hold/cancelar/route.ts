import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { logContratoEvent } from '@/lib/contratos-audit';
import { klapCancel } from '@/lib/klap-client';

/**
 * POST /api/admin/contratos/[id]/hold/cancelar
 *
 * Cancela manualmente el hold activo de un contrato sin pasar por el flow de
 * devolución. Útil en casos excepcionales (cancelación de contrato, error,
 * etc.). NO cambia el estado del contrato.
 *
 * Body: { motivo: string }
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

  const body = await request.json().catch(() => ({}));
  const motivo = sanitizeString(body?.motivo) || 'manual_admin';

  const { data: hold } = await supabaseAdmin
    .from('klap_holds')
    .select('id, hold_actual_id, monto')
    .eq('contrato_id', contratoId)
    .in('estado', ['active', 'renewed'])
    .order('autorizado_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!hold) {
    return NextResponse.json({ error: 'No hay hold activo para este contrato' }, { status: 404 });
  }

  const result = await klapCancel({
    consumer_transaction_id: crypto.randomUUID(),
    consumer_original_transaction_id: hold.hold_actual_id as string,
    amount: { value: Number(hold.monto), currency_code: 'CLP' },
  });

  if (!result.ok) {
    return NextResponse.json({ error: 'Klap rechazó cancel', detalle: result.error }, { status: 502 });
  }

  await supabaseAdmin
    .from('klap_holds')
    .update({
      estado: 'cancelled',
      cancelado_at: new Date().toISOString(),
      cancelado_motivo: motivo,
    })
    .eq('id', hold.id);

  await supabaseAdmin.from('klap_eventos').insert({
    evento_tipo: 'deposit_released',
    contrato_id: contratoId,
    hold_id: hold.id,
    klap_transaction_id: result.data?.trx_id ?? null,
    raw_response: result.raw ?? null,
    origen: 'admin',
    triggered_by: session.user?.id ?? null,
  });
  await logContratoEvent(request, contratoId, 'deposit_released', { motivo, manual: true });

  return NextResponse.json({ ok: true, hold_id: hold.id });
}
