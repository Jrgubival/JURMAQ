import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';

/**
 * GET  /api/admin/maquinarias/[id]/mantenciones  → historial completo
 * POST /api/admin/maquinarias/[id]/mantenciones  → registrar nueva
 *
 * Tier 5 E2: Historial mantenciones.
 */

export const runtime = 'nodejs';

const VALID_TIPOS = new Set([
  'preventiva',
  'correctiva',
  'inspeccion',
  'cambio_aceite',
  'cambio_filtro',
  'neumaticos',
  'pintura_reparacion',
  'otro',
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requirePermission('maquinarias', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id: rawId } = await params;
  const maquinariaId = Number(rawId);
  if (!Number.isInteger(maquinariaId) || maquinariaId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('maquinaria_mantenciones')
    .select('id, tipo, descripcion, fecha, costo, horometro_km, proveedor, factura_url, proxima_mantencion_at, notas, created_at')
    .eq('maquinaria_id', maquinariaId)
    .order('fecha', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[mantenciones-list-fail]', error);
    return NextResponse.json({ error: 'Error listando mantenciones' }, { status: 500 });
  }

  // Agregados: total gastado + última + próxima
  const items = data ?? [];
  const totalGastado = items.reduce((s, m) => s + Number(m.costo || 0), 0);
  const ultima = items[0]?.fecha ?? null;
  const proximaItem = items
    .filter((m) => m.proxima_mantencion_at)
    .map((m) => new Date(m.proxima_mantencion_at as string).getTime())
    .filter((t) => t >= Date.now())
    .sort((a, b) => a - b)[0];
  const proxima = proximaItem ? new Date(proximaItem).toISOString() : null;
  const diasRestantes = proximaItem
    ? Math.ceil((proximaItem - Date.now()) / (24 * 3600 * 1000))
    : null;

  return NextResponse.json({
    items,
    stats: {
      total_gastado: totalGastado,
      total_mantenciones: items.length,
      ultima_fecha: ultima,
      proxima_at: proxima,
      dias_restantes: diasRestantes,
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('maquinarias', 'update');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id: rawId } = await params;
  const maquinariaId = Number(rawId);
  if (!Number.isInteger(maquinariaId) || maquinariaId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const tipo = String(body?.tipo || '').trim();
  if (!VALID_TIPOS.has(tipo)) {
    return NextResponse.json({ error: 'Tipo de mantención inválido' }, { status: 400 });
  }

  const descripcion = sanitizeString(body?.descripcion)?.trim() || '';
  if (!descripcion || descripcion.length < 5) {
    return NextResponse.json({ error: 'Descripción requerida (mín 5 chars)' }, { status: 400 });
  }

  const fecha = sanitizeString(body?.fecha)?.trim();
  // YYYY-MM-DD format check (HTML5 date input).
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'Fecha inválida (YYYY-MM-DD)' }, { status: 400 });
  }

  const costo = Math.max(0, Math.round(Number(body?.costo) || 0));
  if (costo > 100_000_000) {
    return NextResponse.json({ error: 'Costo demasiado alto' }, { status: 400 });
  }

  const horometroKm = body?.horometro_km !== undefined && body?.horometro_km !== null && body?.horometro_km !== ''
    ? Number(body.horometro_km)
    : null;
  if (horometroKm !== null && (!Number.isFinite(horometroKm) || horometroKm < 0)) {
    return NextResponse.json({ error: 'Horómetro/km inválido' }, { status: 400 });
  }

  const proximaAt = sanitizeString(body?.proxima_mantencion_at)?.trim() || null;
  if (proximaAt && !/^\d{4}-\d{2}-\d{2}$/.test(proximaAt)) {
    return NextResponse.json({ error: 'Próxima fecha inválida' }, { status: 400 });
  }

  // Verifica que la máquina existe.
  const { data: maq } = await supabaseAdmin
    .from('maquinarias')
    .select('id')
    .eq('id', maquinariaId)
    .maybeSingle();
  if (!maq) {
    return NextResponse.json({ error: 'Máquina no encontrada' }, { status: 404 });
  }

  const userId = (session.user as { id?: string })?.id || null;

  const { data, error } = await supabaseAdmin
    .from('maquinaria_mantenciones')
    .insert({
      maquinaria_id: maquinariaId,
      tipo,
      descripcion,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      costo,
      horometro_km: horometroKm,
      proveedor: sanitizeString(body?.proveedor)?.trim() || null,
      factura_url: sanitizeString(body?.factura_url)?.trim() || null,
      proxima_mantencion_at: proximaAt,
      notas: sanitizeString(body?.notas) || null,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('[mantencion-create-fail]', error);
    return NextResponse.json({ error: 'Error creando mantención' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mantencion: data });
}
