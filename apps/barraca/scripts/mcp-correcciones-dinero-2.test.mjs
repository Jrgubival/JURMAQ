// Segunda re-auditoría de la Parte B (dinero), 25-11-2026: reintentos que consultan SIEMPRE a Transbank, salida del panel
// coherente (transferencia sin devolución, pago tardío) y datos de pago sin falsos positivos. Solo dobles, nada real.
// Correr: node --test scripts/mcp-correcciones-dinero-2.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const DP = await import("../src/lib/contenido/datos-pago.ts");
const { reintentarDevolucionConsultando, MINUTOS_EN_CURSO_VIEJO } = await import("../src/lib/pedidos/devolucion-webpay.ts");
const { salidaDevolucion, pedidoTransferenciaPagadoSinDevolucion } = await import("../src/lib/pedidos/devolucion-panel.ts");

const T0 = Date.UTC(2026, 10, 25, 15, 0, 0);
const MIN = 60_000;
const hace = (m) => new Date(T0 - m * MIN).toISOString();
const leer = (r) => readFileSync(new URL(r, import.meta.url), "utf8");

// ───────── reintentos: siempre se consulta antes ─────────
function entorno(reembolsoInicial, tb, extra = {}) {
  const e = { reembolso: reembolsoInicial, pedidas: 0, consultas: 0 };
  e.deps = {
    ahora: () => new Date(T0).toISOString(),
    tomarReembolso: async (_n, r) => { await Promise.resolve(); if (!e.reembolso || e.reembolso.estado === "error") { e.reembolso = r; return true; } return false; },
    retomarReembolso: async (_n, f, r) => { await Promise.resolve(); if (e.reembolso?.estado === "en_curso" && e.reembolso.fecha === f) { e.reembolso = r; return true; } return false; },
    guardarReembolso: async (_n, r) => { e.reembolso = r; },
    estadoTransaccion: async () => { e.consultas++; if (tb instanceof Error) throw tb; return tb; },
    reembolsar: async () => { e.pedidas++; return { ok: true, tipo: "REVERSED", autorizacion: "1" }; },
    ...extra,
  };
  return e;
}
const P = { numero: "BJ-261125-AAAA", total: 15000, pasarela_referencia: "TOK" };
const ok = (estado, monto = 15000, saldo = monto) => ({ estado, monto, saldo });
const DESDES = [
  ["sin registro", null, { tipo: "sin_registro" }],
  ["error", { estado: "error", medio: "webpay", monto: 15000, fecha: hace(60) }, { tipo: "error" }],
  ["en curso viejo", { estado: "en_curso", medio: "webpay", monto: 15000, fecha: hace(40) }, { tipo: "en_curso", fecha: hace(40) }],
];

for (const [nombre, inicial, desde] of DESDES) {
  test(`reintento desde «${nombre}»: la anulación SÍ salió pero se guardó error → queda hecha, sin devolver otra vez`, async () => {
    for (const st of ["REVERSED", "NULLIFIED"]) {
      const e = entorno(inicial, ok(st));
      assert.equal((await reintentarDevolucionConsultando(e.deps, P, desde)).resultado, "hecho");
      assert.equal(e.consultas, 1); assert.equal(e.pedidas, 0);
      assert.equal(e.reembolso.estado, "hecho");
    }
  });
  test(`reintento desde «${nombre}»: sigue cobrada y entera → se pide UNA devolución`, async () => {
    const e = entorno(inicial, ok("AUTHORIZED"));
    assert.equal((await reintentarDevolucionConsultando(e.deps, P, desde)).resultado, "hecho");
    assert.equal(e.consultas, 1); assert.equal(e.pedidas, 1);
  });
  test(`reintento desde «${nombre}»: estado ambiguo o consulta fallida → «incierta» y NO se pide nada`, async () => {
    const casos = [new Error("timeout"), ok("PARTIALLY_NULLIFIED"), ok("FAILED"), { estado: null, monto: null, saldo: null }, ok("AUTHORIZED", 9999), ok("AUTHORIZED", 15000, 5000), { estado: "AUTHORIZED", monto: null, saldo: null }];
    for (const c of casos) {
      const e = entorno(inicial, c);
      assert.equal((await reintentarDevolucionConsultando(e.deps, P, desde)).resultado, "incierta", String(JSON.stringify(c)));
      assert.equal(e.pedidas, 0); assert.equal(e.reembolso.estado, "incierto");
    }
  });
  test(`reintento desde «${nombre}»: dos clics a la vez = una sola devolución`, async () => {
    const e = entorno(inicial, ok("AUTHORIZED"));
    const rs = await Promise.all([reintentarDevolucionConsultando(e.deps, P, desde), reintentarDevolucionConsultando(e.deps, P, desde)]);
    assert.deepEqual(rs.map((r) => r.resultado).sort(), ["hecho", "ocupada"]);
    assert.equal(e.pedidas, 1);
  });
}

