// Pruebas de productos, precios masivos (dos pasos), centro de reglas de aprobación,
// despacho, deshacer y herramientas. Tienda falsa en memoria + D1 simulada (sin red).
// Correr: node --test scripts/gestion-precios.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";
import { aprobarUltimoCorreo, crearCtx, crearTienda, ficha } from "./pruebas/tienda-falsa.mjs";

const M = await import("../src/lib/gestion-precios/modelo.ts");
const P = await import("../src/lib/gestion-precios/plan.ts");
const R = await import("../src/lib/gestion-precios/reglas.ts");
const Pre = await import("../src/lib/gestion-precios/precios-masivos.ts");
const Prod = await import("../src/lib/gestion-precios/productos-servicio.ts");
const Con = await import("../src/lib/gestion-precios/consultas.ts");
const Des = await import("../src/lib/gestion-precios/despacho-servicio.ts");
const { resolverAprobacion } = await import("../src/lib/mcp/aprobaciones.ts");
const { obtenerLote } = await import("../src/lib/gestion/index.ts");
const { deshacerLote } = await import("../src/lib/mcp/deshacer.ts");
const { crearRegistro } = await import("../src/lib/mcp/tools/registro.ts");
const { resolvePrice } = await import("../src/lib/pricing.ts");
const { vistaPrecio } = await import("../src/lib/precio-web.ts");
const TP = await import("../src/lib/mcp/tools/productos.ts");
const TPr = await import("../src/lib/mcp/tools/precios.ts");
const TD = await import("../src/lib/mcp/tools/despacho.ts");
const TO = await import("../src/lib/mcp/tools/ofertas.ts");
const { fijarDepsGestion } = await import("../src/lib/mcp/tools/productos-comun.ts");

const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const JORGE = { id: "1", email: "contacto@jurmaq.cl" };
const OTRO = { id: "2", email: "otro@example.com" };
const nuevaDb = () => crearD1Simulada();

const registroMio = () => {
  const r = crearRegistro();
  r.agregar(TP.buscarProductos, TP.verProducto, TP.listarCategorias, TP.verMargenes, TP.editarProducto, TP.crearProducto, TP.crearCategoria, TP.editarCategoria,
    TPr.previsualizarPrecios, TPr.confirmarPrecios, TD.verZonasDespacho, TD.cambiarDespacho, TO.programarOferta, TO.verOfertas, TO.cancelarOferta);
  return r;
};

// ───────── modelo y redondeo ─────────
test("redondeo a pesos enteros: el más cercano, la mitad sube", () => {
  assert.equal(M.precioBajoLocal(1990, 500), 1891); // 1890,5
  assert.equal(M.precioBajoLocal(1000, 500), 950);
  assert.equal(M.precioBajoLocal(999, 500), 949); // 949,05
  assert.equal(M.precioBajoLocal(1010, 500), 960); // 959,5
  assert.equal(M.reajustarPrecio(1000, -1000), 900);
  assert.equal(M.reajustarPrecio(1005, 1000), 1106); // 1105,5
  assert.equal(M.porcentajeABp(5), 500);
  assert.equal(M.porcentajeABp(7.5), 750);
  assert.equal(M.porcentajeABp(0.01), 1);
  assert.equal(M.porcentajeABp(0.125), null);
  assert.equal(M.porcentajeABp(Number.NaN), null);
});

test("pesos válidos: nunca 0, negativo ni decimal", () => {
  for (const v of [0, -1, 10.5, Number.NaN, Infinity, "5", null, undefined, 200_000_000]) assert.equal(M.esPesosValido(v), false, String(v));
  assert.equal(M.esPesosValido(1), true);
  assert.deepEqual(M.construirEstado(1000, 950), { precio: 950, precio_original: 1000, en_oferta: true });
  assert.deepEqual(M.construirEstado(1000, 1000), { precio: 1000, precio_original: null, en_oferta: false });
  assert.throws(() => M.construirEstado(900, 1000));
  assert.equal(M.pesos(12990), "$12.990");
});

// ───────── caso exacto: local = precio normal, web = 5 % menos ─────────
test("local = precio normal (tachado) y web = 5 % menos; la tienda cobra el web y muestra el tachado", () => {
  const plan = P.planificarDescuentoWeb([ficha({ id: 1, codigo: "A1", precio: 1000 })], 500, ["A1"]);
  assert.equal(plan.cambios.length, 1);
  assert.deepEqual(plan.cambios[0].despues, { precio: 950, precio_original: 1000, en_oferta: true });
  assert.match(plan.formula, /precio local − 5 %/);
  assert.match(plan.formula, /más cercano/);
  const r = resolvePrice(plan.cambios[0].despues);
  assert.equal(r.precioFinal, 950);
  assert.equal(r.precioTachado, 1000);
  const v = vistaPrecio({ ...plan.cambios[0].despues, stock: 5 });
  assert.equal(v.precioWeb, 950);
  assert.equal(v.precioNormal, 1000);
  assert.equal(v.ahorroPct, 5);
});

