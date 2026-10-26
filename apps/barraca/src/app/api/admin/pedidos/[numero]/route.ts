import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { z, parseBody } from '@jurmaq/shared/validation';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { pedidos, PATRON_NUMERO } from '@/lib/pedidos';
import { correoConfirmacionComprador } from '@/lib/pedidos/correos';

/**
 * PATCH /api/admin/pedidos/[numero] — cambia el estado de un pedido.
 * "pagado" (transferencia recibida) pasa por la misma función que el pago en
 * línea: valida el monto y descuenta stock una sola vez.
 */
const schema = z.object({
  estado: z.enum(['pagado', 'en_preparacion', 'listo_retiro', 'despachado', 'entregado', 'cancelado']),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_cotizaciones', 'update');
  if (!session) return forbiddenResponse();

  const { numero } = await params;
  if (!PATRON_NUMERO.test(numero)) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  const parsed = parseBody(schema, await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });

  try {
    const store = pedidos();
    const pedido = await store.porNumero(numero);
    if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

    if (parsed.data.estado === 'pagado') {
      const r = await store.marcarPagado(numero, pedido.total, `MANUAL-${Date.now()}`, pedido.metodo_pago);
      if (r !== 'pagado') {
        return NextResponse.json({ error: r === 'ya_procesado' ? 'El pedido ya estaba pagado o cerrado' : 'No se pudo marcar como pagado' }, { status: 409 });
      }
      const actualizado = await store.porNumero(numero);
      if (actualizado) await correoConfirmacionComprador(actualizado);
    } else {
      await store.cambiarEstado(numero, parsed.data.estado);
    }
    logSafe('admin-pedido-estado', { numero, estado: parsed.data.estado, por: session.user?.id ?? null });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logSafeError('admin-pedido-estado-error', { numero, error: String(error) });
    return NextResponse.json({ error: 'No se pudo actualizar el pedido' }, { status: 500 });
  }
}
