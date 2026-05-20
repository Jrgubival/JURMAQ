import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { logContratoEvent } from '@/lib/contratos-audit';

/**
 * POST /api/admin/contratos/[id]/garantia/tradicional/devolver
 *
 * Marca como devuelta una garantía no-Klap recibida previamente. Sólo cierra
 * el ciclo (no toca el contrato — eso lo hace el flow de devolución).
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

  const { data: garantia } = await supabaseAdmin
    .from('garantias_tradicionales')
    .select('id, devuelto_at, metodo')
    .eq('contrato_id', contratoId)
    .maybeSingle();
  if (!garantia) {
    return NextResponse.json({ error: 'No hay garantía tradicional registrada' }, { status: 404 });
  }
  if (garantia.devuelto_at) {
    return NextResponse.json({ error: 'Ya fue marcada como devuelta' }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from('garantias_tradicionales')
    .update({
      devuelto_at: new Date().toISOString(),
      devuelto_by: session.user?.id ?? null,
    })
    .eq('id', garantia.id);

  if (error) {
    return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 });
  }

  await logContratoEvent(request, contratoId, 'tradicional_garantia_devuelta', {
    metodo: String(garantia.metodo),
  });

  return NextResponse.json({ ok: true });
}
