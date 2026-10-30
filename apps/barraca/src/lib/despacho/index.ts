import 'server-only';
import { logSafeError } from '@jurmaq/shared/logging';
import { buildWhatsappUrl, SALUDO_WEB_BARRACA } from '@jurmaq/shared/whatsapp';
import type { LineaRevisada } from '@/lib/tienda';
import { COMUNAS, type Comuna } from './comunas';
import { CATEGORIAS_CAMION, COMUNA_ORIGEN, LIMITE_COURIER, TAMANOS_ENVIO, TARIFAS_PROPIO } from './tarifas';
import { courierActivo, type Bulto, type Paquete } from './courier';

/**
 * Costo del despacho de un carrito a una comuna. Siempre se calcula acá, con
 * las líneas ya revisadas contra la base: del cliente sólo llega la comuna.
 *
 * Regla: un pedido viaja entero de una sola forma.
 * - Comuna del camión propio (Molina, Curicó, Sagrada Familia): todo va en el
 *   camión, con la tarifa de tarifas.ts (o "a coordinar" si no tiene monto).
 * - Otra comuna, con el courier apagado (hoy): retiro o cotizar por WhatsApp.
 * - Otra comuna, con courier: va por courier sólo si TODO el carrito puede.
 *   Si hay fierro o carga pesada, o productos sin tamaño de envío, se bloquea
 *   y se ofrece retirar en la barraca, quitar esos productos (y mandar el
 *   resto por courier) o cotizar el despacho por WhatsApp. No se parte un
 *   pedido en dos envíos: sería cobrar dos despachos y coordinar dos entregas.
 */

export type CotizacionDespacho =
  | { estado: 'ok'; tipo: 'propio'; comuna: Comuna; costo: number | null; detalle: string }
  | {
      estado: 'ok';
      tipo: 'courier';
      comuna: Comuna;
      courier: string;
      costo: number;
      dias: number | null;
      detalle: string;
      servicioCodigo: string;
      paquete: Paquete;
      simulado: boolean;
    }
  | { estado: 'bloqueado'; comuna: Comuna; motivo: string; productos: string[]; whatsapp: string }
  | { estado: 'sin_servicio'; comuna: Comuna; motivo: string; whatsapp: string };

const porCodigo = new Map(COMUNAS.map((c) => [c.codigo, c]));

export function comunaPorCodigo(codigo: string): Comuna | null {
  return porCodigo.get(codigo) ?? null;
}

export const comunasCamion = (): Comuna[] =>
  Object.keys(TARIFAS_PROPIO).map((c) => porCodigo.get(c)).filter((c): c is Comuna => !!c);

const listaCamion = () => {
  const n = comunasCamion().map((c) => c.nombre);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n.join('');
};

export function vaEnCamion(l: Pick<LineaRevisada, 'categoriaId'>): boolean {
  return l.categoriaId != null && l.categoriaId in CATEGORIAS_CAMION;
}

/**
 * Bulto de una línea para el courier: medidas reales si están las tres, si no
 * las del tamaño de envío; peso real si está, si no el del tamaño. Sin tamaño
 * ni medidas completas con peso, el producto no sale por courier (null).
 */
export function bultoDe(l: Pick<LineaRevisada, 'peso' | 'envio' | 'cantidad'>): Bulto | null {
  const e = l.envio;
  const ref = e?.tamano ? TAMANOS_ENVIO[e.tamano] : null;
  const medidas = e?.largoCm && e.anchoCm && e.altoCm ? { largoCm: e.largoCm, anchoCm: e.anchoCm, altoCm: e.altoCm } : ref;
  const pesoKg = l.peso ?? ref?.pesoKg ?? null;
  if (!medidas || pesoKg == null) return null;
  return { ...medidas, pesoKg, cantidad: l.cantidad };
}

/**
 * Todo el pedido como una caja: suma pesos y volumen, y arma una caja lo más
 * cúbica posible que no sea más chica que el bulto más grande por ningún lado.
 */
export function consolidar(bultos: Bulto[]): Paquete {
  const pesoKg = bultos.reduce((s, b) => s + b.pesoKg * b.cantidad, 0);
  const cm3 = bultos.reduce((s, b) => s + b.largoCm * b.anchoCm * b.altoCm * b.cantidad, 0);
  const largoCm = Math.max(Math.ceil(Math.cbrt(cm3)), ...bultos.map((b) => b.largoCm));
  const anchoCm = Math.max(Math.ceil(Math.sqrt(cm3 / largoCm)), ...bultos.map((b) => b.anchoCm));
  const altoCm = Math.max(Math.ceil(cm3 / (largoCm * anchoCm)), ...bultos.map((b) => b.altoCm));
  return {
    pesoKg: Math.round(pesoKg * 10) / 10,
    largoCm,
    anchoCm,
    altoCm,
    volumenM3: Math.round((cm3 / 1_000_000) * 1000) / 1000,
    unidades: bultos.reduce((s, b) => s + b.cantidad, 0),
  };
}

