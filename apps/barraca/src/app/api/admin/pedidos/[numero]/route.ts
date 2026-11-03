import { NextRequest, NextResponse } from 'next/server';
import { revalidarFichasDePedido } from '@/lib/revalidar';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { can } from '@jurmaq/shared/roles';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { z, parseBody } from '@jurmaq/shared/validation';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { pedidos, PATRON_NUMERO, MOTIVOS_CANCELACION } from '@/lib/pedidos';
import { correoCancelacionComprador, correoConfirmacionComprador } from '@/lib/pedidos/correos';
import { devolverWebpay, pagadoConWebpay } from '@/lib/pedidos/rechazo';

/**
 * PATCH /api/admin/pedidos/[numero] — cambia el estado de un pedido.
 * "pagado" (transferencia recibida) pasa por la misma función que el pago en
 * línea: valida el monto y descuenta stock una sola vez.
 */
const schema = z.object({
  estado: z.enum(['pagado', 'en_preparacion', 'listo_retiro', 'despachado', 'entregado', 'cancelado']),
  // Obligatorio al cancelar. 'vencido' lo pone sólo el sistema (48 h sin pago).
  motivoCancelacion: z.enum(['cliente', 'transferencia_no_recibida', 'otro']).optional(),
});

/** Un pedido pagado también se puede cancelar, pero con devolución: sólo quien puede reembolsar. */
const CANCELABLE_PAGADO = ['pagado', 'en_preparacion', 'listo_retiro'];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_ventas', 'update');
  if (!session) return forbiddenResponse();

  const { numero } = await params;
  if (!PATRON_NUMERO.test(numero)) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  const parsed = parseBody(schema, await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });

  try {
    const store = pedidos();
    const pedido = await store.porNumero(numero);
    if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    let reembolso: 'hecho' | 'error' | 'transferencia' | null = null;

    // Sólo transiciones razonables: un pedido cerrado no revive y uno sin pago no se salta el pago.
    const desde: Record<string, string[]> = {
      pagado: ['pendiente_pago', 'transferencia_informada', 'pago_rechazado'],
      en_preparacion: ['pagado'],
      listo_retiro: ['en_preparacion'],
      despachado: ['en_preparacion'],
      entregado: ['listo_retiro', 'despachado'],
      // 'pago_discrepancia' no: se cobró un monto distinto y sólo se cierra con
      // 'No aprobar' + devolución (sólo administrador).
      cancelado: ['pendiente_pago', 'transferencia_informada', 'pago_rechazado', ...CANCELABLE_PAGADO],
    };
    if (!desde[parsed.data.estado]?.includes(pedido.estado)) {
      return NextResponse.json({ error: 'Ese cambio de estado no corresponde para este pedido' }, { status: 409 });
    }
    const motivo = parsed.data.motivoCancelacion;
    if (parsed.data.estado === 'cancelado') {
      if (!motivo) return NextResponse.json({ error: 'Elige el motivo de la cancelación' }, { status: 400 });
      if (CANCELABLE_PAGADO.includes(pedido.estado) && !can(session.user?.role, 'barraca_ventas', 'reembolsar')) {
        return NextResponse.json({ error: 'Cancelar un pedido pagado (con devolución) lo hace el administrador' }, { status: 403 });
      }
      if (motivo === 'transferencia_no_recibida' && (pedido.metodo_pago !== 'transferencia' || pedido.pagado_at)) {
        return NextResponse.json({ error: '«Transferencia no recibida» es sólo para pedidos por transferencia sin pago confirmado' }, { status: 409 });
      }
    }
    // "Marcar pagado" a mano es sólo para transferencias: un pago en línea lo confirma Webpay.
    if (parsed.data.estado === 'pagado' && pedido.metodo_pago !== 'transferencia') {
      return NextResponse.json({ error: 'Los pagos con Webpay se confirman solos. Si el cliente prefiere transferir, cancela este pedido y que haga uno nuevo eligiendo transferencia.' }, { status: 409 });
    }

    if (parsed.data.estado === 'pagado') {
      const r = await store.marcarPagado(numero, pedido.total, `MANUAL-${Date.now()}`, pedido.metodo_pago);
      if (r !== 'pagado') {
        return NextResponse.json({ error: r === 'ya_procesado' ? 'El pedido ya estaba pagado o cerrado' : 'No se pudo marcar como pagado' }, { status: 409 });
      }
      const actualizado = await store.porNumero(numero);
      if (actualizado) await Promise.all([correoConfirmacionComprador(actualizado), revalidarFichasDePedido(actualizado.items)]);
    } else if (parsed.data.estado === 'cancelado') {
      // Una sola operación en la base: estado, motivo, stock y devolución
      // pendiente si se pagó por transferencia. Sin permiso de reembolsar no
      // cancela un pedido con pago, aunque el pago llegue en este instante.
      const r = await store.cancelar(numero, motivo!, can(session.user?.role, 'barraca_ventas', 'reembolsar'));
      if (r === 'requiere_permiso') return NextResponse.json({ error: 'El pedido ya tiene pago: cancelarlo (con devolución) lo hace el administrador' }, { status: 403 });
      if (r === 'motivo_invalido') return NextResponse.json({ error: '«Transferencia no recibida» es sólo para pedidos por transferencia sin pago confirmado' }, { status: 409 });
      if (r !== 'ok') return NextResponse.json({ error: 'Este pedido ya salió o está cerrado: no se puede cancelar' }, { status: 409 });
      const cerrado = await store.porNumero(numero);
      await revalidarFichasDePedido(cerrado?.items);
      if (cerrado?.pagado_at) {
        if (pagadoConWebpay(cerrado)) {
          const ok = await devolverWebpay(cerrado);
          reembolso = ok === null ? null : ok ? 'hecho' : 'error';
        } else {
          reembolso = 'transferencia';
        }
      }
      const final = await store.porNumero(numero);
      if (final) await correoCancelacionComprador(final);
    } else {
      await store.cambiarEstado(numero, parsed.data.estado);
    }
    // El cambio ya quedó en el historial (trigger / store); acá se firma con quién lo hizo.
    const nota =
      parsed.data.estado === 'pagado' ? 'Transferencia confirmada en el panel'
      : parsed.data.estado === 'cancelado' && motivo ? MOTIVOS_CANCELACION[motivo]
      : null;
    await pedidos().firmarEvento(numero, parsed.data.estado, session.user?.email ?? null, nota).catch((e) =>
      logSafeError('admin-pedido-evento-error', { numero, error: String(e) }),
    );
    logSafe('admin-pedido-estado', { numero, estado: parsed.data.estado, por: session.user?.id ?? null });
    return NextResponse.json({ ok: true, reembolso });
  } catch (error) {
    logSafeError('admin-pedido-estado-error', { numero, error: String(error) });
    return NextResponse.json({ error: 'No se pudo actualizar el pedido' }, { status: 500 });
  }
}
