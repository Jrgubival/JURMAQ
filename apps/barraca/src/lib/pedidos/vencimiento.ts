import 'server-only';
import { logSafeError } from '@jurmaq/shared/logging';
import { pedidos } from '@/lib/pedidos';
import { correoCancelacionComprador } from '@/lib/pedidos/correos';

/**
 * Términos 8.3: el pedido por transferencia se paga dentro de 48 horas; si no,
 * se anula sin costo, el stock reservado vuelve a la venta y se avisa al
 * cliente. Los que avisaron "Ya transferí" no se tocan (los revisa la barraca).
 * Lo corren el cron diario y la carga del panel de Ventas. La condición se
 * vuelve a revisar dentro de la base (barraca_pedido_vencer), así que dos
 * corridas a la vez no anulan dos veces.
 */
export const PLAZO_TRANSFERENCIA_HORAS = 48;

export async function vencerTransferencias(): Promise<{ vencidos: number; errores: number }> {
  const store = pedidos();
  const corte = Date.now() - PLAZO_TRANSFERENCIA_HORAS * 3600_000;
  const pendientes = await store.listar({ estado: 'pendiente_pago', limite: 500 });
  const r = { vencidos: 0, errores: 0 };
  for (const p of pendientes) {
    if (p.metodo_pago !== 'transferencia' || Date.parse(p.created_at) > corte) continue;
    try {
      if ((await store.vencer(p.numero, PLAZO_TRANSFERENCIA_HORAS)) !== 'vencido') continue;
      r.vencidos++;
      await correoCancelacionComprador({ ...p, estado: 'cancelado', cancelacion_motivo: 'vencido' });
    } catch (error) {
      r.errores++;
      logSafeError('pedido-vencer-transferencia', { numero: p.numero, error: String(error) });
    }
  }
  return r;
}
