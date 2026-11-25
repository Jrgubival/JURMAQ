// Descuento por transferencia configurable: equivalencia exacta con el 2 % de siempre,
// respaldo ante D1 vacía/caída/dañada, rango, dos pasos, aprobación de Jorge y deshacer.
// Correr: node --test scripts/descuento-transferencia.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";
import { aprobarUltimoCorreo, crearCtx, crearTienda } from "./pruebas/tienda-falsa.mjs";

const DT = await import("../src/lib/pagos/descuento-transferencia.ts");
const CFG = await import("../src/lib/pagos/descuento-config.ts");
const TOT = await import("../src/lib/cupones/totales.ts");
const SRV = await import("../src/lib/gestion-precios/descuento-servicio.ts");
const TD = await import("../src/lib/mcp/tools/descuento-transferencia.ts");
const { fijarDepsGestion } = await import("../src/lib/mcp/tools/productos-comun.ts");
const { crearRegistro } = await import("../src/lib/mcp/tools/registro.ts");
const { resolverAprobacion } = await import("../src/lib/mcp/aprobaciones.ts");
const { obtenerLote } = await import("../src/lib/gestion/index.ts");
const { deshacerLote } = await import("../src/lib/mcp/deshacer.ts");

const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const JORGE = { id: "1", email: "contacto@jurmaq.cl" };
const OTRO = { id: "2", email: "otro@example.com" };
const nuevaDb = () => crearD1Simulada();
const poner = (db, valor) => db.prepare("INSERT OR REPLACE INTO ajustes (clave, valor, actualizado_en) VALUES (?, ?, ?)").bind("descuento_transferencia_pct", valor, T0).run();
const leer = async (db) => (await db.prepare("SELECT valor FROM ajustes WHERE clave = 'descuento_transferencia_pct'").first())?.valor ?? null;

// Fórmulas ORIGINALES (antes de hacerlo configurable), copiadas tal cual para comparar.
const descuentoAntes = (s) => (!Number.isInteger(s) || s <= 0 ? 0 : Math.ceil((s * 2) / 100));
const maxCuponAntes = (subtotal) => {
  const pisoCobrable = (st) => (!Number.isInteger(st) || st <= 0 ? 0 : Math.min(st, Math.max(1000, Math.ceil((st * 1) / 100))));
  const piso = pisoCobrable(subtotal);
  if (piso <= 0 || subtotal <= piso) return 0;
  const neto = (c) => subtotal - c - descuentoAntes(subtotal - c);
  let c = Math.max(0, subtotal - Math.ceil(piso / (1 - 2 / 100)));
  while (c > 0 && neto(c) < piso) c--;
  return c;
};
const totalesAntes = (a) => {
  const cupon = Math.max(0, Math.min(Math.round(a.descuentoCupon ?? 0), maxCuponAntes(a.subtotal)));
  const transf = a.metodoPago === "transferencia" ? descuentoAntes(a.subtotal - cupon) : 0;
  return { subtotal: a.subtotal, descuentoCupon: cupon, descuentoTransferencia: transf, costoDespacho: a.costoDespacho, total: a.subtotal - cupon - transf + (a.costoDespacho ?? 0) };
};

// ───────── equivalencia con el 2 % de hoy ─────────
test("el respaldo es exactamente 2 %", () => {
  assert.equal(DT.DESCUENTO_TRANSFERENCIA_PCT, 2);
});

test("descuentoTransferencia sin porcentaje = fórmula de antes, en todo el rango de pesos", () => {
  for (let s = -5; s <= 300_000; s++) assert.equal(DT.descuentoTransferencia(s), descuentoAntes(s), `subtotal ${s}`);
  let semilla = 12345;
  for (let i = 0; i < 100_000; i++) {
    semilla = (semilla * 1103515245 + 12345) % 2147483648;
    const s = 1 + (semilla % 2_000_000_000);
    assert.equal(DT.descuentoTransferencia(s), descuentoAntes(s), `subtotal ${s}`);
    assert.equal(DT.descuentoTransferencia(s, 2), descuentoAntes(s));
  }
  for (const malo of [0.5, Number.NaN, "100", null, undefined, Infinity]) assert.equal(DT.descuentoTransferencia(malo), 0);
});

