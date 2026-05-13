import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import * as XLSX from 'xlsx';
import { validateMes } from '../_helpers';

/**
 * GET /api/admin/combustible/export?mes=YYYY-MM
 * Excel download with all items of that month (joined with factura + maquinaria).
 */
export async function GET(request: NextRequest) {
  const session = await requirePermission('combustible', 'export');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { searchParams } = new URL(request.url);
  const mes = validateMes(searchParams.get('mes'));
  if (!mes) return NextResponse.json({ error: 'Parametro mes=YYYY-MM requerido' }, { status: 400 });

  const { data: facturas, error } = await supabaseAdmin
    .from('combustible_facturas')
    .select('*, combustible_items(*, maquinarias(id, nombre), contratos(id, numero))')
    .eq('mes_tributario', mes)
    .neq('estado', 'anulada')
    .order('fecha', { ascending: true });

  if (error) return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });

  const rows: any[] = [];
  for (const f of facturas || []) {
    const items = (f as any).combustible_items || [];
    if (items.length === 0) {
      rows.push({
        Fecha: f.fecha,
        Folio: f.folio,
        'Tipo Doc': f.tipo_documento,
        Proveedor: f.proveedor_nombre,
        'RUT Prov.': f.proveedor_rut || '',
        Maquinaria: '',
        Contrato: '',
        'Tipo Combustible': '',
        Litros: '',
        'Monto Item': '',
        'Precio/L': '',
        'Monto Total Factura': f.monto_total,
        'Neto': f.monto_neto || '',
        'IVA': f.monto_iva || '',
        'IEC': f.monto_iec || '',
        Recuperable: f.recuperable ? 'Si' : 'No',
        'Mes Tributario': f.mes_tributario,
        Estado: f.estado,
        Observaciones: f.notas || '',
      });
    } else {
      for (const it of items) {
        rows.push({
          Fecha: f.fecha,
          Folio: f.folio,
          'Tipo Doc': f.tipo_documento,
          Proveedor: f.proveedor_nombre,
          'RUT Prov.': f.proveedor_rut || '',
          Maquinaria: it.maquinarias?.nombre || '',
          Contrato: it.contratos?.numero || '',
          'Tipo Combustible': it.tipo_combustible,
          Litros: Number(it.litros),
          'Monto Item': Number(it.monto),
          'Precio/L': it.precio_por_litro ? Number(it.precio_por_litro) : '',
          'Monto Total Factura': f.monto_total,
          'Neto': f.monto_neto || '',
          'IVA': f.monto_iva || '',
          'IEC': f.monto_iec || '',
          Recuperable: f.recuperable ? 'Si' : 'No',
          'Mes Tributario': f.mes_tributario,
          Estado: f.estado,
          Observaciones: it.observaciones || f.notas || '',
        });
      }
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  // Set column widths
  ws['!cols'] = [
    { wch: 11 }, { wch: 10 }, { wch: 16 }, { wch: 28 }, { wch: 12 },
    { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 12 },
    { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 40 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Combustible ${mes}`);

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="combustible-${mes}.xlsx"`,
    },
  });
}
