import { NextRequest, NextResponse } from 'next/server';
import { safeSecretEquals } from '@jurmaq/shared/crypto/secret';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { pedidos, PATRON_NUMERO } from '@/lib/pedidos';
import { aplicarEstadoPago, origenTienda } from '@/lib/pagos';
import { confirmarWebpay, reembolsarWebpay, sesionWebpay } from '@/lib/pagos/webpay';

/**
 * Retorno de Webpay Plus: /api/pagos/webpay/retorno?pedido=<numero>.
 * Webpay llega por GET o por POST (formulario), con uno de estos juegos:
 *   - token_ws                                → pago terminado: se confirma (commit).
 *   - TBK_TOKEN + TBK_ORDEN_COMPRA (+token_ws) → el comprador anuló en el formulario.
 *   - TBK_ORDEN_COMPRA + TBK_ID_SESION         → se agotó el tiempo.
 *
 * No se confía en nada de lo que trae la URL: el token tiene que ser el que
 * se guardó en el pedido, el resultado se le pregunta a Transbank y el monto
 * se compara con el total guardado (lo hace barraca_pedido_marcar_pagado).
 * Idempotente: un segundo retorno con el mismo token no cobra ni descuenta de
 * nuevo (commit repetido → status; el pedido ya pagado devuelve 'ya_procesado').
 */

async function leerParametros(request: NextRequest): Promise<URLSearchParams> {
  const p = new URLSearchParams(request.nextUrl.searchParams);
  if (request.method === 'POST') {
    try {
      const form = await request.formData();
      for (const [k, v] of form.entries()) if (typeof v === 'string' && !p.has(k)) p.set(k, v);
    } catch { /* sin cuerpo */ }
  }
  return p;
}

function volver(request: NextRequest, numero: string | null, pago?: string) {
  const origen = origenTienda(request.url);
  const url = numero ? `${origen}/pedido/${encodeURIComponent(numero)}${pago ? `?pago=${pago}` : ''}` : `${origen}/`;
  // 303: el navegador vuelve con GET aunque Webpay haya llegado por POST.
  return NextResponse.redirect(url, 303);
}

async function atender(request: NextRequest) {
  const rl = rateLimit(`webpay-retorno:${getClientIp(request)}`, { maxAttempts: 30, windowSeconds: 60 });
  if (!rl.success) return new NextResponse('Demasiadas solicitudes', { status: 429 });

  const p = await leerParametros(request);
  const numero = p.get('pedido') ?? '';
  if (!PATRON_NUMERO.test(numero)) return volver(request, null);

  const store = pedidos();
  const pedido = await store.porNumero(numero);
  if (!pedido) return volver(request, null);

  const tokenWs = p.get('token_ws');
  const tbkToken = p.get('TBK_TOKEN');
  const tbkOrden = p.get('TBK_ORDEN_COMPRA');
  const tbkSesion = p.get('TBK_ID_SESION');
  const pendiente = pedido.estado === 'pendiente_pago' || pedido.estado === 'pago_rechazado';
  const tokenDelPedido = (t: string | null) =>
    !!t && pedido.pasarela === 'webpay' && !!pedido.pasarela_referencia && safeSecretEquals(t, pedido.pasarela_referencia);

  // Anulado por el comprador (o error en el formulario de Webpay): no hubo cobro.
  if (tbkToken) {
    if (tokenDelPedido(tbkToken) && pendiente) {
      await store.marcarRechazado(numero, null);
      logSafe('webpay-anulado', { numero });
    }
    return volver(request, numero, 'anulado');
  }

  // Pago terminado: confirmar con Transbank.
  if (tokenWs) {
    if (!tokenDelPedido(tokenWs)) {
      logSafeError('webpay-token-ajeno', { numero });
      return volver(request, numero);
    }
    if (!pendiente) return volver(request, numero); // doble retorno de un pedido ya resuelto
    try {
      const r = await confirmarWebpay(tokenWs);
      if (!r) throw new Error('respuesta de Webpay ilegible');
      if (r.estado.numero !== numero || !safeSecretEquals(r.sesion, sesionWebpay(numero))) {
        logSafeError('webpay-orden-no-calza', { numero });
        return volver(request, numero, 'error');
      }
      await store.guardarDetallePago(numero, { ...r.detalle, pasarela: 'webpay' });
      const resultado = await aplicarEstadoPago(r.estado, 'webpay');
      logSafe('webpay-retorno', { numero, resultado, codigo: r.detalle.codigoRespuesta });
      // Carrera: la barraca canceló o no aprobó el pedido mientras se pagaba.
      // El cobro ya se aprobó en Transbank: se anula de inmediato.
      if (r.aprobado && resultado === 'ya_procesado') {
        const actual = await store.porNumero(numero);
        if (actual && (actual.estado === 'cancelado' || actual.estado === 'rechazado')) {
          const fecha = () => new Date().toISOString();
          if (await store.tomarReembolso(numero, { estado: 'en_curso', medio: 'webpay', monto: r.detalle.monto, fecha: fecha() })) {
            let ok = false;
            try {
              ok = (await reembolsarWebpay(tokenWs, r.detalle.monto)).ok;
            } catch (e) {
              logSafeError('webpay-reembolso-pedido-cerrado', { numero, error: String(e) });
            }
            await store.guardarReembolso(numero, { estado: ok ? 'hecho' : 'error', medio: 'webpay', monto: r.detalle.monto, fecha: fecha() });
            logSafeError('webpay-pago-sobre-pedido-cerrado', { numero, reembolsado: ok });
          }
          return volver(request, numero, 'cerrado');
        }
      }
      return volver(request, numero, resultado === 'rechazado' ? 'rechazado' : undefined);
    } catch (error) {
      logSafeError('webpay-confirmar-error', { numero, error: String(error) });
      return volver(request, numero, 'error');
    }
  }

  // Tiempo agotado: sólo trae la orden y la sesión.
  if (tbkOrden && tbkSesion) {
    if (pendiente && safeSecretEquals(tbkSesion, sesionWebpay(numero)) && tbkOrden.startsWith(`${numero}-`)) {
      await store.marcarRechazado(numero, null);
      logSafe('webpay-tiempo-agotado', { numero });
    }
    return volver(request, numero, 'tiempo');
  }

  return volver(request, numero);
}

export async function GET(request: NextRequest) {
  return atender(request);
}

export async function POST(request: NextRequest) {
  return atender(request);
}
