/**
 * Lógica del panel de Ventas (lista, filtros, totales, Excel). Sin
 * dependencias de servidor: la usan la API y la pantalla.
 *
 * Fechas: todo en hora de Chile. Un período es [desde, hasta) en días
 * "YYYY-MM-DD"; se filtra por la fecha en que se hizo el pedido.
 */

import type { EstadoPedido } from '@/lib/pedidos';
import { MOTIVOS_CANCELACION, MOTIVOS_RECHAZO, type MotivoCancelacion, type MotivoRechazo } from '@/lib/pedidos/motivos';
import { ZONAS_DESPACHO } from '@/lib/despacho/zonas';

export const TZ = 'America/Santiago';

/** Estados que cuentan como venta (mismo criterio que el Resumen). */
export const ESTADOS_VENTA: EstadoPedido[] = ['pagado', 'en_preparacion', 'listo_retiro', 'despachado', 'entregado'];

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------

export type Preset = 'hoy' | '7d' | 'mes' | 'mes_pasado' | 'rango';
export const PRESETS: Array<{ id: Exclude<Preset, 'rango'>; label: string }> = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mes_pasado', label: 'Mes pasado' },
];

const PATRON_DIA = /^\d{4}-\d{2}-\d{2}$/;
const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "2026-10-30" en hora de Chile. */
export function diaChile(fecha: Date | string): string {
  return fmtDia.format(typeof fecha === 'string' ? new Date(fecha) : fecha);
}

export function diaValido(s: unknown): s is string {
  if (typeof s !== 'string' || !PATRON_DIA.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d && y >= 2020 && y <= 2100;
}

/** Suma días a "YYYY-MM-DD" (calendario, sin horas). */
export function sumarDias(dia: string, n: number): string {
  const [y, m, d] = dia.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + n));
  return f.toISOString().slice(0, 10);
}

/** Minutos que Chile está corrido respecto de UTC en ese instante (ej. -180). */
function desfaseMin(instante: number): number {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instante));
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value);
  const comoUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'));
  return Math.round((comoUtc - instante) / 60000);
}

/** Instante UTC (ISO) de las 00:00 de ese día en Chile. Aguanta cambios de horario. */
export function inicioDiaChile(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);
  let t = base - desfaseMin(base) * 60000;
  t = base - desfaseMin(t) * 60000;
  return new Date(t).toISOString();
}

export interface Periodo {
  preset: Preset;
  /** Primer día incluido. */
  desde: string;
  /** Último día incluido. */
  hasta: string;
}

/** Resuelve el período pedido. Un rango inválido o al revés cae en "Este mes". Máximo 400 días. */
export function resolverPeriodo(preset: string | null | undefined, desde?: string | null, hasta?: string | null, ahora = new Date()): Periodo {
  const hoy = diaChile(ahora);
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  switch (preset) {
    case 'hoy': return { preset: 'hoy', desde: hoy, hasta: hoy };
    case '7d': return { preset: '7d', desde: sumarDias(hoy, -6), hasta: hoy };
    case 'mes_pasado': {
      const finAnterior = sumarDias(inicioMes, -1);
      return { preset: 'mes_pasado', desde: `${finAnterior.slice(0, 7)}-01`, hasta: finAnterior };
    }
    case 'rango':
      if (diaValido(desde) && diaValido(hasta) && desde <= hasta && hasta <= sumarDias(desde, 400)) {
        return { preset: 'rango', desde, hasta };
      }
      break;
  }
  return { preset: 'mes', desde: inicioMes, hasta: hoy };
}

