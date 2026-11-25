// Parte B, base: aviso de operación de dinero o borrado (avisarOperacionDinero), en ambos modos.
// Correr: node --test scripts/mcp-aviso-dinero.test.mjs
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";
import {
  avisarOperacionDinero, encolarAvisoDinero, enviarAviso, reintentarAvisos, avisosConProblemas, limpiarTextoAviso, nombrePila, iniciales,
  textoAviso,
} from "../src/lib/mcp/aviso-operacion.ts";

const BASE = "https://barraca.jurmaq.cl";
const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const USUARIO = { id: "1", email: "contacto@jurmaq.cl" };
const ENV0 = process.env.BARRACA_MODO_APROBACION;
afterEach(() => { if (ENV0 === undefined) delete process.env.BARRACA_MODO_APROBACION; else process.env.BARRACA_MODO_APROBACION = ENV0; });

function entorno({ aprobador = "jorge.personal@example.com", envia = true } = {}) {
  const db = crearD1Simulada();
  const correos = [];
  const estado = { envia };
  const deps = { aprobadorEmail: aprobador, base: BASE, enviar: async (c) => { if (!estado.envia) return false; correos.push(c); return true; } };
  return { db, deps, correos, estado };
}

const DATOS = {
  usuario: USUARIO, herramienta: "confirmar_transferencia", operacion: "Confirmar transferencia", pedidoNumero: 1234,
  clienteNombre: "Juan Pérez González", monto: 52990, medio: "Transferencia", loteId: "lote-1", ahora: T0,
};

for (const modo of ["exigir", "avisar"]) {
  test(`aviso de dinero (${modo}): se registra ANTES de la operación, el correo sale DESPUÉS y trae lo pedido sin datos personales`, async () => {
    process.env.BARRACA_MODO_APROBACION = modo;
    const e = entorno();
    let vistoAntes = null;
    const r = await avisarOperacionDinero(e.db, e.deps, { ...DATOS, resumen: "Se marcó como pagado. Contacto: ana@correo.cl, 12.345.678-5, +56 9 7667 3577, cuenta 42500240045." }, async () => {
      vistoAntes = await e.db.prepare("SELECT estado, tipo FROM avisos_operacion").first();
      assert.deepEqual(e.correos, [], "el correo no sale antes de la operación");
      return { hecho: true };
    });
    assert.equal(r.ok, true);
    assert.deepEqual({ ...vistoAntes }, { estado: "pendiente", tipo: "dinero" });
    assert.deepEqual(r.resultado, { hecho: true });
    assert.equal(r.aviso.estado, "enviado");
    assert.match(textoAviso(r.aviso), /Aviso enviado a Jorge/);
    assert.equal(e.correos.length, 1);
    const c = e.correos[0];
    const todo = JSON.stringify(c);
    assert.equal(c.para, "jorge.personal@example.com");
    assert.match(c.asunto, /Confirmar transferencia/);
    assert.match(c.asunto, /1234/);
    assert.match(todo, /N° 1234/);
    assert.match(todo, /\$52\.990/);
    assert.match(todo, /Transferencia/);
    assert.match(todo, /contacto@jurmaq\.cl/, "quién la pidió");
    assert.match(todo, /Hecho/);
    assert.match(todo, /"valor":"Juan"/, "solo el nombre de pila");
    for (const prohibido of [/Pérez/, /González/, /ana@correo/, /12\.345\.678/, /7667 3577/, /42500240045/]) assert.doesNotMatch(todo, prohibido);
    assert.ok(c.botones.some((b) => b.href === `${BASE}/admin/ventas/1234`), "enlace al pedido en el panel");
    assert.ok(c.botones.some((b) => b.href === `${BASE}/admin/conexiones`));
    const fila = await e.db.prepare("SELECT estado, resultado, pedido_numero, monto, medio, cliente_nombre, resumen, lote_id FROM avisos_operacion").first();
    assert.equal(fila.estado, "enviado");
    assert.equal(fila.resultado, "ok");
    assert.equal(fila.cliente_nombre, "Juan");
    assert.doesNotMatch(JSON.stringify(fila), /ana@correo|12\.345\.678|7667 3577|42500240045|Pérez/, "tampoco se guarda en D1");
  });
}