test("el descuento es idempotente y parte del tachado actual", () => {
  const yaAplicado = P.planificarDescuentoWeb([ficha({ precio: 950, precio_original: 1000, en_oferta: true })], 500);
  assert.equal(yaAplicado.cambios.length, 0);
  assert.equal(yaAplicado.sinCambio, 1);
  const conTachado = P.planificarDescuentoWeb([ficha({ precio: 1800, precio_original: 2000, en_oferta: true })], 500);
  assert.deepEqual(conTachado.cambios[0].despues, { precio: 1900, precio_original: 2000, en_oferta: true });
  const sinPrecio = P.planificarDescuentoWeb([ficha({ id: 9, codigo: "Z", precio: 0 })], 500);
  assert.equal(sinPrecio.invalidos.length, 1);
});

// ───────── por lista y duplicados por código ─────────
const trio = () => [
  ficha({ id: 1, codigo: "D1", precio: 1000 }), ficha({ id: 2, codigo: "D1", precio: 1000 }), ficha({ id: 3, codigo: "D1", precio: 1000 }),
  ficha({ id: 4, codigo: "U1", precio: 500 }),
];

test("un cambio por código llega a TODAS sus fichas duplicadas (por código y por id)", () => {
  const a = P.planificarLista([{ codigo: "D1", precio_local: 2000, precio_web: 1900 }], trio());
  assert.deepEqual(a.cambios.map((c) => c.id), [1, 2, 3]);
  for (const c of a.cambios) assert.deepEqual(c.despues, { precio: 1900, precio_original: 2000, en_oferta: true });
  const b = P.planificarLista([{ id: 2, precio_web: 1500 }], trio());
  assert.deepEqual(b.cambios.map((c) => c.id), [1, 2, 3]);
  assert.deepEqual(b.cambios[0].despues, { precio: 1500, precio_original: null, en_oferta: false });
});

test("lista: repetidos, no encontrados y precios malos se informan sin tocar nada", () => {
  const rep = P.planificarLista([{ codigo: "D1", precio_web: 900 }, { codigo: "D1", precio_web: 800 }], trio());
  assert.equal(rep.invalidos.length, 1);
  assert.equal(rep.cambios.length, 3);
  assert.deepEqual(P.planificarLista([{ codigo: "ZZ", precio_web: 5 }], trio()).noEncontrados, ["ZZ"]);
  for (const malo of [0, -5, 10.5, Number.NaN, "900"]) {
    const p = P.planificarLista([{ codigo: "U1", precio_web: malo }], trio());
    assert.equal(p.invalidos.length, 1, String(malo));
    assert.equal(p.cambios.length, 0);
  }
  assert.equal(P.planificarLista([{ codigo: "U1" }], trio()).invalidos.length, 1);
  assert.equal(P.planificarLista([{ codigo: "U1", precio_local: 400, precio_web: 450 }], trio()).invalidos.length, 1);
  assert.equal(P.planificarLista([{ codigo: "U1", precio_local: 300 }], trio()).invalidos.length, 1);
  const conTachado = [ficha({ id: 7, codigo: "T", precio: 800, precio_original: 1000, en_oferta: true })];
  const p = P.planificarLista([{ codigo: "T", precio_web: 1200 }], conTachado);
  assert.match(p.invalidos[0].motivo, /Indica también el nuevo precio local/);
});

test("resumen: mayores subidas y bajadas, bajo costo y menos de 15 %", () => {
  const fichas = [
    ficha({ id: 1, codigo: "A", precio: 1000, costo: 1000 }), ficha({ id: 2, codigo: "B", precio: 2000, costo: 1000 }),
    ficha({ id: 3, codigo: "C", precio: 2000, costo: 1000 }), ficha({ id: 4, codigo: "D", precio: 100 }),
  ];
  const plan = P.planificarLista([
    { codigo: "A", precio_web: 1100 }, // 10 % sobre costo: menos de 15
    { codigo: "B", precio_web: 900 }, // bajo costo
    { codigo: "C", precio_web: 2400 }, // sube 20 %
    { codigo: "D", precio_web: 150 }, // sube 50 %
  ], fichas);
  const r = P.resumirPlan(plan);
  assert.equal(r.productosQueCambian, 4);
  assert.equal(r.bajoCosto.total, 1);
  assert.equal(r.menos15.total, 1);
  assert.equal(r.mayoresSubidas[0].codigo, "D");
  assert.equal(r.mayoresBajadas[0].codigo, "B");
});

// ───────── centro de reglas ─────────
test("evaluarCambioPrecios: bajo costo, 15 %, 30 % y banderas", async () => {
  const db = nuevaDb();
  const base = { usuarioId: "1", ahora: T0 };
  const c = (precioDespues, extra = {}) => ({ clave: "X", precioAntes: 1500, precioDespues, costo: 1000, ...extra });
  assert.equal((await R.evaluarCambioPrecios(db, { ...base, cambios: [c(1300)] })).requiere, false);
  assert.deepEqual((await R.evaluarCambioPrecios(db, { ...base, cambios: [c(1100)] })).motivos, ["margen_menor_15"]);
  assert.deepEqual((await R.evaluarCambioPrecios(db, { ...base, cambios: [c(900, { precioAntes: 1200 })] })).motivos, ["precio_bajo_costo"]);
  assert.deepEqual((await R.evaluarCambioPrecios(db, { ...base, cambios: [c(1300)], banderas: ["despacho"] })).motivos, ["despacho"]);
  assert.deepEqual((await R.evaluarCambioPrecios(db, { ...base, cambios: [c(2400, { costo: null })] })).motivos, ["variacion_precio"]);
});

