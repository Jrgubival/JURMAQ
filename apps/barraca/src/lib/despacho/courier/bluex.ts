import 'server-only';
import { env } from '@jurmaq/shared/env';
import type { Courier } from './tipos';

/**
 * Blue Express (COURIER=bluex).
 *
 * La cotización sigue lo que hace el plugin oficial "BlueX for WooCommerce"
 * (includes/class-bluex-api-client.php): POST {base}/eplin/pricing/v1 con
 * header x-api-key y el valor declarado en el header "price". Responde
 * { code: "00" | "01", data: { total, promiseDay, nameService } }.
 *
 * Blue Express no publica documentación para tiendas propias: la llave, el
 * nombre de cuenta y la API de emisión y seguimiento los entrega su ejecutivo
 * (ecommerce.blueexpress@blue.cl). Hasta tenerlos, emitir y seguimiento
 * fallan con un mensaje claro y el envío se genera a mano en su portal.
 */

const BASE = () => (env.BLUEX_BASE_URL || 'https://eplin.api.blue.cl').replace(/\/$/, '');
const TIMEOUT_MS = 8000;

/** Servicio Express a domicilio (código 'EX' en el plugin; 'PY' Priority, 'MD' Sameday). */
const SERVICIO = 'EX';

function llave(): string {
  const k = env.BLUEX_API_KEY?.trim();
  if (!k) throw new Error('Falta BLUEX_API_KEY');
  return k;
}

async function post(ruta: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE()}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': llave(), ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Blue Express respondió ${res.status} en ${ruta}`);
  return (await res.json()) as Record<string, unknown>;
}

export const courierBluex: Courier = {
  id: 'bluex',
  nombre: 'Blue Express',

  async cotizar({ origen, destino, bultos, valorDeclarado }) {
    const r = await post(
      '/eplin/pricing/v1',
      {
        from: { country: 'CL', district: origen.codigo },
        to: { country: 'CL', state: destino.region, district: destino.codigo },
        serviceType: SERVICIO,
        domain: env.BLUEX_CUENTA?.trim() || '',
        datosProducto: {
          producto: 'P',
          familiaProducto: 'PAQU',
          bultos: bultos.map((b) => ({
            largo: b.largoCm,
            ancho: b.anchoCm,
            alto: b.altoCm,
            pesoFisico: b.pesoKg,
            cantidad: b.cantidad,
          })),
        },
      },
      { price: String(Math.round(valorDeclarado)) },
    );
    const data = (r.data ?? null) as { total?: unknown; promiseDay?: unknown; nameService?: unknown } | null;
    const costo = Number(data?.total);
    if ((r.code !== '00' && r.code !== '01') || !Number.isFinite(costo) || costo <= 0) {
      throw new Error(`Blue Express no cotizó (código ${String(r.code)})`);
    }
    const dias = Number(data?.promiseDay);
    return {
      costo: Math.round(costo),
      dias: Number.isFinite(dias) && dias > 0 ? dias : null,
      servicio: typeof data?.nameService === 'string' && data.nameService ? data.nameService : 'Blue Express',
    };
  },

  async emitir() {
    throw new Error('La emisión automática con Blue Express aún no está habilitada: generar el envío en el portal de Blue Express');
  },

  async seguimiento() {
    throw new Error('El seguimiento con Blue Express aún no está habilitado');
  },
};
