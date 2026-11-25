// Pruebas de cupones en el checkout: cálculo, reglas, reservas atómicas, interruptor,
// D1 caída, totales con transferencia, administración y reportes.
// Correr: node --test scripts/cupones.test.mjs   (D1 simulada con node:sqlite, sin red)
import "./pruebas/cargar-alias.mjs";
process.env.CUPONES_PEPPER = "sal-de-prueba-no-es-un-secreto"; // sin ella, el control por cliente falla cerrado
import test from "node:test";
import assert from "node:assert/strict";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";

const { calcularCupon, ascendencia } = await import("../src/lib/cupones/calculo.ts");
const { normalizarEmail, normalizarRut, huellaCliente } = await import("../src/lib/cupones/normalizar.ts");
const R = await import("../src/lib/cupones/reservas.ts");
const I = await import("../src/lib/cupones/interruptor.ts");
const S = await import("../src/lib/cupones/servicio.ts");
const A = await import("../src/lib/cupones/admin.ts");
const Rep = await import("../src/lib/cupones/reportes.ts");
const TOT = await import("../src/lib/cupones/totales.ts");
const { totalesPedido } = TOT;
const { REGLAS_POR_DEFECTO, validarReglas, leerReglas } = await import("../src/lib/cupones/reglas.ts");
const { cuponPedidoPagado, cuponPedidoCerrado, cuponesActivosEnCheckout } = await import("../src/lib/cupones/pedidos.ts");
const { descuentoTransferencia } = await import("../src/lib/pagos/descuento-transferencia.ts");

const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const JORGE = { id: "u-jorge", email: "jorge@example.com" };
const regla = (extra = {}) => ({ ...REGLAS_POR_DEFECTO, ...extra });
const linea = (productoId, categoriaId, subtotal, conDescuento = false) => ({ productoId, categoriaId, subtotal, conDescuento });
const PCT10 = { tipo: "porcentaje", valor: 10, montoMinimoCompra: 0 };

// ───────── cálculo ─────────

test("porcentaje y monto fijo; el descuento nunca pasa de la base", () => {
  const ls = [linea(1, 10, 20000), linea(2, 10, 30000)];
  assert.equal(calcularCupon(PCT10, regla(), ls).descuento, 5000);
  assert.equal(calcularCupon({ tipo: "monto_fijo", valor: 8000, montoMinimoCompra: 0 }, regla(), ls).descuento, 8000);
  assert.equal(calcularCupon({ tipo: "monto_fijo", valor: 99999, montoMinimoCompra: 0 }, regla(), ls).descuento, 50000);
  assert.equal(calcularCupon({ tipo: "porcentaje", valor: 120, montoMinimoCompra: 0 }, regla(), ls).ok, false); // mal configurado
});

test("compra mínima se mide sobre lo que califica", () => {
  const ls = [linea(1, 10, 30000), linea(2, 20, 30000)];
  const c = { tipo: "porcentaje", valor: 10, montoMinimoCompra: 50000 };
  assert.equal(calcularCupon(c, regla(), ls).ok, true);
  const r = calcularCupon(c, regla({ categoriasModo: "incluir", categoriasIds: [10] }), ls);
  assert.equal(r.ok, false);
  assert.equal(r.codigo, "minimo");
});

test("categorías incluidas: solo esas (y sus subcategorías)", () => {
  const padre = new Map([[11, 10], [12, 11], [20, null], [10, null]]);
  const ls = [linea(1, 12, 10000), linea(2, 20, 10000), linea(3, null, 10000)];
  const r = calcularCupon(PCT10, regla({ categoriasModo: "incluir", categoriasIds: [10] }), ls, padre);
  assert.equal(r.ok, true);
  assert.deepEqual(r.elegibles, [1]);
  assert.equal(r.descuento, 1000);
  assert.deepEqual(r.excluidas.map((e) => e.productoId), [2, 3]);
  assert.deepEqual([...ascendencia(12, padre)].sort(), [10, 11, 12]);
});

test("categorías excluidas: todo menos esas; línea sin categoría sí califica", () => {
  const padre = new Map([[11, 10]]);
  const ls = [linea(1, 11, 10000), linea(2, 20, 10000), linea(3, null, 10000)];
  const r = calcularCupon(PCT10, regla({ categoriasModo: "excluir", categoriasIds: [10] }), ls, padre);
  assert.deepEqual(r.elegibles, [2, 3]);
  assert.equal(r.descuento, 2000);
});

test("si ninguna línea califica el cupón no aplica", () => {
  const r = calcularCupon(PCT10, regla({ categoriasModo: "incluir", categoriasIds: [99] }), [linea(1, 10, 10000)]);
  assert.equal(r.ok, false);
  assert.equal(r.codigo, "no_aplica");
});

