import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin, escapeOrFilter } from '@jurmaq/shared/sanitize';
import { applyDailyPromosToProducts } from '@/lib/promotions';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Rate limit: 60/min per IP. Public product listing with filters runs
    // count + data + applyDailyPromosToProducts (post-processing). Scraper
    // protection without hurting legit browsing (~24 products/page).
    const ip = getClientIp(request);
    const limiter = rateLimit(`productos-get:${ip}`, { maxAttempts: 60, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const categoria = searchParams.get('categoria');
    const buscar = searchParams.get('buscar');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '24', 10);
    const destacado = searchParams.get('destacado');

    // SECURITY: all=true (includes inactive + negative stock) is admin-only.
    // Anonymous callers get the public filtered view regardless of the flag.
    const requestedAll = searchParams.get('all') === 'true';
    let includeInactive = false;
    if (requestedAll) {
      const session = await auth();
      if (session) includeInactive = true;
    }
    const offset = (page - 1) * limit;

    // Count query
    let countQuery = supabaseAdmin
      .from('barraca_productos')
      .select('id, barraca_categorias!left(slug)', { count: 'exact', head: true });

    // Data query with join
    let dataQuery = supabaseAdmin
      .from('barraca_productos')
      .select('*, barraca_categorias!left(nombre, slug)');

    // Only filter by activo unless admin requests all
    if (!includeInactive) {
      countQuery = countQuery.eq('activo', true).gte('stock', 0);
      dataQuery = dataQuery.eq('activo', true).gte('stock', 0);
    }

    if (categoria) {
      // Filter by category slug via the joined table
      countQuery = supabaseAdmin
        .from('barraca_productos')
        .select('id, barraca_categorias!inner(slug)', { count: 'exact', head: true })
        .eq('barraca_categorias.slug', categoria);

      dataQuery = supabaseAdmin
        .from('barraca_productos')
        .select('*, barraca_categorias!inner(nombre, slug)')
        .eq('barraca_categorias.slug', categoria);

      if (!includeInactive) {
        countQuery = countQuery.eq('activo', true).gte('stock', 0);
        dataQuery = dataQuery.eq('activo', true).gte('stock', 0);
      }
    }

    if (buscar) {
      const safe = escapeOrFilter(buscar);
      countQuery = countQuery.or(`nombre.ilike.%${safe}%,descripcion.ilike.%${safe}%`);
      dataQuery = dataQuery.or(`nombre.ilike.%${safe}%,descripcion.ilike.%${safe}%`);
    }

    if (destacado === 'true') {
      countQuery = countQuery.eq('destacado', true);
      dataQuery = dataQuery.eq('destacado', true);
    }

    const { count: total } = await countQuery;

    const { data: rawProductos, error } = await dataQuery
      .order('destacado', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Flatten the joined category data to match the old API shape
    // Strip `costo` from public responses (internal field)
    const productosFlat = (rawProductos || []).map((p) => {
      const { barraca_categorias, costo, ...rest } = p;
      return {
        ...rest,
        categoria_nombre: barraca_categorias?.nombre || null,
        categoria_slug: barraca_categorias?.slug || null,
      };
    });

    // Mirror the daily-promo discount that the product detail page applies,
    // so listing/grid prices stay consistent with the detail page price.
    // Without this, a product in a daily-promoted category shows full price
    // in the grid and discounted price on the detail — confusing for buyers.
    const productos = await applyDailyPromosToProducts(productosFlat);

    const paginas = Math.ceil((total || 0) / limit);

    return NextResponse.json({
      productos,
      total: total || 0,
      paginas,
      pagina: page,
    });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return NextResponse.json(
      { error: 'Error al obtener productos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await request.json();

    if (!body.nombre || !body.slug) {
      return NextResponse.json({ error: 'Nombre y slug son requeridos' }, { status: 400 });
    }

    const { data: producto, error } = await supabaseAdmin
      .from('barraca_productos')
      .insert({
        codigo: body.codigo || null,
        nombre: body.nombre,
        slug: body.slug,
        descripcion: body.descripcion || null,
        precio: body.precio || 0,
        costo: body.costo || 0,
        stock: body.stock || 0,
        peso: body.peso || null,
        unidad: body.unidad || 'unidad',
        categoria_id: body.categoria_id || null,
        imagen: body.imagen || null,
        producto_padre_id: body.producto_padre_id || null,
        medida: body.medida || null,
        activo: body.activo !== undefined ? body.activo : true,
        destacado: body.destacado || false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(producto, { status: 201 });
  } catch (error) {
    console.error('Error al crear producto:', error);
    return NextResponse.json(
      { error: 'Error al crear producto' },
      { status: 500 }
    );
  }
}
