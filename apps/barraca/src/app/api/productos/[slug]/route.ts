import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin, stripHtml } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Rate limit: 60/min per IP. Product detail runs 3 DB queries
    // (producto + variants + categoria). Enumerable by slug.
    const ip = getClientIp(request);
    const limiter = rateLimit(`producto-slug-get:${ip}`, { maxAttempts: 60, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }

    const { slug } = await params;

    const { data: rawProducto, error } = await supabaseAdmin
      .from('barraca_productos')
      .select('*, barraca_categorias!left(nombre, slug)')
      .eq('slug', slug)
      .eq('activo', true)
      .single();

    if (error || !rawProducto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // Flatten joined data and strip `costo` from public response (internal field)
    const { barraca_categorias, costo, ...rest } = rawProducto as any;
    const producto = {
      ...rest,
      categoria_nombre: barraca_categorias?.nombre || null,
      categoria_slug: barraca_categorias?.slug || null,
    };

    const { data: variantes } = await supabaseAdmin
      .from('barraca_productos')
      .select('*')
      .eq('activo', true)
      .or(`producto_padre_id.eq.${producto.id},id.eq.${producto.id}`)
      .order('medida', { ascending: true });

    let categoria = null;
    if (producto.categoria_id) {
      const { data: cat } = await supabaseAdmin
        .from('barraca_categorias')
        .select('*')
        .eq('id', producto.categoria_id)
        .single();
      categoria = cat;
    }

    // Strip `costo` from variantes as well
    const safeVariantes = (variantes || []).map(({ costo: _c, ...v }) => v);

    return NextResponse.json({
      producto,
      variantes: safeVariantes,
      categoria,
    });
  } catch (error) {
    console.error('Error al obtener producto:', error);
    return NextResponse.json(
      { error: 'Error al obtener producto' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { slug } = await params;
    const body = await request.json();

    const { data: existing } = await supabaseAdmin
      .from('barraca_productos')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const allowedFields = ['codigo', 'nombre', 'slug', 'descripcion', 'precio', 'costo', 'stock', 'peso', 'unidad', 'categoria_id', 'imagen', 'producto_padre_id', 'medida', 'activo', 'destacado'];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }
    // SECURITY (M-2): stripHtml en campos inyectados en JSON-LD público.
    if (typeof updateData.nombre === 'string') updateData.nombre = stripHtml(updateData.nombre);
    if (typeof updateData.descripcion === 'string') updateData.descripcion = stripHtml(updateData.descripcion);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron campos para actualizar' }, { status: 400 });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('barraca_productos')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    return NextResponse.json(
      { error: 'Error al actualizar producto' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { slug } = await params;

    const { data: existing } = await supabaseAdmin
      .from('barraca_productos')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('barraca_productos')
      .update({ activo: false })
      .eq('id', existing.id);

    if (error) throw error;

    return NextResponse.json({ mensaje: 'Producto desactivado correctamente' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    return NextResponse.json(
      { error: 'Error al eliminar producto' },
      { status: 500 }
    );
  }
}
