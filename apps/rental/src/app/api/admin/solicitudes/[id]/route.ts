import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse, requirePermission } from '@jurmaq/shared/auth/guard';
import { logSafeError } from '@jurmaq/shared/logging';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { origenValido } from '@/lib/origen';

/** DELETE /api/admin/solicitudes/[id] — descarta una solicitud web. La deja cancelada, no la borra. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  if (!(await requirePermission('cotizaciones', 'update'))) return forbiddenResponse();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  const { data, error } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .update({ estado: 'cancelada' })
    .eq('id', id)
    .eq('origen', 'web')
    .eq('estado', 'enviada')
    .select('id')
    .maybeSingle();
  if (error) {
    logSafeError('[panel] descartar solicitud');
    return NextResponse.json({ error: 'No se pudo descartar.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
