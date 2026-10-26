import 'server-only';
import fs from 'fs';
import path from 'path';
import type { Pedido, PedidosStore } from './index';

/**
 * Pedidos en un JSON local — SÓLO para probar la tienda en desarrollo sin
 * escribir en la base de producción (PEDIDOS_STORE=archivo). No descuenta
 * stock en Supabase: eso lo hace la función SQL en el store real.
 */
const ARCHIVO = path.join(process.cwd(), '.pedidos-dev.json');

function leer(): Pedido[] {
  try {
    return JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')) as Pedido[];
  } catch {
    return [];
  }
}

function escribir(lista: Pedido[]) {
  fs.writeFileSync(ARCHIVO, JSON.stringify(lista, null, 2));
}

function editar(numero: string, fn: (p: Pedido) => void) {
  const lista = leer();
  const p = lista.find((x) => x.numero === numero);
  if (!p) return;
  fn(p);
  p.updated_at = new Date().toISOString();
  escribir(lista);
}

export function crearStoreArchivo(): PedidosStore {
  return {
    async crear(nuevo) {
      const lista = leer();
      if (lista.some((x) => x.numero === nuevo.numero)) {
        throw Object.assign(new Error('duplicado'), { code: '23505' });
      }
      const ahora = new Date().toISOString();
      const p: Pedido = {
        ...nuevo,
        id: lista.length + 1,
        estado: 'pendiente_pago',
        pasarela: null,
        pasarela_referencia: null,
        pago_id: null,
        pagado_at: null,
        stock_descontado: false,
        created_at: ahora,
        updated_at: ahora,
      };
      lista.unshift(p);
      escribir(lista);
      return p;
    },
    async porNumero(numero) {
      return leer().find((x) => x.numero === numero) ?? null;
    },
    async guardarReferenciaPago(numero, pasarela, referencia) {
      editar(numero, (p) => { p.pasarela = pasarela; p.pasarela_referencia = referencia; });
    },
    async marcarPagado(numero, monto, pagoId, pasarela) {
      const p = leer().find((x) => x.numero === numero);
      if (!p) return 'no_encontrado';
      if (p.estado !== 'pendiente_pago' && p.estado !== 'pago_rechazado') return 'ya_procesado';
      if (Math.abs(p.total - monto) > 1) {
        editar(numero, (x) => { x.estado = 'pago_discrepancia'; x.pago_id = pagoId; });
        return 'monto_distinto';
      }
      editar(numero, (x) => {
        x.estado = 'pagado';
        x.pago_id = pagoId;
        x.pasarela = pasarela;
        x.pagado_at = new Date().toISOString();
        x.stock_descontado = true;
      });
      return 'pagado';
    },
    async marcarRechazado(numero, pagoId) {
      editar(numero, (p) => {
        if (p.estado === 'pendiente_pago') { p.estado = 'pago_rechazado'; p.pago_id = pagoId; }
      });
    },
    async cambiarEstado(numero, estado) {
      editar(numero, (p) => { p.estado = estado; });
    },
    async listar({ estado, limite = 200 }) {
      return leer().filter((p) => !estado || p.estado === estado).slice(0, limite);
    },
  };
}
