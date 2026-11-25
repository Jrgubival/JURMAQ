// Pruebas de los reportes MCP de solo lectura: ventas, más vendidos, catálogo, carritos y cupones,
// con datos conocidos, períodos, límites y sin datos personales.
// Correr: node --test scripts/mcp-reportes.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";

const { crearHerramientasReportes } = await import("../src/lib/mcp/tools/reportes.ts");
const { resumenVentas, masVendidos } = await import("../src/lib/reportes/ventas.ts");
const { reporteCatalogo, sinFoto, sinStock, bajoCosto, margenMenor15 } = await import("../src/lib/reportes/catalogo.ts");
const { resumenCarritos } = await import("../src/lib/reportes/carritos.ts");
const { datoDeCliente } = await import("../src/lib/mcp/tools/contenido-comun.ts");
const { ErrorHerramienta } = await import("../src/lib/mcp/tools/registro.ts");

const T0 = Date.UTC(2026, 10, 25, 15, 0, 0); // 25-nov-2026
const JORGE = { id: "1", email: "jorge@example.com" };

const item = (productoId, codigo, nombre, cantidad, subtotal) => ({ productoId, codigo, nombre, cantidad, subtotal });
const ped = (estado, total, metodo_pago, created_at, items, extra = {}) => ({
  numero: `BJ-${Math.random().toString(36).slice(2, 8)}`, estado, metodo_pago, entrega: "retiro", comuna: null, nombre: "X", rut: null,
  telefono: "1", email: "x@y.cl", subtotal: total, costo_despacho: null, total, created_at, pagado_at: null, items, ...extra,
});

// Noviembre 2026, con datos conocidos.
const PEDIDOS = [
  ped("entregado", 20000, "transferencia", "2026-11-03T15:00:00.000Z", [item(1, "F10", "Fierro 10mm", 4, 16000), item(2, "C1", "Cemento", 1, 4000)]),
  ped("pagado", 10000, "webpay", "2026-11-10T15:00:00.000Z", [item(1, "F10", "Fierro 10mm", 2, 8000), item(3, null, "Clavos", 5, 2000)]),
  ped("despachado", 30000, "webpay", "2026-11-12T15:00:00.000Z", [item(4, "F10", "Fierro 10mm (ficha duplicada)", 1, 4000), item(2, "C1", "Cemento", 6, 26000)], { entrega: "despacho", costo_despacho: 5000, comuna: "Molina" }),
  // No cuentan como venta:
  ped("pendiente_pago", 99999, "transferencia", "2026-11-05T15:00:00.000Z", [item(1, "F10", "Fierro 10mm", 99, 99999)]),
  ped("cancelado", 50000, "webpay", "2026-11-06T15:00:00.000Z", [item(2, "C1", "Cemento", 50, 50000)]),
  ped("rechazado", 40000, "webpay", "2026-11-07T15:00:00.000Z", []),
  ped("pago_discrepancia", 1000, "webpay", "2026-11-08T15:00:00.000Z", []),
  // Fuera del período (octubre):
  ped("entregado", 777777, "webpay", "2026-10-30T15:00:00.000Z", [item(1, "F10", "Fierro 10mm", 1, 777777)]),
];