test("las fichas repetidas cuentan como un solo producto", async () => {
  const db = nuevaDb();
  const cambios = Array.from({ length: 400 }, () => ({ clave: "MISMO", precioAntes: 1000, precioDespues: 990, costo: 100 }));
  const e = await R.evaluarCambioPrecios(db, { usuarioId: "1", cambios, ahora: T0 });
  assert.equal(e.productos, 1);
  assert.equal(e.requiere, false);
});

// ───────── dos pasos ─────────
const fichasSimples = (n, extra = {}) => Array.from({ length: n }, (_, i) => ficha({ id: i + 1, codigo: `P${i}`, precio: 1000, costo: 100, ...extra }));

test("previsualizar no cambia la tienda; confirmar aplica con auditoría y refresca", async () => {
  const db = nuevaDb();
  const T = crearTienda([ficha({ id: 1, codigo: "A", precio: 1000, costo: 500 }), ficha({ id: 2, codigo: "A", precio: 1000, costo: 500 })]);
  const prev = await Pre.previsualizarPrecios(T.deps, crearCtx(db, JORGE, T0), { por: "porcentaje", codigos: ["A"], descuento_web_pct: 5 });
  assert.match(prev.texto, /Fórmula/);
  assert.equal(prev.datos.requiere_aprobacion, false);
  assert.equal(T.filas[0].precio, 1000);
  assert.equal(T.contadores.escrituras, 0);
  const ctx = crearCtx(db, JORGE, T0 + 1000, "confirmar_precios");
  const r = await Pre.confirmarPrecios(T.deps, ctx, { vista_previa_id: prev.datos.vista_previa_id });
  assert.equal(r.datos.aplicado, true);
  assert.equal(r.datos.fichas, 2);
  assert.deepEqual(T.filas.map((f) => [f.precio, f.precio_original, f.en_oferta]), [[950, 1000, true], [950, 1000, true]]);
  const lote = await obtenerLote(db, ctx.loteId);
  assert.equal(lote.length, 2);
  assert.equal(lote[0].antes.precio, 1000);
  assert.equal(lote[0].despues.precio, 950);
  assert.deepEqual(T.contadores.revalidados[0].sort(), [1, 2]);
});

test("el id sirve una sola vez, es del usuario, vence y se rechaza si los datos cambiaron", async () => {
  const db = nuevaDb();
  const T = crearTienda([ficha({ id: 1, codigo: "A", precio: 1000 })]);
  const nueva = async () => (await Pre.previsualizarPrecios(T.deps, crearCtx(db, JORGE, T0), { por: "porcentaje", codigos: ["A"], descuento_web_pct: 10 })).datos.vista_previa_id;
  // otro usuario
  let id = await nueva();
  await assert.rejects(Pre.confirmarPrecios(T.deps, crearCtx(db, OTRO, T0 + 1), { vista_previa_id: id }), /No encontré esa vista previa/);
  // vencida
  await assert.rejects(Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, T0 + 16 * 60_000), { vista_previa_id: id }), /venció/);
  // datos cambiados entre medio: no se aplica nada
  T.filas[0].precio = 1200;
  await assert.rejects(Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, T0 + 1000), { vista_previa_id: id }), /cambiaron/);
  assert.equal(T.filas[0].precio, 1200);
  // un solo uso
  T.filas[0].precio = 1000;
  id = await nueva();
  await Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, T0 + 1000), { vista_previa_id: id });
  await assert.rejects(Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, T0 + 2000), { vista_previa_id: id }), /ya se aplicó/);
  await assert.rejects(Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, T0 + 2000), { vista_previa_id: "ABCDEF" }), /No encontré/);
});

test("una ficha que alguien cambia justo al aplicar no se pisa", async () => {
  const db = nuevaDb();
  const T = crearTienda([ficha({ id: 1, codigo: "A", precio: 1000 }), ficha({ id: 2, codigo: "B", precio: 1000 })]);
  const prev = await Pre.previsualizarPrecios(T.deps, crearCtx(db, JORGE, T0), { por: "porcentaje", codigos: ["A", "B"], descuento_web_pct: 5 });
  const original = T.deps.productos.actualizar;
  T.deps.productos.actualizar = async (id, campos, esperado) => { if (id === 2) T.filas[1].precio = 1111; return original(id, campos, esperado); };
  const r = await Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, T0 + 1000), { vista_previa_id: prev.datos.vista_previa_id });
  assert.equal(r.datos.fichas, 1);
  assert.equal(r.datos.no_aplicadas, 1);
  assert.equal(T.filas[1].precio, 1111);
  assert.match(r.texto, /alguien cambió su precio/);
});

