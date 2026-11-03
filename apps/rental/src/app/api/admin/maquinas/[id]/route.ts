import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse, requirePermission } from '@jurmaq/shared/auth/guard';
import { logSafeError } from '@jurmaq/shared/logging';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { MaquinaEsquema } from '@/lib/esquemas';
import { camposMaquina } from '@/lib/maquinas-servidor';
import { revalidarMaquina } from '@/lib/revalidar';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  if (!(await requirePermission('maquinarias', 'update'))) return forbiddenResponse();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  const p = MaquinaEsquema.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Revisa los datos.' }, { status: 400 });

  const { data: antes } = await supabaseAdmin.from('maquinarias').select('nombre').eq('id', id).maybeSingle();
  if (!antes) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('maquinarias')
    .update(camposMaquina(p.data))
    .eq('id', id)
    .select('id, nombre, tipo')
    .single();
  if (error || !data) {
    logSafeError('[panel] editar máquina');
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }
  revalidarMaquina(data, antes.nombre);
  return NextResponse.json({ ok: true });
}
