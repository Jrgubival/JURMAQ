import 'server-only';
import { env } from '@jurmaq/shared/env';
import type { Courier } from './tipos';

/**
 * Envíame (COURIER=enviame), agregador de couriers: cotiza con todos los
 * transportistas activos de la cuenta y se elige el más barato.
 *
 * Según la documentación oficial (docs.enviame.io, API v2):
 * - Cotizar: GET {base}/v1/prices con header x-api-key. Comunas por código
 *   CUT (from_place_code / to_place_code), peso en kg y medidas en cm.
 *   Responde { data: [{ carrier, name, services: [{ name, code, price, transit_days }] }] }.
 * - Crear envío: POST {base}/s2/v2/companies/{seller}/deliveries con header
 *   api-key. Responde { data: { identifier, tracking_number, label: { PDF } } }.
 * - Seguimiento: GET {base}/s2/v2/deliveries/{id}/tracking.
 *
 * La API key y el id de empresa salen del panel de Envíame ("Mi empresa").
 * La bodega de origen (warehouse_code) se crea una vez en ese panel.
 */

const BASE = () => (env.ENVIAME_BASE_URL || 'https://api.enviame.io/api').replace(/\/$/, '');
const TIMEOUT_MS = 10_000;

function llave(): string {
  const k = env.ENVIAME_API_KEY?.trim();
  if (!k) throw new Error('Falta ENVIAME_API_KEY');
  return k;
}

async function llamar(ruta: string, init: { method: 'GET' | 'POST'; headerLlave: 'x-api-key' | 'api-key'; body?: unknown }) {
  const res = await fetch(`${BASE()}${ruta}`, {
    method: init.method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      [init.headerLlave]: llave(),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Envíame respondió ${res.status} en ${ruta.split('?')[0]}`);
  return (await res.json()) as Record<string, unknown>;
}

interface Servicio {
  name?: unknown;
  code?: unknown;
  price?: unknown;
  transit_days?: unknown;
}
interface Transportista {
  carrier?: unknown;
  name?: unknown;
  services?: Servicio[];
}

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export const courierEnviame: Courier = {
  id: 'enviame',
  nombre: 'Envíame',
  simulado: false,

  async cotizar({ origen, destino, paquete }) {
    const q = new URLSearchParams({
      from_place_code: origen.cut,
      to_place_code: destino.cut,
      from_place: origen.nombre,
      to_place: destino.nombre,
      weight: String(paquete.pesoKg),
      length: String(paquete.largoCm),
      width: String(paquete.anchoCm),
      height: String(paquete.altoCm),
      volume: String(paquete.volumenM3),
    });
    const r = await llamar(`/v1/prices?${q}`, { method: 'GET', headerLlave: 'x-api-key' });
    const opciones = (Array.isArray(r.data) ? (r.data as Transportista[]) : []).flatMap((t) =>
      (Array.isArray(t.services) ? t.services : []).map((s) => ({
        precio: Number(s.price),
        dias: Number(s.transit_days),
        carrier: texto(t.carrier),
        servicio: texto(s.code),
        nombre: [texto(t.name), texto(s.name)].filter(Boolean).join(' · '),
      })),
    );
    const validas = opciones.filter((o) => Number.isFinite(o.precio) && o.precio > 0 && o.carrier);
    if (validas.length === 0) throw new Error(`Envíame no cotizó (status ${String(r.status)})`);
    const mejor = validas.reduce((a, b) => (b.precio < a.precio ? b : a));
    return {
      costo: Math.round(mejor.precio),
      dias: Number.isFinite(mejor.dias) && mejor.dias > 0 ? mejor.dias : null,
      servicio: mejor.nombre || 'Envíame',
      servicioCodigo: `${mejor.carrier}:${mejor.servicio}`,
    };
  },

  async emitir(pedido, { destino, paquete, servicioCodigo }) {
    const seller = env.ENVIAME_SELLER_ID?.trim();
    const bodega = env.ENVIAME_BODEGA?.trim();
    if (!seller || !bodega) throw new Error('Faltan ENVIAME_SELLER_ID o ENVIAME_BODEGA');
    const [carrier = '', servicio = ''] = (servicioCodigo ?? '').split(':');
    const telefono = Number(pedido.telefono.replace(/\D/g, '').slice(-9));
    const r = await llamar(`/s2/v2/companies/${encodeURIComponent(seller)}/deliveries`, {
      method: 'POST',
      headerLlave: 'api-key',
      body: {
        shipping_order: {
          n_packages: 1,
          content_description: `Pedido ${pedido.numero} Barraca JURMAQ`,
          imported_id: pedido.numero,
          order_price: pedido.subtotal,
          weight: paquete.pesoKg,
          volume: paquete.volumenM3,
          type: 'delivery',
        },
        shipping_origin: { warehouse_code: bodega },
        shipping_destination: {
          customer: {
            name: pedido.nombre,
            email: pedido.email,
            ...(Number.isFinite(telefono) && telefono > 0 ? { phone: telefono } : {}),
          },
          delivery_address: {
            place: destino.nombre,
            full_address: pedido.direccion ?? '',
            information: pedido.notas ?? '',
          },
        },
        dimensions: { length: paquete.largoCm, width: paquete.anchoCm, height: paquete.altoCm },
        carrier: { carrier_code: carrier, carrier_service: servicio, tracking_number: '' },
      },
    });
    const data = (r.data ?? null) as { identifier?: unknown; tracking_number?: unknown; label?: { PDF?: unknown } } | null;
    const seguimiento = texto(data?.tracking_number);
    if (!seguimiento) throw new Error('Envíame no devolvió número de seguimiento');
    const etiqueta = texto(data?.label?.PDF);
    return {
      seguimiento,
      etiquetaUrl: etiqueta.startsWith('https://') ? etiqueta : null,
      envioId: data?.identifier != null ? String(data.identifier) : null,
    };
  },

  async seguimiento(envioId) {
    const r = await llamar(`/s2/v2/deliveries/${encodeURIComponent(envioId)}/tracking`, { method: 'GET', headerLlave: 'api-key' });
    const data = (r.data ?? {}) as { status?: { name?: unknown }; statuses?: Array<{ name?: unknown; created_at?: unknown }> };
    return {
      estado: texto(data.status?.name) || 'Sin información',
      eventos: (Array.isArray(data.statuses) ? data.statuses : []).map((e) => ({
        fecha: texto(e.created_at),
        descripcion: texto(e.name),
      })),
    };
  },
};
