import { NextRequest, NextResponse } from 'next/server';
import { z, parseBody } from '@jurmaq/shared/validation';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { logSafeError } from '@jurmaq/shared/logging';
import { revisarLineas, MAX_LINEAS } from '@/lib/tienda';
import { cotizarDespacho } from '@/lib/despacho';

/**
 * POST /api/tienda/despacho — costo del despacho del carrito a una comuna,
 * para mostrarlo en el checkout. Sólo informa: al crear el pedido el servidor
 * lo vuelve a calcular y es ese el monto que se cobra.
 */
const schema = z.object({
  items: z
    .array(z.object({ productoId: z.number().int().positive(), cantidad: z.number().int().positive().max(9999) }))
    .min(1)
    .max(MAX_LINEAS),
  comuna: z.string().trim().regex(/^[A-Z0-9]{2,4}$/),
});

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const ip = getClientIp(request);
  // Cada consulta puede llamar a la API del courier: límite más corto que el carrito.
  const rl = rateLimit(`tienda-despacho:${ip}`, { maxAttempts: 20, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiadas consultas. Espera un minuto.' }, { status: 429 });
  }
  const parsed = parseBody(schema, await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  try {
    const lineas = await revisarLineas(parsed.data.items);
    const c = await cotizarDespacho(lineas, parsed.data.comuna);
    if (!c) return NextResponse.json({ error: 'Comuna no encontrada' }, { status: 400 });
    // Al navegador sólo lo que muestra: nada del paquete ni del servicio interno.
    if (c.estado === 'ok' && c.tipo === 'courier') {
      const { comuna, costo, dias, detalle, simulado } = c;
      return NextResponse.json({ estado: c.estado, tipo: c.tipo, comuna: comuna.nombre, costo, dias, detalle, simulado });
    }
    const { comuna, ...resto } = c;
    return NextResponse.json({ ...resto, comuna: comuna.nombre });
  } catch (error) {
    logSafeError('tienda-despacho-error', { error: String(error) });
    return NextResponse.json({ error: 'No se pudo calcular el despacho' }, { status: 500 });
  }
}
