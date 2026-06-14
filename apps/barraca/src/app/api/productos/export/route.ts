import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { NextResponse } from 'next/server';
import XLSX from 'xlsx';
import type { Database } from '@jurmaq/shared/db-types';

type BarracaProductoRow = Database['public']['Tables']['barraca_productos']['Row'];
type ProductoExportRow = Pick<
  BarracaProductoRow,
  'id' | 'codigo' | 'nombre' | 'slug' | 'medida' | 'precio' | 'precio_original' | 'en_oferta' | 'costo' | 'stock' | 'unidad' | 'peso' | 'activo' | 'solo_cotizar' | 'imagen'
> & {
  barraca_categorias: { nombre: string | null } | null;
};

export async function GET() {
  try {
    // SECURITY (audit jun-2026): antes usaba auth() suelto → cualquier sesión
    // (incluido rol de bajo privilegio) podía bajar TODO el inventario con la
    // columna Costo. Ahora exige el permiso de importar/exportar.
    const session = await requirePermission('barraca_importar', 'create');
    if (!session) return forbiddenResponse('No tienes permiso para exportar el inventario');

    // Fetch ALL products with category names, paginated to bypass Supabase 1000-row limit
    let allProducts: ProductoExportRow[] = [];
    let offset = 0;

    while (true) {
      const { data } = await supabaseAdmin
        .from('barraca_productos')
        .select(
          'id, codigo, nombre, slug, medida, precio, precio_original, en_oferta, costo, stock, unidad, peso, activo, solo_cotizar, imagen, barraca_categorias!left(nombre)'
        )
        // Exporta TODO el inventario (activos e inactivos) — el round-trip
        // incluye la columna "Activo" para re-importar el estado.
        .order('nombre')
        .range(offset, offset + 999);

      if (!data || data.length === 0) break;
      allProducts.push(...(data as unknown as ProductoExportRow[]));
      offset += 1000;
      if (data.length < 1000) break;
    }

    // Map to export format
    const rows = allProducts.map((p) => ({
      // Id = clave única para re-importar (NO la edites). Match recomendado.
      Id: p.id,
      Codigo: p.codigo || '',
      Nombre: p.nombre || '',
      Medida: p.medida || '',
      Categoria: p.barraca_categorias?.nombre || '',
      // "Precio" = lo que se cobra (mapea al campo `precio` al re-importar).
      // "Precio Tachado" = el precio "antes" (solo si está en oferta real).
      Precio: p.en_oferta && p.precio_original ? p.precio_original : p.precio,
      'Precio Tachado': p.en_oferta ? p.precio : '',
      'En Oferta': p.en_oferta ? 'Si' : 'No',
      Costo: p.costo || '',
      Stock: p.stock || 0,
      Unidad: p.unidad || 'UN',
      Peso: p.peso || '',
      'Solo Cotizar': p.solo_cotizar ? 'Si' : 'No',
      Activo: p.activo ? 'Si' : 'No',
      // URL de la foto — editable: pegá una URL nueva y re-importá con "Imagen" tildado.
      Imagen: p.imagen || '',
    }));

    // Generate workbook
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 },
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
      { wch: 8 },
      { wch: 60 },
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
