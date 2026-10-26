import 'server-only';
import type { PasarelaPago } from './tipos';

/**
 * Pasarela simulada, SÓLO para desarrollo (PAGO_PASARELA=simulado). Manda al
 * comprador a /pago/simulado, donde se elige aprobar o rechazar. Permite
 * recorrer el flujo completo sin cuenta de Mercado Pago. index.ts la niega en
 * producción.
 */
export const pagoSimulado: PasarelaPago = {
  id: 'simulado',
  async iniciar(pedido) {
    return {
      url: `/pago/simulado?pedido=${encodeURIComponent(pedido.numero)}`,
      referencia: `SIM-${pedido.numero}`,
    };
  },
  async consultarPago() {
    // La aprobación simulada la aplica directo /api/pagos/simulado.
    return null;
  },
};