test("totalesPedido y descuentoMaximoCupon sin porcentaje = los de antes (todas las combinaciones)", () => {
  const subtotales = [1, 999, 1000, 1001, 1500, 9999, 50_000, 123_457, 800_000, 5_000_001];
  const cupones = [0, 1, 500, 5000, 99_999, 10_000_000];
  for (const subtotal of subtotales) {
    assert.equal(TOT.descuentoMaximoCupon(subtotal), maxCuponAntes(subtotal), `max ${subtotal}`);
    assert.equal(TOT.descuentoMaximoCupon(subtotal, 2), maxCuponAntes(subtotal));
    for (const descuentoCupon of cupones) for (const metodoPago of ["webpay", "transferencia"]) for (const costoDespacho of [null, 0, 5990]) {
      const a = { subtotal, descuentoCupon, metodoPago, costoDespacho };
      assert.deepEqual(TOT.totalesPedido(a), totalesAntes(a));
      assert.deepEqual(TOT.totalesPedido({ ...a, pctTransferencia: 2 }), totalesAntes(a));
    }
  }
});

test("el valor que ve el cliente y el que se cobra salen de la misma función", () => {
  // El checkout (navegador) y /api/pedidos importan la MISMA totalesPedido; con el mismo % dan lo mismo.
  for (const pct of [0, 1, 2, 2.5, 3.7, 10]) for (const subtotal of [1990, 45_000, 1_234_567]) {
    const vista = TOT.totalesPedido({ subtotal, descuentoCupon: 0, metodoPago: "transferencia", costoDespacho: 4000, pctTransferencia: pct });
    const cobro = TOT.totalesPedido({ subtotal, descuentoCupon: 0, metodoPago: "transferencia", costoDespacho: 4000, pctTransferencia: pct });
    assert.deepEqual(vista, cobro);
    assert.equal(vista.descuentoTransferencia, DT.descuentoTransferencia(subtotal, pct));
    assert.equal(vista.total, subtotal - vista.descuentoTransferencia + 4000);
  }
});

test("con otro porcentaje: ejemplo exacto, decimales sin errores de punto flotante y redondeo a favor del cliente", () => {
  assert.equal(DT.descuentoTransferencia(100_000, 3), 3000);
  assert.equal(DT.descuentoTransferencia(100_000, 2.5), 2500);
  assert.equal(DT.descuentoTransferencia(1000, 1.1), 11); // 1000 * 1.1 en flotante daría 1100.0000000000002 y subiría a 12
  assert.equal(DT.descuentoTransferencia(10_000, 0.3), 30);
  assert.equal(DT.descuentoTransferencia(1999, 3), 60); // 59,97 sube
  assert.equal(DT.descuentoTransferencia(100_000, 0), 0);
  assert.equal(TOT.totalesPedido({ subtotal: 100_000, metodoPago: "transferencia", costoDespacho: 5000, pctTransferencia: 0 }).total, 105_000);
  assert.equal(TOT.totalesPedido({ subtotal: 100_000, metodoPago: "webpay", costoDespacho: 5000, pctTransferencia: 5 }).descuentoTransferencia, 0, "Webpay nunca lleva descuento");
});

test("piso cobrable con otros porcentajes: los productos nunca quedan bajo el piso", () => {
  for (const pct of [0, 2, 5.5, 10]) for (const subtotal of [1500, 20_000, 500_000]) for (const metodoPago of ["webpay", "transferencia"]) {
    const t = TOT.totalesPedido({ subtotal, descuentoCupon: subtotal * 10, metodoPago, costoDespacho: null, pctTransferencia: pct });
    assert.ok(t.total >= TOT.pisoCobrable(subtotal), `${pct}% ${metodoPago} ${subtotal}: ${t.total}`);
    assert.equal(t.total, subtotal - t.descuentoCupon - t.descuentoTransferencia);
  }
});

