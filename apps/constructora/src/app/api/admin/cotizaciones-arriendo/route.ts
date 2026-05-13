import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';

export async function GET(_request: NextRequest) {
  // Admin-only: requiere permiso para leer cotizaciones
  const session = await requirePermission('cotizaciones', 'read');
  if (!session) return forbiddenResponse('No autorizado');

  const { data, error } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .select('id, numero, cliente_nombre, cliente_email, fecha_servicio, ubicacion_servicio, unidades_solicitadas, unidad, total, estado, created_at, maquinarias!inner(nombre)')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[admin-cot-arriendo-list]', error);
    return NextResponse.json({ error: 'Error al cargar cotizaciones' }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