function crearDeps(extra = {}) {
  return {
    async pedidosRango(desde, hasta, limite) {
      return PEDIDOS.filter((p) => p.created_at >= desde && p.created_at < hasta).slice(0, limite);
    },
    async productosActivos() { return { filas: PRODUCTOS, truncado: false }; },
    async carritosAbandonados() { return { filas: CARRITOS, truncado: false }; },
    async usosDeCupones() { return []; },
    ...extra,
  };
}
const PRODUCTOS = [
  { id: 1, codigo: "F10", nombre: "Fierro 10mm", precio: 5000, costo: 4000, stock: 10, imagen: "https://x/y.jpg", solo_cotizar: false },
  { id: 2, codigo: "F10", nombre: "Fierro 10mm (duplicada)", precio: 5000, costo: 4000, stock: 10, imagen: "", solo_cotizar: false },
  { id: 3, codigo: "C1", nombre: "Cemento", precio: 6000, costo: 5500, stock: 0, imagen: "/images/barraca/relleno.jpg", solo_cotizar: false },
  { id: 4, codigo: "C2", nombre: "Cal", precio: 3000, costo: 3500, stock: null, imagen: "https://x/c.jpg", solo_cotizar: false },
  { id: 5, codigo: "C3", nombre: "Arena (solo cotizar)", precio: null, costo: null, stock: 0, imagen: "https://x/a.jpg", solo_cotizar: true },
  { id: 6, codigo: "C4", nombre: "Clavo", precio: 1150, costo: 1000, stock: 5, imagen: "https://x/n.jpg", solo_cotizar: false },
  { id: 7, codigo: "C5", nombre: "Tornillo", precio: 1149, costo: 1000, stock: 5, imagen: "https://x/t.jpg", solo_cotizar: false },
  { id: 8, codigo: "C6", nombre: "Sin costo", precio: 100, costo: 0, stock: 5, imagen: "https://x/s.jpg", solo_cotizar: false },
];
const CARRITOS = [
  { items: [{ nombre: "Fierro 10mm", cantidad: 3, precio: 5000 }, { nombre: "Cemento", cantidad: 1 }], total: 19000, last_activity: "2026-11-10T10:00:00Z", email: "secreto@correo.cl", telefono: "+56912345678", session_id: "SESION-123" },
  { items: [{ nombre: "Fierro 10mm", cantidad: 1 }], total: 5000, last_activity: "2026-11-11T10:00:00Z", email: "otro@correo.cl" },
  { items: "no es lista", total: null, last_activity: "2026-11-12T10:00:00Z" },
];

async function llamar(nombre, args = {}, deps = crearDeps()) {
  const h = crearHerramientasReportes(deps).find((x) => x.nombre === nombre);
  const datos = h.esquema.strict().parse(args);
  const salida = await h.ejecutar(datos, { usuario: JORGE, clienteId: "c", loteId: "l", db: crearD1Simulada(), ahora: T0, auditar: async () => { throw new Error("un reporte no escribe"); }, catalogo: [] });
  return typeof salida === "string" ? { texto: salida } : salida;
}

// ───────── ventas ─────────

test("ventas del mes: solo pedidos pagados (criterio del panel), total, cantidad, ticket y forma de pago", async () => {
  const r = await llamar("reporte_ventas", { periodo: "mes" });
  assert.equal(r.datos.total, 60000); // 20000 + 10000 + 30000
  assert.equal(r.datos.pedidos, 3);
  assert.equal(r.datos.ticketMedio, 20000);
  assert.equal(r.datos.despachos, 5000);
  assert.deepEqual(r.datos.porFormaDePago, [{ formaPago: "Transferencia", pedidos: 1, total: 20000 }, { formaPago: "Webpay", pedidos: 2, total: 40000 }]);
  assert.equal(r.datos.desde, "2026-11-01");
  assert.equal(r.datos.hasta, "2026-11-25");
  assert.match(r.texto, /\$60\.000/);
});

test("ventas: por defecto es el mes en curso; el mes pasado y los rangos usan sus fechas", async () => {
  assert.equal((await llamar("reporte_ventas", {})).datos.total, 60000);
  const mp = await llamar("reporte_ventas", { periodo: "mes_pasado" });
  assert.equal(mp.datos.total, 777777);
  assert.equal(mp.datos.pedidos, 1);
  const rango = await llamar("reporte_ventas", { desde: "2026-11-10", hasta: "2026-11-12" });
  assert.equal(rango.datos.total, 40000);
  const vacio = await llamar("reporte_ventas", { desde: "2026-01-01", hasta: "2026-01-31" });
  assert.equal(vacio.datos.total, 0);
  assert.equal(vacio.datos.ticketMedio, 0);
  assert.match(vacio.texto, /No hubo ventas/);
});

