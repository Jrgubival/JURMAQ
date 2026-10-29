import 'server-only';
import crypto from 'crypto';
import type { Courier } from './tipos';

/**
 * Courier simulado, SÓLO para desarrollo (COURIER=simulado). Cotiza con una
 * fórmula de prueba (no son precios reales de nadie) y emite un número de
 * seguimiento inventado, para recorrer el flujo completo sin cuenta en
 * Blue Express. index.ts lo niega en producción.
 */
export const courierSimulado: Courier = {
  id: 'simulado',
  nombre: 'Courier de prueba',

  async cotizar({ origen, destino, bultos }) {
    const kilos = bultos.reduce((s, b) => s + Math.max(b.pesoKg, (b.largoCm * b.anchoCm * b.altoCm) / 4000) * b.cantidad, 0);
    const misma = origen.region === destino.region;
    const base = misma ? 3000 : 5000;
    const costo = Math.round((base + Math.ceil(kilos) * 700) / 10) * 10;
    return { costo, dias: misma ? 2 : 4, servicio: 'Express (prueba)' };
  },

  async emitir() {
    return { seguimiento: `SIM${crypto.randomInt(10_000_000, 99_999_999)}`, etiquetaUrl: null };
  },

  async seguimiento() {
    return { estado: 'En tránsito (prueba)', eventos: [{ fecha: new Date().toISOString(), descripcion: 'Envío simulado' }] };
  },
};
