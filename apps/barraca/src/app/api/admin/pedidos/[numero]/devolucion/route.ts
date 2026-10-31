import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { z, parseBody } from '@jurmaq/shared/validation';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { pedidos, PATRON_NUMERO } from '@/lib/pedidos';
import { correoDevolucionHecha } from '@/lib/pedidos/correos';
import { rutValido, formatearRut } from '@/lib/rut';

/**
 * POST /api/admin/pedidos/[numero]/devolucion — devolución por transferencia
 * de un pedido cancelado o no aprobado que estaba pagado.
 *   { accion: 'cuenta', banco, tipo, numero, rut, titular } → anota la cuenta
 *     que mandó el cliente (por correo o WhatsApp).
 *   { accion: 'hecha' } → la barraca ya transfirió: queda "hecha" y se le
 *     avisa al cliente por correo.
 * El panel sólo registra: la transferencia la hace la barraca en su banco.
 * Sólo quien puede reembolsar (administrador).
 */
const texto = (max: number) => z.string().trim().min(1).max(max);
const schema = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('cuenta'),
    banco: texto(60),
    tipo: texto(40),
    numero: z.string().trim().regex(/^[0-9-]{4,25}$/),
    rut: texto(14),
    titular: texto(120),
  }),
  z.object({ accion: z.literal('hecha') }),
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_ventas', 'reembolsar');
  if (!session) return forbiddenResponse();

  const { numero } = await params;
  if (!PATRON_NUMERO.test(numero)) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  const parsed = parseBody(schema, await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: 'Revisa los datos de la cuenta' }, { status: 400 });

  try {
    const store = pedidos();
    const pedido = await store.porNumero(numero);
    if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    const r = pedido.reembolso;
    if (!r || r.medio !== 'transferencia' || r.estado !== 'pendiente' || !['cancelado', 'rechazado'].includes(pedido.estado)) {
      return NextResponse.json({ error: 'Este pedido no tiene una devolución por transferencia pendiente' }, { status: 409 });
    }

    if (parsed.data.accion === 'cuenta') {
      const d = parsed.data;
      if (!rutValido(d.rut)) return NextResponse.json({ error: 'RUT del titular inválido' }, { status: 400 });
      const guardado = await store.guardarCuentaDevolucion(numero, {
        ...r,
        cuenta: { banco: d.banco, tipo: d.tipo, numero: d.numero, rut: formatearRut(d.rut), titular: d.titular },
      });
      if (!guardado) return NextResponse.json({ error: 'La devolución ya no está pendiente' }, { status: 409 });
      logSafe('admin-devolucion-cuenta', { numero, por: session.user?.id ?? null });
      return NextResponse.json({ ok: true });
    }

    if (!r.cuenta) return NextResponse.json({ error: 'Primero anota la cuenta del cliente' }, { status: 409 });
    const tomado = await store.tomarDevolucionHecha(numero, {
      ...r, estado: 'hecho', hecho_at: new Date().toISOString(), hecho_por: session.user?.email ?? null,
    });
    if (!tomado) return NextResponse.json({ error: 'La devolución ya estaba marcada como hecha' }, { status: 409 });
    const actualizado = await store.porNumero(numero);
    if (actualizado) await correoDevolucionHecha(actualizado);
    await store.registrarEvento(numero, pedido.estado, session.user?.email ?? null, 'Devolución por transferencia hecha').catch((e) =>
      logSafeError('admin-devolucion-evento-error', { numero, error: String(e) }),
    );
    logSafe('admin-devolucion-hecha', { numero, por: session.user?.id ?? null });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logSafeError('admin-devolucion-error', { numero, error: String(error) });
    return NextResponse.json({ error: 'No se pudo guardar la devolución' }, { status: 500 });
  }
}
