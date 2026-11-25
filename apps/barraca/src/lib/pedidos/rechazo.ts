import 'server-only';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { estadoTransaccionWebpay, reembolsarWebpay } from '@/lib/pagos/webpay';
import { pedidos, type MotivoRechazo, type Pedido } from './index';
import { correoRechazoComprador } from './correos';
import { ejecutarDevolucionWebpay, reembolsoEnCursoViejo, retomarDevolucionEnCurso, MINUTOS_EN_CURSO_VIEJO } from './devolucion-webpay';
import { sincronizarDevolucionPanel } from './devoluciones-d1';

/**
 * "No aprobar" un pedido (Términos 8.4) y devolver lo pagado. Lo usa el panel
 * (api/admin/pedidos/[numero]/rechazar), que ya validó permiso y datos.
 */

export const pagadoConWebpay = (p: Pedido) => p.pasarela === 'webpay' && !!p.pagado_at && !!p.pasarela_referencia;

/**
 * Anula el pago en Webpay una sola vez: toma el candado del reembolso antes
 * de llamar a Transbank, así dos clics (o un reintento) no reembolsan dos veces
 * ni pisan un "hecho". La lógica vive en `devolucion-webpay.ts` (la misma que usan
 * las herramientas MCP) y distingue "Transbank dijo que no" de "no sé si devolvió".
 */
export async function devolverWebpayDetallado(p: Pedido) {
  const store = pedidos();
  return ejecutarDevolucionWebpay(
    {
      tomarReembolso: (n, r) => store.tomarReembolso(n, r),
      guardarReembolso: (n, r) => store.guardarReembolso(n, r),
      reembolsar: reembolsarWebpay,
      log: (evento, datos) => (datos.error ? logSafeError(evento, datos) : logSafe(evento, datos)),
    },
    { numero: p.numero, total: p.total, pasarela_referencia: p.pasarela_referencia! },
  );
}

/** Devuelve null si otro proceso ya lo tomó, true si Webpay devolvió, false si falló (clara o incierta). */
export async function devolverWebpay(p: Pedido): Promise<boolean | null> {
  const r = await devolverWebpayDetallado(p);
  return r.resultado === 'ocupada' ? null : r.resultado === 'hecho';
}

export type ResultadoRechazo =
  | { ok: true; reembolso: 'hecho' | 'error' | 'incierto' | 'transferencia' | null }
  | { ok: false; status: number; error: string };

export async function rechazarPedido(numero: string, motivo: MotivoRechazo, nota: string | null): Promise<ResultadoRechazo> {
  const store = pedidos();
  const pedido = await store.porNumero(numero);
  if (!pedido) return { ok: false, status: 404, error: 'Pedido no encontrado' };
  const r = await store.cerrar(numero, 'rechazado', motivo, nota);
  if (r !== 'ok') return { ok: false, status: 409, error: 'Este pedido ya salió o está cerrado: no se puede rechazar' };
  // Se relee después de cerrar: el pago pudo confirmarse justo antes.
  const cerrado = (await store.porNumero(numero)) ?? pedido;
  let reembolso: 'hecho' | 'error' | 'incierto' | 'transferencia' | null = null;
  if (cerrado.pagado_at) {
    if (pagadoConWebpay(cerrado)) {
      const d = await devolverWebpayDetallado(cerrado);
      reembolso = d.resultado === 'hecho' ? 'hecho' : d.resultado === 'incierta' ? 'incierto' : 'error';
    } else {
      await store.guardarReembolso(numero, { estado: 'pendiente', medio: 'transferencia', monto: cerrado.total, fecha: new Date().toISOString() });
      reembolso = 'transferencia';
    }
  }
  const actualizado = await store.porNumero(numero);
  if (actualizado) await correoRechazoComprador(actualizado);
  return { ok: true, reembolso };
}

/**
 * Pone al día `devoluciones_mcp` (D1) cuando el panel cambia el resultado de una devolución. Mejor esfuerzo: si no hay D1 o
 * la tabla, no pasa nada (el panel manda; la fila solo guía al MCP). Nunca lanza.
 */
async function sincronizarConMcp(numero: string, hacia: 'devolucion_hecha' | 'devolucion_rechazada' | 'devolucion_incierta') {
  try {
    const { usarGestion } = await import('../gestion/d1');
    await usarGestion((db) => sincronizarDevolucionPanel(db, numero, hacia, Date.now()));
  } catch (e) {
    logSafeError('admin-devolucion-sync-mcp', { numero, error: String(e).slice(0, 200) });
  }
}

/**
 * Reintenta la devolución de Webpay desde el panel. Casos seguros:
 *  - sin devolución registrada (reembolso nulo) en un pedido cancelado o no aprobado que sigue cobrado: el proceso murió justo
 *    después de cancelar, antes de pedir la devolución (no hubo ningún intento con Transbank);
 *  - devolución en «error» (Transbank dijo que no);
 *  - devolución «en curso» de hace más de MINUTOS_EN_CURSO_VIEJO minutos (colgada): antes de pedir nada se consulta el estado
 *    real en Transbank (solo lectura) y no se devuelve dos veces. Va con el mismo candado atómico de siempre.
 * Una devolución «incierta» NO se reintenta: se resuelve a mano.
 */
