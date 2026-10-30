import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { pedidos, PATRON_NUMERO } from '@/lib/pedidos';
import { comunaPorCodigo } from '@/lib/despacho';
import { COMUNA_ORIGEN } from '@/lib/despacho/tarifas';
import { courierPorId } from '@/lib/despacho/courier';
import { z, parseBody } from '@jurmaq/shared/validation';

/**
 * POST /api/admin/pedidos/[numero]/envio — crea el envío en el courier del
 * pedido (Envíame) con la misma caja y servicio que se cotizaron, y guarda el
 * número de seguimiento y la etiqueta. Sólo pedidos por courier, pagados o en
 * preparación, y una sola vez. Es manual: nada lo dispara solo. Si llega
 * { seguimiento } (envío hecho a mano en el panel del courier) sólo se guarda
 * ese número.
 */
const schema = z.object({ seguimiento: z.string().trim().regex(/^[A-Za-z0-9-]{4,40}$/).optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_cotizaciones', 'update');
  if (!session) return forbiddenResponse();

  const { numero } = await params;
  if (!PATRON_NUMERO.test(numero)) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

  const parsed = parseBody(schema, await request.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: 'Número de seguimiento inválido' }, { status: 400 });

  try {
    const store = pedidos();
    const pedido = await store.porNumero(numero);
    if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    if (pedido.despacho_tipo !== 'courier') {
      return NextResponse.json({ error: 'Este pedido no va por courier' }, { status: 409 });
    }
    if (pedido.courier_seguimiento) {
      return NextResponse.json({ error: 'El envío ya está generado' }, { status: 409 });
    }
    if (pedido.estado !== 'pagado' && pedido.estado !== 'en_preparacion') {
      return NextResponse.json({ error: 'Genera el envío cuando el pedido esté pagado' }, { status: 409 });
    }
    if (parsed.data.seguimiento) {
      const ok = await store.guardarEnvio(numero, { seguimiento: parsed.data.seguimiento, etiquetaUrl: null, envioId: null });
      if (!ok) return NextResponse.json({ error: 'El envío ya está generado' }, { status: 409 });
      logSafe('admin-pedido-envio-manual', { numero, por: session.user?.id ?? null });
      return NextResponse.json({ ok: true, seguimiento: parsed.data.seguimiento, etiquetaUrl: null });
    }
    const courier = courierPorId(pedido.courier);
    const destino = comunaPorCodigo(pedido.comuna_codigo ?? '');
    const origen = comunaPorCodigo(COMUNA_ORIGEN);
    if (!courier || !destino || !origen || !pedido.courier_paquete) {
      return NextResponse.json({ error: 'El courier de este pedido no está disponible. Genera el envío en su panel.' }, { status: 409 });
    }
    const envio = await courier.emitir(pedido, {
      origen,
      destino,
      paquete: pedido.courier_paquete,
      servicioCodigo: pedido.courier_servicio,
    });
    if (!(await store.guardarEnvio(numero, envio))) {
      // Otro clic ganó la carrera: el envío recién creado queda duplicado en el courier.
      logSafeError('admin-pedido-envio-duplicado', { numero, courier: courier.id });
      return NextResponse.json({ error: 'El envío ya estaba generado. Anula el duplicado en el panel del courier.' }, { status: 409 });
    }
    logSafe('admin-pedido-envio', { numero, courier: courier.id, por: session.user?.id ?? null });
    return NextResponse.json({ ok: true, seguimiento: envio.seguimiento, etiquetaUrl: envio.etiquetaUrl });
  } catch (error) {
    logSafeError('admin-pedido-envio-error', { numero, error: String(error) });
    return NextResponse.json({ error: 'No se pudo generar el envío. Hazlo en el panel del courier.' }, { status: 502 });
  }
}