test("no acumulable: deja fuera ofertas, promo de categoría y combos; el resto sí recibe el cupón", () => {
  const ls = [linea(1, 10, 10000, true), linea(2, 10, 20000, false), linea(3, 10, 5000, true)]; // 1 y 3: oferta / combo
  const r = calcularCupon(PCT10, regla({ noAcumulable: true }), ls);
  assert.equal(r.ok, true);
  assert.equal(r.base, 20000);
  assert.equal(r.descuento, 2000);
  assert.deepEqual(r.excluidas.map((e) => e.motivo), ["con_descuento", "con_descuento"]);
  // Todo en oferta: no aplica y el mensaje lo dice
  const t = calcularCupon(PCT10, regla({ noAcumulable: true }), [linea(1, 10, 10000, true)]);
  assert.equal(t.ok, false);
  assert.match(t.error, /oferta/);
  // Sin la regla, sí se suma
  assert.equal(calcularCupon(PCT10, regla(), [linea(1, 10, 10000, true)]).descuento, 1000);
});

test("combo: el subtotal de la línea ya trae el combo y 'no acumulable' lo respeta", () => {
  // 3 unidades de $5.000 con "lleva 3 por $12.000": la línea vale 12000 y conDescuento = true
  const ls = [linea(1, 10, 12000, true), linea(2, 10, 8000, false)];
  assert.equal(calcularCupon(PCT10, regla(), ls).descuento, 2000);
  assert.equal(calcularCupon(PCT10, regla({ noAcumulable: true }), ls).descuento, 800);
});

// ───────── normalización ─────────

test("correo y RUT normalizados", async () => {
  assert.equal(normalizarEmail("  Ana.Perez+tienda@Gmail.com "), "anaperez@gmail.com");
  assert.equal(normalizarEmail("ana@googlemail.com"), "ana@gmail.com");
  assert.equal(normalizarEmail("a.b@empresa.cl"), "a.b@empresa.cl"); // solo Gmail ignora puntos
  assert.equal(normalizarRut("12.345.678-k"), "12345678K");
  assert.equal(normalizarRut("012345678-K"), "12345678K");
  assert.equal(normalizarRut("hola"), null);
  assert.equal(normalizarRut(""), null);
  assert.equal(await huellaCliente("email", "a@b.cl"), await huellaCliente("email", "a@b.cl"));
  assert.notEqual(await huellaCliente("email", "a@b.cl"), await huellaCliente("rut", "a@b.cl"));
});

// ───────── reservas ─────────

const cliente = async (email, rut) => ({
  emailHash: await huellaCliente("email", normalizarEmail(email)),
  rutHash: rut ? await huellaCliente("rut", normalizarRut(rut)) : null,
});
const params = async (extra = {}) => ({
  cuponId: "c1", ...(await cliente("a@x.cl", "11111111-1")), descuento: 1000, montoCompra: 10000,
  metodoPago: "transferencia", maxTotal: null, maxPorCliente: 0, ahora: T0, ...extra,
});

test("tope total: la reserva N+1 se rechaza como agotado", async () => {
  const db = crearD1Simulada();
  for (let i = 0; i < 3; i++) assert.equal((await R.reservarUsoCupon(db, await params({ ...(await cliente(`u${i}@x.cl`)), maxTotal: 3 }))).ok, true);
  const r = await R.reservarUsoCupon(db, await params({ ...(await cliente("u9@x.cl")), maxTotal: 3 }));
  assert.deepEqual(r, { ok: false, motivo: "agotado" });
});

test("un uso por cliente: mismo correo, mismo RUT con otro correo, o correo equivalente de Gmail", async () => {
  const db = crearD1Simulada();
  const base = { maxPorCliente: 1 };
  assert.equal((await R.reservarUsoCupon(db, await params({ ...base, ...(await cliente("ana.p@gmail.com", "11.111.111-1")) }))).ok, true);
  // mismo correo
  assert.deepEqual(await R.reservarUsoCupon(db, await params({ ...base, ...(await cliente("ana.p@gmail.com", "22.222.222-2")) })), { ok: false, motivo: "ya_usado" });
  // correo "distinto" pero equivalente (puntos y +etiqueta)
  assert.equal((await R.reservarUsoCupon(db, await params({ ...base, ...(await cliente("anap+x@gmail.com", null) ) }))).ok, false);
  // mismo RUT, otro correo
  assert.deepEqual(await R.reservarUsoCupon(db, await params({ ...base, ...(await cliente("otro@x.cl", "11111111-1")) })), { ok: false, motivo: "ya_usado" });
  // cliente distinto: pasa
  assert.equal((await R.reservarUsoCupon(db, await params({ ...base, ...(await cliente("otro@x.cl", "33.333.333-3")) }))).ok, true);
  // otro cupón: independiente
  assert.equal((await R.reservarUsoCupon(db, await params({ ...base, cuponId: "c2", ...(await cliente("ana.p@gmail.com", "11111111-1")) }))).ok, true);
});

test("carrera: 25 pedidos simultáneos con tope 5 → exactamente 5 reservas", async () => {
  const db = crearD1Simulada();
  const intentos = await Promise.all(
    Array.from({ length: 25 }, async (_, i) => R.reservarUsoCupon(db, await params({ ...(await cliente(`c${i}@x.cl`)), maxTotal: 5 }))),
  );
  assert.equal(intentos.filter((r) => r.ok).length, 5);
  assert.equal((await R.contarUsos(db, "c1", T0)).total, 5);
});

