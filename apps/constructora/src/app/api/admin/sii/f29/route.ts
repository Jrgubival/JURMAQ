/**
 * GET /api/admin/sii/f29?periodo=YYYY-MM
 *
 * Genera Excel con el F29 del período: hoja ventas + hoja compras + hoja resumen.
 *
 * Acepta `?download=true` para forzar descarga, sino retorna JSON con preview.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import * as XLSX from 'xlsx';

function formatMonto(n: number): string {
  return n.toLocaleString('es-CL');
}

export async function GET(request: NextRequest) {
  const session = await requirePermission('combustible', 'export');
  if (!session) return forbiddenResponse('No autorizado');

  const { searchParams } = new URL(request.url);
  const periodo = searchParams.get('periodo'); // YYYY-MM
  const download = searchParams.get('download') === 'true';

  if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
    return NextResponse.json({ error: 'periodo=YYYY-MM requerido' }, { status: 400 });
  }

  // Cargar ventas y compras del período
  const [ventasRes, comprasRes, resumenRes] = await Promise.all([
    supabaseAdmin
      .from('iva_libro_ventas')
      .select('*')
      .eq('periodo', periodo)
      .eq('anulado', false)
      .order('fecha_emision'),
    supabaseAdmin
      .from('iva_libro_compras')
      .select('*')
      .eq('periodo', periodo)
      .eq('anulado', false)
      .order('fecha_emision'),
    supabaseAdmin
      .from('iva_resumen_mensual')
      .select('*')
      .eq('periodo', periodo)
      .single(),
  ]);

  const ventas = ventasRes.data || [];
  const compras = comprasRes.data || [];
  const resumen = resumenRes.data || { ventas_count: 0, ventas_neto: 0, iva_debito: 0, compras_count: 0, compras_neto: 0, iva_credito: 0, f29_a_pagar: 0 };

  if (!download) {
    return NextResponse.json({ periodo, resumen, ventas: ventas.length, compras: compras.length });
  }

  // Build workbook
  const wb = XLSX.utils.book_new();

  // Hoja Ventas
  const ventasData = ventas.map((v) => ({
    Fecha: v.fecha_emision,
    'Tipo doc': v.doc_tipo,
    'N° doc': v.doc_nro,
    'RUT cliente': v.contraparte_rut || '',
    'Nombre cliente': v.contraparte_nombre,
    'Monto neto': formatMonto(v.monto_neto),
    'IVA': formatMonto(v.iva),
    'Total': formatMonto(v.monto_total),
    'Exento': v.exento ? 'SÍ' : 'NO',
    'Origen': v.origen_tipo || '',
    'Notas': v.notas || '',
  }));
  const wsVentas = XLSX.utils.json_to_sheet(ventasData);
  XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas');

  // Hoja Compras
  const comprasData = compras.map((c) => ({
    Fecha: c.fecha_emision,
    'Tipo doc': c.doc_tipo,
    'N° doc': c.doc_nro,
    'RUT proveedor': c.proveedor_rut,
    'Nombre proveedor': c.proveedor_nombre,
    'Monto neto': formatMonto(c.monto_neto),
    'IVA': formatMonto(c.iva),
    'Total': formatMonto(c.monto_total),
    'Exento': c.exento ? 'SÍ' : 'NO',
    'Categoría': c.categoria || '',
    'Origen': c.origen_tipo || '',
    'Notas': c.notas || '',
  }));
  const wsCompras = XLSX.utils.json_to_sheet(comprasData);
  XLSX.utils.book_append_sheet(wb, wsCompras, 'Compras');

  // Hoja Resumen F29
  const resumenData = [
    { Concepto: 'PERÍODO', Valor: periodo },
    { Concepto: '', Valor: '' },
    { Concepto: '=== VENTAS ===', Valor: '' },
    { Concepto: 'Cantidad documentos', Valor: resumen.ventas_count },
    { Concepto: 'Ventas netas', Valor: formatMonto(resumen.ventas_neto) },
    { Concepto: 'IVA Débito (19%)', Valor: formatMonto(resumen.iva_debito) },
    { Concepto: '', Valor: '' },
    { Concepto: '=== COMPRAS ===', Valor: '' },
    { Concepto: 'Cantidad documentos', Valor: resumen.compras_count },
    { Concepto: 'Compras netas', Valor: formatMonto(resumen.compras_neto) },
    { Concepto: 'IVA Crédito (19%)', Valor: formatMonto(resumen.iva_credito) },
    { Concepto: '', Valor: '' },
    { Concepto: '=== F29 A PAGAR ===', Valor: '' },
    { Concepto: 'IVA débito - IVA crédito', Valor: formatMonto(resumen.f29_a_pagar) },
  ];
  const wsResumen = XLSX.utils.json_to_sheet(resumenData);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen F29');

  // Output
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="F29-${periodo}.xlsx"`,
      'Cache-Control': 'no-cache',
    },
  });
}