test("ventas: períodos inválidos o demasiado largos se rechazan", async () => {
  await assert.rejects(llamar("reporte_ventas", { desde: "2026-11-10" }), ErrorHerramienta);
  await assert.rejects(llamar("reporte_ventas", { desde: "2026-11-30", hasta: "2026-11-01" }), ErrorHerramienta);
  await assert.rejects(llamar("reporte_ventas", { desde: "2025-01-01", hasta: "2026-11-25" }), /400 días/);
  await assert.rejects(llamar("reporte_ventas", { desde: "2026-02-31", hasta: "2026-03-05" }), ErrorHerramienta);
});

test("ventas: avisa cuando se llega al tope de pedidos del período", async () => {
  const muchos = Array.from({ length: 3000 }, () => ped("pagado", 1000, "webpay", "2026-11-10T15:00:00.000Z", []));
  const r = await llamar("reporte_ventas", { periodo: "mes" }, crearDeps({ pedidosRango: async (d, h, l) => muchos.slice(0, l) }));
  assert.equal(r.datos.truncado, true);
  assert.match(r.texto, /Aviso/);
});

test("resumenVentas no cuenta pendientes, cancelados, rechazados ni pagos por revisar", () => {
  const r = resumenVentas(PEDIDOS.slice(3, 7));
  assert.equal(r.total, 0);
  assert.equal(r.pedidos, 0);
});

// ───────── más vendidos ─────────

test("más vendidos: agrupa por código (fichas duplicadas juntas), solo ventas del período, ordena y limita", async () => {
  const r = await llamar("reporte_mas_vendidos", { periodo: "mes" });
  const [a, b, c] = r.datos.productos;
  // Empatan en 7 unidades; gana el que más ingresos dejó.
  assert.deepEqual([a.codigo, a.unidades, a.ingresos, a.pedidos], ["C1", 7, 30000, 2]);
  assert.deepEqual([b.codigo, b.unidades, b.ingresos, b.pedidos], ["F10", 7, 28000, 3]); // 4 + 2 + 1 (la ficha 4 es duplicada y suma al mismo código)
  assert.deepEqual([c.codigo, c.nombre, c.unidades], [null, "Clavos", 5]);
  assert.equal(r.datos.productos.length, 3);
  const porIngresos = await llamar("reporte_mas_vendidos", { periodo: "mes", orden: "ingresos", limite: 1 });
  assert.equal(porIngresos.datos.productos.length, 1);
  assert.equal(porIngresos.datos.productos[0].codigo, "C1");
  // No cuenta el pedido pendiente de 99 fierros ni el cancelado de 50 cementos.
  assert.ok(masVendidos(PEDIDOS, 10).every((p) => p.unidades < 50));
});

test("más vendidos: máximo 50 por esquema", async () => {
  await assert.rejects(llamar("reporte_mas_vendidos", { limite: 51 }), /too_big|Too big|51|inválid|<=/i);
});

// ───────── catálogo ─────────

test("catálogo: cada criterio, agrupado por código", () => {
  const nombres = (tipo) => reporteCatalogo(PRODUCTOS, tipo).items.map((i) => i.codigo);
  assert.deepEqual(nombres("sin_foto").sort(), ["C1", "F10"]); // F10 una ficha sin foto; C1 con imagen de relleno
  assert.equal(reporteCatalogo(PRODUCTOS, "sin_foto").items.find((i) => i.codigo === "F10").fichas, 1);
  assert.deepEqual(nombres("sin_stock").sort(), ["C1", "C2"]); // stock 0 y stock vacío; el «solo cotizar» no cuenta
  assert.deepEqual(nombres("bajo_costo"), ["C2"]);
  // Ordenados por peor margen. 3000<4025, 6000<6325, 1149<1150; 1150 es justo el 15 %: no entra; costo 0 no se evalúa.
  assert.deepEqual(nombres("margen_menor_15"), ["C2", "C1", "C5"]);
  const m = reporteCatalogo(PRODUCTOS, "margen_menor_15").items[0];
  assert.equal(m.margenPct, -14.3);
  assert.equal(sinFoto({ imagen: null }), true);
  assert.equal(sinFoto({ imagen: "https://x/a.jpg" }), false);
  assert.equal(sinStock({ stock: 0.9, solo_cotizar: false }), true);
  assert.equal(bajoCosto({ precio: 1000, costo: 1000 }), false);
  assert.equal(margenMenor15({ precio: 1150, costo: 1000 }), false);
  assert.equal(margenMenor15({ precio: 1149, costo: null }), false);
});

