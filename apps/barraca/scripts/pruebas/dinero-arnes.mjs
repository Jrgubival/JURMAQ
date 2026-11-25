// Arnés compartido de las pruebas de dinero y borrado: tienda falsa (Supabase), Transbank, correos y D1 simulada.
// Copia del que usa mcp-dinero.test.mjs. NUNCA toca pedidos reales.
import "./cargar-alias.mjs";
import "./cargar-shared.mjs";
import assert from "node:assert/strict";
import { crearD1Simulada } from "./d1-simulada.mjs";
const { registrarLote, nuevoLoteId } = await import("../../src/lib/gestion/index.ts");
const { crearHerramientasDinero } = await import("../../src/lib/mcp/tools/dinero.ts");
const { crearHerramientasBorrado } = await import("../../src/lib/mcp/tools/borrado.ts");
const { crearHerramientasPedidos } = await import("../../src/lib/mcp/tools/pedidos.ts");
const { crearHerramientasReportes } = await import("../../src/lib/mcp/tools/reportes.ts");
const { ejecutarDevolucionWebpay } = await import("../../src/lib/pedidos/devolucion-webpay.ts");

export const T0 = Date.UTC(2026, 10, 25, 15, 0, 0);
export const JORGE = { id: "1", email: "contacto@jurmaq.cl" };
export const OTRO = { id: "2", email: "otro@example.com" };
export const PIMIENTA = "pimienta-de-prueba-0123456789-abcdefghijklmnop";
export const NUM = (c) => `BJ-261120-${c.repeat(4)}`;

export function pedido(c, extra = {}) {
  return {
    numero: NUM(c), estado: "pendiente_pago", metodo_pago: "transferencia", pasarela: null, pasarela_referencia: null, pago_detalle: null,
    pagado_at: null, entrega: "retiro", nombre: "Juana Pérez Soto", rut: "12.345.678-5", telefono: "+56 9 1234 5678", email: "juana.perez@correo.cl",
    direccion: null, notas: null, items: [{ productoId: 1, codigo: "F10", nombre: "Fierro", cantidad: 3, precio: 5000, subtotal: 15000 }],
    total: 15000, stock_descontado: true, reembolso: null, documento_path: null, documento_subido_at: null, documento_enviado_at: null,
    comprobante_path: null, cupon_codigo: null, transferencia_informada_at: null, created_at: "2026-11-20T14:00:00.000Z", ...extra,
  };
}
export const webpayPagado = (c, extra = {}) => pedido(c, { estado: "pagado", metodo_pago: "webpay", pasarela: "webpay", pasarela_referencia: `TOKEN-${c}`, pago_detalle: { monto: 15000 }, pagado_at: "2026-11-20T15:00:00.000Z", ...extra });
export const transferPagado = (c, extra = {}) => pedido(c, { estado: "pagado", pagado_at: "2026-11-20T15:00:00.000Z", ...extra });

