import { NextRequest, NextResponse } from 'next/server';
import { z, parseBody } from '@jurmaq/shared/validation';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { revisarLineas, MAX_LINEAS } from '@/lib/tienda';
import { usarGestion } from '@/lib/gestion';
import { evaluarCuponCheckout, MENSAJES_CUPON, type ResultadoCupon } from '@/lib/cupones/servicio';
import { totalesPedido } from '@/lib/cupones/totales';
import { pctTransferenciaActual } from '@/lib/pagos/descuento-config';
import { repoSupabase } from '@/lib/cupones/repo-supabase';
import { rutValido } from '@/lib/rut';

/**
 * POST /api/checkout/cupon — vista previa del cupón en el checkout. No consume
 * nada: la reserva real ocurre al crear el pedido (/api/pedidos). El descuento
 * se calcula acá, desde precios y categorías de la base; del navegador solo
 * se toman ids, cantidades, código, correo y RUT.
 */

export const runtime = 'nodejs';

const schema = z.object({
  codigo: z.string().trim().min(1).max(40),
  items: z.array(z.object({ productoId: z.number().int().positive(), cantidad: z.number().int().positive().max(9999) })).min(1).max(MAX_LINEAS),
  email: z.string().trim().toLowerCase().email().max(160),
  rut: z.string().trim().max(14).optional().default(''),
  metodoPago: z.enum(['webpay', 'transferencia']).optional().default('webpay'),
});

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) return NextResponse.json({ ok: false, error: 'Origen no autorizado' }, { status: 403 });
  const rl = rateLimit(`checkout-cupon:${getClientIp(request)}`, { maxAttempts: 15, windowSeconds: 60 });
  if (!rl.success) return NextResponse.json({ ok: false, error: 'Demasiados intentos. Espera un minuto.' }, { status: 429 });

  const parsed = parseBody(schema, await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ ok: false, error: 'Revisa el código y tu correo.' }, { status: 400 });
  const d = parsed.data;
  if (d.rut && !rutValido(d.rut)) return NextResponse.json({ ok: false, error: 'El RUT no es válido.' }, { status: 400 });

  try {
    const lineas = await revisarLineas(d.items);
    const pctTransferencia = await pctTransferenciaActual();
    const lineasCupon = lineas
      .filter((l) => !l.problema)
      .map((l) => ({ productoId: l.productoId, categoriaId: l.categoriaId, subtotal: l.subtotal, conDescuento: l.conDescuento }));
    let ev: ResultadoCupon;
    try {
      ev = await usarGestion((db) => evaluarCuponCheckout(db, repoSupabase, { codigo: d.codigo, lineas: lineasCupon, email: d.email, rut: d.rut, pctTransferencia }));
    } catch {
      ev = { ok: false, motivo: 'no_disponible', mensaje: MENSAJES_CUPON.no_disponible };
    }
    if (!ev.ok) return NextResponse.json({ ok: false, motivo: ev.motivo, error: ev.mensaje }, { status: 200 });

    const subtotal = lineas.reduce((s, l) => s + l.subtotal, 0);
    const t = totalesPedido({ subtotal, descuentoCupon: ev.descuento, metodoPago: d.metodoPago, costoDespacho: null, pctTransferencia });
    return NextResponse.json({
      ok: true,
      codigo: ev.cupon.codigo,
      descripcion: ev.cupon.descripcion,
      descuento: ev.descuento,
      descuentoTransferencia: t.descuentoTransferencia,
      requiereRut: ev.reglas.unUsoPorCliente,
      // Líneas que no recibieron el cupón (para decírselo al cliente).
      sinCupon: ev.excluidas.length,
      motivoSinCupon: ev.excluidas[0]?.motivo ?? null,
    });
  } catch {
    return NextResponse.json({ ok: false, motivo: 'error', error: MENSAJES_CUPON.error }, { status: 200 });
  }
}
