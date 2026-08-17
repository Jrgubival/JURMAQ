import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import type { Database } from '@jurmaq/shared/db-types';

type CategoriaRow = Database['public']['Tables']['barraca_categorias']['Row'];
type CategoriaConCount = CategoriaRow & { producto_count: number };

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

    // Conteo por categoría con `head + count`: Postgres cuenta y devuelve solo
    // el número en un header.
    //
    // Antes esto traía las ~1.978 filas de productos activos (una columna, pero
    // 1.978 filas) para contarlas con un for en JS, en CADA llamada. Y este
    // endpoint lo llama el layout global en cada pageview, así que era una de
    // las fuentes principales de Fluid Active CPU.
    //
    // Son N queries en paralelo (una por categoría, ~19) en vez de una que
    // transfiere 1.978 filas: menos CPU, menos transferencia y menos memoria.
    const catIds = (categorias || []).map((c: CategoriaRow) => c.id);
    const productCounts: Record<number, number> = {};

    if (catIds.length > 0) {
      const conteos = await Promise.all(
        catIds.map(async (id: number) => {
          const { count } = await supabaseAdmin
            .from('barraca_productos')
            .select('id', { count: 'exact', head: true })
            .eq('activo', true)
            .eq('categoria_id', id);
          return [id, count ?? 0] as const;
        })
      );
      for (const [id, n] of conteos) productCounts[id] = n;
    }

    const catsWithCount = (categorias || []).map((c: CategoriaRow) => ({
      ...c,
      producto_count: productCounts[c.id] || 0,
    }));

    // Group subcategories under their parents
    const padres = catsWithCount.filter((c: CategoriaRow) => !c.padre_id);
    const hijas = catsWithCount.filter((c: CategoriaRow) => c.padre_id);

    const resultado = padres.map((padre: CategoriaConCount) => ({
      ...padre,
      subcategorias: hijas.filter((h: CategoriaConCount) => h.padre_id === padre.id),
    }));

    // El árbol de categorías cambia unas pocas veces al mes, pero el layout
    // global lo pide en cada pageview. Con este cache la CDN responde casi
    // todas las llamadas y la función deja de ejecutarse por visita.
    return NextResponse.json(resultado, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
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