function crearStore(lista) {
  const mapa = new Map(lista.map((p) => [p.numero, structuredClone(p)]));
  const s = { mapa, llamadas: { marcarPagado: 0, cancelar: 0 }, eventos: [], cuentasEscritas: 0, falloCancelar: null };
  s.porNumero = async (n) => { const p = mapa.get(n); return p ? structuredClone(p) : null; };
  s.listarRango = async () => [...mapa.values()].map((p) => structuredClone(p));
  s.marcarPagado = async (n, monto) => {
    s.llamadas.marcarPagado++; await Promise.resolve();
    const p = mapa.get(n);
    if (!p) return "no_encontrado";
    if (!["pendiente_pago", "transferencia_informada", "pago_rechazado"].includes(p.estado)) return "ya_procesado";
    if (monto !== p.total) return "monto_distinto";
    p.estado = "pagado"; p.pagado_at = "2026-11-25T15:00:00.000Z";
    return "pagado";
  };
  s.cancelar = async (n) => {
    s.llamadas.cancelar++; await Promise.resolve();
    if (s.falloCancelar) throw s.falloCancelar;
    const p = mapa.get(n);
    if (!p) return "no_encontrado";
    if (!["pendiente_pago", "transferencia_informada", "pago_rechazado", "pagado", "en_preparacion", "listo_retiro"].includes(p.estado)) return "estado_invalido";
    p.estado = "cancelado"; p.stock_descontado = false;
    if (p.pagado_at && p.pasarela !== "webpay" && !p.reembolso) p.reembolso = { estado: "pendiente", medio: "transferencia", monto: p.total, fecha: "x" };
    return "ok";
  };
  s.tomarReembolso = async (n, r) => { await Promise.resolve(); const p = mapa.get(n); if (p.reembolso && p.reembolso.estado !== "error") return false; p.reembolso = r; return true; };
  s.guardarReembolso = async (n, r) => { mapa.get(n).reembolso = r; };
  s.tomarDevolucionHecha = async (n, r) => {
    const p = mapa.get(n);
    if (p.reembolso?.medio === "transferencia" && p.reembolso.estado === "pendiente" && p.reembolso.cuenta?.numero === r.cuenta?.numero) { p.reembolso = r; return true; }
    return false;
  };
  s.firmarEvento = async (...a) => { s.eventos.push(a); };
  s.registrarEvento = async (...a) => { s.eventos.push(a); };
  s.eventosDe = [];
  s.eventos_ = async () => [];
  s.borrarPedidoNuncaPagado = async (n) => {
    const p = mapa.get(n);
    if (!p || p.estado !== "cancelado" || p.pagado_at || p.documento_path || p.reembolso) return false;
    mapa.delete(n); return true;
  };
  return s;
}

/** Doble de Supabase para personas (en memoria, con las mismas reglas de la base real). */
function crearPersonas(datos) {
  const e = (x) => x.toLowerCase();
  return {
    datos, comprobantesBorrados: [],
    async contarSuscriptores(m) { return datos.suscriptores.filter((x) => e(x.email) === m).length; },
    async borrarSuscriptores(m) { const n = datos.suscriptores.length; datos.suscriptores = datos.suscriptores.filter((x) => e(x.email) !== m); return n - datos.suscriptores.length; },
    async contarCarritos(m) { return datos.carritos.filter((x) => e(x.email) === m).length; },
    async borrarCarritos(m) { const n = datos.carritos.length; datos.carritos = datos.carritos.filter((x) => e(x.email) !== m); return n - datos.carritos.length; },
    async cotizaciones(m) { const l = datos.cotizaciones.filter((x) => e(x.email) === m); return { total: l.length, pagadas: l.filter((x) => x.estado === "pagada").length, abiertas: l.filter((x) => ["aprobada", "aceptada"].includes(x.estado)).length }; },
    async anonimizarCotizacionesNoPagadas(m) { let n = 0; for (const c of datos.cotizaciones) if (e(c.email) === m && !["pagada", "aprobada", "aceptada"].includes(c.estado)) { c.nombre = "Anonimizado"; c.email = "anonimizado@borrado.invalid"; n++; } return n; },
    async pedidos(m) { return datos.pedidos.filter((p) => e(p.email) === m).map((p) => ({ numero: p.numero, estado: p.estado, pagado: !!p.pagado_at, comprobante_path: p.comprobante_path ?? null })); },
    async anonimizarPedidos(nums) { let n = 0; for (const p of datos.pedidos) if (nums.includes(p.numero) && !p.pagado_at && ["cancelado", "pago_rechazado", "rechazado"].includes(p.estado)) { Object.assign(p, { nombre: "Anonimizado", email: "anonimizado@borrado.invalid", rut: null, telefono: "anonimizado", direccion: null }); n++; } return n; },
    async contarOpiniones(nums) { return datos.opiniones.filter((o) => nums.includes(o.pedido_numero)).length; },
    async anonimizarOpiniones(nums) { let n = 0; for (const o of datos.opiniones) if (nums.includes(o.pedido_numero)) { o.autor_publico = "Cliente"; n++; } return n; },
    async usuariosAntiguos() { return 0; },
    async anonimizarUsuariosAntiguos() { return 0; },
    async borrarComprobante(r) { this.comprobantesBorrados.push(r); },
    async borrarNotasInternas(nums) { let n = 0; for (const x of nums) n += (await db_.prepare("DELETE FROM pedido_notas WHERE numero = ?").bind(x).run()).meta.changes; return n; },
    async contarNotasInternas(nums) { let n = 0; for (const x of nums) n += (await db_.prepare("SELECT COUNT(*) AS n FROM pedido_notas WHERE numero = ?").bind(x).first()).n; return n; },
  };
}
let db_;

