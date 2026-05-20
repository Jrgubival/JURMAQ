import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';

/**
 * GET  /api/admin/cupones — lista
 * POST /api/admin/cupones — crea
 */

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  const session = await requirePermission('barraca_promociones', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { data, error } = await supabaseAdmin
    .from('barraca_cupones')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: 'Error listando cupones' }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_promociones', 'create');
  if (!session) return forbiddenResponse('No tienes permiso');

  const body = await request.json().catch(() => ({}));
  const codigo = sanitizeString(body?.codigo)?.toUpperCase().trim() || '';
  if (!/^[A-Z0-9_-]{3,30}$/.test(codigo)) {
    return NextResponse.json({ error: 'Código inválido (3-30 chars: A-Z, 0-9, _, -)' }, { status: 400 });
  }
  const tipo = body?.tipo === 'porcentaje' || body?.tipo === 'monto_fijo' ? body.tipo : null;
  if (!tipo) return NextResponse.json({ error: 'tipo debe ser porcentaje o monto_fijo' }, { status: 400 });
  const valor = Number(body?.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: 'valor debe ser > 0' }, { status: 400 });
  }
  if (tipo === 'porcentaje' && valor > 100) {
    return NextResponse.json({ error: 'porcentaje no puede exceder 100' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('barraca_cupones')
    .insert({
      codigo,
      descripcion: sanitizeString(body?.descripcion) || null,
      tipo,
      valor,
      monto_minimo_compra: Number(body?.monto_minimo_compra) || 0,
      max_usos_total: body?.max_usos_total ? Number(body.max_usos_total) : null,
      max_usos_por_usuario: Number(body?.max_usos_por_usuario) || 1,
      valido_desde: body?.valido_desde || new Date().toISOString(),
      valido_hasta: body?.valido_hasta || null,
      activo: body?.activo !== false,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un cupón con ese código' }, { status: 409 });
    }
    console.error('[cupones-create-fail]', error);
    return NextResponse.json({ error: 'Error creando cupón' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cupon: data });
}
