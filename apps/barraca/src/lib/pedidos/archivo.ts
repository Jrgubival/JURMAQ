import 'server-only';
import fs from 'fs';
import path from 'path';
import type { EventoPedido, EstadoPedido, Pedido, PedidosStore } from './index';

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

function nuevoEvento(p: Pedido, anterior: EstadoPedido | null, nuevo: EstadoPedido, motivo: string | null, actor: string | null): EventoPedido {
  const eventos = p.eventos ?? [];
  return {
    id: eventos.length + 1,
    numero: p.numero,
    estado_anterior: anterior,
    estado_nuevo: nuevo,
    motivo,
    actor_email: actor,
    created_at: new Date().toISOString(),
  };
}

/** Igual que el trigger de la base: todo cambio de estado deja un evento sin firmar. */
function editar(numero: string, fn: (p: Pedido) => void) {
  const lista = leer();
  const p = lista.find((x) => x.numero === numero);
  if (!p) return;
  const antes = p.estado;
  fn(p);
  if (p.estado !== antes) {
    const motivo = p.estado === 'rechazado' ? p.rechazo_motivo ?? null : null;
    p.eventos = [...(p.eventos ?? []), nuevoEvento(p, antes, p.estado, motivo, null)];
  }
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
        pago_detalle: null,
        pagado_at: null,
        stock_descontado: false,
        courier_seguimiento: null,
        courier_etiqueta_url: null,
        courier_envio_id: null,
        created_at: ahora,
        updated_at: ahora,
      };
      p.eventos = [nuevoEvento(p, null, 'pendiente_pago', 'Pedido creado en la tienda', null)];
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
      if (!['pendiente_pago', 'pago_rechazado', 'transferencia_informada'].includes(p.estado)) return 'ya_procesado';
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
    async guardarDetallePago(numero, detalle) {
      editar(numero, (p) => { p.pago_detalle = detalle; });
    },
    // Desarrollo: el stock de la base no se toca; sólo se lleva la marca.
    async reservarStock(numero) {
      const p = leer().find((x) => x.numero === numero);
      if (!p) return 'no_encontrado';
      if (p.stock_descontado) return 'ya_reservado';
      editar(numero, (x) => { x.stock_descontado = true; });
      return 'reservado';
    },
    async cerrar(numero, estado, motivo, nota) {
      const p = leer().find((x) => x.numero === numero);
      if (!p) return 'no_encontrado';
      if (!['pendiente_pago', 'transferencia_informada', 'pago_rechazado', 'pago_discrepancia', 'pagado', 'en_preparacion', 'listo_retiro'].includes(p.estado)) return 'estado_invalido';
      editar(numero, (x) => {
        x.estado = estado;
        x.stock_descontado = false;
        if (estado === 'rechazado') { x.rechazo_motivo = motivo; x.rechazo_nota = nota; x.rechazado_at = new Date().toISOString(); }
      });
      return 'ok';
    },
    async guardarMotivoCancelacion(numero, motivo) {
      editar(numero, (x) => { if (x.estado === 'cancelado') x.cancelacion_motivo = motivo; });
    },
    async vencer(numero, horas) {
      const p = leer().find((x) => x.numero === numero);
      if (!p) return 'no_encontrado';
      if (p.estado !== 'pendiente_pago' || p.metodo_pago !== 'transferencia' || Date.parse(p.created_at) > Date.now() - horas * 3600_000) {
        return 'no_corresponde';
      }
      editar(numero, (x) => { x.estado = 'cancelado'; x.stock_descontado = false; x.cancelacion_motivo = 'vencido'; });
      return 'vencido';
    },
    async guardarReembolso(numero, r) {
      editar(numero, (p) => { p.reembolso = r; });
    },
    async tomarDevolucionHecha(numero, r) {
      let tomado = false;
      editar(numero, (p) => {
        if (p.reembolso?.medio === 'transferencia' && p.reembolso.estado === 'pendiente') { p.reembolso = r; tomado = true; }
      });
      return tomado;
    },
    async tomarReembolso(numero, r) {
      let tomado = false;
      editar(numero, (p) => {
        if (!p.reembolso || p.reembolso.estado === 'error') { p.reembolso = r; tomado = true; }
      });
      return tomado;
    },
    async cambiarEstado(numero, estado) {
      editar(numero, (p) => { p.estado = estado; });
    },
    async informarTransferencia(numero, comprobantePath, nota) {
      let informado = false;
      editar(numero, (p) => {
        if (p.metodo_pago !== 'transferencia' || p.estado !== 'pendiente_pago') return;
        p.estado = 'transferencia_informada';
        p.transferencia_informada_at = new Date().toISOString();
        p.comprobante_path = comprobantePath;
        p.comprobante_nota = nota;
        informado = true;
      });
      return informado;
    },
    async guardarEnvio(numero, envio) {
      let guardado = false;
      editar(numero, (p) => {
        if (p.courier_seguimiento) return;
        p.courier_seguimiento = envio.seguimiento;
        p.courier_etiqueta_url = envio.etiquetaUrl;
        p.courier_envio_id = envio.envioId;
        guardado = true;
      });
      return guardado;
    },
    async listar({ estado, limite = 200 }) {
      return leer().filter((p) => !estado || p.estado === estado).slice(0, limite);
    },
    async listarRango({ desde, hasta, limite }) {
      const d = Date.parse(desde);
      const h = Date.parse(hasta);
      return leer()
        .filter((p) => { const t = Date.parse(p.created_at); return t >= d && t < h; })
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limite);
    },
    async eventos(numero) {
      return leer().find((x) => x.numero === numero)?.eventos ?? [];
    },
    async firmarEvento(numero, estadoNuevo, actorEmail, motivo) {
      const lista = leer();
      const p = lista.find((x) => x.numero === numero);
      const hace = Date.now() - 5 * 60 * 1000;
      const ev = [...(p?.eventos ?? [])].reverse().find(
        (e) => e.estado_nuevo === estadoNuevo && !e.actor_email && Date.parse(e.created_at) >= hace,
      );
      if (!ev) return;
      if (actorEmail) ev.actor_email = actorEmail;
      if (motivo) ev.motivo = motivo;
      escribir(lista);
    },
    async registrarEvento(numero, estado, actorEmail, motivo) {
      const lista = leer();
      const p = lista.find((x) => x.numero === numero);
      if (!p) return;
      p.eventos = [...(p.eventos ?? []), nuevoEvento(p, estado, estado, motivo, actorEmail)];
      escribir(lista);
    },
    async guardarDocumento(numero, ruta, tipo) {
      editar(numero, (p) => {
        p.documento_path = ruta;
        p.documento_tipo = tipo;
        p.documento_subido_at = new Date().toISOString();
        p.documento_enviado_at = null;
      });
    },
    async marcarDocumentoEnviado(numero) {
      editar(numero, (p) => { p.documento_enviado_at = new Date().toISOString(); });
    },
    async paraPedirOpinion({ desde, hasta, limite }) {
      return leer()
        .filter((p) => p.estado === 'entregado' && !p.opinion_solicitada_at && p.updated_at >= desde && p.updated_at <= hasta)
        .slice(0, limite);
    },
    async marcarOpinionSolicitada(numero) {
      let marcado = false;
      editar(numero, (p) => {
        if (p.opinion_solicitada_at) return;
        p.opinion_solicitada_at = new Date().toISOString();
        marcado = true;
      });
      return marcado;
    },
    async desmarcarOpinionSolicitada(numero) {
      editar(numero, (p) => { p.opinion_solicitada_at = null; });
    },
  };
}
