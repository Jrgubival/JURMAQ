import 'server-only';
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { env } from '@jurmaq/shared/env';
import { crearStoreArchivo } from './archivo';
import type { EnvioEmitido, Paquete } from '@/lib/despacho/courier/tipos';

/**
 * Pedidos de la tienda (tabla `barraca_pedidos`, ver
 * supabase/migrations/2026_10_26_barraca_pedidos.sql).
 *
 * Detrás de una interfaz para poder probar el flujo completo en local sin
 * escribir en la base de producción: con PEDIDOS_STORE=archivo (sólo fuera de
 * producción) los pedidos van a un JSON en la carpeta de la app.
 */

export type EstadoPedido =
  | 'pendiente_pago'
  | 'pagado'
  | 'pago_rechazado'
  | 'pago_discrepancia'
  | 'en_preparacion'
  | 'listo_retiro'
  | 'despachado'
  | 'entregado'
  | 'cancelado';

export const ESTADOS_PEDIDO: EstadoPedido[] = [
  'pendiente_pago', 'pagado', 'pago_rechazado', 'pago_discrepancia',
  'en_preparacion', 'listo_retiro', 'despachado', 'entregado', 'cancelado',
];

export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  pendiente_pago: 'Pendiente de pago',
  pagado: 'Pagado',
  pago_rechazado: 'Pago rechazado',
  pago_discrepancia: 'Pago por revisar',
  en_preparacion: 'En preparación',
  listo_retiro: 'Listo para retiro',
  despachado: 'Despachado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

/** 'webpay' = pago en línea con Webpay Plus; 'mercadopago' queda por pedidos antiguos. */
export type MetodoPago = 'webpay' | 'mercadopago' | 'transferencia';
export type Entrega = 'retiro' | 'despacho';
export type TipoDespacho = 'propio' | 'courier';

export interface ItemPedido {
  productoId: number;
  codigo: string | null;
  nombre: string;
  medida: string | null;
  unidad: string | null;
  cantidad: number;
  precio: number;
  subtotal: number;
}

export interface Pedido {
  id: number | string;
  numero: string;
  acceso_hash: string;
  estado: EstadoPedido;
  metodo_pago: MetodoPago;
  pasarela: string | null;
  pasarela_referencia: string | null;
  pago_id: string | null;
  /** Comprobante del pago en línea (Webpay: orden, autorización, tarjeta, cuotas). */
  pago_detalle: Record<string, unknown> | null;
  pagado_at: string | null;
  entrega: Entrega;
  direccion: string | null;
  comuna: string | null;
  nombre: string;
  rut: string | null;
  telefono: string;
  email: string;
  notas: string | null;
  items: ItemPedido[];
  subtotal: number;
  costo_despacho: number | null;
  /** Cómo viaja el despacho: camión propio o courier. null en retiro. */
  despacho_tipo: TipoDespacho | null;
  /** Código de comuna (ver lib/despacho/comunas.ts). */
  comuna_codigo: string | null;
  /** Courier usado ('enviame', 'simulado') y su número de seguimiento. */
  courier: string | null;
  /** Transportista y servicio cotizados (ej. "BLX:priority"), para crear el envío con lo mismo. */
  courier_servicio: string | null;
  /** La caja cotizada (peso y medidas), para que el envío salga igual. */
  courier_paquete: Paquete | null;
  courier_seguimiento: string | null;
  /** URL de la etiqueta PDF del courier y id del envío en el courier. */
  courier_etiqueta_url: string | null;
  courier_envio_id: string | null;
  /** Cuándo aceptó los Términos y la Privacidad en el checkout (obligatorio para comprar). */
  terminos_aceptados_at: string;
  /** Consentimiento aparte, no obligatorio, para recordatorios y ofertas por correo. */
  acepta_ofertas: boolean;
  total: number;
  stock_descontado: boolean;
  created_at: string;
  updated_at: string;
}

export type NuevoPedido = Omit<
  Pedido,
  'id' | 'estado' | 'pasarela' | 'pasarela_referencia' | 'pago_id' | 'pago_detalle' | 'pagado_at' | 'stock_descontado' | 'courier_seguimiento' | 'courier_etiqueta_url' | 'courier_envio_id' | 'created_at' | 'updated_at'
>;

export type ResultadoPago = 'pagado' | 'ya_procesado' | 'monto_distinto' | 'no_encontrado';

export interface PedidosStore {
  crear(p: NuevoPedido): Promise<Pedido>;
  porNumero(numero: string): Promise<Pedido | null>;
  guardarReferenciaPago(numero: string, pasarela: string, referencia: string): Promise<void>;
  /** Marca pagado y descuenta stock, atómico e idempotente. */
  marcarPagado(numero: string, monto: number, pagoId: string, pasarela: string): Promise<ResultadoPago>;
  /** Sólo pasa a 'pago_rechazado' si seguía pendiente. */
  marcarRechazado(numero: string, pagoId: string | null): Promise<void>;
  /** Guarda el comprobante del último intento de pago en línea. */
  guardarDetallePago(numero: string, detalle: Record<string, unknown>): Promise<void>;
  cambiarEstado(numero: string, estado: EstadoPedido): Promise<void>;
  /** Guarda el envío generado. Sólo si el pedido aún no tenía seguimiento (devuelve false si ya lo tenía). */
  guardarEnvio(numero: string, envio: EnvioEmitido): Promise<boolean>;
  listar(opts: { estado?: EstadoPedido; limite?: number }): Promise<Pedido[]>;
}

