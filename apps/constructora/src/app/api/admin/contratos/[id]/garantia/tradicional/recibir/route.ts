import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { logContratoEvent } from '@/lib/contratos-audit';

/**
 * POST /api/admin/contratos/[id]/garantia/tradicional/recibir
 *
 * Marca como recibida una garantía no-Klap (cheque, depósito, transferencia, pagaré).
 * Crea registro en garantias_tradicionales con datos específicos del método.
 *
 * Body: { monto, cheque_banco?, cheque_numero?, cheque_fecha?, transferencia_referencia?, pagare_url?, deposito_comprobante_url?, notas? }
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

  const body = await request.json().catch(() => null);
  if (!body || typeof body.monto !== 'number' || body.monto <= 0) {
    return NextResponse.json({ error: 'monto requerido' }, { status: 400 });
  }

  const { data: contrato } = await supabaseAdmin
    .from('contratos')
    .select('id, garantia_metodo')
    .eq('id', contratoId)
    .maybeSingle();
  if (!contrato) {
    return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
  }
  if (contrato.garantia_metodo === 'klap_hold') {
    return NextResponse.json(
      { error: 'Este contrato usa garantía Klap. Cambia el método primero.' },
      { status: 409 },
    );
  }

  const payload: Record<string, unknown> = {
    contrato_id: contratoId,
    metodo: contrato.garantia_metodo,
    monto: body.monto,
    cheque_banco: sanitizeString(body.cheque_banco) || null,
    cheque_numero: sanitizeString(body.cheque_numero) || null,
    cheque_fecha: typeof body.cheque_fecha === 'string' ? body.cheque_fecha : null,
    transferencia_referencia: sanitizeString(body.transferencia_referencia) || null,
    pagare_url: sanitizeString(body.pagare_url) || null,
    deposito_comprobante_url: sanitizeString(body.deposito_comprobante_url) || null,
    notas: sanitizeString(body.notas) || null,
    recibido_at: new Date().toISOString(),
    recibido_by: session.user?.id ?? null,
  };

  const { error } = await supabaseAdmin
    .from('garantias_tradicionales')
    .upsert(payload, { onConflict: 'contrato_id' });

  if (error) {
    console.error('[garantia-trad-recibir-fail]', error);
    return NextResponse.json({ error: 'No se pudo registrar' }, { status: 500 });
  }

  await logContratoEvent(request, contratoId, 'tradicional_garantia_recibida', {
    metodo: String(contrato.garantia_metodo),
    monto: body.monto,
  });

  return NextResponse.json({ ok: true });
}