test("más de 300 productos: queda pendiente de Jorge, se aplica solo tras su OK y la aprobación sirve una vez", async () => {
  const db = nuevaDb();
  const T = crearTienda(fichasSimples(301));
  const codigos = T.filas.map((f) => f.codigo);
  const prev = await Pre.previsualizarPrecios(T.deps, crearCtx(db, JORGE, T0), { por: "porcentaje", codigos, descuento_web_pct: 5 });
  assert.equal(prev.datos.requiere_aprobacion, true);
  const id = prev.datos.vista_previa_id;
  const c1 = await Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, T0 + 1000), { vista_previa_id: id });
  assert.match(c1.texto, /necesita el OK de Jorge/);
  assert.equal(c1.datos.aplicado, false);
  assert.equal(T.correos.length, 1);
  assert.equal(T.contadores.escrituras, 0);
  const c2 = await Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, T0 + 2000), { vista_previa_id: id });
  assert.match(c2.texto, /sigue esperando/);
  assert.equal(T.correos.length, 1, "no manda otro correo");
  assert.equal((await aprobarUltimoCorreo(db, T.correos, resolverAprobacion)).ok, true);
  const c3 = await Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, T0 + 3000), { vista_previa_id: id });
  assert.equal(c3.datos.aplicado, true);
  assert.equal(T.contadores.escrituras, 301);
  assert.match(c3.texto, /aprobado por Jorge/);
  // una aprobación gastada no sirve para repetir (la vista previa tampoco)
  await assert.rejects(Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, T0 + 4000), { vista_previa_id: id }), /ya se aplicó/);
});

test("sin correo del aprobador la acción queda BLOQUEADA y no se aplica", async () => {
  const db = nuevaDb();
  const T = crearTienda(fichasSimples(301), { aprobadorEmail: null });
  const prev = await Pre.previsualizarPrecios(T.deps, crearCtx(db, JORGE, T0), { por: "porcentaje", codigos: T.filas.map((f) => f.codigo), descuento_web_pct: 5 });
  const r = await Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, T0 + 1000), { vista_previa_id: prev.datos.vista_previa_id });
  assert.equal(r.datos.estado, "bloqueada");
  assert.match(r.texto, /bloqueado/);
  assert.equal(T.contadores.escrituras, 0);
  // y si el correo no sale
  T.estadoAprobador.email = "jorge@example.com";
  T.estadoAprobador.correoCae = true;
  const r2 = await Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, T0 + 2000), { vista_previa_id: prev.datos.vista_previa_id });
  assert.equal(r2.datos.estado, "bloqueada");
  assert.equal(T.contadores.escrituras, 0);
});

test("bajo el costo o con menos de 15 % pide aprobación; con 15 % o más pasa directo", async () => {
  const db = nuevaDb();
  const T = crearTienda([ficha({ id: 1, codigo: "A", precio: 1500, costo: 1000 })]);
  const prueba = async (web) => (await Pre.previsualizarPrecios(T.deps, crearCtx(db, JORGE, T0), { por: "lista", items: [{ codigo: "A", precio_web: web }] })).datos;
  const bajo = await prueba(900);
  assert.equal(bajo.requiere_aprobacion, true);
  assert.equal(bajo.resumen.bajoCosto.total, 1);
  const delgado = await prueba(1100);
  assert.equal(delgado.resumen.menos15.total, 1);
  assert.equal(delgado.requiere_aprobacion, true);
  const bien = await prueba(1200);
  assert.equal(bien.requiere_aprobacion, false);
});

test("dividir un masivo en varios chicos no evade el umbral de 300 productos", async () => {
  const db = nuevaDb();
  const T = crearTienda(fichasSimples(400));
  const parte = (i) => T.filas.slice(i * 100, i * 100 + 100).map((f) => f.codigo);
  for (let i = 0; i < 3; i++) {
    const prev = await Pre.previsualizarPrecios(T.deps, crearCtx(db, JORGE, T0 + i * 10), { por: "porcentaje", codigos: parte(i), descuento_web_pct: 5 });
    assert.equal(prev.datos.requiere_aprobacion, false, `parte ${i}`);
    const r = await Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, T0 + i * 10 + 5), { vista_previa_id: prev.datos.vista_previa_id });
    assert.equal(r.datos.aplicado, true);
  }
  const cuarta = await Pre.previsualizarPrecios(T.deps, crearCtx(db, JORGE, T0 + 100), { por: "porcentaje", codigos: parte(3), descuento_web_pct: 5 });
  assert.equal(cuarta.datos.requiere_aprobacion, true);
  const r = await Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, T0 + 110), { vista_previa_id: cuarta.datos.vista_previa_id });
  assert.equal(r.datos.aplicado, false);
  assert.equal(T.contadores.escrituras, 300);
});

