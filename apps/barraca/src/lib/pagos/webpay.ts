import 'server-only';
import crypto from 'crypto';
import { WebpayPlus, IntegrationApiKeys, IntegrationCommerceCodes } from 'transbank-sdk';
import { env } from '@jurmaq/shared/env';
import { esProduccion } from '@/lib/pedidos';
import type { PasarelaPago, EstadoPagoPasarela } from './tipos';

/**
 * Webpay Plus (Transbank, API REST, SDK oficial `transbank-sdk`).
 *
 * Flujo:
 *  1. iniciar → crea la transacción por el TOTAL GUARDADO del pedido y deja el
 *     token en el pedido. El comprador pasa por /pago/webpay/<numero>, que
 *     arma el formulario POST hacia Webpay (el token no va en la URL).
 *  2. Webpay vuelve a /api/pagos/webpay/retorno?pedido=<numero>; ahí se
 *     confirma (commit) y se valida monto, orden y sesión contra el pedido.
 *
 * Credenciales sólo por variables de entorno:
 *   WEBPAY_ENTORNO=produccion, WEBPAY_COMMERCE_CODE y WEBPAY_API_KEY.
 * Sin WEBPAY_ENTORNO=produccion se usa el ambiente de INTEGRACIÓN con las
 * credenciales públicas de prueba de Transbank. En producción (Vercel) el
 * ambiente de integración no se permite: sin credenciales, no hay pago en línea.
 */

export const URL_FORMULARIO = {
  integracion: 'https://webpay3gint.transbank.cl/webpayserver/initTransaction',
  produccion: 'https://webpay3g.transbank.cl/webpayserver/initTransaction',
} as const;

export function entornoWebpay(): 'integracion' | 'produccion' {
  return env.WEBPAY_ENTORNO === 'produccion' ? 'produccion' : 'integracion';
}

/** ¿Hay con qué cobrar? Fail-closed: producción sin credenciales de producción = no. */
export function webpayConfigurado(): boolean {
  if (entornoWebpay() === 'produccion') {
    return /^\d{12}$/.test(env.WEBPAY_COMMERCE_CODE?.trim() ?? '') && !!env.WEBPAY_API_KEY?.trim();
  }
  return !esProduccion();
}

function transaccion() {
  if (entornoWebpay() === 'produccion') {
    const codigo = env.WEBPAY_COMMERCE_CODE?.trim();
    const llave = env.WEBPAY_API_KEY?.trim();
    if (!codigo || !/^\d{12}$/.test(codigo) || !llave) throw new Error('Webpay de producción sin credenciales válidas');
    return WebpayPlus.Transaction.buildForProduction(codigo, llave);
  }
  if (esProduccion()) throw new Error('Webpay de integración no permitido en producción');
  return WebpayPlus.Transaction.buildForIntegration(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY);
}

/**
 * Sesión de la transacción: HMAC del número de pedido. Permite reconocer un
 * retorno por tiempo agotado (que no trae token) sin guardar nada más.
 */
export function sesionWebpay(numero: string): string {
  return crypto.createHmac('sha256', env.AUTH_SECRET).update(`webpay:${numero}`).digest('hex').slice(0, 40);
}

/** Orden de compra única por intento: "<numero>-<sufijo>" (máx. 26 caracteres). */
function ordenDeCompra(numero: string): string {
  return `${numero}-${Date.now().toString(36).toUpperCase()}`.slice(0, 26);
}

export function numeroDeOrden(ordenCompra: string): string {
  return ordenCompra.split('-').slice(0, 3).join('-');
}

/** Lo que Transbank pide mostrar en el comprobante. */
export interface DetalleWebpay {
  ordenCompra: string;
  autorizacion: string | null;
  monto: number;
  tarjeta: string | null; // últimos 4 dígitos
  tipoPago: string; // Débito, Crédito, Prepago…
  cuotas: number;
  fecha: string | null;
  codigoRespuesta: number | null;
}

const TIPOS_PAGO: Record<string, string> = {
  VD: 'Débito',
  VP: 'Prepago',
  VN: 'Crédito, sin cuotas',
  VC: 'Crédito, cuotas normales',
  SI: 'Crédito, 3 cuotas sin interés',
  S2: 'Crédito, 2 cuotas sin interés',
  NC: 'Crédito, N cuotas sin interés',
};

