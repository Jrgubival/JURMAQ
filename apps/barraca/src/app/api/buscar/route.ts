import { NextRequest, NextResponse } from 'next/server';
import { searchProducts } from '@/lib/search';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Rate limit: 30 search requests per minute per IP
    const ip = getClientIp(request);
    const limiter = rateLimit(`search:${ip}`, { maxAttempts: 30, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const rawLimit = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Math.min(Math.max(rawLimit, 1), 100);

    const productos = await searchProducts(q, limit);

    return NextResponse.json({
      productos,
      total: productos.length,
    });
  } catch (error) {
    console.error('Error en busqueda:', error);
    return NextResponse.json(
      { error: 'Error al buscar productos' },
      { status: 500 }
    );
  }
}