test("variación acumulada de más de 30 % en 24 h sobre un mismo producto pide aprobación", async () => {
  const db = nuevaDb();
  const T = crearTienda([ficha({ id: 1, codigo: "A", precio: 1000 })]);
  const cambiar = async (web, t) => {
    const prev = await Pre.previsualizarPrecios(T.deps, crearCtx(db, JORGE, t), { por: "lista", items: [{ codigo: "A", precio_web: web }] });
    return { prev, r: await Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, t + 5), { vista_previa_id: prev.datos.vista_previa_id }) };
  };
  const a = await cambiar(800, T0);
  assert.equal(a.r.datos.aplicado, true);
  const b = await cambiar(640, T0 + 1000);
  assert.equal(b.prev.datos.requiere_aprobacion, true);
  assert.equal(b.r.datos.aplicado, false);
  assert.equal(T.filas[0].precio, 800);
});

test("masivo por categoría: reajuste y descuento, con subcategorías", async () => {
  const db = nuevaDb();
  const T = crearTienda(
    [ficha({ id: 1, codigo: "A", precio: 1000, categoria_id: 10 }), ficha({ id: 2, codigo: "B", precio: 2000, categoria_id: 11 }), ficha({ id: 3, codigo: "C", precio: 500, categoria_id: 20 })],
    { categorias: [{ id: 10 }, { id: 11, padre_id: 10 }, { id: 20 }] },
  );
  const prev = await Pre.previsualizarPrecios(T.deps, crearCtx(db, JORGE, T0), { por: "categoria", categoria_id: 10, reajuste_pct: 10 });
  assert.equal(prev.datos.resumen.productosQueCambian, 2);
  await Pre.confirmarPrecios(T.deps, crearCtx(db, JORGE, T0 + 1), { vista_previa_id: prev.datos.vista_previa_id });
  assert.deepEqual(T.filas.map((f) => f.precio), [1100, 2200, 500]);
  await assert.rejects(Pre.previsualizarPrecios(T.deps, crearCtx(db, JORGE, T0), { por: "categoria", categoria_id: 10 }), /una sola cosa/);
  await assert.rejects(Pre.previsualizarPrecios(T.deps, crearCtx(db, JORGE, T0), { por: "categoria", categoria_id: 99, reajuste_pct: 5 }), /No encontré esa categoría/);
});

// ───────── deshacer sin pisar ─────────
test("deshacer restaura, no pisa lo cambiado después, y es repetible", async () => {
  const db = nuevaDb();
  const reg = registroMio();
  const T = crearTienda([ficha({ id: 1, codigo: "A", precio: 1000 }), ficha({ id: 2, codigo: "B", precio: 1000 })]);
  fijarDepsGestion(T.deps);
  try {
    const prev = await Pre.previsualizarPrecios(T.deps, crearCtx(db, JORGE, T0), { por: "porcentaje", codigos: ["A", "B"], descuento_web_pct: 10 });
    const ctx = crearCtx(db, JORGE, T0 + 10, "confirmar_precios");
    await Pre.confirmarPrecios(T.deps, ctx, { vista_previa_id: prev.datos.vista_previa_id });
    T.filas[1].precio = 777; // alguien lo cambia después
    const r = await deshacerLote(db, reg, ctx.loteId, JORGE, T0 + 100);
    assert.equal(r.ok, true);
    assert.match(r.mensajes[0], /NO se tocaron/);
    assert.equal(T.filas[0].precio, 1000);
    assert.equal(T.filas[0].en_oferta, false);
    assert.equal(T.filas[1].precio, 777);
    assert.equal((await deshacerLote(db, reg, ctx.loteId, JORGE, T0 + 200)).motivo, "ya_deshecho");
  } finally {
    fijarDepsGestion(null);
  }
});

test("si todo cambió después, no se deshace nada y el lote sigue vigente", async () => {
  const db = nuevaDb();
  const reg = registroMio();
  const T = crearTienda([ficha({ id: 1, codigo: "A", precio: 1000 })]);
  fijarDepsGestion(T.deps);
  try {
    const prev = await Pre.previsualizarPrecios(T.deps, crearCtx(db, JORGE, T0), { por: "porcentaje", codigos: ["A"], descuento_web_pct: 10 });
    const ctx = crearCtx(db, JORGE, T0 + 10, "confirmar_precios");
    await Pre.confirmarPrecios(T.deps, ctx, { vista_previa_id: prev.datos.vista_previa_id });
    T.filas[0].precio = 5;
    const r = await deshacerLote(db, reg, ctx.loteId, JORGE, T0 + 100);
    assert.equal(r.ok, false);
    assert.equal(T.filas[0].precio, 5);
    assert.equal((await obtenerLote(db, ctx.loteId))[0].deshechoEn, null);
  } finally {
    fijarDepsGestion(null);
  }
});

