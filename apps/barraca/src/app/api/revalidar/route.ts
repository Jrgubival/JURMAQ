import { NextRequest, NextResponse } from 'next/server';
import { revalidarCatalogo } from '@/lib/revalidar';
import { env } from '@jurmaq/shared/env';
import { safeSecretEquals } from '@jurmaq/shared/crypto/secret';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

/**
 * Invalida el caché de las páginas de catálogo después de una carga masiva
 * de precios/stock (scripts/sync-precios-inventario.py).
 *
 * Las fichas se cachean 24 h y las categorías 1 h para no gastar cuota de
 * Vercel; sin esto, un precio cargado por script tardaría hasta un día en
 * verse. Se invalida el patrón completo: cada página se regenera recién la
 * próxima vez que alguien la pide, no todas a la vez.
 *
 * Protegido con CRON_SECRET (Authorization: Bearer …), comparación en tiempo
 * constante y fail-closed: sin secreto configurado no invalida nada.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limiter = rateLimit(`revalidar:${ip}`, { maxAttempts: 10, windowSeconds: 60 });
  if (!limiter.success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }

  const secreto = env.CRON_SECRET?.trim();
  const recibido = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!secreto || !safeSecretEquals(recibido, secreto)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  revalidarCatalogo();

  return NextResponse.json({ ok: true, revalidado: ['/producto/[slug]', '/categorias/[slug]', '/'] });
}
