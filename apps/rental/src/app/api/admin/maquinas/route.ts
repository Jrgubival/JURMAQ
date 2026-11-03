import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse, requirePermission } from '@jurmaq/shared/auth/guard';
import { logSafeError } from '@jurmaq/shared/logging';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { MaquinaEsquema } from '@/lib/esquemas';
import { camposMaquina } from '@/lib/maquinas-servidor';
import { revalidarMaquina } from '@/lib/revalidar';

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  if (!(await requirePermission('maquinarias', 'create'))) return forbiddenResponse();
  const p = MaquinaEsquema.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Revisa los datos.' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('maquinarias')
    .insert(camposMaquina(p.data))
    .select('id, nombre, tipo')
    .single();
  if (error || !data) {
    logSafeError('[panel] crear máquina');
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }
  revalidarMaquina(data);
  return NextResponse.json({ id: data.id }, { status: 201 });
}
