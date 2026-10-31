import 'server-only';
import crypto from 'crypto';
import { env } from '@jurmaq/shared/env';
import { safeSecretEquals } from '@jurmaq/shared/crypto/secret';
import { cookiePedido, tokenValido, PATRON_NUMERO, type Pedido } from './index';

/**
 * Enlaces de los correos al comprador, sin cuentas ni contraseñas (oct-2026:
 * la tienda vende sólo como invitado).
 *
 *   - "Ver tu pedido":  /pedido/acceso/<numero>/<token>
 *   - "Danos tu opinión": /opinar/<numero>/<token>
 *
 * El token es un HMAC-SHA256 (AUTH_SECRET) del número con un prefijo distinto
 * para cada uso, así un enlace no sirve para el otro. No se guarda en la base:
 * se recalcula y se compara en tiempo constante. Va en la ruta, nunca en la
 * query string, y jamás se escribe en los logs.
 */

export const PATRON_TOKEN = /^[a-f0-9]{64}$/;

const URL_TIENDA = (env.NEXT_PUBLIC_BARRACA_URL || 'https://barraca.jurmaq.cl').replace(/\/$/, '');

function firmar(uso: 'pedido-enlace' | 'opinar', numero: string): string {
  return crypto.createHmac('sha256', env.AUTH_SECRET).update(`${uso}:${numero}`).digest('hex');
}

function valido(uso: 'pedido-enlace' | 'opinar', numero: string, token: string | null | undefined): boolean {
  if (typeof token !== 'string' || !PATRON_NUMERO.test(numero) || !PATRON_TOKEN.test(token)) return false;
  return safeSecretEquals(token, firmar(uso, numero));
}

export const tokenEnlacePedido = (numero: string) => firmar('pedido-enlace', numero);
export const enlacePedidoValido = (numero: string, token: string | null | undefined) => valido('pedido-enlace', numero, token);
export const tokenOpinar = (numero: string) => firmar('opinar', numero);
export const opinarValido = (numero: string, token: string | null | undefined) => valido('opinar', numero, token);

export function urlVerPedido(numero: string): string {
  return `${URL_TIENDA}/pedido/acceso/${encodeURIComponent(numero)}/${tokenEnlacePedido(numero)}`;
}

export function urlOpinar(numero: string): string {
  return `${URL_TIENDA}/opinar/${encodeURIComponent(numero)}/${tokenOpinar(numero)}`;
}

/** Cookie httpOnly que deja el enlace del correo (guarda el mismo HMAC). */
export function cookieEnlacePedido(numero: string): string {
  return `pedido_enlace_${numero.replace(/[^A-Z0-9]/gi, '')}`;
}

/** Cuánto dura la cookie del enlace en el navegador (igual que la del checkout). */
export const DURACION_COOKIE_ENLACE = 60 * 60 * 24 * 90;

/**
 * ¿Este navegador puede ver (y pagar) el pedido? Vale la cookie del checkout
 * (token al azar cuyo sha256 está en acceso_hash) o la del enlace del correo.
 */
export function puedeVerPedido(leerCookie: (nombre: string) => string | undefined, p: Pedido): boolean {
  if (tokenValido(leerCookie(cookiePedido(p.numero)), p.acceso_hash)) return true;
  return enlacePedidoValido(p.numero, leerCookie(cookieEnlacePedido(p.numero)));
}