// ───────── editar y crear producto ─────────
test("editar producto: llega a todas las fichas del código y se deshace", async () => {
  const db = nuevaDb();
  const reg = registroMio();
  const T = crearTienda(trio());
  fijarDepsGestion(T.deps);
  try {
    const ctx = crearCtx(db, JORGE, T0, "editar_producto");
    const r = await TP.editarProducto.ejecutar({ codigo: "D1", stock: 5, nombre: "<b>Cemento</b> 25 kg" }, ctx);
    assert.match(r.texto, /3 ficha/);
    assert.deepEqual(T.filas.slice(0, 3).map((f) => [f.stock, f.nombre]), [[5, "Cemento 25 kg"], [5, "Cemento 25 kg"], [5, "Cemento 25 kg"]]);
    assert.equal(T.filas[3].stock, 10);
    assert.equal((await deshacerLote(db, reg, ctx.loteId, JORGE, T0 + 5)).ok, true);
    assert.deepEqual(T.filas.slice(0, 3).map((f) => f.stock), [10, 10, 10]);
    await assert.rejects(TP.editarProducto.ejecutar({ codigo: "NOEXISTE", stock: 1 }, ctx), { name: "ErrorHerramienta" });
  } finally {
    fijarDepsGestion(null);
  }
});

test("editar producto: precio bajo el costo queda pendiente y se aplica tras el OK al repetir", async () => {
  const db = nuevaDb();
  const T = crearTienda([ficha({ id: 1, codigo: "A", precio: 2000, costo: 1000 }), ficha({ id: 2, codigo: "A", precio: 2000, costo: 1000 })]);
  const ctx = (t) => crearCtx(db, JORGE, t, "editar_producto");
  const p1 = await Prod.editarProducto(T.deps, ctx(T0), { codigo: "A", precio_web: 900 });
  assert.match(p1.texto, /necesita el OK de Jorge/);
  assert.equal(T.filas[0].precio, 2000);
  assert.equal(T.correos.length, 1);
  const p2 = await Prod.editarProducto(T.deps, ctx(T0 + 1), { codigo: "A", precio_web: 900 });
  assert.match(p2.texto, /sigue esperando/);
  assert.equal(T.correos.length, 1);
  await aprobarUltimoCorreo(db, T.correos, resolverAprobacion);
  const p3 = await Prod.editarProducto(T.deps, ctx(T0 + 2), { codigo: "A", precio_web: 900 });
  assert.equal(p3.datos.aplicado, true);
  assert.deepEqual(T.filas.map((f) => f.precio), [900, 900]);
  // otro usuario no puede gastar la aprobación de Jorge
  const T2 = crearTienda([ficha({ id: 1, codigo: "A", precio: 2000, costo: 1000 })]);
  await Prod.editarProducto(T2.deps, crearCtx(db, JORGE, T0 + 3, "editar_producto"), { codigo: "A", precio_web: 950 });
  await aprobarUltimoCorreo(db, T2.correos, resolverAprobacion);
  const o = await Prod.editarProducto(T2.deps, crearCtx(db, OTRO, T0 + 4, "editar_producto"), { codigo: "A", precio_web: 950 });
  assert.equal(o.datos.aplicado, false);
  assert.equal(T2.filas[0].precio, 2000);
});

test("editar producto: validaciones (imagen ajena, combo, precios) y precio local", async () => {
  const db = nuevaDb();
  const T = crearTienda([ficha({ id: 1, codigo: "A", precio: 1000 })]);
  const ctx = () => crearCtx(db, JORGE, T0, "editar_producto");
  await assert.rejects(Prod.editarProducto(T.deps, ctx(), { codigo: "A", imagen: "https://evil.example/x.jpg" }), /Esa imagen no vale/);
  await assert.rejects(Prod.editarProducto(T.deps, ctx(), { codigo: "A", precio_web: 0 }), /entero de pesos/);
  await assert.rejects(Prod.editarProducto(T.deps, ctx(), { codigo: "A", precio_web: 10.5 }), /entero de pesos/);
  await assert.rejects(Prod.editarProducto(T.deps, ctx(), { codigo: "A", combo_cantidad: 3, combo_precio: 3500 }), /no ahorra nada/);
  await assert.rejects(Prod.editarProducto(T.deps, ctx(), { codigo: "A", combo_cantidad: 1, combo_precio: 900 }), /entre 2 y 999/);
  await Prod.editarProducto(T.deps, ctx(), { codigo: "A", combo_cantidad: 3, combo_precio: 2700, imagen: "/images/barraca/nueva.webp" });
  assert.equal(T.filas[0].combo_cantidad, 3);
  assert.equal(T.filas[0].imagen, "/images/barraca/nueva.webp");
  await Prod.editarProducto(T.deps, ctx(), { codigo: "A", precio_local: 1100 });
  assert.deepEqual([T.filas[0].precio, T.filas[0].precio_original, T.filas[0].en_oferta], [1000, 1100, true]);
  await Prod.editarProducto(T.deps, ctx(), { codigo: "A", precio_local: null });
  assert.deepEqual([T.filas[0].precio, T.filas[0].precio_original, T.filas[0].en_oferta], [1000, null, false]);
  const igual = await Prod.editarProducto(T.deps, ctx(), { codigo: "A", precio_web: 1000 });
  assert.equal(igual.datos.aplicado, false);
  // una oferta_fin vencida no queda colgando al encender el tachado
  T.filas[0].oferta_fin = "2026-01-01";
  await Prod.editarProducto(T.deps, crearCtx(nuevaDb(), JORGE, T0, "editar_producto"), { codigo: "A", precio_local: 1200 });
  assert.equal(T.filas[0].oferta_fin, null);
});

