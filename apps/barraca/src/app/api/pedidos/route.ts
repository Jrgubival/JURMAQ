import { NextRequest, NextResponse } from 'next/server';
import { z, parseBody } from '@jurmaq/shared/validation';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { logSafe, logSafeError, maskEmail } from '@jurmaq/shared/logging';
import { revisarLineas, MAX_LINEAS } from '@/lib/tienda';
import {
  pedidos, nuevoNumeroPedido, nuevoTokenAcceso, cookiePedido, type ItemPedido, type Pedido,
} from '@/lib/pedidos';
import { correoAvisoBarraca, correoConfirmacionComprador } from '@/lib/pedidos/correos';
import { pasarelaActiva, pagoEnLineaDisponible, origenTienda } from '@/lib/pagos';
import { rutValido, formatearRut } from '@/lib/rut';
import { cotizarDespacho } from '@/lib/despacho';

/**
 * POST /api/pedidos — crea un pedido desde el checkout.
 *
 * Los precios y el stock se recalculan acá desde la base: del cliente sólo se
 * toman los ids y las cantidades. El acceso a la página de confirmación queda
 * en una cookie httpOnly (nunca en la URL).
 */

const texto = (max: number) => z.string().trim().max(max);

const schema = z
  .object({
    items: z
      .array(z.object({ productoId: z.number().int().positive(), cantidad: z.number().int().positive().max(9999) }))
      .min(1)
      .max(MAX_LINEAS),
    nombre: texto(120).min(3),
    rut: texto(14).optional().default(''),
    telefono: texto(20).min(8),
    email: z.string().trim().toLowerCase().email().max(160),
    entrega: z.enum(['retiro', 'despacho']),
    direccion: texto(200).optional().default(''),
    // Código de comuna (ver lib/despacho/comunas.ts); el nombre sale del servidor.
    comuna: z.string().trim().regex(/^[A-Z0-9]{2,4}$/).optional().or(z.literal('')).default(''),
    metodoPago: z.enum(['mercadopago', 'transferencia']),
    notas: texto(500).optional().default(''),
    // Fail-closed: sin la casilla marcada no hay pedido (Ley 19.496, art. 12 A).
    aceptaTerminos: z.literal(true),
    aceptaOfertas: z.boolean().optional().default(false),
  })
  .superRefine((d, ctx) => {
    if (d.rut && !rutValido(d.rut)) ctx.addIssue({ code: 'custom', path: ['rut'], message: 'RUT inválido' });
    if (d.telefono.replace(/\D/g, '').length < 8) ctx.addIssue({ code: 'custom', path: ['telefono'], message: 'Teléfono inválido' });
    if (d.entrega === 'despacho') {
      if (d.direccion.length < 5) ctx.addIssue({ code: 'custom', path: ['direccion'], message: 'Falta la dirección' });
      if (!d.comuna) ctx.addIssue({ code: 'custom', path: ['comuna'], message: 'Falta la comuna' });
    }
  });

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const ip = getClientIp(request);
  const rl = rateLimit(`pedidos-crear:${ip}`, { maxAttempts: 10, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera un minuto.' }, { status: 429 });
  }

  const parsed = parseBody(schema, await request.json().catch(() => null));
  if (!parsed.ok) {
    if (parsed.error.startsWith('aceptaTerminos')) {
      return NextResponse.json({ error: 'Para comprar debes aceptar los Términos y Condiciones y la Política de Privacidad.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Revisa los datos del formulario', detalle: parsed.error }, { status: 400 });
  }
  const d = parsed.data;

  if (d.metodoPago === 'mercadopago' && !pagoEnLineaDisponible()) {
    return NextResponse.json({ error: 'El pago en línea no está disponible. Elige transferencia.' }, { status: 409 });
  }

  try {
    // Precio y stock vigentes. Si algo cambió desde que el cliente armó el
    // carrito, se le devuelve el carrito revisado para que lo vea antes de pagar.
    const lineas = await revisarLineas(d.items);
    const pedidas = new Map(d.items.map((i) => [i.productoId, i.cantidad]));
    const cambio =
      lineas.length !== pedidas.size ||
      lineas.some((l) => l.problema || l.cantidad !== pedidas.get(l.productoId));
    if (cambio) {
      return NextResponse.json(
        { error: 'Algunos productos cambiaron de stock o ya no están disponibles. Revisa tu carrito.', items: lineas },
        { status: 409 },
      );
    }

    const items: ItemPedido[] = lineas.map((l) => ({
      productoId: l.productoId,
      codigo: l.codigo,
      nombre: l.nombre,
      medida: l.medida,
      unidad: l.unidad,
      cantidad: l.cantidad,
      precio: l.precio,
      subtotal: l.precio * l.cantidad,
    }));
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    if (!Number.isInteger(subtotal) || subtotal <= 0) {
      return NextResponse.json({ error: 'El carrito no tiene un total válido' }, { status: 409 });
    }

    // El despacho también se calcula acá: lo que mostró el checkout es sólo una vista previa.
    let despacho: Awaited<ReturnType<typeof cotizarDespacho>> = null;
    if (d.entrega === 'despacho') {
      despacho = await cotizarDespacho(lineas, d.comuna);
      if (!despacho) return NextResponse.json({ error: 'Elige una comuna de la lista.' }, { status: 400 });
      if (despacho.estado !== 'ok') return NextResponse.json({ error: despacho.motivo }, { status: 409 });
    }
    const costoDespacho = despacho?.estado === 'ok' ? despacho.costo : null;
    if (costoDespacho != null && (!Number.isInteger(costoDespacho) || costoDespacho < 0)) {
      return NextResponse.json({ error: 'No pudimos calcular el despacho. Intenta de nuevo.' }, { status: 409 });
    }

    const { token, hash } = nuevoTokenAcceso();
    const store = pedidos();
    let pedido: Pedido | null = null;
    for (let intento = 0; intento < 4 && !pedido; intento++) {
      try {
        pedido = await store.crear({
          numero: nuevoNumeroPedido(),
          acceso_hash: hash,
          metodo_pago: d.metodoPago,
          entrega: d.entrega,
          direccion: d.entrega === 'despacho' ? d.direccion : null,
          comuna: despacho?.comuna.nombre ?? null,
          comuna_codigo: despacho?.comuna.codigo ?? null,
          despacho_tipo: despacho?.estado === 'ok' ? despacho.tipo : null,
          courier: despacho?.estado === 'ok' && despacho.tipo === 'courier' ? despacho.courier : null,
          nombre: d.nombre,
          rut: d.rut ? formatearRut(d.rut) : null,
          telefono: d.telefono,
          email: d.email,
          notas: d.notas || null,
          items,
          subtotal,
          terminos_aceptados_at: new Date().toISOString(),
          acepta_ofertas: d.aceptaOfertas,
          costo_despacho: costoDespacho, // null = a coordinar
          total: subtotal + (costoDespacho ?? 0),
        });
      } catch (e) {
        if ((e as { code?: string }).code !== '23505') throw e; // número repetido: otro intento
      }
    }
    if (!pedido) throw new Error('No se pudo generar un número de pedido');

    logSafe('pedido-creado', { numero: pedido.numero, metodo: d.metodoPago, total: pedido.total, email: maskEmail(d.email) });

    let redirect = `/pedido/${pedido.numero}`;
    if (d.metodoPago === 'mercadopago') {
      const origen = origenTienda(request.url);
      try {
        const pasarela = pasarelaActiva();
        const inicio = await pasarela.iniciar(pedido, {
          retorno: `${origen}/pedido/${pedido.numero}`,
          notificacion: `${origen}/api/pagos/webhook`,
        });
        await store.guardarReferenciaPago(pedido.numero, pasarela.id, inicio.referencia);
        redirect = inicio.url;
      } catch (e) {
        // El pedido queda guardado y pendiente; en la confirmación se ofrece
        // reintentar o pasar a transferencia.
        logSafeError('pedido-pago-inicio-error', { numero: pedido.numero, error: String(e) });
        redirect = `/pedido/${pedido.numero}`;
      }
    } else {
      await Promise.all([correoConfirmacionComprador(pedido), correoAvisoBarraca(pedido, 'nuevo')]);
    }

    const res = NextResponse.json({ numero: pedido.numero, total: pedido.total, redirect }, { status: 201 });
    res.cookies.set(cookiePedido(pedido.numero), token, {
      httpOnly: true,
      sameSite: 'lax', // viaja en el retorno top-level desde Mercado Pago
      secure: origenTienda(request.url).startsWith('https://'),
      path: '/',
      maxAge: 60 * 60 * 24 * 90,
    });
    return res;
  } catch (error) {
    logSafeError('pedido-crear-error', { error: String(error) });
    return NextResponse.json({ error: 'No pudimos registrar tu pedido. Intenta de nuevo.' }, { status: 500 });
  }
}
