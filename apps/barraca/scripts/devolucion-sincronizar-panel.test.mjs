// El panel pone al día devoluciones_mcp al marcar «hecha» (también desde rechazada o transferencia pendiente).
// Correr: node --test scripts/devolucion-sincronizar-panel.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";
import { NUM, T0 } from "./pruebas/dinero-arnes.mjs";
import { reservarDevolucion, sincronizarDevolucionPanel, leerDevolucion } from "../src/lib/pedidos/devoluciones-d1.ts";

test("«Ya se devolvió» del panel cierra también una fila rechazada o con transferencia pendiente", async () => {
  const db = crearD1Simulada();
  for (const [c, desde] of [["A", "devolucion_rechazada"], ["B", "transferencia_pendiente"], ["C", "devolucion_incierta"]]) {
    await reservarDevolucion(db, { numero: NUM(c), medio: "webpay", monto: 15000, usuarioId: "1", ahora: T0 });
    await db.prepare("UPDATE devoluciones_mcp SET estado = ? WHERE numero = ?").bind(desde, NUM(c)).run();
    assert.equal(await sincronizarDevolucionPanel(db, NUM(c), "devolucion_hecha", T0 + 1), true, desde);
    assert.equal((await leerDevolucion(db, NUM(c))).estado, "devolucion_hecha");
  }
  // una fila ya hecha no se pisa
  assert.equal(await sincronizarDevolucionPanel(db, NUM("A"), "devolucion_rechazada", T0 + 2), false);
});

test("la ruta del panel que marca hecha la devolución por transferencia sincroniza D1", () => {
  const ruta = readFileSync(new URL("../src/app/api/admin/pedidos/[numero]/devolucion/route.ts", import.meta.url), "utf8");
  assert.match(ruta, /import \{[^}]*sincronizarConMcp[^}]*\} from '@\/lib\/pedidos\/rechazo'/);
  const hecha = ruta.slice(ruta.indexOf("tomarDevolucionHecha"));
  assert.match(hecha, /await sincronizarConMcp\(numero, 'devolucion_hecha'\)/);
  // y solo después de que el pedido quedó marcado (no si «ya estaba marcada»)
  assert.ok(hecha.indexOf("ya estaba marcada como hecha") < hecha.indexOf("sincronizarConMcp"));
  const rechazo = readFileSync(new URL("../src/lib/pedidos/rechazo.ts", import.meta.url), "utf8");
  assert.match(rechazo, /export async function sincronizarConMcp/);
});