test("sin BARRACA_APROBADOR_EMAIL válido las operaciones de dinero quedan BLOQUEADAS y la operación no se ejecuta", async () => {
  for (const aprobador of [null, "", "no-es-correo", "   "]) {
    const e = entorno({ aprobador });
    let ejecutada = false;
    const r = await avisarOperacionDinero(e.db, e.deps, DATOS, async () => { ejecutada = true; return 1; });
    assert.equal(r.ok, false, String(aprobador));
    assert.equal(r.motivo, "sin_aprobador");
    assert.match(r.mensaje, /BLOQUEADO/);
    assert.equal(ejecutada, false);
    assert.equal((await e.db.prepare("SELECT COUNT(*) AS n FROM avisos_operacion").first()).n, 0);
  }
});

test("si el aviso previo no se puede registrar en D1, la operación irreversible NO se ejecuta", async () => {
  const e = entorno();
  const dbRota = { prepare: (sql) => (/INSERT INTO avisos_operacion/.test(sql) ? { bind: () => ({ run: async () => { throw new Error("D1 caída"); } }) } : e.db.prepare(sql)), batch: (x) => e.db.batch(x) };
  let ejecutada = false;
  const r = await avisarOperacionDinero(dbRota, e.deps, DATOS, async () => { ejecutada = true; });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "no_registrado");
  assert.equal(ejecutada, false);
  assert.deepEqual(e.correos, []);
  // Sin la tabla (migración 0010 sin aplicar) tampoco se ejecuta.
  const sinTabla = crearD1Simulada({ migraciones: "0009_correos_campanas.sql" });
  const r2 = await avisarOperacionDinero(sinTabla, e.deps, DATOS, async () => { ejecutada = true; });
  assert.equal(r2.ok, false);
  assert.equal(ejecutada, false);
});

test("si el correo falla: la operación igual quedó hecha, se dice en la respuesta, queda registrado y el cron lo reintenta", async () => {
  const e = entorno({ envia: false });
  let hecha = 0;
  const r = await avisarOperacionDinero(e.db, e.deps, DATOS, async () => { hecha++; return "ok"; });
  assert.equal(r.ok, true);
  assert.equal(hecha, 1);
  assert.equal(r.aviso.estado, "fallido");
  assert.match(textoAviso(r.aviso), /ATENCIÓN: el aviso a Jorge NO se pudo enviar/);
  assert.match(textoAviso(r.aviso), /cada 30 minutos/);
  const fila = await e.db.prepare("SELECT estado, ultimo_error, intentos, resultado FROM avisos_operacion").first();
  assert.deepEqual({ ...fila }, { estado: "fallido", ultimo_error: "envio_rechazado", intentos: 1, resultado: "ok" });
  assert.equal((await avisosConProblemas(e.db, T0 + 1000)).length, 1);
  // El cron (cada 30 min) lo vuelve a intentar cuando el correo vuelve.
  assert.deepEqual({ ...(await reintentarAvisos(e.db, e.deps, Date.now() + 10 * 60_000)) }, { intentados: 1, enviados: 0, fallidos: 1 });
  e.estado.envia = true;
  assert.deepEqual({ ...(await reintentarAvisos(e.db, e.deps, Date.now() + 40 * 60_000)) }, { intentados: 1, enviados: 1, fallidos: 0 });
  assert.equal(e.correos.length, 1);
  assert.match(JSON.stringify(e.correos[0]), /Hecho/);
  assert.equal((await avisosConProblemas(e.db, Date.now() + 50 * 60_000)).length, 0);
  // No se manda dos veces.
  assert.equal((await reintentarAvisos(e.db, e.deps, Date.now() + 90 * 60_000)).intentados, 0);
});

test("si la operación lanza un error, el aviso igual sale (resultado «error») y el error se relanza", async () => {
  const e = entorno();
  await assert.rejects(avisarOperacionDinero(e.db, e.deps, DATOS, async () => { throw new Error("Supabase caído"); }), /Supabase caído/);
  assert.equal(e.correos.length, 1);
  assert.match(JSON.stringify(e.correos[0]), /Se intentó, pero falló/);
  assert.equal((await e.db.prepare("SELECT resultado FROM avisos_operacion").first()).resultado, "error");
});