test("carrera: el mismo cliente 10 veces a la vez con un uso por cliente → una sola", async () => {
  const db = crearD1Simulada();
  const cl = await cliente("misma@x.cl", "11111111-1");
  const rs = await Promise.all(Array.from({ length: 10 }, async () => R.reservarUsoCupon(db, { ...(await params({ maxPorCliente: 1 })), ...cl })));
  assert.equal(rs.filter((r) => r.ok).length, 1);
});

test("liberar al cancelar o vencer devuelve el cupo; confirmar lo deja firme", async () => {
  const db = crearD1Simulada();
  const p = await params({ maxTotal: 1 });
  const r1 = await R.reservarUsoCupon(db, p);
  assert.equal(await R.asignarPedido(db, r1.reservaId, "BJ-261125-AAAA", "transferencia", T0), true);
  assert.equal((await R.reservarUsoCupon(db, { ...p, ...(await cliente("b@x.cl")) })).ok, false); // lleno
  // pedido cancelado
  assert.equal(await R.liberarUsoDePedido(db, "BJ-261125-AAAA", "cancelado", T0), true);
  assert.equal(await R.liberarUsoDePedido(db, "BJ-261125-AAAA", "cancelado", T0), false); // idempotente
  const r2 = await R.reservarUsoCupon(db, { ...p, ...(await cliente("b@x.cl")) });
  assert.equal(r2.ok, true);
  await R.asignarPedido(db, r2.reservaId, "BJ-261125-BBBB", "webpay", T0);
  assert.equal(await R.confirmarUsoDePedido(db, "BJ-261125-BBBB", T0), true);
  assert.equal((await R.reservarUsoCupon(db, { ...p, ...(await cliente("c@x.cl")) })).ok, false);
  // un pedido pagado que se cancela también libera
  assert.equal(await R.liberarUsoDePedido(db, "BJ-261125-BBBB", "cancelado", T0), true);
  assert.equal((await R.reservarUsoCupon(db, { ...p, ...(await cliente("c@x.cl")) })).ok, true);
});

test("la reserva sin pedido vence sola; la de Webpay a las 2 h; la confirmada no vence", async () => {
  const db = crearD1Simulada();
  const p = await params({ maxTotal: 1 });
  const r = await R.reservarUsoCupon(db, p);
  assert.equal((await R.reservarUsoCupon(db, { ...p, ...(await cliente("b@x.cl")) })).ok, false);
  // pasan 11 minutos y el pedido nunca se creó
  assert.equal((await R.reservarUsoCupon(db, { ...p, ...(await cliente("b@x.cl")), ahora: T0 + 11 * 60_000 })).ok, true);
  // Webpay abandonado
  const w = await R.reservarUsoCupon(db, { ...p, cuponId: "w", ...(await cliente("w@x.cl")) });
  await R.asignarPedido(db, w.reservaId, "BJ-261125-WWWW", "webpay", T0);
  assert.equal((await R.contarUsos(db, "w", T0 + 119 * 60_000)).total, 1);
  assert.equal((await R.contarUsos(db, "w", T0 + 121 * 60_000)).total, 0);
  // Confirmada: sigue contando
  await R.confirmarUsoDePedido(db, "BJ-261125-WWWW", T0 + 60_000);
  assert.equal((await R.contarUsos(db, "w", T0 + 365 * 86400_000)).total, 1);
  assert.ok(r.ok);
});

test("liberarReserva (pedido que no se pudo crear) y número de pedido único", async () => {
  const db = crearD1Simulada();
  const p = await params();
  const a = await R.reservarUsoCupon(db, p);
  const b = await R.reservarUsoCupon(db, { ...p, ...(await cliente("b@x.cl")) });
  assert.equal(await R.asignarPedido(db, a.reservaId, "BJ-1", "webpay", T0), true);
  await assert.rejects(() => R.asignarPedido(db, b.reservaId, "BJ-1", "webpay", T0)); // índice único
  assert.equal(await R.liberarReserva(db, b.reservaId, "pedido_fallido", T0), true);
});

// ───────── interruptor ─────────

test("interruptor: apagado por defecto", async () => {
  const db = crearD1Simulada();
  assert.equal(await I.leerInterruptorCupones(db), false);
});

test("encender sin hook de aprobación no se puede", async () => {
  const db = crearD1Simulada();
  await assert.rejects(() => I.encenderInterruptorCupones(db, { usuario: JORGE, verificarEsquema: async () => true }), /aprobación/);
  await assert.rejects(() => I.encenderInterruptorCupones(db, { usuario: JORGE, aprobar: "si", verificarEsquema: async () => true }), /aprobación/);
  assert.equal(await I.leerInterruptorCupones(db), false);
});

test("encender: si el hook no aprueba, queda apagado; si falta el esquema, ni siquiera pide aprobar", async () => {
  const db = crearD1Simulada();
  let pidio = 0;
  const aprobar = async () => { pidio++; return false; };
  assert.deepEqual(await I.encenderInterruptorCupones(db, { usuario: JORGE, aprobar, verificarEsquema: async () => true }), { ok: false, motivo: "no_aprobado" });
  assert.deepEqual(await I.encenderInterruptorCupones(db, { usuario: JORGE, aprobar, verificarEsquema: async () => false }), { ok: false, motivo: "esquema_incompleto" });
  assert.equal(pidio, 1);
  assert.equal(await I.leerInterruptorCupones(db), false);
});