test("catálogo: pagina con tope por página y avisa si el catálogo se truncó", async () => {
  const muchos = Array.from({ length: 120 }, (_, i) => ({ id: i, codigo: `K${i}`, nombre: `P${String(i).padStart(3, "0")}`, precio: 1, costo: 1, stock: 0, imagen: "x", solo_cotizar: false }));
  const r = await llamar("reporte_catalogo", { tipo: "sin_stock", por_pagina: 50, pagina: 3 }, crearDeps({ productosActivos: async () => ({ filas: muchos, truncado: true }) }));
  assert.equal(r.datos.total, 120);
  assert.equal(r.datos.items.length, 20);
  assert.equal(r.datos.pagina, 3);
  assert.match(r.texto, /Aviso/);
  await assert.rejects(llamar("reporte_catalogo", { tipo: "sin_stock", por_pagina: 51 }));
  await assert.rejects(llamar("reporte_catalogo", { tipo: "otro" }));
});

// ───────── carritos ─────────

test("carritos abandonados: solo cantidad, montos y productos; ningún dato personal", async () => {
  const r = await llamar("reporte_carritos_abandonados", { periodo: "mes" });
  assert.equal(r.datos.carritos, 3);
  assert.equal(r.datos.montoTotal, 24000);
  assert.equal(r.datos.montoPromedio, 8000);
  // Los nombres salen como dato de cliente (marcadores), nunca como texto libre.
  assert.deepEqual(r.datos.productosMasDejados[0], { nombre: datoDeCliente("Fierro 10mm", 120), unidades: 4, carritos: 2 });
  assert.match(r.texto, /<<<TEXTO_DE_CLIENTE/);
  const todo = JSON.stringify(r);
  for (const x of ["secreto@correo", "otro@correo", "+56912345678", "SESION-123", "@"]) assert.ok(!todo.includes(x), `no debería salir ${x}`);
  // Aunque la fuente trajera columnas de más, el resumen no las puede transportar.
  assert.deepEqual(Object.keys(resumenCarritos(CARRITOS)).sort(), ["carritos", "montoPromedio", "montoTotal", "productosMasDejados"]);
});

test("carritos: la consulta real pide solo items, total y fecha (jamás correo ni teléfono)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/lib/mcp/tools/reportes.ts", import.meta.url), "utf8");
  const bloque = src.slice(src.indexOf("async carritosAbandonados"), src.indexOf("async usosDeCupones"));
  assert.match(bloque, /\.select\("items, total, last_activity"\)/);
  assert.doesNotMatch(bloque, /email|telefono|session_id/);
});

// ───────── cupones ─────────

test("cupones: entrega usos por código del período, sin datos personales", async () => {
  let pedido;
  const deps = crearDeps({
    usosDeCupones: async (db, d, h) => { pedido = [d, h]; return [{ cuponId: "c1", codigo: "VERANO10", confirmados: 3, reservadosVigentes: 1, liberados: 2, descuentoTotal: 9000, montoCompraTotal: 90000 }]; },
  });
  const r = await llamar("reporte_cupones", { periodo: "mes" }, deps);
  assert.equal(pedido[0], Date.parse("2026-11-01T03:00:00.000Z")); // 00:00 de Chile (verano, UTC-3)
  assert.match(r.texto, /VERANO10: 3 usos confirmados/);
  assert.equal(r.datos.cupones.length, 1);
  const vacio = await llamar("reporte_cupones", {});
  assert.match(vacio.texto, /No hubo usos/);
});

test("todos los reportes son de solo lectura y no escriben auditoría", () => {
  const hs = crearHerramientasReportes(crearDeps());
  assert.equal(hs.length, 5);
  for (const h of hs) {
    assert.equal(h.anotaciones.readOnlyHint, true, h.nombre);
    assert.equal(h.anotaciones.destructiveHint, false, h.nombre);
    assert.equal(h.revertidor, undefined, h.nombre);
  }
});