// ───────── validación del rango ─────────
test("rango válido: de 0 a 10 con un decimal; todo lo demás se rechaza", () => {
  for (const v of [0, 1, 2, 2.5, 9.9, 10, 0.1]) assert.equal(DT.pctTransferenciaValido(v), v, String(v));
  for (const v of [-0.1, 10.1, 11, 100, 2.55, 0.05, Number.NaN, Infinity, "2", null, undefined, true]) assert.equal(DT.pctTransferenciaValido(v), null, String(v));
  assert.equal(DT.leerPctGuardado("2"), 2);
  assert.equal(DT.leerPctGuardado("2.5"), 2.5);
  assert.equal(DT.leerPctGuardado("10"), 10);
  for (const v of ["", " 2", "2 ", "2.55", "11", "-1", "abc", "2,5", "1e1", null, undefined, 2, "10.5"]) assert.equal(DT.leerPctGuardado(v), null, String(v));
  assert.equal(DT.textoPctGuardado(2.5), "2.5");
  assert.equal(DT.textoPctGuardado(3), "3");
  assert.throws(() => DT.textoPctGuardado(11));
  assert.equal(DT.formatoPct(2.5), "2,5");
});

// ───────── lectura con respaldo ─────────
test("lectura: D1 vacía, sin tablas, que lanza o con valor dañado = 2 % de respaldo", async () => {
  const vacia = nuevaDb();
  assert.deepEqual(await CFG.leerDescuentoTransferencia(vacia), { pct: 2, origen: "codigo" });
  const sinTablas = crearD1Simulada({ migraciones: false });
  assert.deepEqual(await CFG.leerDescuentoTransferencia(sinTablas), { pct: 2, origen: "codigo" });
  const rota = { prepare() { throw new Error("D1 caída"); }, async batch() { throw new Error("x"); } };
  assert.deepEqual(await CFG.leerDescuentoTransferencia(rota), { pct: 2, origen: "codigo" });
  for (const dañado of ["abc", "11", "2.55", "-1", "", "2,5", "NaN"]) {
    const db = nuevaDb();
    await poner(db, dañado);
    assert.deepEqual(await CFG.leerDescuentoTransferencia(db), { pct: 2, origen: "codigo" }, dañado);
  }
  const bien = nuevaDb();
  await poner(bien, "3.5");
  assert.deepEqual(await CFG.leerDescuentoTransferencia(bien), { pct: 3.5, origen: "d1" });
});

test("lectura del servidor sin binding de D1 (pruebas, build, dev) = 2 %", async () => {
  CFG.reiniciarPausaDescuento();
  assert.equal(await CFG.pctTransferenciaActual(), 2);
});

test("lectura del servidor: con la D1 caída usa el último valor bueno del isolate (0 % se respeta); isolate frío = 2 %", async () => {
  CFG.reiniciarPausaDescuento();
  let t = T0;
  const ahora = () => t;
  const db0 = nuevaDb();
  await poner(db0, "0");
  assert.equal(await CFG.pctTransferenciaActual({ obtenerDb: async () => db0, ahora }), 0);
  const rota = { prepare() { throw new Error("D1 caída"); }, async batch() { throw new Error("x"); } };
  // cae: sigue 0, no 2
  assert.equal(await CFG.pctTransferenciaActual({ obtenerDb: async () => rota, ahora }), 0);
  // en la pausa tampoco vuelve al 2 %
  t += 5_000;
  assert.equal(await CFG.pctTransferenciaActual({ obtenerDb: async () => db0, ahora }), 0);
  // se recupera con otro valor
  t += 20_000;
  const db1 = nuevaDb();
  await poner(db1, "4.5");
  assert.equal(await CFG.pctTransferenciaActual({ obtenerDb: async () => db1, ahora }), 4.5);
  assert.equal(await CFG.pctTransferenciaActual({ obtenerDb: async () => { throw new Error("sin binding"); }, ahora: () => t + 1 }), 4.5);
  // isolate frío + base caída = 2 % del código
  CFG.reiniciarPausaDescuento();
  assert.equal(await CFG.pctTransferenciaActual({ obtenerDb: async () => rota, ahora }), 2);
  CFG.reiniciarPausaDescuento();
});

// ───────── herramientas ─────────
const registroMio = () => {
  const r = crearRegistro();
  r.agregar(...TD.herramientasDescuentoTransferencia);
  return r;
};

test("anotaciones: ver es de solo lectura; previsualizar y confirmar escriben; solo confirmar deshace", () => {
  const reg = registroMio();
  assert.equal(reg.obtener("ver_descuento_transferencia").anotaciones.readOnlyHint, true);
  assert.equal(reg.obtener("previsualizar_descuento_transferencia").anotaciones.readOnlyHint, false);
  assert.equal(reg.obtener("confirmar_descuento_transferencia").anotaciones.readOnlyHint, false);
  assert.ok(reg.obtener("confirmar_descuento_transferencia").revertidor);
  assert.equal(reg.obtener("previsualizar_descuento_transferencia").revertidor, undefined);
});

