import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { logSafeError } from '@jurmaq/shared/logging';
import { z, parseBody } from '@jurmaq/shared/validation';
import { pedidos, PATRON_NUMERO } from '@/lib/pedidos';
import { opinarValido, PATRON_TOKEN } from '@/lib/pedidos/enlace';
import { autorPublico, crearOpinion } from '@/lib/opiniones';

/**
 * POST /api/opiniones — opinión de un producto con el enlace del correo.
 *
 * Body: { numero, token, producto_id, rating, titulo?, comentario? }. El token
 * (HMAC del número, ver lib/pedidos/enlace.ts) va en el body, no en la URL.
 * Sólo pedidos entregados, sólo productos de ese pedido y una sola vez por
 * pedido y producto (índice único en la base).
 */
export const runtime = 'nodejs';

/** Quita caracteres de control (deja saltos de línea en el comentario). */
const limpiar = (v: string) => v.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim();

const schema = z.object({
  numero: z.string().regex(PATRON_NUMERO),
  token: z.string().regex(PATRON_TOKEN),
  producto_id: z.number().int().positive().finite(),
  rating: z.number().int().min(1).max(5),
  titulo: z.string().max(100).optional().nullable().transform((v) => (v ? limpiar(v).slice(0, 100) || null : null)),
  comentario: z.string().max(2000).optional().nullable().transform((v) => (v ? limpiar(v).slice(0, 2000) || null : null)),
});

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const rl = rateLimit(`opiniones:${getClientIp(request)}`, { maxAttempts: 20, windowSeconds: 3600 });
  if (!rl.success) return NextResponse.json({ error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 });

  const parsed = parseBody(schema, await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: 'Revisa la calificación y el comentario.' }, { status: 400 });
  const { numero, token, producto_id, rating, titulo, comentario } = parsed.data;

  // Mismo mensaje para token malo y pedido inexistente.
  if (!opinarValido(numero, token)) return NextResponse.json({ error: 'Enlace no válido' }, { status: 404 });

  try {
    const pedido = await pedidos().porNumero(numero);
    if (!pedido) return NextResponse.json({ error: 'Enlace no válido' }, { status: 404 });
    if (pedido.estado !== 'entregado') {
      return NextResponse.json({ error: 'Podrás opinar cuando el pedido esté entregado.' }, { status: 409 });
    }
    if (!pedido.items.some((i) => Number(i.productoId) === producto_id)) {
      return NextResponse.json({ error: 'Ese producto no está en tu pedido.' }, { status: 400 });
    }

    const r = await crearOpinion({
      pedidoNumero: numero,
      productoId: producto_id,
      rating,
      titulo,
      comentario,
      autorPublico: autorPublico(pedido.nombre),
    });
    if (r === 'duplicada') {
      return NextResponse.json({ error: 'Ya opinaste sobre este producto.' }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    logSafeError('opinion-crear', { numero, error: String(error) });
    return NextResponse.json({ error: 'No pudimos guardar tu opinión. Intenta de nuevo.' }, { status: 500 });
  }
}