test("encender con aprobación queda auditado; apagar es libre", async () => {
  const db = crearD1Simulada();
  const r = await I.encenderInterruptorCupones(db, { usuario: JORGE, aprobar: async () => ({ aprobada: true, aprobacionId: "AP-1" }), verificarEsquema: async () => true, ahora: T0 });
  assert.deepEqual(r, { ok: true, aprobacionId: "AP-1" });
  assert.equal(await I.leerInterruptorCupones(db), true);
  await I.apagarInterruptorCupones(db, JORGE, T0 + 1);
  assert.equal(await I.leerInterruptorCupones(db), false);
  const { results } = await db.prepare("SELECT herramienta, despues FROM auditoria ORDER BY creado_en").all();
  assert.deepEqual(results.map((x) => x.herramienta), ["cupones.encender_interruptor", "cupones.apagar_interruptor"]);
  assert.match(results[0].despues, /AP-1/);
});

// ───────── servicio (evaluar y reservar) ─────────

function repoFalso({ cupon, usosAntiguos = 0 } = {}) {
  return {
    async buscarPorCodigo(codigo) { return cupon && cupon.codigo === codigo ? cupon : null; },
    async usosAntiguosDeCorreo() { return usosAntiguos; },
    async categoriasPadre() { return new Map([[11, 10]]); },
  };
}
const CUPON = {
  id: "c1", codigo: "VERANO27", descripcion: null, tipo: "porcentaje", valor: 10, monto_minimo_compra: 0,
  max_usos_total: null, max_usos_por_usuario: 1, usos_actuales: 0, valido_desde: null, valido_hasta: null, activo: true,
};
async function dbEncendida() {
  const db = crearD1Simulada();
  await I.encenderInterruptorCupones(db, { usuario: JORGE, aprobar: async () => true, verificarEsquema: async () => true });
  return db;
}
const entrada = (extra = {}) => ({ codigo: "verano27", lineas: [linea(1, 10, 50000)], email: "ana@x.cl", rut: "11.111.111-1", ahora: T0, ...extra });

test("interruptor apagado: el cupón NO se aplica aunque exista y esté activo (comportamiento actual)", async () => {
  const db = crearD1Simulada();
  const r = await S.evaluarCuponCheckout(db, repoFalso({ cupon: CUPON }), entrada());
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "desactivado");
  assert.equal(await cuponesActivosEnCheckout(), false); // sin binding GESTION_DB: apagado
});

test("encendido: aplica, calcula en servidor y devuelve lo necesario para reservar", async () => {
  const db = await dbEncendida();
  const r = await S.evaluarCuponCheckout(db, repoFalso({ cupon: CUPON }), entrada());
  assert.equal(r.ok, true);
  assert.equal(r.descuento, 5000);
  const res = await S.reservarCuponParaPedido(db, r, "webpay", T0);
  assert.equal(res.ok, true);
});

test("cupones antiguos: vencido, inactivo, inexistente, código mal escrito", async () => {
  const db = await dbEncendida();
  const ev = (c, e) => S.evaluarCuponCheckout(db, repoFalso({ cupon: c }), entrada(e));
  assert.equal((await ev({ ...CUPON, valido_hasta: "2026-01-01T00:00:00Z" })).motivo, "vencido");
  assert.equal((await ev({ ...CUPON, valido_desde: "2027-01-01T00:00:00Z" })).motivo, "vencido");
  assert.equal((await ev({ ...CUPON, activo: false })).motivo, "no_existe");
  assert.equal((await ev(CUPON, { codigo: "OTRO" })).motivo, "no_existe");
  assert.equal((await ev(CUPON, { codigo: "x; drop" })).motivo, "invalido");
});

test("un uso por cliente: pide RUT y bloquea por correo o RUT, sin usar el tope total", async () => {
  const db = await dbEncendida();
  await A.crearCupon(db, { async insertar(f) { return { ok: true, cupon: { ...CUPON, ...f } }; } }, JORGE, { codigo: "UNO", tipo: "porcentaje", valor: 10, reglas: { unUsoPorCliente: true } }, T0).catch(() => null);
  const cupon = { ...CUPON, id: "cu", codigo: "UNO", max_usos_total: 1 }; // tope 1 que NO debe regir
  await db.prepare("INSERT INTO cupon_reglas VALUES (?,?,?,?,?,?,?)").bind("cu", "todas", "[]", 1, 0, T0, null).run();
  const repo = repoFalso({ cupon });
  const sinRut = await S.evaluarCuponCheckout(db, repo, entrada({ codigo: "UNO", rut: "" }));
  assert.equal(sinRut.motivo, "falta_rut");
  const a = await S.evaluarCuponCheckout(db, repo, entrada({ codigo: "UNO" }));
  assert.equal(a.ok, true);
  assert.equal(a.maxTotal, null);
  assert.equal(a.maxPorCliente, 1);
  assert.equal((await S.reservarCuponParaPedido(db, a, "webpay", T0)).ok, true);
  // otro cliente distinto: pasa aunque max_usos_total=1
  const b = await S.evaluarCuponCheckout(db, repo, entrada({ codigo: "UNO", email: "otra@x.cl", rut: "22.222.222-2" }));
  assert.equal(b.ok, true);
  // mismo RUT, otro correo
  assert.equal((await S.evaluarCuponCheckout(db, repo, entrada({ codigo: "UNO", email: "otra@x.cl" }))).motivo, "ya_usado");
  // mismo correo con otro RUT
  assert.equal((await S.evaluarCuponCheckout(db, repo, entrada({ codigo: "UNO", rut: "22.222.222-2" }))).motivo, "ya_usado");
});

