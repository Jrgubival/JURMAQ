import 'server-only';
import { logSafeError } from '@jurmaq/shared/logging';
import { buildWhatsappUrl, SALUDO_WEB_BARRACA } from '@jurmaq/shared/whatsapp';
import type { LineaRevisada } from '@/lib/tienda';
import { COMUNAS, type Comuna } from './comunas';
import { CATEGORIAS_CAMION, COMUNA_ORIGEN, LIMITE_COURIER, TAMANOS_ENVIO } from './tarifas';
import { costoZona, type ZonaDespacho } from './zonas';
import { zonasDespachoVigentes } from './tarifas-db';
import { courierActivo, type Bulto, type Paquete } from './courier';

/**
 * Costo del despacho de un carrito a una comuna. Siempre se calcula acá, con
 * las líneas ya revisadas contra la base: del cliente sólo llega la comuna.
 *
 * Regla: un pedido viaja entero de una sola forma.
 * - Zona del camión propio (zonas.ts: Molina, Lontué, Curicó…): todo va en el
 *   camión, con la tarifa de esa zona.
 * - Otra comuna, con el courier apagado (hoy): retiro o cotizar por WhatsApp.
 * - Otra comuna, con courier: va por courier sólo si TODO el carrito puede.
 *   Si hay fierro o carga pesada, o productos sin tamaño de envío, se bloquea
 *   y se ofrece retirar en la barraca, quitar esos productos (y mandar el
 *   resto por courier) o cotizar el despacho por WhatsApp. No se parte un
 *   pedido en dos envíos: sería cobrar dos despachos y coordinar dos entregas.
 */

export type CotizacionDespacho =
  | { estado: 'ok'; tipo: 'propio'; comuna: Comuna; lugar: string; costo: number | null; detalle: string }
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

const listaCamion = (zonas: ZonaDespacho[]) => {
  const n = zonas.map((z) => z.nombre);
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

/**
 * `destino` es el id de una zona del camión (zonas.ts) o, para el resto del
 * país, un código de comuna (comunas.ts).
 */
export async function cotizarDespacho(lineas: LineaRevisada[], destino: string): Promise<CotizacionDespacho | null> {
  const subtotal = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);

  // Tarifas del camión: tabla barraca_zonas_despacho (editable en /admin/despacho),
  // con respaldo en las constantes de zonas.ts si la tabla falla (tarifas-db.ts).
  const { zonas } = await zonasDespachoVigentes();
  const zona = zonas.find((z) => z.id === destino) ?? null;
  if (zona) {
    const comunaZona = comunaPorCodigo(zona.comuna);
    if (!comunaZona) return null;
    return { estado: 'ok', tipo: 'propio', comuna: comunaZona, lugar: zona.nombre, costo: costoZona(zona, subtotal), detalle: 'Lo preparamos en 1 a 5 días hábiles y te contactamos para coordinar el día de entrega.' };
  }

  // Una comuna que tiene zonas se elige por zona, no por código.
  if (zonas.some((z) => z.comuna === destino)) return null;
  const comuna = comunaPorCodigo(destino);
  if (!comuna) return null;

  const whatsapp = whatsappDespacho(comuna, lineas);
  const courier = courierActivo();
  if (!courier) {
    return {
      estado: 'sin_servicio',
      comuna,
      motivo: `Por ahora despachamos sólo en nuestro camión a ${listaCamion(zonas)}. Puedes retirar en la barraca o cotizar el despacho a ${comuna.nombre} por WhatsApp.`,
      whatsapp,
    };
  }

  const camion = lineas.filter(vaEnCamion);
  if (camion.length > 0) {
    return {
      estado: 'bloqueado',
      comuna,
      motivo: `Fierros, perfiles, planchas y materiales pesados sólo los despachamos en nuestro camión a ${listaCamion(zonas)}. Puedes retirarlos en la barraca, quitarlos del carrito o cotizar el despacho por WhatsApp.`,
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