/** [desde, hasta) en ISO UTC para consultar la base. */
export function limitesPeriodo(p: Periodo): { desde: string; hasta: string } {
  return { desde: inicioDiaChile(p.desde), hasta: inicioDiaChile(sumarDias(p.hasta, 1)) };
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

export type GrupoEstado = 'todos' | 'atender' | 'informada' | 'por_pagar' | 'por_preparar' | 'listos' | 'entregados' | 'cerrados';

export const GRUPOS_ESTADO: Array<{ id: GrupoEstado; label: string; estados: EstadoPedido[] | null }> = [
  { id: 'todos', label: 'Todos', estados: null },
  { id: 'atender', label: 'Por atender', estados: ['transferencia_informada', 'pago_discrepancia', 'pagado', 'en_preparacion', 'pendiente_pago', 'pago_rechazado'] },
  { id: 'informada', label: 'Transferencia informada', estados: ['transferencia_informada'] },
  { id: 'por_pagar', label: 'Por pagar', estados: ['pendiente_pago', 'pago_rechazado', 'pago_discrepancia'] },
  { id: 'por_preparar', label: 'Por preparar', estados: ['pagado', 'en_preparacion'] },
  { id: 'listos', label: 'Listos / en camino', estados: ['listo_retiro', 'despachado'] },
  { id: 'entregados', label: 'Entregados', estados: ['entregado'] },
  { id: 'cerrados', label: 'Cancelados / no aprobados', estados: ['cancelado', 'rechazado'] },
];

export type Medio = 'todos' | 'webpay' | 'transferencia';
export const MEDIOS: Array<{ id: Medio; label: string }> = [
  { id: 'todos', label: 'Todo medio' },
  { id: 'webpay', label: 'Webpay' },
  { id: 'transferencia', label: 'Transferencia' },
];

/** 'todas', 'retiro', 'otra' (despacho fuera de las zonas) o el id de una zona del camión. */
export type ZonaFiltro = string;
export const OPCIONES_ZONA: Array<{ id: string; label: string }> = [
  { id: 'todas', label: 'Toda entrega' },
  { id: 'retiro', label: 'Retiro en la barraca' },
  ...ZONAS_DESPACHO.map((z) => ({ id: z.id, label: `Despacho ${z.nombre}` })),
  { id: 'otra', label: 'Despacho a otra comuna' },
];

export interface Filtros {
  estado: GrupoEstado;
  medio: Medio;
  zona: ZonaFiltro;
  q: string;
}

export function leerFiltros(sp: { get(k: string): string | null }): Filtros {
  const estado = sp.get('estado');
  const medio = sp.get('medio');
  const zona = sp.get('zona');
  return {
    estado: GRUPOS_ESTADO.some((g) => g.id === estado) ? (estado as GrupoEstado) : 'todos',
    medio: medio === 'webpay' || medio === 'transferencia' ? medio : 'todos',
    zona: OPCIONES_ZONA.some((z) => z.id === zona) ? (zona as string) : 'todas',
    q: (sp.get('q') ?? '').trim().slice(0, 80),
  };
}

/** Lo mínimo de un pedido que usan la lista, los totales y el Excel. */
export interface PedidoVenta {
  numero: string;
  estado: EstadoPedido;
  metodo_pago: 'webpay' | 'mercadopago' | 'transferencia';
  entrega: 'retiro' | 'despacho';
  comuna: string | null;
  direccion?: string | null;
  nombre: string;
  rut: string | null;
  telefono: string;
  email: string;
  subtotal: number;
  descuento_transferencia?: number;
  costo_despacho: number | null;
  total: number;
  cancelacion_motivo?: MotivoCancelacion | null;
  rechazo_motivo?: MotivoRechazo | null;
  reembolso?: { estado: string; medio: string } | null;
  created_at: string;
  pagado_at: string | null;
  documento_solicitado?: 'boleta' | 'factura' | null;
  factura_razon_social?: string | null;
  factura_rut?: string | null;
  factura_giro?: string | null;
  factura_direccion?: string | null;
  documento_path?: string | null;
  documento_tipo?: 'boleta' | 'factura' | null;
  documento_enviado_at?: string | null;
}

const soloDigitos = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '');
const rutLimpio = (s: string | null | undefined) => String(s ?? '').replace(/[^0-9kK]/g, '').toUpperCase();
const normal = (s: string | null | undefined) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const nombresZona = new Map(ZONAS_DESPACHO.map((z) => [z.id, normal(z.nombre)]));
const todasLasZonas = new Set(ZONAS_DESPACHO.map((z) => normal(z.nombre)));

export function calzaMedio(p: PedidoVenta, medio: Medio): boolean {
  if (medio === 'todos') return true;
  if (medio === 'transferencia') return p.metodo_pago === 'transferencia';
  return p.metodo_pago !== 'transferencia'; // Webpay (y los pocos de Mercado Pago antiguos)
}

export function calzaZona(p: PedidoVenta, zona: ZonaFiltro): boolean {
  if (zona === 'todas') return true;
  if (zona === 'retiro') return p.entrega === 'retiro';
  if (p.entrega !== 'despacho') return false;
  const c = normal(p.comuna);
  if (zona === 'otra') return !todasLasZonas.has(c);
  return nombresZona.get(zona) === c;
}