test("tope total efectivo descuenta los usos antiguos de cotizaciones", async () => {
  const db = await dbEncendida();
  const cupon = { ...CUPON, max_usos_total: 5, usos_actuales: 5, max_usos_por_usuario: 0 };
  assert.equal((await S.evaluarCuponCheckout(db, repoFalso({ cupon }), entrada())).motivo, "agotado");
  const cupon2 = { ...CUPON, max_usos_total: 6, usos_actuales: 5, max_usos_por_usuario: 0 };
  const ev = await S.evaluarCuponCheckout(db, repoFalso({ cupon: cupon2 }), entrada());
  assert.equal(ev.ok, true);
  assert.equal(ev.maxTotal, 1);
});

test("límite antiguo por correo (cotizaciones) también se respeta", async () => {
  const db = await dbEncendida();
  assert.equal((await S.evaluarCuponCheckout(db, repoFalso({ cupon: CUPON, usosAntiguos: 1 }), entrada())).motivo, "ya_usado");
});

test("D1 caída: el cupón no se aplica, con mensaje claro (falla cerrado)", async () => {
  const caida = {
    prepare() { throw new Error("D1 no responde"); },
    async batch() { throw new Error("D1 no responde"); },
  };
  const r = await S.evaluarCuponCheckout(caida, repoFalso({ cupon: CUPON }), entrada());
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "no_disponible");
  assert.match(r.mensaje, /sin cupón/);
  // y si cae justo al reservar
  const db = await dbEncendida();
  const ev = await S.evaluarCuponCheckout(db, repoFalso({ cupon: CUPON }), entrada());
  const res = await S.reservarCuponParaPedido(caida, ev, "webpay", T0);
  assert.deepEqual([res.ok, res.motivo], [false, "no_disponible"]);
});

test("Supabase caído al buscar el cupón: no se aplica", async () => {
  const db = await dbEncendida();
  const repo = { ...repoFalso({ cupon: CUPON }), async buscarPorCodigo() { throw new Error("boom"); } };
  assert.equal((await S.evaluarCuponCheckout(db, repo, entrada())).motivo, "no_disponible");
});

test("categorías en el servicio: hereda subcategorías con el árbol de la base", async () => {
  const db = await dbEncendida();
  await db.prepare("INSERT INTO cupon_reglas VALUES (?,?,?,?,?,?,?)").bind("c1", "incluir", "[10]", 0, 0, T0, null).run();
  const r = await S.evaluarCuponCheckout(db, repoFalso({ cupon: { ...CUPON, max_usos_por_usuario: 0 } }), entrada({ lineas: [linea(1, 11, 30000), linea(2, 20, 30000)] }));
  assert.equal(r.ok, true);
  assert.equal(r.descuento, 3000);
});

test("hooks del pedido sin la D1 no rompen nada", async () => {
  await cuponPedidoPagado("BJ-1");
  await cuponPedidoCerrado("BJ-1", "cancelado");
});

// ───────── totales: transferencia 2% + cupón ─────────

test("sin cupón los totales son idénticos a los de hoy (webpay y transferencia)", () => {
  assert.deepEqual(totalesPedido({ subtotal: 50000, metodoPago: "webpay", costoDespacho: 5000 }), {
    subtotal: 50000, descuentoCupon: 0, descuentoTransferencia: 0, costoDespacho: 5000, total: 55000,
  });
  const t = totalesPedido({ subtotal: 50000, metodoPago: "transferencia", costoDespacho: null });
  assert.equal(t.descuentoTransferencia, descuentoTransferencia(50000));
  assert.equal(t.total, 50000 - 1000);
});

test("transferencia 2% + cupón: el 2% se calcula sobre los productos menos el cupón; el despacho va al final", () => {
  const t = totalesPedido({ subtotal: 50000, descuentoCupon: 5000, metodoPago: "transferencia", costoDespacho: 8000 });
  assert.equal(t.descuentoTransferencia, 900); // 2% de 45.000
  assert.equal(t.total, 50000 - 5000 - 900 + 8000);
  // con webpay no hay 2%
  assert.equal(totalesPedido({ subtotal: 50000, descuentoCupon: 5000, metodoPago: "webpay", costoDespacho: 8000 }).total, 53000);
  // el cupón nunca deja el total negativo ni pasa del subtotal; con subtotal bajo el piso no hay descuento
  assert.equal(totalesPedido({ subtotal: 1000, descuentoCupon: 99999, metodoPago: "webpay", costoDespacho: 0 }).total, 1000);
});

