import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse, requirePermission } from '@jurmaq/shared/auth/guard';
import { logSafeError } from '@jurmaq/shared/logging';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { cabecera, filasLineas } from '@/lib/cotizaciones-servidor';
import { CotizacionEsquema, ESTADOS_COTIZACION, EstadoEsquema } from '@/lib/esquemas';

async function cargable(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  const { data } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .select('id, estado')
    .eq('id', id)
    .eq('origen', 'panel')
    .maybeSingle();
  // Con contrato ya no se edita desde aquí.
  return data && (ESTADOS_COTIZACION as readonly string[]).includes(data.estado) ? data : null;
}

/** PATCH con `{ estado }` cambia el estado; con la cotización completa la reemplaza. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  if (!(await requirePermission('cotizaciones', 'update'))) return forbiddenResponse();
  const actual = await cargable((await params).id);
  if (!actual) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  const json = await request.json().catch(() => null);

  const soloEstado = EstadoEsquema.safeParse(json);
  if (soloEstado.success) {
    const { estado } = soloEstado.data;
    const { error } = await supabaseAdmin
      .from('cotizaciones_arriendo')
      .update({ estado, ...(estado === 'enviada' ? { enviada_at: new Date().toISOString() } : {}) })
      .eq('id', actual.id);
    if (error) return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const p = CotizacionEsquema.safeParse(json);
  if (!p.success) return NextResponse.json({ error: 'Revisa los datos.' }, { status: 400 });
  const cab = cabecera(p.data);
  if (!cab) return NextResponse.json({ error: 'Agrega al menos una máquina.' }, { status: 400 });

  // Primero las líneas nuevas: si algo falla, la cotización no queda vacía.
  const { data: viejas } = await supabaseAdmin.from('cotizacion_arriendo_lineas').select('id').eq('cotizacion_id', actual.id);
  const { error: errLineas } = await supabaseAdmin.from('cotizacion_arriendo_lineas').insert(filasLineas(actual.id, p.data.lineas));
  if (errLineas) {
    logSafeError('[panel] líneas');
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }
  const ids = (viejas ?? []).map((l) => l.id);
  if (ids.length > 0) await supabaseAdmin.from('cotizacion_arriendo_lineas').delete().in('id', ids);
  const { error } = await supabaseAdmin.from('cotizaciones_arriendo').update(cab).eq('id', actual.id);
  if (error) {
    logSafeError('[panel] editar cotización');
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
