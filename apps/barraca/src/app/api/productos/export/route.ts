import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
import { NextResponse } from 'next/server';
import XLSX from 'xlsx';

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Fetch ALL products with category names, paginated to bypass Supabase 1000-row limit
    let allProducts: any[] = [];
    let offset = 0;

    while (true) {
      const { data } = await supabaseAdmin
        .from('barraca_productos')
        .select(
          'codigo, nombre, medida, precio, precio_original, en_oferta, costo, stock, unidad, peso, activo, solo_cotizar, barraca_categorias!left(nombre)'
        )
        .eq('activo', true)
        .order('nombre')
        .range(offset, offset + 999);

      if (!data || data.length === 0) break;
      allProducts.push(...data);
      offset += 1000;
      if (data.length < 1000) break;
    }

    // Map to export format
    const rows = allProducts.map((p: any) => ({
      Codigo: p.codigo || '',
      Nombre: p.nombre || '',
      Medida: p.medida || '',
      Categoria: p.barraca_categorias?.nombre || '',
      'Precio Normal': p.en_oferta && p.precio_original ? p.precio_original : p.precio,
      'Precio Tachado': p.en_oferta ? p.precio : '',
      'En Oferta': p.en_oferta ? 'Si' : 'No',
      Costo: p.costo || '',
      Stock: p.stock || 0,
      Unidad: p.unidad || 'UN',
      Peso: p.peso || '',
      'Solo Cotizar': p.solo_cotizar ? 'Si' : 'No',
    }));

    // Generate workbook
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 45 },
      { wch: 20 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
      { wch: 12 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=productos-barraca-${new Date().toISOString().split('T')[0]}.xlsx`,
      },
    });
  } catch (error) {
    console.error('Error al exportar productos:', error);
    return NextResponse.json(
      { error: 'Error al exportar productos' },
      { status: 500 }
    );
  }
}