test("esquemas estrictos: rango y campos extra", () => {
  const s = TD.previsualizarDescuentoTransferencia.esquema.strict();
  assert.equal(s.safeParse({ pct: 3 }).success, true);
  assert.equal(s.safeParse({ pct: 2.5, subtotal_ejemplo: 50_000 }).success, true);
  for (const malo of [{ pct: -1 }, { pct: 11 }, { pct: "3" }, { pct: 3, extra: 1 }, { pct: 3, subtotal_ejemplo: 0 }, { pct: 3, subtotal_ejemplo: 1.5 }, {}]) assert.equal(s.safeParse(malo).success, false, JSON.stringify(malo));
  assert.equal(TD.confirmarDescuentoTransferencia.esquema.strict().safeParse({ vista_previa_id: "ABC", x: 1 }).success, false);
});

test("las tres herramientas están en el catálogo real del MCP", async () => {
  const { registro } = await import("../src/lib/mcp/tools/index.ts");
  for (const n of ["ver_descuento_transferencia", "previsualizar_descuento_transferencia", "confirmar_descuento_transferencia"]) assert.ok(registro.obtener(n), n);
});

test("ver: muestra valor, origen, ejemplo y dónde se muestra; sin tocar nada", async () => {
  const db = nuevaDb();
  const v = await SRV.verDescuentoTransferencia(db);
  assert.equal(v.datos.pct, 2);
  assert.equal(v.datos.origen, "codigo");
  assert.match(v.texto, /2 %/);
  assert.match(v.texto, /\$100\.000/);
  assert.match(v.texto, /descuento \$2\.000/);
  assert.match(v.texto, /Términos y Condiciones, puntos 14\.2 y 16\.1/);
  assert.equal(await leer(db), null);
  await poner(db, "3");
  assert.equal((await SRV.verDescuentoTransferencia(db, { subtotal_ejemplo: 50_000 })).datos.origen, "d1");
  await assert.rejects(SRV.verDescuentoTransferencia(db, { subtotal_ejemplo: 0 }), /carrito de ejemplo/);
});

test("previsualizar: ejemplo numérico, textos que cambian y advertencia legal; no cambia nada", async () => {
  const db = nuevaDb();
  const ctx = crearCtx(db, JORGE, T0);
  for (const malo of [-1, 10.1, 2.55, Number.NaN, "3"]) await assert.rejects(SRV.previsualizarDescuentoTransferencia(ctx, { pct: malo }), /entre 0 y 10/, String(malo));
  const igual = await SRV.previsualizarDescuentoTransferencia(ctx, { pct: 2 });
  assert.equal(igual.datos.cambia, false);
  const p = await SRV.previsualizarDescuentoTransferencia(ctx, { pct: 3 });
  assert.equal(await leer(db), null, "no escribe el ajuste");
  assert.match(p.texto, /2 % → 3 %/);
  assert.match(p.texto, /Hoy: 2 % → descuento \$2\.000, productos a pagar \$98\.000/);
  assert.match(p.texto, /Después: 3 % → descuento \$3\.000, productos a pagar \$97\.000/);
  assert.match(p.texto, /«2% de descuento» → «3% de descuento»/);
  assert.match(p.texto, /TEXTO LEGAL/);
  assert.match(p.texto, /puntos 14\.2 y 16\.1/);
  assert.equal(p.datos.ejemplo.descuento_despues, 3000);
  assert.ok(p.datos.advertencia_legal);
  assert.match(p.datos.vista_previa_id, /^[2-9A-HJKMNP-Z]{12}$/);
  const cero = await SRV.previsualizarDescuentoTransferencia(ctx, { pct: 0, subtotal_ejemplo: 80_000 });
  assert.match(cero.texto, /la etiqueta desaparece/);
  assert.match(cero.texto, /carrito de \$80\.000/);
});