// La tabla todavía no está en db-types (la migración no está aplicada).
const db = supabaseAdmin as unknown as SupabaseClient;

const storeSupabase: PedidosStore = {
  async crear(p) {
    const { data, error } = await db.from('barraca_pedidos').insert(p).select('*').single();
    if (error) throw error;
    return data as Pedido;
  },
  async porNumero(numero) {
    const { data, error } = await db.from('barraca_pedidos').select('*').eq('numero', numero).maybeSingle();
    if (error) throw error;
    return (data as Pedido) ?? null;
  },
  async guardarReferenciaPago(numero, pasarela, referencia) {
    const { error } = await db
      .from('barraca_pedidos')
      .update({ pasarela, pasarela_referencia: referencia })
      .eq('numero', numero);
    if (error) throw error;
  },
  async marcarPagado(numero, monto, pagoId, pasarela) {
    const { data, error } = await db.rpc('barraca_pedido_marcar_pagado', {
      p_numero: numero,
      p_monto: Math.round(monto),
      p_pago_id: pagoId,
      p_pasarela: pasarela,
    });
    if (error) throw error;
    return data as ResultadoPago;
  },
  async marcarRechazado(numero, pagoId) {
    const { error } = await db
      .from('barraca_pedidos')
      .update({ estado: 'pago_rechazado', pago_id: pagoId })
      .eq('numero', numero)
      .eq('estado', 'pendiente_pago');
    if (error) throw error;
  },
  async guardarDetallePago(numero, detalle) {
    const { error } = await db.from('barraca_pedidos').update({ pago_detalle: detalle }).eq('numero', numero);
    if (error) throw error;
  },
  async cambiarEstado(numero, estado) {
    const { error } = await db.from('barraca_pedidos').update({ estado }).eq('numero', numero);
    if (error) throw error;
  },
  async guardarEnvio(numero, envio) {
    const { data, error } = await db
      .from('barraca_pedidos')
      .update({
        courier_seguimiento: envio.seguimiento,
        courier_etiqueta_url: envio.etiquetaUrl,
        courier_envio_id: envio.envioId,
      })
      .eq('numero', numero)
      .is('courier_seguimiento', null)
      .select('numero');
    if (error) throw error;
    return (data ?? []).length > 0;
  },
  async listar({ estado, limite = 200 }) {
    let q = db.from('barraca_pedidos').select('*').order('created_at', { ascending: false }).limit(limite);
    if (estado) q = q.eq('estado', estado);
    const { data, error } = await q;
    if (error) throw error;
    return (data as Pedido[]) ?? [];
  },
};

/** Producción real (Vercel production). Los modos de prueba se niegan acá. */
export function esProduccion(): boolean {
  return process.env.VERCEL_ENV === 'production' || (process.env.NODE_ENV === 'production' && !!process.env.VERCEL);
}

let store: PedidosStore | null = null;

export function pedidos(): PedidosStore {
  if (store) return store;
  if (env.PEDIDOS_STORE === 'archivo') {
    // Fail-closed: el JSON local jamás se usa en producción.
    if (esProduccion()) {
      throw new Error('PEDIDOS_STORE=archivo no está permitido en producción');
    }
    store = crearStoreArchivo();
  } else {
    store = storeSupabase;
  }
  return store;
}

// ---------------------------------------------------------------------------
// Número y token de acceso
// ---------------------------------------------------------------------------

const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // sin 0/O/1/I/L

/** "BJ-261026-7KQ4": fecha (para ubicarlo a ojo) + 4 caracteres al azar. */
export function nuevoNumeroPedido(fecha = new Date()): string {
  const f = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', year: '2-digit', month: '2-digit', day: '2-digit',
  }).formatToParts(fecha);
  const parte = (t: string) => f.find((x) => x.type === t)?.value ?? '00';
  const bytes = crypto.randomBytes(4);
  const sufijo = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
  return `BJ-${parte('year')}${parte('month')}${parte('day')}-${sufijo}`;
}

export const PATRON_NUMERO = /^BJ-\d{6}-[2-9A-HJKMNP-Z]{4}$/;

export function nuevoTokenAcceso(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Compara en tiempo constante el token de la cookie con el hash guardado. */
export function tokenValido(token: string | undefined, hash: string): boolean {
  if (!token || !hash) return false;
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Nombre de la cookie httpOnly que da acceso a la confirmación de un pedido. */
export function cookiePedido(numero: string): string {
  return `bj_pedido_${numero.replace(/[^A-Z0-9]/gi, '')}`;
}
