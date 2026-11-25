// Parte B, base: topes duros (no aprobables, en ambos modos) y datos bancarios / enlaces de pago intocables.
// Correr: node --test scripts/mcp-topes-duros.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";
import { crearCtx, crearTienda, ficha } from "./pruebas/tienda-falsa.mjs";

const T = await import("../src/lib/gestion-precios/topes.ts");
const R = await import("../src/lib/gestion-precios/reglas.ts");
const Prod = await import("../src/lib/gestion-precios/productos-servicio.ts");
const Pre = await import("../src/lib/gestion-precios/precios-masivos.ts");
const Ofe = await import("../src/lib/gestion-precios/ofertas.ts");
const { deshacerLote } = await import("../src/lib/mcp/deshacer.ts");
const { crearRegistro } = await import("../src/lib/mcp/tools/registro.ts");
const TP = await import("../src/lib/mcp/tools/productos.ts");
const { fijarDepsGestion } = await import("../src/lib/mcp/tools/productos-comun.ts");
const { ErrorHerramienta } = await import("../src/lib/mcp/tools/registro.ts");
const DP = await import("../src/lib/contenido/datos-pago.ts");
const Repo = await import("../src/lib/contenido/repositorio.ts");
const { validarSeo } = await import("../src/lib/seo-editable/reglas.ts");
const { validarGuia } = await import("../src/lib/seo-editable/guias.ts");
const { RE_BANCARIO } = await import("../src/lib/correos-cliente/validar.ts");
const { registro } = await import("../src/lib/mcp/tools/index.ts");

const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const JORGE = { id: "1", email: "contacto@jurmaq.cl" };
const nuevaDb = () => crearD1Simulada();

