// Pedidos de ejemplo y recorrido de TODOS los correos al cliente de lib/pedidos/correos.ts.
// Sirve para fijar (golden) lo que sale hoy y comprobar que no cambia byte a byte.
import { createHash } from "node:crypto";

const base = {
  id: 1, numero: "BJ-261120-AAAA", acceso_hash: "h", estado: "pendiente_pago", metodo_pago: "webpay", pasarela: null, pasarela_referencia: null, pago_id: null,
  pago_detalle: null, pagado_at: null, entrega: "retiro", direccion: null, comuna: null, nombre: "Juana Pérez Soto", rut: "12.345.678-5", telefono: "+56 9 1234 5678",
  email: "juana@example.cl", notas: null,
  items: [{ productoId: 1, codigo: "F10", nombre: "Fierro 10mm", medida: "6m", unidad: "un", cantidad: 3, precio: 5000, subtotal: 15000 }],
  subtotal: 15000, descuento_transferencia: 0, costo_despacho: null, despacho_tipo: null, comuna_codigo: null, courier: null, courier_seguimiento: null,
  terminos_aceptados_at: "2026-11-20T14:00:00.000Z", terminos_version: "v1", acepta_ofertas: false, documento_solicitado: "boleta",
  total: 15000, stock_descontado: false, created_at: "2026-11-20T14:00:00.000Z", updated_at: "2026-11-20T14:00:00.000Z",
};
const p = (extra) => ({ ...base, ...extra });
const combo = { productoId: 2, codigo: "C1", nombre: "Clavo 3\"", medida: null, unidad: "kg", cantidad: 2, precio: 3000, subtotal: 5000, combo: { cantidad: 2, precio: 5000 } };

export const PEDIDOS = {
  webpayPendiente: p({}),
  transferenciaPendiente: p({ numero: "BJ-261120-BBBB", metodo_pago: "transferencia", entrega: "despacho", direccion: "Calle 1 #23", comuna: "Curicó", costo_despacho: 4990, despacho_tipo: "propio", total: 19990, descuento_transferencia: 300 }),
  transferenciaInformada: p({ numero: "BJ-261120-CCCC", metodo_pago: "transferencia", estado: "transferencia_informada" }),
  pagadoWebpay: p({ numero: "BJ-261120-DDDD", estado: "pagado", pasarela: "webpay", pagado_at: "2026-11-20T15:00:00.000Z", pago_detalle: { ordenCompra: "OC123", autorizacion: "A9", tarjeta: "1234" }, entrega: "despacho", direccion: "Av. Sur 5", comuna: "Molina", costo_despacho: 0, despacho_tipo: "courier", courier: "enviame" }),
  conCuponYFactura: p({ numero: "BJ-261120-EEEE", estado: "pagado", metodo_pago: "transferencia", pagado_at: "2026-11-20T16:00:00.000Z", cupon_codigo: "VERANO27", cupon_descuento: 1500, descuento_transferencia: 270, documento_solicitado: "factura", factura_razon_social: "Constructora X SpA", factura_rut: "76.111.222-3", factura_giro: "Construcción", factura_direccion: "Calle Y 1", items: [base.items[0], combo], subtotal: 20000, total: 18230 }),
  nombreRaro: p({ numero: "BJ-261120-FFFF", nombre: "Ana<b>\"&'Z</b> Lopez", entrega: "despacho", direccion: "<script>x</script> 1", comuna: "A&B", costo_despacho: null, items: [{ ...base.items[0], nombre: "Tubo <i>&\"x\"</i>" }] }),
};

const REEMBOLSOS = {
  sin: null,
  webpayHecho: { estado: "hecho", medio: "webpay", monto: 15000, fecha: "2026-11-21" },
  webpayPendiente: { estado: "pendiente", medio: "webpay", monto: 15000, fecha: "2026-11-21" },
  transferencia: { estado: "pendiente", medio: "transferencia", monto: 15000, fecha: "2026-11-21", cuenta: { banco: "Banco <X>", tipo: "Vista", numero: "123456789012", rut: "11.111.111-1", titular: "Juana" } },
};