// ───────── piso cobrable (retiro en tienda no puede quedar en $0) ─────────

test("piso cobrable: el descuento se limita y los productos nunca bajan de $1.000 ni del 1 % (Webpay y transferencia)", () => {
  const { pisoCobrable, descuentoMaximoCupon } = TOT;
  assert.equal(pisoCobrable(50000), 1000);
  assert.equal(pisoCobrable(500000), 5000); // 1 % pesa más que $1.000
  assert.equal(pisoCobrable(800), 800);
  assert.equal(descuentoMaximoCupon(800), 0);
  for (const subtotal of [1500, 20000, 200000, 999999, 5_000_000]) {
    for (const metodoPago of ["webpay", "transferencia"]) {
      const t = totalesPedido({ subtotal, descuentoCupon: subtotal * 10, metodoPago, costoDespacho: null });
      assert.ok(t.total >= pisoCobrable(subtotal), `${metodoPago} ${subtotal}: total ${t.total}`);
      assert.ok(t.total > 0);
      assert.equal(t.total, subtotal - t.descuentoCupon - t.descuentoTransferencia);
    }
  }
  // Retiro en tienda, cupón de $200.000 sobre una compra de $200.000: no queda gratis.
  const retiro = totalesPedido({ subtotal: 200000, descuentoCupon: 200000, metodoPago: "webpay", costoDespacho: null });
  assert.ok(retiro.total >= 2000 && retiro.total < 2100);
  const retiroTransf = totalesPedido({ subtotal: 200000, descuentoCupon: 200000, metodoPago: "transferencia", costoDespacho: null });
  assert.ok(retiroTransf.total >= 2000);
});

test("piso cobrable en el checkout: el descuento que ve el cliente ya viene limitado (mismo valor con Webpay o transferencia)", async () => {
  const db = await dbEncendida();
  const monto = { ...CUPON, id: "c9", codigo: "REGALO", tipo: "monto_fijo", valor: 200000, max_usos_por_usuario: 0 };
  const r = await S.evaluarCuponCheckout(db, repoFalso({ cupon: monto }), entrada({ codigo: "regalo", lineas: [linea(1, 10, 200000)] }));
  assert.equal(r.ok, true);
  assert.ok(r.descuento < 200000);
  assert.equal(r.descuento, TOT.descuentoMaximoCupon(200000));
  for (const metodoPago of ["webpay", "transferencia"]) {
    const t = totalesPedido({ subtotal: 200000, descuentoCupon: r.descuento, metodoPago, costoDespacho: null });
    assert.equal(t.descuentoCupon, r.descuento); // los totales no recortan de nuevo: es coherente con lo reservado
    assert.ok(t.total >= 2000);
  }
  // Carrito de $900: el cupón no da descuento (queda bajo el piso)
  const chico = await S.evaluarCuponCheckout(db, repoFalso({ cupon: CUPON }), entrada({ lineas: [linea(1, 10, 900)] }));
  assert.equal(chico.ok, false);
});

// ───────── sin CUPONES_PEPPER falla cerrado ─────────

test("sin CUPONES_PEPPER el cupón no se aplica y avisa (no hay hash sin sal)", async () => {
  const guardada = process.env.CUPONES_PEPPER;
  delete process.env.CUPONES_PEPPER;
  try {
    await assert.rejects(() => huellaCliente("email", "ana@x.cl"), /falta_pepper/);
    const db = await dbEncendida();
    const r = await S.evaluarCuponCheckout(db, repoFalso({ cupon: CUPON }), entrada());
    assert.equal(r.ok, false);
    assert.equal(r.motivo, "no_disponible");
    assert.match(r.mensaje, /No pudimos revisar el cupón/);
  } finally {
    process.env.CUPONES_PEPPER = guardada;
  }
});

// ───────── administración ─────────

function repoAdminFalso() {
  const filas = new Map();
  return {
    filas,
    fallaActualizar: false,
    async listar() { return [...filas.values()]; },
    async porId(id) { return filas.get(id) ?? null; },
    async insertar(f) {
      if ([...filas.values()].some((c) => c.codigo === f.codigo)) return { ok: false, codigoRepetido: true };
      const c = { usos_actuales: 0, ...f };
      filas.set(f.id, c);
      return { ok: true, cupon: c };
    },
    async actualizar(id, campos) { if (this.fallaActualizar) return false; filas.set(id, { ...filas.get(id), ...campos }); return true; },
    async codigosPorIds(ids) { return new Map(ids.filter((i) => filas.has(i)).map((i) => [i, filas.get(i).codigo])); },
  };
}