const ENV0 = { modo: process.env.BARRACA_MODO_APROBACION, aprob: process.env.BARRACA_APROBADOR_EMAIL };
afterEach(() => {
  for (const [k, v] of [["BARRACA_MODO_APROBACION", ENV0.modo], ["BARRACA_APROBADOR_EMAIL", ENV0.aprob]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});
const MODOS = ["exigir", "avisar"];
const enModo = (m) => { process.env.BARRACA_MODO_APROBACION = m; process.env.BARRACA_APROBADOR_EMAIL = "jorge.personal@example.com"; };

// ───────── precios ─────────
test("tope duro: función pura (cero, negativo, bajo el 50 % del costo; sin costo no hay tope de costo)", () => {
  const f = (precio, costo, extra = {}) => T.incumplimientosTopes([{ clave: "A", precio, costo, ...extra }]);
  assert.equal(f(0, 100).length, 1);
  assert.equal(f(-5, null).length, 1);
  assert.equal(f(Number.NaN, 100).length, 1);
  assert.equal(f(49, 100).length, 1, "49 % del costo");
  assert.equal(f(50, 100).length, 0, "justo el 50 % se puede");
  assert.equal(f(51, 100).length, 0);
  assert.equal(f(1, null).length, 0, "sin costo no hay tope de costo");
  assert.equal(f(1, 0).length, 0, "costo 0 = sin costo");
  assert.equal(f(10, 100, { sinCambio: true }).length, 0, "un precio que no cambia ya estaba así: no se rechaza otra edición");
  assert.equal(f(0, 100, { sinCambio: true }).length, 1, "pero cero siempre se rechaza");
  assert.throws(() => T.exigirTopesDuros([{ clave: "A", precio: 40, costo: 100 }]), (e) => e instanceof ErrorHerramienta && e.name === "ErrorTopeDuro" && /tope duro/.test(e.message) && /no se aprueba/.test(e.message));
});

test("tope duro: evaluarCambioPrecios lo lanza en AMBOS modos (no es una aprobación, es un error) y no escribe nada", async () => {
  for (const modo of MODOS) {
    enModo(modo);
    const db = nuevaDb();
    const ev = (cambios) => R.evaluarCambioPrecios(db, { usuarioId: "1", cambios, ahora: T0 });
    await assert.rejects(ev([{ clave: "A", precioAntes: 1000, precioDespues: 400, costo: 1000 }]), T.ErrorTopeDuro, modo);
    await assert.rejects(ev([{ clave: "A", precioAntes: 1000, precioDespues: 0, costo: null }]), T.ErrorTopeDuro, modo);
    await assert.rejects(ev([{ clave: "A", precioAntes: 1000, precioDespues: 1000, precioComboUnitario: 1, costo: 100 }]), T.ErrorTopeDuro, modo);
    await assert.rejects(ev([{ clave: "N", precioAntes: 300, precioDespues: 300, costo: 1000, nuevo: true }]), T.ErrorTopeDuro, modo);
    // Lo que sí es aprobable no cambia: bajo el costo pero sobre el 50 %.
    const ok = await ev([{ clave: "A", precioAntes: 1000, precioDespues: 800, costo: 1000 }]);
    assert.ok(ok.motivos.includes("precio_bajo_costo"));
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM aprobaciones").first()).n, 0);
  }
});

test("tope duro: editar_producto, crear_producto, precios masivos y ofertas lo respetan en ambos modos (error claro, sin aprobación ni cambios)", async () => {
  for (const modo of MODOS) {
    enModo(modo);
    const db = nuevaDb();
    const Tn = crearTienda([ficha({ id: 1, codigo: "A", precio: 1000, costo: 1000 })]);
    // editar_producto
    await assert.rejects(Prod.editarProducto(Tn.deps, crearCtx(db, JORGE, T0, "editar_producto"), { codigo: "A", precio_web: 400 }), /tope duro/, modo);
    assert.equal(Tn.filas[0].precio, 1000);
    // crear_producto
    await assert.rejects(Prod.crearProducto(Tn.deps, crearCtx(db, JORGE, T0, "crear_producto"), { codigo: "N-9", nombre: "Muy barato", precio_web: 300, costo: 1000 }), /tope duro/, modo);
    assert.equal(Tn.filas.some((f) => f.codigo === "N-9"), false);
    // precios masivos (previsualizar ya lo dice)
    await assert.rejects(Pre.previsualizarPrecios(Tn.deps, crearCtx(db, JORGE, T0, "previsualizar_precios"), { por: "lista", items: [{ codigo: "A", precio_web: 100 }] }), /tope duro/, modo);
    // oferta
    await assert.rejects(Ofe.programarOferta(Tn.deps, crearCtx(db, JORGE, T0, "programar_oferta"), { productos: [{ codigo: "A", precio_oferta: 100 }], inicio: "2026-11-26T00:00", fin: "2026-11-27T00:00" }), /tope duro/, modo);
    assert.equal(Tn.filas[0].precio, 1000);
    assert.deepEqual(Tn.correos, []);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM aprobaciones").first()).n, 0);
  }
});

test("tope duro: en avisar un precio bajo el costo (sobre el 50 %) sigue siendo vista previa + confirmar, y bajo el 50 % ni siquiera eso", async () => {
  enModo("avisar");
  const db = nuevaDb();
  const Tn = crearTienda([ficha({ id: 1, codigo: "A", precio: 1000, costo: 1000 })]);
  const c = (t) => crearCtx(db, JORGE, t, "editar_producto");
  const r1 = await Prod.editarProducto(Tn.deps, c(T0), { codigo: "A", precio_web: 800 });
  assert.equal(r1.datos.aplicado, false);
  assert.match(r1.texto, /modo AVISAR/);
  assert.equal(Tn.filas[0].precio, 1000);
  const r2 = await Prod.editarProducto(Tn.deps, c(T0 + 1000), { codigo: "A", precio_web: 800 });
  assert.equal(r2.datos.aplicado, true);
  assert.equal(Tn.filas[0].precio, 800);
  await assert.rejects(Prod.editarProducto(Tn.deps, c(T0 + 2000), { codigo: "A", precio_web: 400 }), /tope duro/);
  assert.equal(Tn.filas[0].precio, 800);
});

test("tope duro: deshacer no puede restaurar un precio bajo el 50 % del costo de hoy (ni con aprobación)", async () => {
  for (const modo of MODOS) {
    enModo(modo);
    const db = nuevaDb();
    const Tn = crearTienda([ficha({ id: 1, codigo: "B", precio: 1000, costo: 100 })]);
    const reg = crearRegistro();
    reg.agregar(TP.editarProducto);
    fijarDepsGestion(Tn.deps);
    try {
      const c1 = crearCtx(db, JORGE, T0, "editar_producto");
      assert.equal((await Prod.editarProducto(Tn.deps, c1, { codigo: "B", precio_web: 1100 })).datos.aplicado, true);
      Tn.filas[0].costo = 5000; // el costo se disparó: el precio de antes (1000) quedaría bajo el 50 %
      const u = await deshacerLote(db, reg, c1.loteId, JORGE, T0 + 20);
      assert.equal(u.ok, false);
      assert.match(u.mensaje, /No se puede deshacer.*tope duro/s, modo);
      assert.equal(Tn.filas[0].precio, 1100, "no se restauró");
      assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM aprobaciones").first()).n, 0, "no hay aprobación que pedir");
    } finally {
      fijarDepsGestion(null);
    }
  }
});

// ───────── datos bancarios y enlaces de pago ─────────
test("datos de pago: se detectan cuentas, IBAN y enlaces de pago; la prosa y jurmaq.cl no", () => {
  for (const malo of [
    "Transfiere a la cuenta corriente 12345678 del Banco X",
    "N° de cuenta: 0012 3456 7890",
    "cuenta rut 99999999-9 a nombre de",
    "IBAN CL12ABCD123456789012",
    "Paga aquí https://www.webpay.cl/pagar",
    "https://checkout.example.com/abc",
    "pagos.otrositio.cl/cobrar",
    "https://mercadopago.cl/x",
    "wa.me/56912345678?text=link flow.cl/pago",
  ]) assert.equal(DP.contieneDatosDePago(malo), true, malo);
  for (const bueno of [
    "Aceptamos pago con Webpay o transferencia bancaria.",
    "Tu banco puede pedirte una clave adicional.",
    "Ver https://barraca.jurmaq.cl/pago/error y https://jurmaq.cl/contacto",
    "Más información en https://www.sernac.cl",
    "El pedido N° 123456789 está en preparación.",
  ]) assert.equal(DP.contieneDatosDePago(bueno), false, bueno);
  // Lo que ya estaba (el número de cuenta de los Términos) se puede dejar; agregar o cambiar uno, no.
  const antes = "Número de cuenta: 42500240045. Banco Estado.";
  assert.equal(DP.agregaDatosDePago(antes, `${antes} Más texto.`), false);
  assert.equal(DP.agregaDatosDePago(antes, "Número de cuenta: 42500240046. Banco Estado."), true);
  assert.equal(DP.agregaDatosDePago("sin datos", antes), true);
  assert.equal(DP.agregaDatosDePago(antes, "Sin datos de pago."), false, "quitarlo es libre");
});

test("datos de pago: contenido, SEO y guías los rechazan en ambos modos; los Términos actuales siguen publicables tal cual", async () => {
  for (const modo of MODOS) {
    enModo(modo);
    const db = nuevaDb();
    const usuario = { id: "1", email: "contacto@jurmaq.cl" };
    // contenido: nosotros con una cuenta nueva, cinta con un enlace de pago
    const nos = (await Repo.obtenerEstado(db, "nosotros")).efectivo;
    const conCuenta = { ...nos, texto: `${nos.texto ?? nos.intro ?? ""}\n\nDeposita en la cuenta corriente 123456789 del Banco Ejemplo.` };
    const r1 = await Repo.publicar(db, { clave: "nosotros", usuario, valor: conCuenta, ahora: T0 });
    assert.equal(r1.ok, false, modo);
    assert.match(String(r1.errores), /datos bancarios o un enlace de pago/);
    const r2 = await Repo.publicar(db, { clave: "cinta", usuario, valor: { texto: "Paga ya", enlace: { texto: "Pagar", enlace: "https://www.webpay.cl/x" } }, ahora: T0 });
    assert.equal(r2.ok, false, modo);
    // ni con una aprobación ya dada
    const r3 = await Repo.publicar(db, { clave: "cinta", usuario, valor: { texto: "Paga ya", enlace: { texto: "Pagar", enlace: "https://www.webpay.cl/x" } }, aprobacion: { aprobadoPor: "jorge" }, ahora: T0 });
    assert.equal(r3.ok, false, `${modo}: ni aprobado`);
    // los Términos de hoy (traen su número de cuenta) se pueden publicar con un cambio que no toque eso
    const ter = (await Repo.obtenerEstado(db, "terminos")).efectivo;
    const r4 = await Repo.publicar(db, { clave: "terminos", usuario, valor: { texto: `${ter.texto}\n\n18. Un párrafo más.` }, aprobacion: { aprobadoPor: "jorge" }, ahora: T0 });
    assert.equal(r4.ok, true, `${modo}: ${JSON.stringify(r4)}`);
    // pero no cambiar el número de cuenta
    const r5 = await Repo.publicar(db, { clave: "terminos", usuario, valor: { texto: ter.texto.replace("42500240045", "11111111111") }, aprobacion: { aprobadoPor: "jorge" }, ahora: T0 + 1 });
    assert.equal(r5.ok, false, `${modo}: cambiar la cuenta`);
    // SEO
    assert.equal(validarSeo({ titulo: "Fierro con cuenta corriente 12345678 hoy", descripcion: null, ogTitulo: null, ogDescripcion: null }).ok, false);
    assert.equal(validarSeo({ titulo: "Mejor fierro para tu obra en la zona", descripcion: "Compra en https://pagos.ejemplo.cl/ahora y recibe", ogTitulo: null, ogDescripcion: null }).ok, false);
    // Guías
    const guia = { slug: "g", titulo: "Guía", descripcionMeta: "d", h1: "h", intro: "Intro", secciones: [{ h2: "S", md: "Paga en https://checkout.ejemplo.com/ahora" }], faq: [], categoriaSlugRelacionada: "fierros", categoriaNombre: "Fierros" };
    const g = validarGuia(guia);
    assert.equal(g.ok, false);
    assert.match(g.errores.join(" "), /datos bancarios o un enlace de pago/);
  }
});

test("datos de pago: los correos y campañas ya los rechazaban (regla bancaria del validador)", () => {
  for (const t of ["Paga con Webpay", "deposita en tu banco", "link de pago", "Cuenta corriente", "IBAN", "mercado pago"]) assert.match(t, RE_BANCARIO, t);
});

function archivosTs(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (n.endsWith(".ts")) out.push(p);
  }
  return out;
}
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("transversal: ninguna herramienta lee ni escribe datos bancarios, claves de pasarela ni enlaces de pago", () => {
  // 1. El esquema de ninguna herramienta pide ni devuelve campos de cuentas bancarias o enlaces de pago.
  for (const h of registro.lista()) {
    const campos = Object.keys(h.esquema.shape).join(" ");
    assert.ok(!/cuenta_banc|banco|iban|swift|enlace_pago|link_pago|url_pago|webpay|transbank|tarjeta|rut_cuenta|numero_cuenta/i.test(`${h.nombre} ${campos}`), `${h.nombre}: campos ${campos}`);
  }
  // 2. El código de las herramientas y de la gestión no toca las variables de la cuenta ni de la pasarela.
  const carpetas = ["src/lib/mcp/tools", "src/lib/gestion-precios", "src/lib/mcp"];
  for (const c of carpetas) {
    for (const f of archivosTs(path.join(RAIZ, c))) {
      const t = readFileSync(f, "utf8");
      assert.ok(!/BANK_[A-Z_]+|WEBPAY_[A-Z_]+|TRANSBANK_[A-Z_]+|\bbarraca_datos_bancarios\b/.test(t), `${path.relative(RAIZ, f)} toca datos de la cuenta o de la pasarela`);
    }
  }
  // 3. Ninguna herramienta tiene nombre de cobrar, pagar o enlazar pagos (los pagos de dinero llegan en la parte siguiente con su propio scope).
  for (const h of registro.lista()) assert.ok(!/enlace_pago|link_pago|cuenta_banc|datos_banc/.test(h.nombre), h.nombre);
});
