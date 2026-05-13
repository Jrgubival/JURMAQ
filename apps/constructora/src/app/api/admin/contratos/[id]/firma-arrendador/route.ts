import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { logContratoEvent } from '@/lib/contratos-audit';

/**
 * POST   /api/admin/contratos/[id]/firma-arrendador
 *   Body: { firma_base64: string }
 *   Permite a un usuario admin/gerente firmar el contrato como representante
 *   de JURMAQ (arrendador). Es el complemento de la firma OTP del arrendatario.
 *
 * DELETE /api/admin/contratos/[id]/firma-arrendador
 *   Borra la firma JURMAQ (en caso de error tipográfico al firmar). Solo
 *   permitido si el contrato aún no está firmado por el arrendatario.
 *
 * Permission: contratos:update — admin y gerente, no operador ni vendedor.
 *
 * Auditoría: cada firma/desfirma queda registrada en contratos_audit_log
 * con el user_id que ejecutó la acción. Sirve para saber quién firmó cada
 * contrato si más adelante el cliente reclama.
 */

const MAX_SIGNATURE_BYTES = 400 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  const session = await requirePermission('contratos', 'update');
  if (!session) return forbiddenResponse('No tienes permiso para firmar contratos');

  const { id } = await params;
  const contratoId = parseInt(id, 10);
  if (!Number.isFinite(contratoId) || contratoId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const firmaBase64 = typeof body.firma_base64 === 'string' ? body.firma_base64 : null;
  if (!firmaBase64 || firmaBase64.length < 100) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
  }
  if (firmaBase64.length > MAX_SIGNATURE_BYTES) {
    return NextResponse.json({ error: 'Firma demasiado grande' }, { status: 400 });
  }
  if (!/^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(firmaBase64.replace(/\s/g, ''))) {
    return NextResponse.json({ error: 'Formato de firma inválido' }, { status: 400 });
  }

  // Verify contract exists and isn't anulado.
  const { data: contrato } = await supabaseAdmin
    .from('contratos')
    .select('id, estado')
    .eq('id', contratoId)
    .single();
  if (!contrato) {
    return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
  }
  if (contrato.estado === 'anulado') {
    return NextResponse.json({ error: 'Este contrato fue anulado' }, { status: 410 });
  }

  // Cache the signer's name at signing time so it survives later renames /
  // role changes on the user row.
  const userId = (session?.user as { id?: number | string } | undefined)?.id;
  const userName = (session?.user as { name?: string } | undefined)?.name || null;
  const userIdNum = typeof userId === 'number' ? userId : userId ? parseInt(String(userId), 10) : null;

  const { error: updateError } = await supabaseAdmin
    .from('contratos')
    .update({
      firma_arrendador: firmaBase64,
      firma_arrendador_at: new Date().toISOString(),
      firma_arrendador_user_id: Number.isFinite(userIdNum) ? userIdNum : null,
      firma_arrendador_nombre: userName,
    })
    .eq('id', contratoId);

  if (updateError) {
    console.error('[firma-arrendador-update-fail]', contratoId, updateError.message);
    return NextResponse.json({ error: 'Error al guardar la firma' }, { status: 500 });
  }

  await logContratoEvent(request, contratoId, 'arrendador_signed', {
    user_id: userIdNum,
    user_name: userName,
  });

  return NextResponse.json({ success: true, firmado_por: userName, firmado_at: new Date().toISOString() });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  const session = await requirePermission('contratos', 'update');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id } = await params;
  const contratoId = parseInt(id, 10);
  if (!Number.isFinite(contratoId) || contratoId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  // Don't allow unsigning if the customer already signed — at that point the
  // contract is locked.
  const { data: contrato } = await supabaseAdmin
    .from('contratos')
    .select('id, estado, firma_arrendatario')
    .eq('id', contratoId)
    .single();
  if (!contrato) {
    return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
  }
  if (contrato.firma_arrendatario || contrato.estado === 'firmado' || contrato.estado === 'vigente') {
    return NextResponse.json(
      { error: 'No se puede borrar la firma JURMAQ después de que el arrendatario firmó.' },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin
    .from('contratos')
    .update({
      firma_arrendador: null,
      firma_arrendador_at: null,
      firma_arrendador_user_id: null,
      firma_arrendador_nombre: null,
    })
    .eq('id', contratoId);

  if (error) {
    console.error('[firma-arrendador-delete-fail]', contratoId, error.message);
    return NextResponse.json({ error: 'Error al borrar la firma' }, { status: 500 });
  }

  const userId = (session?.user as { id?: number | string } | undefined)?.id;
  const userIdNum = typeof userId === 'number' ? userId : userId ? parseInt(String(userId), 10) : null;
  await logContratoEvent(request, contratoId, 'arrendador_unsigned', { user_id: userIdNum });

  return NextResponse.json({ success: true });
}