test("crear producto: queda oculto, no repite códigos, slug único y aprobación bajo costo", async () => {
  const db = nuevaDb();
  const reg = registroMio();
  const T = crearTienda([ficha({ id: 1, codigo: "A", precio: 1000, slug: "cemento-a" })]);
  const ctx = (t = T0) => crearCtx(db, JORGE, t, "crear_producto");
  const c = ctx();
  const r = await Prod.crearProducto(T.deps, c, { codigo: "N-1", nombre: "Cemento Nuevo", precio_web: 5000, costo: 3000 });
  assert.equal(r.datos.activo, false);
  assert.equal(T.filas.at(-1).activo, false);
  await assert.rejects(Prod.crearProducto(T.deps, ctx(), { codigo: "N-1", nombre: "Otro", precio_web: 100 }), /Ya existe/);
  await assert.rejects(Prod.crearProducto(T.deps, ctx(), { codigo: "N-2", nombre: "X", precio_web: 0 }), /entero de pesos/);
  const pend = await Prod.crearProducto(T.deps, ctx(), { codigo: "N-3", nombre: "Barato", precio_web: 100, costo: 500 });
  assert.equal(pend.datos.aplicado, false);
  assert.equal(T.filas.some((f) => f.codigo === "N-3"), false);
  // deshacer = ocultar, nunca borrar
  fijarDepsGestion(T.deps);
  try {
    T.filas.at(-1).activo = true;
    const d = await deshacerLote(db, reg, c.loteId, JORGE, T0 + 5);
    assert.equal(d.ok, true);
    assert.equal(T.filas.find((f) => f.codigo === "N-1").activo, false);
    assert.ok(T.filas.find((f) => f.codigo === "N-1"));
  } finally {
    fijarDepsGestion(null);
  }
});

test("categorías: crear, renombrar, ordenar y desactivar con aviso", async () => {
  const db = nuevaDb();
  const T = crearTienda([ficha({ id: 1, codigo: "A", categoria_id: 10 })], { categorias: [{ id: 10, nombre: "Cementos", orden: 1 }] });
  const c = await Prod.crearCategoria(T.deps, crearCtx(db, JORGE, T0), { nombre: "Pinturas" });
  assert.equal(c.datos.orden, 2);
  await assert.rejects(Prod.crearCategoria(T.deps, crearCtx(db, JORGE, T0), { nombre: "cementos" }), /Ya existe/);
  const e = await Prod.editarCategoria(T.deps, crearCtx(db, JORGE, T0), { id: 10, activa: false, nombre: "Cementos y morteros" });
  assert.match(e.texto, /1 productos activos/);
  assert.equal(T.categorias[0].slug, "c-10", "el slug no cambia");
});

// ───────── despacho ─────────
test("despacho: siempre pide aprobación, se aplica al repetir tras el OK y se deshace", async () => {
  const db = nuevaDb();
  const reg = registroMio();
  const T = crearTienda([], { zonas: [{ id: "molina", nombre: "Molina", costo: 5000, gratis_desde: 150000 }] });
  fijarDepsGestion(T.deps);
  try {
    const ctx = (t) => crearCtx(db, JORGE, t, "cambiar_despacho");
    await assert.rejects(Des.cambiarDespacho(T.deps, ctx(T0), { zona_id: "molina", costo: -5 }), /entero de pesos/);
    await assert.rejects(Des.cambiarDespacho(T.deps, ctx(T0), { zona_id: "molina", costo: 10.5 }), /entero de pesos/);
    await assert.rejects(Des.cambiarDespacho(T.deps, ctx(T0), { zona_id: "nada", costo: 1 }), /No encontré la zona/);
    const p1 = await Des.cambiarDespacho(T.deps, ctx(T0), { zona_id: "molina", costo: 6000, gratis_desde: 200000 });
    assert.match(p1.texto, /despacho; cambia el envío gratis|despacho/i);
    assert.equal(T.zonas[0].costo, 5000);
    assert.equal(T.correos.length, 1);
    await Des.cambiarDespacho(T.deps, ctx(T0 + 1), { zona_id: "molina", costo: 6000, gratis_desde: 200000 });
    assert.equal(T.correos.length, 1);
    await aprobarUltimoCorreo(db, T.correos, resolverAprobacion);
    const c = ctx(T0 + 2);
    const ok = await Des.cambiarDespacho(T.deps, c, { zona_id: "molina", costo: 6000, gratis_desde: 200000 });
    assert.equal(ok.datos.aplicado, true);
    assert.deepEqual([T.zonas[0].costo, T.zonas[0].gratis_desde], [6000, 200000]);
    assert.equal(T.contadores.zonasInvalidadas, 1);
    assert.equal((await obtenerLote(db, c.loteId))[0].entidad, "zona");
    // Deshacer NO es puerta trasera: restaurar un despacho también necesita el OK de Jorge.
    const intento = await deshacerLote(db, reg, c.loteId, JORGE, T0 + 5);
    assert.equal(intento.ok, false);
    assert.match(intento.mensaje, /pendiente de Jorge/);
    assert.deepEqual([T.zonas[0].costo, T.zonas[0].gratis_desde], [6000, 200000]);
    assert.equal(T.correos.length, 2);
    await deshacerLote(db, reg, c.loteId, JORGE, T0 + 6);
    assert.equal(T.correos.length, 2); // sigue pendiente: no manda otro correo
    await aprobarUltimoCorreo(db, T.correos, resolverAprobacion);
    assert.equal((await deshacerLote(db, reg, c.loteId, JORGE, T0 + 7)).ok, true);
    assert.deepEqual([T.zonas[0].costo, T.zonas[0].gratis_desde], [5000, 150000]);
    // "nunca gratis" y bloqueo sin aprobador
    T.estadoAprobador.email = null;
    const b = await Des.cambiarDespacho(T.deps, ctx(T0 + 9), { zona_id: "molina", gratis_desde: null });
    assert.equal(b.datos.estado, "bloqueada");
    assert.equal(T.zonas[0].gratis_desde, 150000);
  } finally {
    fijarDepsGestion(null);
  }
  const sin = crearTienda([], { sinZonas: true });
  await assert.rejects(Des.cambiarDespacho(sin.deps, crearCtx(db, JORGE, T0), { zona_id: "molina", costo: 1 }), /no está disponible/);
  assert.match((await Con.verZonasDespacho(sin.deps)).texto, /tarifas fijas del código/);
});