test("`exito` decide el resultado del correo cuando la operación devuelve «no se pudo» sin lanzar", async () => {
  const e = entorno();
  const r = await avisarOperacionDinero(e.db, e.deps, DATOS, async () => ({ aplicado: false }), (x) => x.aplicado);
  assert.equal(r.ok, true);
  assert.match(JSON.stringify(e.correos[0]), /Se intentó, pero falló/);
});

test("un aviso que quedó pendiente porque el worker murió a mitad sale desde el cron diciendo que no se pudo confirmar", async () => {
  const e = entorno();
  const enc = await encolarAvisoDinero(e.db, e.deps, DATOS);
  assert.equal(enc.ok, true);
  // (la operación nunca terminó: nadie llamó a despachar)
  assert.equal((await reintentarAvisos(e.db, e.deps, T0 + 60_000)).intentados, 0, "todavía es reciente");
  const r = await reintentarAvisos(e.db, e.deps, T0 + 5 * 60_000);
  assert.equal(r.enviados, 1);
  assert.match(JSON.stringify(e.correos[0]), /no se pudo confirmar si terminó/);
});

test("dos envíos a la vez del mismo aviso no duplican el correo", async () => {
  const e = entorno();
  const enc = await encolarAvisoDinero(e.db, e.deps, DATOS);
  const [a, b] = await Promise.all([enviarAviso(e.db, e.deps, enc.id, T0), enviarAviso(e.db, e.deps, enc.id, T0)]);
  assert.equal(e.correos.length, 1);
  assert.ok([a.estado, b.estado].includes("enviado"));
});

test("se pierde el correo de Jorge después de registrar: el aviso queda fallido con motivo sin_aprobador (visible)", async () => {
  const e = entorno();
  const enc = await encolarAvisoDinero(e.db, e.deps, DATOS);
  const r = await enviarAviso(e.db, { ...e.deps, aprobadorEmail: undefined }, enc.id, T0);
  assert.equal(r.estado, "fallido");
  assert.equal((await e.db.prepare("SELECT ultimo_error FROM avisos_operacion").first()).ultimo_error, "sin_aprobador");
});

test("limpieza de datos personales: correos, RUT, teléfonos y cuentas se ocultan; solo nombre de pila o iniciales", () => {
  assert.equal(limpiarTextoAviso("Escribe a ana@correo.cl o llama al +56 9 7667 3577"), "Escribe a [oculto] o llama al [oculto]");
  assert.equal(limpiarTextoAviso("RUT 12.345.678-5 y 12345678-K"), "RUT [oculto] y [oculto]");
  assert.equal(limpiarTextoAviso("cuenta 0012345678901"), "cuenta [oculto]");
  assert.equal(limpiarTextoAviso("Pedido 1234 por $52.990"), "Pedido 1234 por $52.990");
  assert.equal(nombrePila("  juan   pérez "), "Juan");
  assert.equal(nombrePila("MARÍA JOSÉ"), "María");
  assert.equal(nombrePila("x@y.cl 12345678"), null);
  assert.equal(nombrePila("<script>alert(1)</script>"), null);
  assert.equal(iniciales("x@y.cl 12345678"), "X.");
  assert.equal(iniciales("Juan Pérez González"), "J. P.");
  assert.equal(iniciales(""), null);
});

test("el aviso de dinero se registra igual aunque el nombre del cliente sea raro (iniciales) y no admite datos de cuenta en el resumen", async () => {
  const e = entorno();
  await avisarOperacionDinero(e.db, e.deps, { ...DATOS, clienteNombre: "x@y.cl 12345678", resumen: "Pagó con la cuenta 99887766554" }, async () => 1);
  const todo = JSON.stringify(e.correos[0]);
  assert.doesNotMatch(todo, /x@y\.cl|12345678|99887766554/);
});

test("el HTML del correo de aviso escapa todo texto y lleva los botones", async () => {
  const { htmlCorreoAviso } = await import("./pruebas/aviso-servidor-sin-servidor.mjs");
  const html = htmlCorreoAviso({
    para: "j@example.com", asunto: "Asunto <b>", titulo: "Título <script>", intro: "Intro & más",
    filas: [{ etiqueta: "Qué <i>", valor: "<img src=x onerror=alert(1)>" }], botones: [{ etiqueta: "Ver", href: `${BASE}/admin/conexiones` }], pie: "Pie",
  });
  assert.doesNotMatch(html, /<script>|<img|<i>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /admin\/conexiones/);
});
