import { NextRequest, NextResponse } from 'next/server';
import { z, parseBody } from '@jurmaq/shared/validation';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { logSafeError } from '@jurmaq/shared/logging';
import { revisarLineas, MAX_LINEAS } from '@/lib/tienda';

/**
 * POST /api/tienda/carrito — precio y stock vigentes del carrito del navegador.
 * Sólo lee: no guarda nada. Lo usan el drawer, /carrito y /checkout.
 */
const schema = z.object({
  items: z
    .array(
      z.object({
        productoId: z.number().int().positive(),
        cantidad: z.number().int().positive().max(9999),
      }),
    )
    .max(MAX_LINEAS),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`tienda-carrito:${ip}`, { maxAttempts: 60, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const parsed = parseBody(schema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Carrito inválido' }, { status: 400 });
  }
  try {
    const items = await revisarLineas(parsed.data.items);
    return NextResponse.json({ items });
  } catch (error) {
    logSafeError('tienda-carrito-error', { error: String(error) });
    return NextResponse.json({ error: 'No se pudo revisar el carrito' }, { status: 500 });
  }
}