// ───────── lectura ─────────
test("lectura: buscar paginado, ver producto con fichas, categorías y márgenes", async () => {
  const db = nuevaDb();
  const T = crearTienda(
    [...Array.from({ length: 30 }, (_, i) => ficha({ id: i + 1, codigo: `C${i}`, nombre: `Cemento ${i}`, precio: 1000, costo: 900, categoria_id: 10 })),
      ficha({ id: 100, codigo: "D", precio: 1000, costo: 2000, imagen: null }), ficha({ id: 101, codigo: "D", precio: 1000, costo: 2000 })],
    { categorias: [{ id: 10, nombre: "Cementos" }] },
  );
  const b = await Con.buscarProductos(T.deps, { texto: "cemento", por_pagina: 20 });
  assert.match(b.texto, /30 fichas encontradas\. Página 1 de 2/);
  assert.equal(b.datos.productos.length, 20);
  assert.equal(b.datos.productos[0].costo, undefined, "la búsqueda no muestra costos");
  assert.equal((await Con.buscarProductos(T.deps, { sin_foto: true })).datos.total, 1);
  const v = await Con.verProducto(T.deps, db, { codigo: "D" });
  assert.match(v.texto, /2 fichas/);
  assert.equal(v.datos.fichas[0].clase_margen, "bajo_costo");
  const cats = await Con.listarCategorias(T.deps, {});
  assert.match(cats.texto, /\[10\] Cementos \| 30 productos activos/);
  const m = await Con.verMargenes(T.deps, {});
  assert.equal(m.datos.bajo_costo, 1);
  assert.equal(m.datos.menos_15, 30);
});

// ───────── herramientas (interfaz) ─────────
test("las herramientas de escritura no son de solo lectura y llevan deshacer donde corresponde", () => {
  const reg = registroMio();
  const lectura = ["buscar_productos", "ver_producto", "listar_categorias", "ver_margenes", "ver_zonas_despacho", "ver_ofertas"];
  const escritura = ["editar_producto", "crear_producto", "crear_categoria", "editar_categoria", "previsualizar_precios", "confirmar_precios", "cambiar_despacho", "programar_oferta", "cancelar_oferta"];
  for (const n of lectura) {
    const h = reg.obtener(n);
    assert.equal(h.anotaciones.readOnlyHint, true, n);
    assert.equal(h.anotaciones.destructiveHint, false, n);
  }
  for (const n of escritura) assert.equal(reg.obtener(n).anotaciones.readOnlyHint, false, n);
  for (const n of ["editar_producto", "crear_producto", "crear_categoria", "editar_categoria", "confirmar_precios", "cambiar_despacho", "programar_oferta"]) assert.ok(reg.obtener(n).revertidor, n);
  assert.equal(reg.obtener("previsualizar_precios").revertidor, undefined);
});

test("esquemas estrictos: topes de tamaño y rangos", () => {
  const s = TPr.previsualizarPrecios.esquema.strict();
  assert.equal(s.safeParse({ por: "lista", items: Array.from({ length: 501 }, () => ({ codigo: "A", precio_web: 1 })) }).success, false);
  assert.equal(s.safeParse({ por: "porcentaje", codigos: ["A"], descuento_web_pct: 60 }).success, false);
  assert.equal(s.safeParse({ por: "porcentaje", codigos: ["A"], descuento_web_pct: 5, extra: 1 }).success, false);
  assert.equal(s.safeParse({ por: "porcentaje", codigos: ["A"], descuento_web_pct: 5 }).success, true);
  assert.equal(TD.cambiarDespacho.esquema.strict().safeParse({ zona_id: "../x", costo: 1 }).success, false);
});
