import 'server-only';
import crypto from 'crypto';
import type { Courier } from './tipos';

/**
 * Courier simulado, SÓLO para desarrollo (COURIER=simulado). Cotiza con TARIFAS
 * DE EJEMPLO (una fórmula de prueba, no son precios de ningún courier) y emite
 * un número de seguimiento inventado, para recorrer el flujo completo sin
 * cuenta en Envíame. index.ts lo niega en producción y el checkout lo marca
 * como "tarifa de ejemplo".
 */
export const courierSimulado: Courier = {
  id: 'simulado',
  nombre: 'Courier de prueba',
  simulado: true,

  async cotizar({ origen, destino, paquete }) {
    const misma = origen.region === destino.region;
    const base = misma ? 3500 : 5500;
    const costo = Math.round((base + Math.ceil(paquete.pesoKg) * 400) / 10) * 10;
    return { costo, dias: misma ? 2 : 4, servicio: 'Courier de prueba', servicioCodigo: 'SIM:prueba' };
  },

  async emitir() {
    return { seguimiento: `SIM${crypto.randomInt(10_000_000, 99_999_999)}`, etiquetaUrl: null, envioId: null };
  },

  async seguimiento() {
    return { estado: 'En tránsito (prueba)', eventos: [{ fecha: new Date().toISOString(), descripcion: 'Envío simulado' }] };
  },
};
