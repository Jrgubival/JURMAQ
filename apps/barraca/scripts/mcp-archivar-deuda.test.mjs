// Archivar NO se permite mientras al cliente se le deba plata; se vuelve a comprobar justo antes del INSERT.
// Correr: node --test scripts/mcp-archivar-deuda.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { montar, pedido, webpayPagado, transferPagado, NUM, T0 } from "./pruebas/dinero-arnes.mjs";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";
import { motivoNoArchivable } from "../src/lib/mcp/tools/borrado.ts";
import { archivarPedido, estaArchivado } from "../src/lib/pedidos/archivados.ts";
import { reservarDevolucion } from "../src/lib/pedidos/devoluciones-d1.ts";

const reemb = (estado, medio = "webpay") => ({ estado, medio, monto: 15000, fecha: "2026-11-20T16:00:00.000Z" });
const cancelado = (c, extra = {}) => webpayPagado(c, { estado: "cancelado", ...extra });

test("motivoNoArchivable: se bloquea si al cliente se le debe plata", () => {
  const bloquea = [
    ["cancelado, pagado y sin devolución", cancelado("A"), null],
    ["reembolso en error", cancelado("A", { reembolso: reemb("error") }), null],
    ["reembolso pendiente (transferencia por hacer)", cancelado("A", { reembolso: reemb("pendiente", "transferencia") }), null],
    ["reembolso en curso", cancelado("A", { reembolso: reemb("en_curso") }), null],
    ["reembolso incierto", cancelado("A", { reembolso: reemb("incierto") }), null],
    ["D1 devolución rechazada", cancelado("A", { reembolso: reemb("hecho") }), "devolucion_rechazada"],
    ["D1 transferencia pendiente", cancelado("A", { reembolso: reemb("hecho") }), "transferencia_pendiente"],
    ["D1 incierta", webpayPagado("A"), "devolucion_incierta"],
    ["pago_discrepancia", pedido("A", { estado: "pago_discrepancia" }), null],
    ["transferencia_informada", pedido("A", { estado: "transferencia_informada" }), null],
  ];
  for (const [nombre, p, d1] of bloquea) assert.ok(motivoNoArchivable(p, d1), nombre);
});

test("motivoNoArchivable: lo normal sigue archivable", () => {
  assert.equal(motivoNoArchivable(transferPagado("A"), null), null);
  assert.equal(motivoNoArchivable(webpayPagado("A", { estado: "entregado" }), null), null);
  assert.equal(motivoNoArchivable(cancelado("A", { reembolso: reemb("hecho") }), "devolucion_hecha"), null);
  assert.equal(motivoNoArchivable(pedido("A", { estado: "cancelado" }), null), null, "cancelado que nunca se pagó");
});

test("archivar_pedido (herramienta) rechaza cada caso de deuda con un motivo", async () => {
  const m = await montar({
    pedidos: [cancelado("A"), cancelado("B", { reembolso: reemb("error") }), cancelado("C", { reembolso: reemb("pendiente", "transferencia") }),
      pedido("D", { estado: "pago_discrepancia" }), pedido("E", { estado: "transferencia_informada" }), cancelado("F", { reembolso: reemb("hecho") })],
  });
  for (const c of "ABCDE") await m.falla("archivar_pedido", { numeros: [NUM(c)] }, /No hay nada que archivar/);
  await m.db.prepare("INSERT INTO devoluciones_mcp (numero, estado, medio, monto, usuario_id, creado_en, actualizado_en) VALUES (?, 'devolucion_rechazada', 'webpay', 15000, '1', 1, 1)").bind(NUM("F")).run();
  await m.falla("archivar_pedido", { numeros: [NUM("F")] }, /Webpay rechazó la devolución/);
  assert.equal((await m.db.prepare("SELECT COUNT(*) AS n FROM pedidos_archivados").first()).n, 0);
});

test("se vuelve a comprobar justo antes del INSERT: si tras la confirmación quedó plata debida, no se archiva", async () => {
  const m = await montar({ pedidos: [webpayPagado("A", { estado: "entregado" }), transferPagado("B"), transferPagado("C")] });
  const numeros = [NUM("A"), NUM("B"), NUM("C")];
  const v = await m.llamar("archivar_pedido", { numeros });
  assert.deepEqual(v.datos.archivables.sort(), numeros);
  // Al confirmar se leen los 3 pedidos (lecturas 1 a 3) y luego se revisan de nuevo, uno por uno, antes de cada INSERT (4 en adelante): en la lectura 4 «llega» una
  // cancelación a medias de A y una transferencia pendiente de B (justo la carrera que cubre la segunda comprobación).
  const original = m.store.porNumero;
  let lecturas = 0;
  m.store.porNumero = async (n) => {
    lecturas++;
    if (lecturas === 4) {
      Object.assign(m.store.mapa.get(NUM("A")), { estado: "cancelado" });
      await m.db.prepare("INSERT INTO devoluciones_mcp (numero, estado, medio, monto, usuario_id, creado_en, actualizado_en) VALUES (?, 'transferencia_pendiente', 'transferencia', 15000, '1', 1, 1)").bind(NUM("B")).run();
    }
    return original(n);
  };
  const r = await m.llamar("archivar_pedido", { numeros, id_vista_previa: v.datos.idVistaPrevia });
  assert.deepEqual(r.datos.archivados, [NUM("C")]);
  assert.deepEqual(r.datos.noArchivados.sort(), [NUM("A"), NUM("B")]);
  assert.match(r.texto, /No se archivó/);
  assert.equal(await estaArchivado(m.db, NUM("A")), false);
  assert.equal(await estaArchivado(m.db, NUM("B")), false);
  assert.equal(await estaArchivado(m.db, NUM("C")), true);
});

test("el INSERT de D1 es condicional y atómico: no inserta si la reserva está abierta, sin importar lo que lea Supabase", async () => {
  const db = crearD1Simulada();
  const dat = (c) => ({ numero: NUM(c), estado: "pagado", usuarioId: "1", ahora: T0 });
  await reservarDevolucion(db, { numero: NUM("A"), medio: "webpay", monto: 15000, usuarioId: "1", ahora: T0 });
  assert.equal(await archivarPedido(db, dat("A"), { sinDevolucionesAbiertas: true }), false, "reservada");
  for (const estado of ["devolucion_en_curso", "devolucion_incierta", "devolucion_rechazada", "transferencia_pendiente"]) {
    await db.prepare("UPDATE devoluciones_mcp SET estado = ? WHERE numero = ?").bind(estado, NUM("A")).run();
    assert.equal(await archivarPedido(db, dat("A"), { sinDevolucionesAbiertas: true }), false, estado);
  }
  await db.prepare("UPDATE devoluciones_mcp SET estado = 'devolucion_hecha' WHERE numero = ?").bind(NUM("A")).run();
  assert.equal(await archivarPedido(db, dat("A"), { sinDevolucionesAbiertas: true }), true, "hecha ya no bloquea");
  assert.equal(await archivarPedido(db, dat("B"), { sinDevolucionesAbiertas: true }), true, "sin fila de devolución");
  assert.equal(await archivarPedido(db, dat("B"), { sinDevolucionesAbiertas: true }), false, "idempotente");
});