test("crear cupón con reglas: guarda en Supabase y D1 y deja auditoría", async () => {
  const db = crearD1Simulada();
  const repo = repoAdminFalso();
  const r = await A.crearCupon(db, repo, JORGE, {
    codigo: " verano27 ", tipo: "porcentaje", valor: 15, montoMinimoCompra: 20000, validoHasta: "2027-02-28",
    reglas: { categoriasModo: "excluir", categoriasIds: [3, 4], noAcumulable: true },
  }, T0);
  assert.equal(r.ok, true);
  const id = r.valor.cupon.id;
  assert.equal(repo.filas.get(id).codigo, "VERANO27");
  assert.deepEqual(await leerReglas(db, id), { categoriasModo: "excluir", categoriasIds: [3, 4], unUsoPorCliente: false, noAcumulable: true });
  const aud = await db.prepare("SELECT herramienta, entidad_id FROM auditoria").all();
  assert.deepEqual(JSON.parse(JSON.stringify(aud.results)), [{ herramienta: "cupones.crear", entidad_id: id }]);
});

test("crear: validaciones y código repetido (no deja reglas huérfanas)", async () => {
  const db = crearD1Simulada();
  const repo = repoAdminFalso();
  const ok = await A.crearCupon(db, repo, JORGE, { codigo: "UNO", tipo: "monto_fijo", valor: 5000 }, T0);
  assert.equal(ok.ok, true);
  const dup = await A.crearCupon(db, repo, JORGE, { codigo: "UNO", tipo: "monto_fijo", valor: 5000, reglas: { noAcumulable: true } }, T0);
  assert.deepEqual([dup.ok, dup.codigo], [false, "codigo_repetido"]);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM cupon_reglas").first()).n, 1);
  for (const mala of [
    { codigo: "x", tipo: "porcentaje", valor: 10 },
    { codigo: "BUENO", tipo: "porcentaje", valor: 101 },
    { codigo: "BUENO", tipo: "porcentaje", valor: 0 },
    { codigo: "BUENO", tipo: "otro", valor: 10 },
    { codigo: "BUENO", tipo: "porcentaje", valor: 10, reglas: { categoriasModo: "incluir", categoriasIds: [] } },
    { codigo: "BUENO", tipo: "porcentaje", valor: 10, reglas: { categoriasModo: "incluir", categoriasIds: ["a"] } },
    { codigo: "BUENO", tipo: "porcentaje", valor: 10, maxUsosTotal: 5, reglas: { unUsoPorCliente: true } },
    { codigo: "BUENO", tipo: "porcentaje", valor: 10, validoDesde: "2027-03-01", validoHasta: "2027-02-01" },
  ]) assert.equal((await A.crearCupon(db, repo, JORGE, mala, T0)).ok, false, JSON.stringify(mala));
});

test("editar un cupón ya creado: campos y reglas; auditoría con antes y después", async () => {
  const db = crearD1Simulada();
  const repo = repoAdminFalso();
  const c = (await A.crearCupon(db, repo, JORGE, { codigo: "EDITA", tipo: "porcentaje", valor: 10 }, T0)).valor.cupon;
  const r = await A.editarCupon(db, repo, JORGE, c.id, { valor: 20, descripcion: "<b>Hola</b>", reglas: { categoriasModo: "incluir", categoriasIds: [7], unUsoPorCliente: true } }, T0 + 1);
  assert.equal(r.ok, true);
  assert.equal(repo.filas.get(c.id).valor, 20);
  assert.equal(repo.filas.get(c.id).descripcion, "bHola/b"); // sin etiquetas
  assert.equal((await leerReglas(db, c.id)).unUsoPorCliente, true);
  const aud = await db.prepare("SELECT antes, despues FROM auditoria WHERE herramienta = 'cupones.editar'").first();
  assert.match(aud.antes, /"valor":10/);
  assert.match(aud.despues, /"valor":20/);
  assert.equal((await A.editarCupon(db, repo, JORGE, "no-existe", { valor: 5 })).codigo, "no_encontrado");
  assert.equal((await A.editarCupon(db, repo, JORGE, c.id, {})).ok, false);
  // pasar a un uso por cliente con tope total puesto no se permite
  const conTope = (await A.crearCupon(db, repo, JORGE, { codigo: "TOPE", tipo: "porcentaje", valor: 10, maxUsosTotal: 50 }, T0)).valor.cupon;
  assert.equal((await A.editarCupon(db, repo, JORGE, conTope.id, { reglas: { unUsoPorCliente: true } })).ok, false);
  assert.equal((await A.editarCupon(db, repo, JORGE, conTope.id, { maxUsosTotal: null, reglas: { unUsoPorCliente: true } })).ok, true);
});

test("editar: si falla Supabase se revierten las reglas", async () => {
  const db = crearD1Simulada();
  const repo = repoAdminFalso();
  const c = (await A.crearCupon(db, repo, JORGE, { codigo: "REVIERTE", tipo: "porcentaje", valor: 10 }, T0)).valor.cupon;
  repo.fallaActualizar = true;
  const r = await A.editarCupon(db, repo, JORGE, c.id, { valor: 30, reglas: { noAcumulable: true } }, T0 + 1);
  assert.equal(r.ok, false);
  assert.equal((await leerReglas(db, c.id)).noAcumulable, false);
});