test("reintento: si Transbank rechaza (4xx) tras confirmar que sigue cobrada, queda en error; un timeout al pedir queda incierta", async () => {
  let e = entorno({ estado: "error", medio: "webpay", monto: 15000, fecha: hace(5) }, ok("AUTHORIZED"), { reembolsar: async () => { const x = new Error("status code 422"); x.name = "TransbankError"; throw x; } });
  assert.equal((await reintentarDevolucionConsultando(e.deps, P, { tipo: "error" })).resultado, "rechazada");
  e = entorno({ estado: "error", medio: "webpay", monto: 15000, fecha: hace(5) }, ok("AUTHORIZED"), { reembolsar: async () => { throw new Error("socket hang up"); } });
  assert.equal((await reintentarDevolucionConsultando(e.deps, P, { tipo: "error" })).resultado, "incierta");
  assert.equal(e.reembolso.estado, "incierto");
});

test("el servidor siempre usa la versión que consulta (no queda la rama ciega)", () => {
  const rechazo = leer("../src/lib/pedidos/rechazo.ts");
  assert.match(rechazo, /reintentarDevolucionConsultando/);
  assert.doesNotMatch(rechazo, /d = await devolverWebpayDetallado\(pedido\)/);
  assert.match(rechazo, /salidaDevolucion\(pedido, Date\.now\(\)\)/);
});

// ───────── salida del panel: el botón que se muestra es el que el servidor acepta ─────────
const base = { estado: "cancelado", metodo_pago: "webpay", pasarela: "webpay", pasarela_referencia: "TOK", pagado_at: hace(100), reembolso: null };
const r = (estado, medio = "webpay", fecha = hace(1)) => ({ estado, medio, monto: 15000, fecha });

test("salida: Webpay pagado, cancelado o no aprobado", () => {
  for (const estado of ["cancelado", "rechazado"]) {
    assert.equal(salidaDevolucion({ ...base, estado }, T0), "reintentar");
    assert.equal(salidaDevolucion({ ...base, estado, reembolso: r("error") }, T0), "reintentar");
    assert.equal(salidaDevolucion({ ...base, estado, reembolso: r("incierto") }, T0), "resolver");
    assert.equal(salidaDevolucion({ ...base, estado, reembolso: r("hecho") }, T0), null);
  }
  assert.equal(salidaDevolucion({ ...base, estado: "pagado" }, T0), null);
  assert.equal(salidaDevolucion({ ...base, pasarela_referencia: null }, T0), null);
});

test("salida: «en curso» reciente espera; vieja se reintenta (con consulta)", () => {
  assert.equal(salidaDevolucion({ ...base, reembolso: r("en_curso", "webpay", hace(MINUTOS_EN_CURSO_VIEJO - 1)) }, T0), "esperar");
  assert.equal(salidaDevolucion({ ...base, reembolso: r("en_curso", "webpay", hace(MINUTOS_EN_CURSO_VIEJO + 1)) }, T0), "reintentar");
});

test("salida: pago tardío (sin pagado_at) con devolución abierta tiene salida; sin devolución no se inventa un cobro", () => {
  const tardio = { ...base, pagado_at: null };
  assert.equal(salidaDevolucion({ ...tardio, reembolso: r("error") }, T0), "reintentar");
  assert.equal(salidaDevolucion({ ...tardio, reembolso: r("en_curso", "webpay", hace(30)) }, T0), "reintentar");
  assert.equal(salidaDevolucion({ ...tardio, reembolso: r("en_curso", "webpay", hace(2)) }, T0), "esperar");
  assert.equal(salidaDevolucion({ ...tardio, reembolso: r("incierto") }, T0), "resolver");
  assert.equal(salidaDevolucion({ ...tardio, reembolso: null }, T0), null);
  assert.equal(salidaDevolucion({ ...tardio, reembolso: r("hecho") }, T0), null);
});

