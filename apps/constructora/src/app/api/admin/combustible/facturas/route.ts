import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString, escapeOrFilter } from '@jurmaq/shared/sanitize';
import type { Database } from '@jurmaq/shared/db-types';
import {
  ALLOWED_ESTADOS,
  ALLOWED_TIPOS_COMBUSTIBLE,
  ALLOWED_TIPOS_DOCUMENTO,
  computeMesTributario,
  getSignedUrl,
} from '../_helpers';

type CombustibleFacturaRow = Database['public']['Tables']['combustible_facturas']['Row'];
type CombustibleItemRow = Database['public']['Tables']['combustible_items']['Row'];
type FacturaWithItems = CombustibleFacturaRow & {
  combustible_items: CombustibleItemRow[] | null;
};

type FacturaItemInput = {
  tipo_combustible: string;
  litros: number | string;
  monto: number | string;
  maquinaria_id?: number | string | null;
  contrato_id?: number | string | null;
  precio_por_litro?: number | string | null;
  horometro?: number | string | null;
  odometro?: number | string | null;
  observaciones?: string | null;
};

/**
 * GET /api/admin/combustible/facturas
 * Filters: ?estado, ?mes=YYYY-MM, ?maquinaria_id, ?buscar, ?desde, ?hasta
 */
export async function GET(request: NextRequest) {
  const session = await requirePermission('combustible', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado');
  const mes = searchParams.get('mes');
  const maquinariaId = searchParams.get('maquinaria_id');
  const buscar = searchParams.get('buscar');
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');

  let query = supabaseAdmin
    .from('combustible_facturas')
    .select('*, combustible_items(*, maquinarias(id, nombre, tipo_combustible), contratos(id, numero))')
    .order('fecha', { ascending: false });

  if (estado && ALLOWED_ESTADOS.has(estado)) query = query.eq('estado', estado);
  if (mes && /^\d{4}-\d{2}$/.test(mes)) query = query.eq('mes_tributario', mes);
  if (desde) query = query.gte('fecha', desde);
  if (hasta) query = query.lte('fecha', hasta);
  if (buscar) {
    // SECURITY (audit fase 2C.1): estandarizado a escapeOrFilter de shared.
    const safe = escapeOrFilter(buscar.trim().slice(0, 80));
    if (safe) {
      query = query.or(`folio.ilike.%${safe}%,proveedor_nombre.ilike.%${safe}%,proveedor_rut.ilike.%${safe}%`);
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error listing combustible facturas:', error);
    return NextResponse.json({ error: 'Error al listar facturas' }, { status: 500 });
  }

  // Filter by maquinaria_id client-side since it's in the nested items
  let results = (data || []) as FacturaWithItems[];
  if (maquinariaId) {
    const mId = parseInt(maquinariaId, 10);
    results = results.filter((f: FacturaWithItems) =>
      Array.isArray(f.combustible_items) &&
      f.combustible_items.some((i: CombustibleItemRow) => i.maquinaria_id === mId)
    );
  }

  // Resolve signed URLs
  const withUrls = await Promise.all(results.map(async (f: FacturaWithItems) => ({
    ...f,
    items: f.combustible_items || [],
    combustible_items: undefined,
    archivo_signed_url: await getSignedUrl(f.archivo_url),
  })));

  return NextResponse.json(withUrls);
}

/**
 * POST /api/admin/combustible/facturas
 * Create factura + items atomically.
 */
export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  const session = await requirePermission('combustible', 'create');
  if (!session) return forbiddenResponse('No tienes permiso');

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 });
  }

  // Validate header
  const fecha = typeof body.fecha === 'string' ? body.fecha : null;
  const proveedorNombre = sanitizeString(body.proveedor_nombre);
  const folio = sanitizeString(body.folio);
  const montoTotal = Number(body.monto_total) || 0;

  if (!fecha || !/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    return NextResponse.json({ error: 'Fecha requerida (YYYY-MM-DD)' }, { status: 400 });
  }
  if (!proveedorNombre) return NextResponse.json({ error: 'Proveedor requerido' }, { status: 400 });
  if (!folio) return NextResponse.json({ error: 'Folio requerido' }, { status: 400 });
  if (montoTotal <= 0) return NextResponse.json({ error: 'Monto total debe ser > 0' }, { status: 400 });

  const tipoDocumento = typeof body.tipo_documento === 'string' && ALLOWED_TIPOS_DOCUMENTO.has(body.tipo_documento)
    ? body.tipo_documento
    : 'factura_electronica';

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: 'Debe registrar al menos un item' }, { status: 400 });
  }
  if (items.length > 50) {
    return NextResponse.json({ error: 'Maximo 50 items por factura' }, { status: 400 });
  }

  // Validate each item
  for (const item of items) {
    if (!ALLOWED_TIPOS_COMBUSTIBLE.has(item.tipo_combustible)) {
      return NextResponse.json({ error: 'Tipo de combustible invalido en items' }, { status: 400 });
    }
    const litros = Number(item.litros);
    const monto = Number(item.monto);
    if (!Number.isFinite(litros) || litros <= 0) {
      return NextResponse.json({ error: 'Litros debe ser > 0 en cada item' }, { status: 400 });
    }
    if (!Number.isFinite(monto) || monto < 0) {
      return NextResponse.json({ error: 'Monto invalido en item' }, { status: 400 });
    }
  }

  const mesTributario = body.mes_tributario || computeMesTributario(fecha);

  const insertData = {
    fecha,
    proveedor_nombre: proveedorNombre,
    proveedor_rut: sanitizeString(body.proveedor_rut),
    proveedor_direccion: sanitizeString(body.proveedor_direccion),
    tipo_documento: tipoDocumento,
    folio,
    monto_neto: Number(body.monto_neto) || null,
    monto_iva: Number(body.monto_iva) || null,
    monto_total: Math.round(montoTotal),
    monto_iec: Number(body.monto_iec) || null,
    recuperable: body.recuperable !== false,
    mes_tributario: mesTributario,
    archivo_url: body.archivo_url || null,
    archivo_nombre: body.archivo_nombre || null,
    archivo_tamano: Number(body.archivo_tamano) || null,
    estado: body.estado && ALLOWED_ESTADOS.has(body.estado) ? body.estado : 'registrada',
    notas: sanitizeString(body.notas),
    created_by_user_id: (session?.user as any)?.id ? Number((session.user as any).id) : null,
  };

  // Insert factura
  const { data: factura, error: fErr } = await supabaseAdmin
    .from('combustible_facturas')
    .insert(insertData)
    .select()
    .single();

  if (fErr || !factura) {
    console.error('Error creating factura:', fErr);
    return NextResponse.json({ error: 'Error al crear factura' }, { status: 500 });
  }

  // Insert items
  const itemsToInsert = items.map((item: FacturaItemInput) => ({
    factura_id: factura.id,
    maquinaria_id: item.maquinaria_id ? Number(item.maquinaria_id) : null,
    contrato_id: item.contrato_id ? Number(item.contrato_id) : null,
    tipo_combustible: item.tipo_combustible,
    litros: Number(item.litros),
    monto: Math.round(Number(item.monto)),
    precio_por_litro: item.precio_por_litro ? Number(item.precio_por_litro) : null,
    horometro: item.horometro ? Number(item.horometro) : null,
    odometro: item.odometro ? Number(item.odometro) : null,
    observaciones: sanitizeString(item.observaciones),
  }));

  const { error: iErr } = await supabaseAdmin.from('combustible_items').insert(itemsToInsert);
  if (iErr) {
    console.error('Error creating items, rolling back factura:', iErr);
    await supabaseAdmin.from('combustible_facturas').delete().eq('id', factura.id);
    return NextResponse.json({ error: 'Error al crear items' }, { status: 500 });
  }

  return NextResponse.json({ ...factura, items: itemsToInsert }, { status: 201 });
}