test("activar y desactivar con auditoría propia", async () => {
  const db = crearD1Simulada();
  const repo = repoAdminFalso();
  const c = (await A.crearCupon(db, repo, JORGE, { codigo: "ONOFF", tipo: "porcentaje", valor: 10 }, T0)).valor.cupon;
  assert.equal((await A.desactivarCupon(db, repo, JORGE, c.id, T0 + 1)).ok, true);
  assert.equal(repo.filas.get(c.id).activo, false);
  assert.equal((await A.activarCupon(db, repo, JORGE, c.id, T0 + 2)).ok, true);
  assert.equal(repo.filas.get(c.id).activo, true);
  const h = (await db.prepare("SELECT herramienta FROM auditoria ORDER BY creado_en").all()).results.map((x) => x.herramienta);
  assert.deepEqual(h, ["cupones.crear", "cupones.desactivar", "cupones.activar"]);
});

test("listado para el panel: reglas y usos; con la D1 caída avisa", async () => {
  const db = crearD1Simulada();
  const repo = repoAdminFalso();
  const c = (await A.crearCupon(db, repo, JORGE, { codigo: "LISTA", tipo: "porcentaje", valor: 10, reglas: { noAcumulable: true } }, T0)).valor.cupon;
  const r1 = await R.reservarUsoCupon(db, await params({ cuponId: c.id, ahora: T0 }));
  await R.asignarPedido(db, r1.reservaId, "BJ-L1", "webpay", T0);
  await R.confirmarUsoDePedido(db, "BJ-L1", T0);
  await R.reservarUsoCupon(db, await params({ cuponId: c.id, ...(await cliente("b@x.cl")), ahora: T0 }));
  const l = await A.listarCuponesAdmin(db, repo, T0);
  assert.equal(l.gestionDisponible, true);
  assert.deepEqual([l.items[0].usosPedidos, l.items[0].reservasVigentes, l.items[0].reglas.noAcumulable], [1, 1, true]);
  const caida = { prepare() { throw new Error("x"); }, async batch() { throw new Error("x"); } };
  const l2 = await A.listarCuponesAdmin(caida, repo, T0);
  assert.equal(l2.gestionDisponible, false);
  assert.equal(l2.items.length, 1);
});

// ───────── reportes ─────────

test("usos por período sin datos personales", async () => {
  const db = crearD1Simulada();
  const repo = repoAdminFalso();
  repo.filas.set("c1", { id: "c1", codigo: "VERANO27" });
  for (const [i, estado] of ["confirmada", "confirmada", "liberada", "reservada"].entries()) {
    const r = await R.reservarUsoCupon(db, await params({ ...(await cliente(`p${i}@x.cl`)), descuento: 1000 * (i + 1), montoCompra: 10000, ahora: T0 + i * 86400_000 }));
    await R.asignarPedido(db, r.reservaId, `BJ-R${i}`, "webpay", T0 + i * 86400_000);
    if (estado === "confirmada") await R.confirmarUsoDePedido(db, `BJ-R${i}`, T0);
    if (estado === "liberada") await R.liberarUsoDePedido(db, `BJ-R${i}`, "cancelado", T0);
  }
  const filas = await Rep.usosDeCuponesConCodigo(db, repo, { desde: T0, hasta: T0 + 10 * 86400_000, ahora: T0 + 3 * 86400_000 + 60_000 });
  assert.equal(filas.length, 1);
  assert.deepEqual(
    { c: filas[0].confirmados, r: filas[0].reservadosVigentes, l: filas[0].liberados, d: filas[0].descuentoTotal, m: filas[0].montoCompraTotal, cod: filas[0].codigo },
    { c: 2, r: 1, l: 1, d: 3000, m: 20000, cod: "VERANO27" },
  );
  // nada personal en el resultado
  assert.doesNotMatch(JSON.stringify(filas), /@|hash/i);
  // el período filtra
  assert.equal((await Rep.usosDeCuponesPorPeriodo(db, { desde: T0 + 5 * 86400_000, hasta: T0 + 9 * 86400_000 })).length, 0);
  const dias = await Rep.usosDeCuponesPorDia(db, { desde: T0, hasta: T0 + 10 * 86400_000 });
  assert.equal(dias.length, 2); // una confirmada el día 25 y otra el 26
  assert.ok(dias.reduce((s, d) => s + d.confirmados, 0) === 2);
});

test("la migración 0004 aplica sobre las anteriores y no usa IF NOT EXISTS", async () => {
  const db = crearD1Simulada({ migraciones: "0002_oauth.sql" });
  const { readFileSync } = await import("node:fs");
  db.sqlite.exec(readFileSync(new URL("../migrations-gestion/0004_cupones.sql", import.meta.url), "utf8"));
  const t = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results.map((x) => x.name);
  for (const n of ["ajustes", "cupon_reglas", "cupon_usos"]) assert.ok(t.includes(n), n);
});

test("validarReglas: lista blanca", () => {
  assert.equal(validarReglas({ categoriasModo: "raro" }).ok, false);
  assert.equal(validarReglas({ unUsoPorCliente: "si" }).ok, false);
  assert.equal(validarReglas([]).ok, false);
  assert.deepEqual(validarReglas(undefined).reglas, REGLAS_POR_DEFECTO);
});