export function calzaBusqueda(p: PedidoVenta, q: string): boolean {
  const t = normal(q.trim());
  if (!t) return true;
  if (normal(p.numero).includes(t)) return true;
  if (normal(p.nombre).includes(t) || normal(p.email).includes(t) || normal(p.factura_razon_social).includes(t)) return true;
  const dig = soloDigitos(t);
  if (dig.length >= 4 && soloDigitos(p.telefono).includes(dig)) return true;
  const r = rutLimpio(t);
  if (r.length >= 4 && (rutLimpio(p.rut).includes(r) || rutLimpio(p.factura_rut).includes(r))) return true;
  return false;
}

export function calzaEstado(p: PedidoVenta, grupo: GrupoEstado): boolean {
  const estados = GRUPOS_ESTADO.find((g) => g.id === grupo)?.estados;
  return !estados || estados.includes(p.estado);
}

// ---------------------------------------------------------------------------
// Orden: lo que espera algo arriba
// ---------------------------------------------------------------------------

/** Menor = más arriba. null = no espera nada (va por fecha). */
const PRIORIDAD: Partial<Record<EstadoPedido, number>> = {
  transferencia_informada: 0,
  pago_discrepancia: 1,
  pagado: 2,
  en_preparacion: 3,
  pendiente_pago: 4,
  pago_rechazado: 5,
};

export function esPendiente(estado: EstadoPedido): boolean {
  return PRIORIDAD[estado] != null;
}

export function ordenarVentas<T extends PedidoVenta>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const pa = PRIORIDAD[a.estado] ?? 99;
    const pb = PRIORIDAD[b.estado] ?? 99;
    if (pa !== pb) return pa - pb;
    return b.created_at.localeCompare(a.created_at);
  });
}

// ---------------------------------------------------------------------------
// Totales
// ---------------------------------------------------------------------------

export interface Totales {
  vendido: number;
  pedidos: number;
  ticket: number;
  despachos: number;
}

export function calcularTotales(lista: PedidoVenta[]): Totales {
  let vendido = 0;
  let pedidos = 0;
  let despachos = 0;
  for (const p of lista) {
    if (!ESTADOS_VENTA.includes(p.estado)) continue;
    const total = Number.isFinite(p.total) ? p.total : 0;
    vendido += total;
    pedidos++;
    if (p.entrega === 'despacho' && Number.isFinite(p.costo_despacho)) despachos += p.costo_despacho ?? 0;
  }
  return { vendido, pedidos, ticket: pedidos ? Math.round(vendido / pedidos) : 0, despachos };
}

export interface ConteoAtender {
  informada: number;
  porPagar: number;
  porPreparar: number;
  revisar: number;
}

export function contarAtender(lista: Array<{ estado: EstadoPedido }>): ConteoAtender {
  const c: ConteoAtender = { informada: 0, porPagar: 0, porPreparar: 0, revisar: 0 };
  for (const p of lista) {
    if (p.estado === 'transferencia_informada') c.informada++;
    else if (p.estado === 'pago_discrepancia') c.revisar++;
    else if (p.estado === 'pendiente_pago' || p.estado === 'pago_rechazado') c.porPagar++;
    else if (p.estado === 'pagado' || p.estado === 'en_preparacion') c.porPreparar++;
  }
  return c;
}

// ---------------------------------------------------------------------------
// Textos compartidos
// ---------------------------------------------------------------------------

export function medioPago(m: PedidoVenta['metodo_pago']): string {
  return m === 'transferencia' ? 'Transferencia' : m === 'webpay' ? 'Webpay' : 'Mercado Pago';
}

export function textoEntrega(p: Pick<PedidoVenta, 'entrega' | 'comuna'>): string {
  return p.entrega === 'retiro' ? 'Retiro' : `Despacho ${p.comuna ?? ''}`.trim();
}

export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  pendiente_pago: 'Por pagar',
  transferencia_informada: 'Transferencia informada',
  pagado: 'Pagado · por preparar',
  pago_rechazado: 'Pago rechazado',
  pago_discrepancia: 'Pago por revisar',
  en_preparacion: 'En preparación',
  listo_retiro: 'Listo para retiro',
  despachado: 'Despachado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  rechazado: 'No aprobado',
};