/** Recorre todos los correos al cliente y devuelve [{ caso, to, subject, html, attachments? }] */
export async function recorrerCorreos(C) {
  const out = [];
  const captura = async (caso, fn) => {
    globalThis.__CORREOS_ENVIADOS__ = [];
    const r = await fn();
    for (const c of globalThis.__CORREOS_ENVIADOS__) out.push({ caso, to: c.to, subject: c.subject, html: c.html, bcc: c.skipAdminBcc, adjuntos: (c.attachments ?? []).map((a) => a.filename) });
    return r;
  };
  for (const [n, ped] of Object.entries(PEDIDOS)) {
    await captura(`confirmacion:${n}`, () => C.correoConfirmacionComprador(ped));
  }
  const motivosRechazo = ["sin_stock", "sin_despacho", "pago_fraude"];
  for (const m of motivosRechazo) {
    for (const [rn, r] of Object.entries(REEMBOLSOS)) {
      for (const pagado of [false, true]) {
        await captura(`rechazo:${m}:${rn}:${pagado}`, () => C.correoRechazoComprador(p({ rechazo_motivo: m, reembolso: r, pagado_at: pagado ? "2026-11-20T15:00:00.000Z" : null })));
      }
    }
  }
  await captura("rechazo:sin-motivo", () => C.correoRechazoComprador(p({})));
  for (const m of [undefined, null, "cliente", "transferencia_no_recibida", "vencido", "otro"]) {
    for (const [rn, r] of Object.entries(REEMBOLSOS)) {
      for (const pagado of [false, true]) {
        await captura(`cancelacion:${m}:${rn}:${pagado}`, () => C.correoCancelacionComprador(p({ cancelacion_motivo: m, reembolso: r, pagado_at: pagado ? "2026-11-20T15:00:00.000Z" : null, items: [base.items[0], combo] })));
      }
    }
  }
  for (const [rn, r] of Object.entries(REEMBOLSOS)) {
    await captura(`devolucion:${rn}`, () => C.correoDevolucionHecha(p({ reembolso: r })));
  }
  await captura("devolucion:nombreRaro", () => C.correoDevolucionHecha({ ...PEDIDOS.nombreRaro, reembolso: REEMBOLSOS.transferencia }));
  await captura("opinion:normal", () => C.correoPedirOpinion(p({ items: [base.items[0], { ...base.items[0], productoId: 7, nombre: "Otro producto" }] }), "https://barraca.jurmaq.cl/baja/abc"));
  await captura("opinion:raro", () => C.correoPedirOpinion(PEDIDOS.nombreRaro, "https://barraca.jurmaq.cl/baja/a&b"));
  const pdf = Buffer.from("%PDF-1.4 prueba");
  for (const tipo of ["boleta", "factura"]) {
    for (const [n, ped] of [["boleta", PEDIDOS.webpayPendiente], ["factura", PEDIDOS.conCuponYFactura], ["raro", PEDIDOS.nombreRaro]]) {
      globalThis.__CORREOS_ENVIADOS__ = [];
      const r = await C.correoDocumentoTributario(ped, tipo, pdf);
      for (const c of globalThis.__CORREOS_ENVIADOS__) out.push({ caso: `documento:${tipo}:${n}`, to: c.to, subject: c.subject, html: c.html, bcc: c.skipAdminBcc, adjuntos: (c.attachments ?? []).map((a) => a.filename) });
      out.push({ caso: `documento:${tipo}:${n}:resultado`, to: "-", subject: String(r), html: "" });
    }
  }
  return out;
}

export const huella = (c) => createHash("sha256").update(JSON.stringify([c.to, c.subject, c.html, c.bcc, c.adjuntos])).digest("hex");
