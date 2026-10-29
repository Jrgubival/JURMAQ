import 'server-only';
import { logSafeError } from '@jurmaq/shared/logging';
import type { LineaRevisada } from '@/lib/tienda';
import { COMUNAS, type Comuna } from './comunas';
import { BULTO_POR_DEFECTO, CATEGORIAS_CAMION, COMUNA_ORIGEN, TARIFAS_PROPIO } from './tarifas';
import { courierActivo, type Bulto } from './courier';

/**
 * Costo del despacho de un carrito a una comuna. Siempre se calcula acá, con
 * las líneas ya revisadas contra la base: del cliente sólo llega la comuna.
 *
 * - Comuna del camión propio (Molina, Curicó): va en camión, con la tarifa de
 *   tarifas.ts (o "a coordinar" si no tiene monto).
 * - Otra comuna: sólo si nada del carrito es de una categoría de camión; se
 *   cotiza con el courier activo.
 */

export type CotizacionDespacho =
  | { estado: 'ok'; tipo: 'propio'; comuna: Comuna; costo: number | null; detalle: string }
  | { estado: 'ok'; tipo: 'courier'; comuna: Comuna; courier: string; costo: number; dias: number | null; detalle: string }
  | { estado: 'bloqueado'; comuna: Comuna; motivo: string; productos: string[] }
  | { estado: 'sin_servicio'; comuna: Comuna; motivo: string };

const porCodigo = new Map(COMUNAS.map((c) => [c.codigo, c]));

export function comunaPorCodigo(codigo: string): Comuna | null {
  return porCodigo.get(codigo) ?? null;
}

export const comunasCamion = (): Comuna[] =>
  Object.keys(TARIFAS_PROPIO).map((c) => porCodigo.get(c)).filter((c): c is Comuna => !!c);

const listaCamion = () => comunasCamion().map((c) => c.nombre).join(' y ');

export function vaEnCamion(l: Pick<LineaRevisada, 'categoriaId'>): boolean {
  return l.categoriaId != null && l.categoriaId in CATEGORIAS_CAMION;
}

export function bultosDe(lineas: LineaRevisada[]): Bulto[] {
  return lineas.map((l) => ({ ...BULTO_POR_DEFECTO, pesoKg: l.peso ?? BULTO_POR_DEFECTO.pesoKg, cantidad: l.cantidad }));
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

  const camion = lineas.filter(vaEnCamion);
  if (camion.length > 0) {
    return {
      estado: 'bloqueado',
      comuna,
      motivo: `Fierros, perfiles, planchas y materiales pesados sólo los despachamos a ${listaCamion()}. Puedes retirarlos en la barraca o quitarlos del carrito.`,
      productos: camion.map((l) => l.nombre),
    };
  }

  const courier = courierActivo();
  if (!courier) {
    return { estado: 'sin_servicio', comuna, motivo: `Por ahora despachamos sólo a ${listaCamion()}. Puedes retirar en la barraca.` };
  }
  const origen = comunaPorCodigo(COMUNA_ORIGEN)!;
  try {
    const c = await courier.cotizar({ origen, destino: comuna, bultos: bultosDe(lineas), valorDeclarado: subtotal });
    const plazo = c.dias ? ` Llega en unos ${c.dias} días hábiles.` : '';
    return { estado: 'ok', tipo: 'courier', comuna, courier: courier.id, costo: c.costo, dias: c.dias, detalle: `Por ${courier.nombre}.${plazo}` };
  } catch (error) {
    logSafeError('despacho-cotizar-error', { courier: courier.id, comuna: comuna.codigo, error: String(error) });
    return { estado: 'sin_servicio', comuna, motivo: 'No pudimos cotizar el envío en este momento. Intenta de nuevo en unos minutos o elige retiro.' };
  }
}