test("cambiar: dos pasos, SIEMPRE con aprobación, un solo uso, auditoría y deshacer con aprobación", async () => {
  const db = nuevaDb();
  const T = crearTienda([]);
  fijarDepsGestion(T.deps);
  try {
    const reg = registroMio();
    const prev = await SRV.previsualizarDescuentoTransferencia(crearCtx(db, JORGE, T0), { pct: 3 });
    const id = prev.datos.vista_previa_id;
    const conf = (t) => crearCtx(db, JORGE, t, "confirmar_descuento_transferencia");

    // 1) sin aprobación: queda pendiente, manda un correo y NO cambia nada
    const p1 = await SRV.confirmarDescuentoTransferencia(T.deps, conf(T0 + 1), { vista_previa_id: id });
    assert.equal(p1.datos.aplicado, false);
    assert.equal(p1.datos.estado, "pendiente");
    assert.equal(T.correos.length, 1);
    assert.equal(await leer(db), null);
    // repetir no manda otro correo
    await SRV.confirmarDescuentoTransferencia(T.deps, conf(T0 + 2), { vista_previa_id: id });
    assert.equal(T.correos.length, 1);

    // 2) otro usuario no puede usar la vista previa
    await assert.rejects(SRV.confirmarDescuentoTransferencia(T.deps, crearCtx(db, OTRO, T0 + 3), { vista_previa_id: id }), /No encontré esa vista previa/);

    // 3) Jorge aprueba; al repetir se aplica
    await aprobarUltimoCorreo(db, T.correos, resolverAprobacion);
    const c = conf(T0 + 4);
    const ok = await SRV.confirmarDescuentoTransferencia(T.deps, c, { vista_previa_id: id });
    assert.equal(ok.datos.aplicado, true);
    assert.equal(await leer(db), "3");
    assert.deepEqual(await CFG.leerDescuentoTransferencia(db), { pct: 3, origen: "d1" });
    assert.match(ok.texto, /Términos/);
    const lote = await obtenerLote(db, c.loteId);
    assert.equal(lote.length, 1);
    assert.equal(lote[0].entidad, "ajuste");
    assert.deepEqual(JSON.parse(JSON.stringify(lote[0].antes)), { pct: 2 });
    assert.deepEqual(JSON.parse(JSON.stringify(lote[0].despues)), { pct: 3 });
    assert.equal(lote[0].usuarioId, "1");

    // 4) un solo uso
    await assert.rejects(SRV.confirmarDescuentoTransferencia(T.deps, conf(T0 + 5), { vista_previa_id: id }), /ya se aplicó/);

    // 5) el cálculo del pedido toma el valor nuevo
    assert.equal(TOT.totalesPedido({ subtotal: 100_000, metodoPago: "transferencia", costoDespacho: null, pctTransferencia: (await CFG.leerDescuentoTransferencia(db)).pct }).descuentoTransferencia, 3000);

    // 6) deshacer NO es puerta trasera: también pide el OK de Jorge
    const intento = await deshacerLote(db, reg, c.loteId, JORGE, T0 + 6);
    assert.equal(intento.ok, false);
    assert.match(intento.mensaje, /pendiente de Jorge/);
    assert.equal(await leer(db), "3");
    assert.equal(T.correos.length, 2);
    await deshacerLote(db, reg, c.loteId, JORGE, T0 + 7);
    assert.equal(T.correos.length, 2, "sigue pendiente: no manda otro correo");
    await aprobarUltimoCorreo(db, T.correos, resolverAprobacion);
    const des = await deshacerLote(db, reg, c.loteId, JORGE, T0 + 8);
    assert.equal(des.ok, true);
    assert.equal((await CFG.leerDescuentoTransferencia(db)).pct, 2);
  } finally {
    fijarDepsGestion(null);
  }
});

