import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Rate limit: 60/min per IP. Public catalog endpoint with 2 DB queries
    // (categories + product counts). Scraper protection.
    const ip = getClientIp(request);
    const limiter = rateLimit(`categorias-get:${ip}`, { maxAttempts: 60, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }

    // Get all active categories
    const { data: categorias, error } = await supabaseAdmin
      .from('barraca_categorias')
      .select('*')
      .eq('activa', true)
      // Case-insensitive exclusion for orphan/seed categories. After a prior
      // Title Case migration the row became "No Informado" (not the original
      // "NO INFORMADO"), which broke the exact-match filter.
      .not('nombre', 'ilike', 'no informado')
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) throw error;

    // Get product counts for each category
    const catIds = (categorias || []).map((c: any) => c.id);
    let productCounts: Record<number, number> = {};

    if (catIds.length > 0) {
      const { data: counts } = await supabaseAdmin
        .from('barraca_productos')
        .select('categoria_id')
        .eq('activo', true)
        .in('categoria_id', catIds);

      if (counts) {
        for (const row of counts) {
          productCounts[row.categoria_id] = (productCounts[row.categoria_id] || 0) + 1;
        }
      }
    }

    const catsWithCount = (categorias || []).map((c: any) => ({
      ...c,
      producto_count: productCounts[c.id] || 0,
    }));

    // Group subcategories under their parents
    const padres = catsWithCount.filter((c: any) => !c.padre_id);
    const hijas = catsWithCount.filter((c: any) => c.padre_id);

    const resultado = padres.map((padre: any) => ({
      ...padre,
      subcategorias: hijas.filter((h: any) => h.padre_id === padre.id),
    }));

    return NextResponse.json(resultado);
  } catch (error) {
    console.error('Error al obtener categorias:', error);
    return NextResponse.json(
      { error: 'Error al obtener categorias' },
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

    const { data: categoria, error } = await supabaseAdmin
      .from('barraca_categorias')
      .insert({
        nombre: body.nombre,
        slug: body.slug,
        descripcion: body.descripcion || null,
        imagen: body.imagen || null,
        orden: body.orden || 0,
        padre_id: body.padre_id || null,
        activa: body.activa !== undefined ? body.activa : true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(categoria, { status: 201 });
  } catch (error) {
    console.error('Error al crear categoria:', error);
    return NextResponse.json(
      { error: 'Error al crear categoria' },
      { status: 500 }
    );
  }
}