export async function montar({ pedidos = [], aprobador = "jorge.personal@example.com", transbank, datosPersonas, pimienta } = {}) {
  const db = crearD1Simulada();
  db_ = db;
  const store = crearStore(pedidos);
  const correos = []; const llamadasTransbank = []; const correosCliente = [];
  const aviso = { aprobadorEmail: aprobador, base: "https://barraca.jurmaq.cl", enviar: async (c) => { correos.push(c); return true; } };
  const tb = transbank ?? (async () => ({ ok: true, tipo: "REVERSED", autorizacion: "1" }));
  const personas = crearPersonas(datosPersonas ?? { suscriptores: [], carritos: [], cotizaciones: [], pedidos: [], opiniones: [] });
  const deps = {
    puerto: async () => store,
    aviso: async () => aviso,
    devolverWebpay: (p) => ejecutarDevolucionWebpay({
      tomarReembolso: store.tomarReembolso, guardarReembolso: store.guardarReembolso,
      reembolsar: async (t, m) => { llamadasTransbank.push({ t, m }); return tb(t, m); },
    }, { numero: p.numero, total: p.total, pasarela_referencia: p.pasarela_referencia }),
    estadoTransbank: async () => ({ estado: "AUTHORIZED", monto: 15000, saldo: 15000 }),
    correoConfirmacion: async (p) => { correosCliente.push(["confirmacion", p.numero]); },
    correoCancelacion: async (p) => { correosCliente.push(["cancelacion", p.numero]); },
    correoDevolucionHecha: async (p) => { correosCliente.push(["devolucion_hecha", p.numero]); },
    revalidar: async () => undefined,
    eventos: async () => [],
    personas: async () => personas,
    borrarComprobante: async () => undefined,
    pimienta: () => (pimienta === undefined ? PIMIENTA : pimienta),
  };
  store.eventos = [];
  const puertoBorrado = Object.assign(Object.create(store), { eventos: async () => [{}, {}] });
  const herramientas = [
    ...crearHerramientasDinero(deps),
    ...crearHerramientasBorrado({ ...deps, puerto: async () => puertoBorrado }),
    ...crearHerramientasPedidos({ puerto: async () => store }),
    ...crearHerramientasReportes({ pedidosRango: async () => [...store.mapa.values()].map((p) => structuredClone(p)), productosActivos: async () => ({ filas: [], truncado: false }), carritosAbandonados: async () => ({ filas: [], truncado: false }), usosDeCupones: async () => [] }),
  ];
  // Reloj de la prueba: cada llamada sin hora explícita avanza 10 s (la confirmación exige una espera mínima tras la vista previa).
  let reloj = 0;
  const llamar = async (nombre, args, usuario = JORGE, ahoraPedida = undefined) => {
    const ahora = ahoraPedida ?? T0 + (reloj += 10_000);
    const h = herramientas.find((x) => x.nombre === nombre);
    assert.ok(h, nombre);
    const datos = h.esquema.strict().parse(args);
    const loteId = nuevoLoteId();
    const ctx = { usuario, clienteId: "c", loteId, db, ahora, catalogo: [], scope: "tienda:leer tienda:escribir tienda:dinero",
      async auditar(cambios) { await registrarLote(db, loteId, usuario, cambios.map((c) => ({ ...c, herramienta: c.herramienta ?? nombre })), ahora); } };
    const salida = await h.ejecutar(datos, ctx);
    return { ...(typeof salida === "string" ? { texto: salida } : salida), loteId };
  };
  const falla = async (nombre, args, patron, usuario) => {
    await assert.rejects(() => llamar(nombre, args, usuario), (e) => { assert.equal(e.name, "ErrorHerramienta", String(e)); if (patron) assert.match(e.message, patron); return true; });
  };
  const auditoria = async () => (await db.prepare("SELECT * FROM auditoria").all()).results;
  return { db, store, correos, correosCliente, llamadasTransbank, llamar, falla, auditoria, personas, deps };
}

