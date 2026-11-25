// Notas internas visibles en el panel de Ventas: lectura sin romper el panel, orden, borradas ocultas,
// texto tal cual (React lo escapa), permisos del endpoint de agregar.
// Correr: node --test scripts/notas-panel.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";

const N = await import("../src/lib/pedidos/notas.ts");
const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const conDbDe = (db) => async (fn) => fn(db);
const leerFuente = (ruta) => fs.readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");

test("el panel recibe las notas con autor, fecha ISO y texto, la más nueva primero", async () => {
  const db = crearD1Simulada();
  await N.agregarNota(db, "BJ-261030-K9ZE", "Llamar antes de despachar", { id: "1", email: "contacto@jurmaq.cl" }, T0);
  await N.agregarNota(db, "BJ-261030-K9ZE", "Cliente retira el viernes", { id: "2", email: "vendedor@jurmaq.cl" }, T0 + 60_000);
  await N.agregarNota(db, "BJ-261030-OTRO", "De otro pedido", { id: "1", email: "contacto@jurmaq.cl" }, T0);
  const r = await N.notasParaPanel(conDbDe(db), "BJ-261030-K9ZE");
  assert.equal(r.disponibles, true);
  assert.equal(r.notas.length, 2);
  assert.equal(r.notas[0].texto, "Cliente retira el viernes");
  assert.equal(r.notas[0].autor, "vendedor@jurmaq.cl");
  assert.equal(r.notas[0].creadaEn, new Date(T0 + 60_000).toISOString());
  assert.deepEqual(Object.keys(r.notas[0]).sort(), ["autor", "creadaEn", "id", "texto"]);
});

test("las notas borradas (deshacer) no se muestran; sin notas es una lista vacía disponible", async () => {
  const db = crearD1Simulada();
  const a = await N.agregarNota(db, "BJ-261030-K9ZE", "Nota que se borra", { id: "1", email: "a@x.cl" }, T0);
  await N.borrarNota(db, a.nota.id, "1", T0 + 1);
  assert.deepEqual(await N.notasParaPanel(conDbDe(db), "BJ-261030-K9ZE"), { notas: [], disponibles: true });
});

test("si D1 falla, no tiene tablas, no existe o tarda, el panel sigue: sin notas y disponibles = false", async () => {
  const silenciar = console.error;
  console.error = () => {};
  try {
    const sinTablas = crearD1Simulada({ migraciones: false });
    assert.deepEqual(await N.notasParaPanel(conDbDe(sinTablas), "BJ-261030-K9ZE"), { notas: [], disponibles: false });
    const rota = async () => { throw new Error("D1 caída: detalle interno"); };
    assert.deepEqual(await N.notasParaPanel(rota, "BJ-261030-K9ZE"), { notas: [], disponibles: false });
    const lenta = () => new Promise(() => {});
    const t = Date.now();
    assert.deepEqual(await N.notasParaPanel(lenta, "BJ-261030-K9ZE", 50), { notas: [], disponibles: false });
    assert.ok(Date.now() - t < 1000);
  } finally {
    console.error = silenciar;
  }
});

test("el texto de la nota llega tal cual (sin HTML interpretado): el escape lo hace React", async () => {
  const db = crearD1Simulada();
  const peligro = `<img src=x onerror=alert(1)> <script>alert(2)</script>`;
  await N.agregarNota(db, "BJ-261030-K9ZE", peligro, { id: "1", email: "a@x.cl" }, T0);
  const r = await N.notasParaPanel(conDbDe(db), "BJ-261030-K9ZE");
  assert.equal(r.notas[0].texto, peligro);
  // Y el componente jamás inyecta HTML crudo.
  const detalle = leerFuente("src/app/admin/ventas/[numero]/DetalleVenta.tsx");
  assert.ok(!/dangerouslySetInnerHTML/.test(detalle));
  assert.match(detalle, /\{n\.texto\}/);
});

test("el endpoint de agregar nota exige permiso de edición, mismo origen, texto validado y no filtra errores", () => {
  const ruta = leerFuente("src/app/api/admin/pedidos/[numero]/notas/route.ts");
  assert.match(ruta, /isValidOrigin\(request\)/);
  assert.match(ruta, /requirePermission\('barraca_ventas', 'update'\)/);
  assert.match(ruta, /forbiddenResponse\(\)/);
  assert.match(ruta, /PATRON_NUMERO\.test\(numero\)/);
  assert.match(ruta, /max\(MAX_NOTA\)/);
  assert.match(ruta, /\.strict\(\)/);
  assert.match(ruta, /rateLimit\(/);
  assert.ok(!/String\(error\)|error\.message/.test(ruta), "no filtra el error");
  // El usuario sale de la sesión, nunca del body.
  assert.ok(!/parsed\.data\.(autor|usuario)/.test(ruta));
});

test("lo que guarda el panel y lo que guarda el MCP es la misma tabla, con los mismos topes", async () => {
  const db = crearD1Simulada();
  const larga = await N.agregarNota(db, "BJ-261030-K9ZE", "x".repeat(900), { id: "1", email: "a@x.cl" }, T0);
  assert.equal(larga.nota.texto.length, N.MAX_NOTA);
  assert.deepEqual(await N.agregarNota(db, "BJ-261030-K9ZE", "   ​ ", { id: "1" }, T0), { ok: false, motivo: "vacia" });
  for (let i = 1; i < N.MAX_NOTAS_POR_PEDIDO; i++) await N.agregarNota(db, "BJ-261030-K9ZE", `n${i}`, { id: "1" }, T0 + i);
  assert.deepEqual(await N.agregarNota(db, "BJ-261030-K9ZE", "una más", { id: "1" }, T0 + 999), { ok: false, motivo: "tope" });
});