/** Respuesta de commit/status de Webpay Plus, validada (no se confía en su forma). */
export interface ResultadoWebpay {
  aprobado: boolean;
  estado: EstadoPagoPasarela;
  detalle: DetalleWebpay;
  sesion: string;
}

export function leerRespuesta(r: unknown): ResultadoWebpay | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  const monto = Number(o.amount);
  const orden = typeof o.buy_order === 'string' ? o.buy_order : '';
  if (!Number.isInteger(monto) || monto <= 0 || !orden) return null;
  const codigo = typeof o.response_code === 'number' ? o.response_code : null;
  const aprobado = codigo === 0 && o.status === 'AUTHORIZED';
  const tarjeta = (o.card_detail as { card_number?: unknown } | undefined)?.card_number;
  const tipo = typeof o.payment_type_code === 'string' ? o.payment_type_code : '';
  const cuotas = Number(o.installments_number);
  const detalle: DetalleWebpay = {
    ordenCompra: orden,
    autorizacion: typeof o.authorization_code === 'string' ? o.authorization_code : null,
    monto,
    tarjeta: typeof tarjeta === 'string' ? tarjeta.slice(-4) : null,
    tipoPago: TIPOS_PAGO[tipo] ?? (tipo || '—'),
    cuotas: Number.isInteger(cuotas) ? cuotas : 0,
    fecha: typeof o.transaction_date === 'string' ? o.transaction_date : null,
    codigoRespuesta: codigo,
  };
  return {
    aprobado,
    sesion: typeof o.session_id === 'string' ? o.session_id : '',
    detalle,
    estado: {
      numero: numeroDeOrden(orden),
      estado: aprobado ? 'aprobado' : 'rechazado',
      monto,
      pagoId: `${orden}${detalle.autorizacion ? `/${detalle.autorizacion}` : ''}`,
    },
  };
}

/** Confirma el pago. Si ya estaba confirmado (doble retorno), consulta su estado. */
export async function confirmarWebpay(token: string): Promise<ResultadoWebpay | null> {
  const tx = transaccion();
  try {
    return leerRespuesta(await tx.commit(token));
  } catch {
    // Commit repetido o fallido: el estado real se pregunta a Transbank.
    return leerRespuesta(await tx.status(token));
  }
}

export const webpay: PasarelaPago = {
  id: 'webpay',

  async iniciar(pedido, urls) {
    if (!Number.isInteger(pedido.total) || pedido.total <= 0) throw new Error('Total inválido');
    const origen = new URL(urls.retorno).origin;
    const retorno = `${origen}/api/pagos/webpay/retorno?pedido=${encodeURIComponent(pedido.numero)}`;
    const r = (await transaccion().create(ordenDeCompra(pedido.numero), sesionWebpay(pedido.numero), pedido.total, retorno)) as {
      token?: unknown;
    };
    if (typeof r?.token !== 'string' || !r.token) throw new Error('Webpay no devolvió token');
    return { url: `/pago/webpay/${encodeURIComponent(pedido.numero)}`, referencia: r.token };
  },

  async consultarPago(token) {
    return leerRespuesta(await transaccion().status(token))?.estado ?? null;
  },
};

/**
 * Devuelve un pago aprobado (pedido no aprobado por la barraca). Por el total,
 * dentro de plazo Transbank lo reversa (como si no se hubiera cobrado); fuera
 * de plazo lo anula y el abono llega según el banco emisor. Sólo lo llama el
 * panel, con confirmación previa del administrador.
 */
export async function reembolsarWebpay(token: string, monto: number): Promise<{ ok: boolean; tipo: string | null; autorizacion: string | null }> {
  if (!Number.isInteger(monto) || monto <= 0) throw new Error('Monto inválido');
  const r = (await transaccion().refund(token, monto)) as Record<string, unknown> | null;
  const tipo = typeof r?.type === 'string' ? r.type : null;
  const codigo = typeof r?.response_code === 'number' ? r.response_code : null;
  const ok = tipo === 'REVERSED' || (tipo === 'NULLIFIED' && codigo === 0);
  return { ok, tipo, autorizacion: typeof r?.authorization_code === 'string' ? r.authorization_code : null };
}