test("salida: transferencia pagada y cancelada sin devolución registrada → registrar la pendiente (y solo ahí)", () => {
  const tr = { estado: "cancelado", metodo_pago: "transferencia", pasarela: "transferencia", pasarela_referencia: null, pagado_at: hace(100), reembolso: null };
  assert.equal(salidaDevolucion(tr, T0), "registrar_transferencia");
  assert.equal(salidaDevolucion({ ...tr, pasarela: null }, T0), "registrar_transferencia");
  assert.equal(pedidoTransferenciaPagadoSinDevolucion({ ...tr, estado: "rechazado" }), true);
  assert.equal(pedidoTransferenciaPagadoSinDevolucion({ ...tr, pagado_at: null }), false, "sin pago no hay nada que devolver");
  assert.equal(pedidoTransferenciaPagadoSinDevolucion({ ...tr, estado: "pagado" }), false);
  assert.equal(pedidoTransferenciaPagadoSinDevolucion({ ...tr, reembolso: r("pendiente", "transferencia") }), false);
  assert.equal(salidaDevolucion({ ...tr, reembolso: r("pendiente", "transferencia") }, T0), null, "la pendiente ya tiene su flujo");
  assert.equal(pedidoTransferenciaPagadoSinDevolucion({ ...base }), false, "Webpay no usa esta salida");
});

test("la ruta de devolución exige el permiso de reembolsar y la pantalla usa el mismo criterio; los textos de la herramienta dicen la salida correcta", () => {
  const ruta = leer("../src/app/api/admin/pedidos/[numero]/devolucion/route.ts");
  assert.match(ruta, /requirePermission\('barraca_ventas', 'reembolsar'\)/);
  assert.match(ruta, /registrar_pendiente/);
  const ui = leer("../src/app/admin/ventas/[numero]/DetalleVenta.tsx");
  assert.match(ui, /salidaDevolucion\(p, ahoraMs\)/);
  assert.match(ui, /Registrar devolución pendiente por transferencia/);
  assert.doesNotMatch(ui, /webpayCobrado/);
  const dinero = leer("../src/lib/mcp/tools/dinero.ts");
  assert.match(dinero, /PANEL_TRANSFERENCIA/);
  const store = leer("../src/lib/pedidos/index.ts");
  assert.match(store, /async registrarDevolucionTransferencia[^]*\.is\('reembolso', null\)[^]*\.not\('pagado_at', 'is', null\)/);
});

// ───────── datos de pago: separadores variados y falsos positivos ─────────
test("datos de pago: cuentas con separadores variados con contexto de cuenta o banco", () => {
  const malos = [
    "Cuenta: 1234 - 5678 - 9012",
    "Transfiere a 1234  5678  9012",
    "Deposita en 1.234.567.890 por favor",
    "Banco Estado 1234 – 5678 – 9012",
    "N° de cuenta 1234/5678/9012",
    "cuenta 12345-67890",
    "Titular Juan Pérez 12 34 56 78 90 12",
    "cta 1234 . 5678 . 9012",
    "4111 1111 1111 1111",
    "tarjeta 4111-1111-1111-1111",
  ];
  for (const t of malos) assert.equal(DP.contieneDatosDePago(t), true, t);
});

test("datos de pago: sin falsos positivos (contado.Pago, códigos de fabricante, precios, teléfonos)", () => {
  const buenos = [
    "Precio al contado.Pago con tarjeta o transferencia en caja",
    "Aceptamos efectivo, al contado.Pagos con Webpay en la tienda.",
    "Código de fabricante 1234567890",
    "Cód. fabricante 7891234560 modelo ST-45",
    "Lote 2026112501 serie 0012345678",
    "Pernos desde $12.990 - $15.990 - $18.990 según largo",
    "Medidas 2000 x 1000 x 3000 x 4000 mm",
    "Llama al 22 345 6789 / 22 345 6790",
    "Pedido mínimo de 10 unidades; stock 1.500.000",
    "Ver pago.jpg en la ficha",
    "Soldadora 220 V corriente alterna, giro libre",
  ];
  for (const t of buenos) assert.equal(DP.contieneDatosDePago(t), false, t);
  // los enlaces de verdad siguen bloqueados
  for (const t of ["https://contado.pago/x", "www.pagos.cl", "mira pagos.example.com/cobro", "webpay.cl", "https://x.cl/pagar"]) assert.equal(DP.contieneDatosDePago(t), true, t);
});

test("datos de pago: el texto real de los Términos y la privacidad se pueden republicar sin cambios; agregar una cuenta nueva no", () => {
  const terminos = leer("../src/content/legal/terminos.md");
  const privacidad = leer("../src/content/legal/privacidad.md");
  assert.equal(DP.agregaDatosDePago(terminos, terminos), false);
  assert.equal(DP.agregaDatosDePago(privacidad, privacidad), false);
  assert.equal(DP.agregaDatosDePago(terminos, `${terminos}\n\nNota: horario de atención de lunes a viernes, 09:00 a 18:00.`), false);
  assert.equal(DP.agregaDatosDePago(terminos, `${terminos}\nCuenta 1234 - 5678 - 9012`), true);
});