/** Tono del estado en el panel: qué tan urgente es para la barraca. */
export type Tono = 'urgente' | 'atencion' | 'trabajo' | 'camino' | 'listo' | 'cerrado';
export const TONO_ESTADO: Record<EstadoPedido, Tono> = {
  transferencia_informada: 'urgente',
  pago_discrepancia: 'urgente',
  pendiente_pago: 'atencion',
  pago_rechazado: 'atencion',
  pagado: 'trabajo',
  en_preparacion: 'trabajo',
  listo_retiro: 'camino',
  despachado: 'camino',
  entregado: 'listo',
  cancelado: 'cerrado',
  rechazado: 'cerrado',
};

/** Fila liviana para la lista del panel (lo que viaja al navegador). */
export interface FilaLista {
  numero: string;
  estado: EstadoPedido;
  metodo_pago: PedidoVenta['metodo_pago'];
  entrega: PedidoVenta['entrega'];
  comuna: string | null;
  nombre: string;
  rut: string | null;
  telefono: string;
  total: number;
  created_at: string;
  factura: boolean;
  razonSocial: string | null;
  documentoSubido: boolean;
  articulos: number;
  /** Por qué se cerró (cancelado / no aprobado), o null. */
  cierre: string | null;
  devolucionPendiente: boolean;
}

/** "Transferencia no recibida", "Cancelado con pago (devolución)", motivo de no aprobación… */
export function motivoCierre(p: Pick<PedidoVenta, 'estado' | 'cancelacion_motivo' | 'rechazo_motivo' | 'pagado_at'>): string | null {
  if (p.estado === 'cancelado') {
    const m = p.cancelacion_motivo ? MOTIVOS_CANCELACION[p.cancelacion_motivo] : 'Sin motivo';
    return p.pagado_at ? `${m} · con pago (devolución)` : m;
  }
  if (p.estado === 'rechazado') return p.rechazo_motivo ? MOTIVOS_RECHAZO[p.rechazo_motivo] : 'No aprobado';
  return null;
}

export function textoDevolucion(r: PedidoVenta['reembolso']): string {
  if (!r) return '';
  const medio = r.medio === 'webpay' ? 'Webpay' : 'Transferencia';
  const estado = r.estado === 'hecho' ? 'hecha' : r.estado === 'pendiente' ? 'pendiente' : r.estado === 'en_curso' ? 'en curso' : 'falló';
  return `${medio}: ${estado}`;
}

export function aFilaLista(p: PedidoVenta & { items?: Array<{ cantidad: number }> }): FilaLista {
  return {
    numero: p.numero,
    estado: p.estado,
    metodo_pago: p.metodo_pago,
    entrega: p.entrega,
    comuna: p.comuna,
    nombre: p.nombre,
    rut: p.rut,
    telefono: p.telefono,
    total: p.total,
    created_at: p.created_at,
    factura: p.documento_solicitado === 'factura',
    razonSocial: p.documento_solicitado === 'factura' ? p.factura_razon_social ?? null : null,
    documentoSubido: !!p.documento_path,
    articulos: (p.items ?? []).reduce((s, i) => s + (Number.isFinite(i.cantidad) ? i.cantidad : 0), 0),
    cierre: motivoCierre(p),
    devolucionPendiente: p.reembolso?.estado === 'pendiente' || p.reembolso?.estado === 'error',
  };
}

const fmtFechaCorta = new Intl.DateTimeFormat('es-CL', { timeZone: TZ, day: 'numeric', month: 'short' });
const fmtHora = new Intl.DateTimeFormat('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

/** "30 oct · 14:05" en hora de Chile. */
export function fechaCorta(iso: string): string {
  const d = new Date(iso);
  return `${fmtFechaCorta.format(d).replace('.', '')} · ${fmtHora.format(d)}`;
}

/** "1 al 31 de octubre", "30 de octubre", "28 sept. al 2 oct.". */
export function textoPeriodo(p: Periodo): string {
  const f = (dia: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('es-CL', { timeZone: 'UTC', ...opts }).format(new Date(`${dia}T12:00:00Z`));
  if (p.desde === p.hasta) return f(p.desde, { day: 'numeric', month: 'long', year: 'numeric' });
  if (p.desde.slice(0, 7) === p.hasta.slice(0, 7)) {
    return `${Number(p.desde.slice(8))} al ${f(p.hasta, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  return `${f(p.desde, { day: 'numeric', month: 'short', year: 'numeric' })} al ${f(p.hasta, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
