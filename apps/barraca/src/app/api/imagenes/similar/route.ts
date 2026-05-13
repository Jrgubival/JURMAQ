import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Extract the base name of a product by stripping dimensions, sizes, and
 * measurement suffixes. This allows grouping products that are the same
 * item in different sizes (e.g. "FIERRO ESTRIADO 8MM" and "FIERRO ESTRIADO 12MM").
 */
function extractBaseName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\d+\s*(MM|CM|MT|MTS|M|KG|LT|PULG|PULGADAS|"|')/gi, '')
    .replace(/\d+\s*X\s*\d+/gi, '')
    .replace(/\d+(\/\d+)?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productoId = searchParams.get('productoId');

    if (!productoId) {
      return NextResponse.json(
        { error: 'productoId es requerido' },
        { status: 400 }
      );
    }

    // Get the current product
    const { data: producto, error: prodError } = await supabaseAdmin
      .from('barraca_productos')
      .select('id, nombre, categoria_id')
      .eq('id', productoId)
      .single();

    if (prodError || !producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const baseName = extractBaseName(producto.nombre);

    if (!baseName || baseName.length < 3) {
      return NextResponse.json({ similar: [] });
    }

    // Search for products with similar names in the same category
    // Use the first few words of the base name for a broader match
    const searchWords = baseName.split(' ').filter((w) => w.length > 2).slice(0, 3);
    const searchPattern = searchWords.join('%');

    let query = supabaseAdmin
      .from('barraca_productos')
      .select('id, nombre, codigo, imagen, categoria_id')
      .neq('id', producto.id)
      .eq('activo', true)
      .ilike('nombre', `%${searchPattern}%`)
      .limit(20);

    // Prefer same category if available
    if (producto.categoria_id) {
      query = query.eq('categoria_id', producto.categoria_id);
    }

    const { data: similarProducts, error: simError } = await query;

    if (simError) throw simError;

    // Score and sort by similarity
    const scored = (similarProducts || []).map((p) => {
      const pBase = extractBaseName(p.nombre);
      const similarity = baseName === pBase ? 1 : baseName.includes(pBase) || pBase.includes(baseName) ? 0.8 : 0.5;
      return { ...p, similarity };
    });

    scored.sort((a, b) => b.similarity - a.similarity);

    return NextResponse.json({
      similar: scored.slice(0, 15).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        codigo: p.codigo,
        imagen: p.imagen,
        needsImage: !p.imagen || p.imagen.startsWith('/images/barraca/'),
      })),
    });
  } catch (error) {
    console.error('Error buscando productos similares:', error);
    return NextResponse.json(
      { error: 'Error al buscar productos similares' },
      { status: 500 }
    );
  }
}