test("si alguien cambió el valor entre la vista previa y la confirmación, se rechaza; y deshacer no pisa cambios ajenos", async () => {
  const db = nuevaDb();
  const T = crearTienda([]);
  fijarDepsGestion(T.deps);
  try {
    const reg = registroMio();
    const prev = await SRV.previsualizarDescuentoTransferencia(crearCtx(db, JORGE, T0), { pct: 4 });
    await poner(db, "5"); // alguien lo cambió en medio
    await assert.rejects(SRV.confirmarDescuentoTransferencia(T.deps, crearCtx(db, JORGE, T0 + 1), { vista_previa_id: prev.datos.vista_previa_id }), /datos cambiaron/);
    assert.equal(T.correos.length, 0);
    assert.equal(await leer(db), "5");

    // Aplica 4 con aprobación (desde 5), luego alguien lo deja en 7: deshacer no lo toca.
    const prev2 = await SRV.previsualizarDescuentoTransferencia(crearCtx(db, JORGE, T0 + 2), { pct: 4 });
    const conf = (t) => crearCtx(db, JORGE, t, "confirmar_descuento_transferencia");
    await SRV.confirmarDescuentoTransferencia(T.deps, conf(T0 + 3), { vista_previa_id: prev2.datos.vista_previa_id });
    await aprobarUltimoCorreo(db, T.correos, resolverAprobacion);
    const c = conf(T0 + 4);
    assert.equal((await SRV.confirmarDescuentoTransferencia(T.deps, c, { vista_previa_id: prev2.datos.vista_previa_id })).datos.aplicado, true);
    await poner(db, "7");
    const r = await deshacerLote(db, reg, c.loteId, JORGE, T0 + 5);
    assert.equal(r.ok, false);
    assert.match(r.mensaje, /alguien cambió/);
    assert.equal(await leer(db), "7");
    assert.equal(T.correos.length, 1, "ni siquiera pidió aprobación: hay conflicto");
  } finally {
    fijarDepsGestion(null);
  }
});

test("sin correo del aprobador queda BLOQUEADO y no se escribe nada; rechazado tampoco aplica", async () => {
  const db = nuevaDb();
  const T = crearTienda([]);
  fijarDepsGestion(T.deps);
  try {
    const prev = await SRV.previsualizarDescuentoTransferencia(crearCtx(db, JORGE, T0), { pct: 6 });
    T.estadoAprobador.email = null;
    const b = await SRV.confirmarDescuentoTransferencia(T.deps, crearCtx(db, JORGE, T0 + 1), { vista_previa_id: prev.datos.vista_previa_id });
    assert.equal(b.datos.estado, "bloqueada");
    assert.equal(await leer(db), null);
    T.estadoAprobador.email = "jorge@example.com";
    await SRV.confirmarDescuentoTransferencia(T.deps, crearCtx(db, JORGE, T0 + 2), { vista_previa_id: prev.datos.vista_previa_id });
    const token = T.correos[T.correos.length - 1].enlace.split("/aprobar/")[1];
    await resolverAprobacion(db, token, "rechazar");
    const r = await SRV.confirmarDescuentoTransferencia(T.deps, crearCtx(db, JORGE, T0 + 3), { vista_previa_id: prev.datos.vista_previa_id });
    assert.equal(r.datos.estado, "rechazada");
    assert.equal(await leer(db), null);
  } finally {
    fijarDepsGestion(null);
  }
});

test("la vista previa vence y la aprobación de otro cambio no sirve para este", async () => {
  const db = nuevaDb();
  const T = crearTienda([]);
  fijarDepsGestion(T.deps);
  try {
    const p3 = await SRV.previsualizarDescuentoTransferencia(crearCtx(db, JORGE, T0), { pct: 3 });
    await assert.rejects(SRV.confirmarDescuentoTransferencia(T.deps, crearCtx(db, JORGE, T0 + 6 * 3_600_000), { vista_previa_id: p3.datos.vista_previa_id }), /venció/);
    // Aprobado el 3, no sirve para el 8: la huella cambia.
    await SRV.confirmarDescuentoTransferencia(T.deps, crearCtx(db, JORGE, T0 + 1), { vista_previa_id: (await SRV.previsualizarDescuentoTransferencia(crearCtx(db, JORGE, T0 + 1), { pct: 3 })).datos.vista_previa_id });
    await aprobarUltimoCorreo(db, T.correos, resolverAprobacion);
    const p8 = await SRV.previsualizarDescuentoTransferencia(crearCtx(db, JORGE, T0 + 2), { pct: 8 });
    const r = await SRV.confirmarDescuentoTransferencia(T.deps, crearCtx(db, JORGE, T0 + 3), { vista_previa_id: p8.datos.vista_previa_id });
    assert.equal(r.datos.aplicado, false);
    assert.equal(await leer(db), null);
  } finally {
    fijarDepsGestion(null);
  }
});
