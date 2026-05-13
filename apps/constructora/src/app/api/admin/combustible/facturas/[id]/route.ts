import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { ALLOWED_ESTADOS, getSignedUrl, parseNumericId } from '../../_helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission('combustible', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id: rawId } = await params;
  const id = parseNumericId(rawId);
  if (!id) return NextResponse.json({ error: 'ID invalido' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('combustible_facturas')
    .select('*, combustible_items(*, maquinarias(id, nombre, tipo_combustible), contratos(id, numero))')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  return NextResponse.json({
    ...data,
    items: data.combustible_items || [],
    combustible_items: undefined,
    archivo_signed_url: await getSignedUrl(data.archivo_url),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  const session = await requirePermission('combustible', 'update');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id: rawId } = await params;
  const id = parseNumericId(rawId);
  if (!id) return NextResponse.json({ error: 'ID invalido' }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 });

  const update: Record<string, unknown> = {};

  if (body.estado !== undefined) {
    if (!ALLOWED_ESTADOS.has(body.estado)) return NextResponse.json({ error: 'Estado invalido' }, { status: 400 });
    update.estado = body.estado;
  }
  if (body.fecha !== undefined) update.fecha = body.fecha;
  if (body.proveedor_nombre !== undefined) update.proveedor_nombre = sanitizeString(body.proveedor_nombre);
  if (body.proveedor_rut !== undefined) update.proveedor_rut = sanitizeString(body.proveedor_rut);
  if (body.proveedor_direccion !== undefined) update.proveedor_direccion = sanitizeString(body.proveedor_direccion);
  if (body.folio !== undefined) update.folio = sanitizeString(body.folio);
  if (body.monto_neto !== undefined) update.monto_neto = Number(body.monto_neto) || null;
  if (body.monto_iva !== undefined) update.monto_iva = Number(body.monto_iva) || null;
  if (body.monto_total !== undefined) update.monto_total = Math.round(Number(body.monto_total) || 0);
  if (body.monto_iec !== undefined) update.monto_iec = Number(body.monto_iec) || null;
  if (body.recuperable !== undefined) update.recuperable = !!body.recuperable;
  if (body.mes_tributario !== undefined) update.mes_tributario = body.mes_tributario;
  if (body.archivo_url !== undefined) update.archivo_url = body.archivo_url;
  if (body.archivo_nombre !== undefined) update.archivo_nombre = body.archivo_nombre;
  if (body.archivo_tamano !== undefined) update.archivo_tamano = Number(body.archivo_tamano) || null;
  if (body.notas !== undefined) update.notas = sanitizeString(body.notas);

  const { data, error } = await supabaseAdmin
    .from('combustible_facturas')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  const session = await requirePermission('combustible', 'delete');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id: rawId } = await params;
  const id = parseNumericId(rawId);
  if (!id) return NextResponse.json({ error: 'ID invalido' }, { status: 400 });

  // Protect 'recuperada' from deletion
  const { data: existing } = await supabaseAdmin.from('combustible_facturas').select('estado').eq('id', id).single();
  if (existing?.estado === 'recuperada') {
    return NextResponse.json({ error: 'No se puede eliminar una factura ya recuperada. Anulala en su lugar.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('combustible_facturas').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });
  return NextResponse.json({ success: true });
}
