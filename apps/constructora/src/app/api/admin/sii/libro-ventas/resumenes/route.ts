import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';

export async function GET(_request: NextRequest) {
  const session = await requirePermission('combustible', 'read');
  if (!session) return forbiddenResponse('No autorizado');

  const { data, error } = await supabaseAdmin
    .from('iva_resumen_mensual')
    .select('*')
    .limit(36);

  if (error) {
    console.error('[sii-resumen]', error);
    return NextResponse.json({ error: 'Error cargando resumenes' }, { status: 500 });
  }
  return NextResponse.json(data || []);
}