export async function reintentarDevolucion(numero: string): Promise<{ ok: boolean | null; status: number; error?: string; reembolso?: 'hecho' | 'error' | 'incierto' }> {
  const store = pedidos();
  const pedido = await store.porNumero(numero);
  if (!pedido) return { ok: false, status: 404, error: 'Pedido no encontrado' };
  if (pedido.reembolso?.estado === 'incierto') {
    return { ok: false, status: 409, error: 'Webpay no confirmó si devolvió el dinero. No se reintenta sola: revisa el pago en el portal de Transbank y resuélvela con «Ya se devolvió» o «No se devolvió».' };
  }
  if (!['rechazado', 'cancelado'].includes(pedido.estado) || !pagadoConWebpay(pedido) || pedido.reembolso?.estado === 'hecho') {
    return { ok: false, status: 409, error: 'Este pedido no tiene un reembolso de Webpay pendiente' };
  }
  const log = (evento: string, datos: Record<string, unknown>) => (datos.error ? logSafeError(evento, datos) : logSafe(evento, datos));
  let d: Awaited<ReturnType<typeof ejecutarDevolucionWebpay>>;
  if (pedido.reembolso?.estado === 'en_curso') {
    if (!reembolsoEnCursoViejo(pedido.reembolso, Date.now())) {
      return { ok: null, status: 409, error: `La devolución está en curso desde hace menos de ${MINUTOS_EN_CURSO_VIEJO} minutos. Espera un poco y revisa de nuevo.` };
    }
    d = await retomarDevolucionEnCurso(
      {
        tomarReembolso: (n, r) => store.tomarReembolso(n, r),
        guardarReembolso: (n, r) => store.guardarReembolso(n, r),
        reembolsar: reembolsarWebpay,
        retomarReembolso: (n, f, r) => store.retomarReembolsoEnCurso(n, f, r),
        estadoTransaccion: estadoTransaccionWebpay,
        log,
      },
      { numero: pedido.numero, total: pedido.total, pasarela_referencia: pedido.pasarela_referencia!, fechaEnCurso: pedido.reembolso.fecha },
    );
  } else {
    d = await devolverWebpayDetallado(pedido);
  }
  if (d.resultado === 'ocupada') return { ok: null, status: 409, error: 'La devolución ya está en curso o hecha' };
  await sincronizarConMcp(numero, d.resultado === 'hecho' ? 'devolucion_hecha' : d.resultado === 'incierta' ? 'devolucion_incierta' : 'devolucion_rechazada');
  if (d.resultado === 'incierta') return { ok: false, status: 502, reembolso: 'incierto' };
  return { ok: d.resultado === 'hecho', status: d.resultado === 'hecho' ? 200 : 502, reembolso: d.resultado === 'hecho' ? 'hecho' : 'error' };
}

/**
 * Cierra a mano una devolución de Webpay 'incierta' después de revisar el pago en el portal de Transbank:
 * 'hecha' (Transbank sí devolvió: queda hecha) o 'no_hecha' (Transbank no devolvió: queda en error y se puede reintentar).
 * Solo si seguía 'incierta' (condicional). Sólo administrador (lo exige la ruta).
 */
export async function resolverDevolucionIncierta(numero: string, resultado: 'hecha' | 'no_hecha', actorEmail: string | null): Promise<{ ok: boolean; status: number; error?: string }> {
  const store = pedidos();
  const pedido = await store.porNumero(numero);
  if (!pedido) return { ok: false, status: 404, error: 'Pedido no encontrado' };
  const r = pedido.reembolso;
  if (!r || r.medio !== 'webpay' || r.estado !== 'incierto') return { ok: false, status: 409, error: 'Este pedido no tiene una devolución incierta' };
  const ahora = new Date().toISOString();
  const nuevo = resultado === 'hecha'
    ? { ...r, estado: 'hecho' as const, hecho_at: ahora, hecho_por: actorEmail }
    : { ...r, estado: 'error' as const, fecha: ahora };
  if (!(await store.resolverReembolsoIncierto(numero, nuevo))) return { ok: false, status: 409, error: 'La devolución ya estaba resuelta' };
  await sincronizarConMcp(numero, resultado === 'hecha' ? 'devolucion_hecha' : 'devolucion_rechazada');
  await store.registrarEvento(numero, pedido.estado, actorEmail, resultado === 'hecha' ? 'Devolución incierta resuelta: sí se devolvió (revisado en Transbank)' : 'Devolución incierta resuelta: no se devolvió (revisado en Transbank)').catch(() => undefined);
  return { ok: true, status: 200 };
}
