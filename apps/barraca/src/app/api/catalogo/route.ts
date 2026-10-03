import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { logSafeError } from '@jurmaq/shared/logging';
import { categoriaPorSlug, leerParametros, productosDeCategoria } from '@/lib/catalogo';

/**
 * Grilla filtrada de una categoría (orden, stock, precio, página).
 *
 * La página /categorias/[slug] es estática; cuando el cliente cambia un filtro
 * pide esto. La respuesta es pública e idéntica para todos, así que la CDN la
 * guarda 10 minutos por combinación de parámetros: la función corre una vez
 * por combinación cada 10 minutos, no una vez por visita.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const limiter = rateLimit(`catalogo:${ip}`, { maxAttempts: 120, windowSeconds: 60 });
  if (!limiter.success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }

  const q = request.nextUrl.searchParams;
  const slug = q.get('cat') ?? '';
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
    return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
  }

  try {
    const cat = await categoriaPorSlug(slug);
    if (!cat) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });

    const resultado = await productosDeCategoria(cat.catIds, leerParametros(q));
    return NextResponse.json(resultado, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    logSafeError('[api/catalogo] error al cargar la grilla', { error: error instanceof Error ? error.name : 'unknown' });
    return NextResponse.json({ error: 'No se pudo cargar el catálogo' }, { status: 500 });
  }
}