function whatsappDespacho(comuna: Comuna, lineas: LineaRevisada[]): string {
  const detalle = lineas.slice(0, 10).map((l) => `${l.cantidad} x ${l.nombre}`).join(', ');
  return buildWhatsappUrl({
    text: `${SALUDO_WEB_BARRACA} y quiero cotizar el despacho a ${comuna.nombre} de: ${detalle}`,
    utm_content: 'barraca_checkout_despacho',
    utm_campaign: 'barraca_despacho',
  });
}

export async function cotizarDespacho(lineas: LineaRevisada[], codigoComuna: string): Promise<CotizacionDespacho | null> {
  const comuna = comunaPorCodigo(codigoComuna);
  if (!comuna) return null;
  const subtotal = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);

  if (codigoComuna in TARIFAS_PROPIO) {
    const t = TARIFAS_PROPIO[codigoComuna];
    if (!t) {
      return { estado: 'ok', tipo: 'propio', comuna, costo: null, detalle: 'Te llamamos para acordar el día y el costo.' };
    }
    const gratis = t.gratisDesde != null && subtotal >= t.gratisDesde;
    return { estado: 'ok', tipo: 'propio', comuna, costo: gratis ? 0 : t.costo, detalle: 'Te llamamos para acordar el día de entrega.' };
  }

  const whatsapp = whatsappDespacho(comuna, lineas);
  const courier = courierActivo();
  if (!courier) {
    return {
      estado: 'sin_servicio',
      comuna,
      motivo: `Por ahora despachamos sólo en nuestro camión a ${listaCamion()}. Puedes retirar en la barraca o cotizar el despacho a ${comuna.nombre} por WhatsApp.`,
      whatsapp,
    };
  }

  const camion = lineas.filter(vaEnCamion);
  if (camion.length > 0) {
    return {
      estado: 'bloqueado',
      comuna,
      motivo: `Fierros, perfiles, planchas y materiales pesados sólo los despachamos en nuestro camión a ${listaCamion()}. Puedes retirarlos en la barraca, quitarlos del carrito o cotizar el despacho por WhatsApp.`,
      productos: camion.map((l) => l.nombre),
      whatsapp,
    };
  }

  const bultos = lineas.map((l) => ({ l, b: bultoDe(l) }));
  const sinDatos = bultos.filter((x) => !x.b).map((x) => x.l.nombre);
  if (sinDatos.length > 0) {
    return {
      estado: 'bloqueado',
      comuna,
      motivo: `Estos productos todavía no tienen peso y medida para enviarlos por courier. Puedes retirarlos en la barraca, quitarlos del carrito o cotizar el despacho por WhatsApp.`,
      productos: sinDatos,
      whatsapp,
    };
  }
  const paquete = consolidar(bultos.map((x) => x.b!));
  if (paquete.pesoKg > LIMITE_COURIER.pesoKg || Math.max(paquete.largoCm, paquete.anchoCm, paquete.altoCm) > LIMITE_COURIER.ladoCm) {
    return {
      estado: 'sin_servicio',
      comuna,
      motivo: 'El pedido es muy grande para enviarlo por courier. Cotiza el despacho por WhatsApp o retíralo en la barraca.',
      whatsapp,
    };
  }

  const origen = comunaPorCodigo(COMUNA_ORIGEN)!;
  try {
    const c = await courier.cotizar({ origen, destino: comuna, paquete, valorDeclarado: subtotal });
    const plazo = c.dias ? ` Llega en unos ${c.dias} ${c.dias === 1 ? 'día hábil' : 'días hábiles'} desde que lo entregamos al courier.` : '';
    const prueba = courier.simulado ? ' Tarifa de ejemplo (modo prueba).' : '';
    return {
      estado: 'ok',
      tipo: 'courier',
      comuna,
      courier: courier.id,
      costo: c.costo,
      dias: c.dias,
      detalle: `Por ${c.servicio}.${plazo}${prueba}`,
      servicioCodigo: c.servicioCodigo,
      paquete,
      simulado: courier.simulado,
    };
  } catch (error) {
    logSafeError('despacho-cotizar-error', { courier: courier.id, comuna: comuna.codigo, error: String(error) });
    return { estado: 'sin_servicio', comuna, motivo: 'No pudimos cotizar el envío en este momento. Intenta de nuevo en unos minutos, elige retiro o cotiza por WhatsApp.', whatsapp };
  }
}
