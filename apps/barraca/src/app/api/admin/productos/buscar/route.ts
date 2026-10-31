import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { escapeOrFilter } from '@jurmaq/shared/sanitize';
import { logSafeError } from '@jurmaq/shared/logging';
import { esComprable } from '@/lib/stock';
import { precioDeVenta } from '@/lib/precio-web';

/**
 * GET /api/admin/productos/buscar?q=&ver=todos|disponibles|no_disponibles
 * Lista corta para el panel de la tienda: precio, stock y si está disponible
 * (misma regla que la tienda: lib/stock.ts → esComprable).
 */
const LIMITE = 60;

export async function GET(request: NextRequest) {
  const session = await requirePermission('barraca_productos', 'read');
  if (!session) return forbiddenResponse();

  const q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 80);
  const verParam = request.nextUrl.searchParams.get('ver');
  const ver = verParam === 'disponibles' || verParam === 'no_disponibles' ? verParam : 'todos';

  try {
    let query = supabaseAdmin
      .from('barraca_productos')
      .select('id, codigo, nombre, slug, medida, unidad, precio, precio_original, en_oferta, stock, solo_cotizar, activo, imagen')
      .eq('activo', true)
      .order('nombre', { ascending: true })
      .limit(ver === 'todos' ? LIMITE : 400);
    if (q) {
      const t = escapeOrFilter(q);
      query = query.or(`nombre.ilike.%${t}%,codigo.ilike.%${t}%`);
    }
    const { data, error } = await query;
    if (error) throw error;

    const productos = (data ?? [])
      .map((p) => {
        const precio = precioDeVenta(p);
        return {
          id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          slug: p.slug,
          medida: p.medida,
          unidad: p.unidad,
          precio,
          stock: p.stock,
          imagen: p.imagen,
          soloCotizar: !!p.solo_cotizar,
          disponible: esComprable({ precio, stock: p.stock, solo_cotizar: p.solo_cotizar, activo: p.activo }),
        };
      })
      .filter((p) => ver === 'todos' || (ver === 'disponibles' ? p.disponible : !p.disponible))
      .slice(0, LIMITE);

    return NextResponse.json({ productos });
  } catch (error) {
    logSafeError('admin-productos-buscar', { error: String(error) });
    return NextResponse.json({ error: 'No se pudieron cargar los productos' }, { status: 500 });
  }
}
