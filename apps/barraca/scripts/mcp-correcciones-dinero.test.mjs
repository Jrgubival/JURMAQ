// Correcciones de la auditoría de la Parte B (dinero y borrado), 25-11-2026: topes de volumen, tiempo mínimo entre vista
// previa y confirmación, datos de pago endurecidos, devolución con reintento seguro, borrado más estricto, pago tardío,
// archivados en reportes, referencia de persona con pimienta y clasificación de errores de Transbank.
// Todo con dobles y D1 simulada. NUNCA toca pedidos reales.
// Correr: node --test scripts/mcp-correcciones-dinero.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { crearCtx, crearTienda, ficha } from "./pruebas/tienda-falsa.mjs";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";

const DP = await import("../src/lib/contenido/datos-pago.ts");
const Prod = await import("../src/lib/gestion-precios/productos-servicio.ts");
const { ejecutarDevolucionWebpay, fallaGarantizaQueNoSeDevolvio } = await import("../src/lib/pedidos/devolucion-webpay.ts");

const T0 = Date.UTC(2026, 10, 25, 15, 0, 0);
const JORGE = { id: "1", email: "contacto@jurmaq.cl" };

// ───────── 2. datos de pago endurecidos ─────────
test("datos de pago: números largos sin la palabra cuenta, ancho completo, acortadores, WhatsApp y rutas de pago", () => {
  const malos = [
    "Deposita en 12345678901234 por favor",
    "Transfiere al 1234 5678 9012",
    "Cuenta ０１２３４５６７８９０",
    "ｗｅｂｐａｙ.cl/x",
    "Cuenta vista 00-123-45678-9 a nombre de Juan",
    "RUT 12.345.678-5 cuenta rut banco estado",
    "Mira bit.ly/3abcde",
    "tinyurl.com/yabc",
    "https://t.co/zzz",
    "Escríbeme a wa.me/56999999999",
    "https://api.whatsapp.com/send?phone=56999999999",
    "https://ejemplo.cl/pagar?id=5",
    "https://ejemplo.cl/%70agar",
    "ejemplo.cl/checkout/ab",
    "https://pagos.ejemplo.cl/ahora",
    "https://ofertas.example/cobro",
    "CL12345678901234567890",
  ];
  for (const t of malos) assert.equal(DP.contieneDatosDePago(t), true, t);
  const buenos = [
    "Llámanos al +56 9 6123 4567 o al 22 345 6789",
    "Horario: 25-11-2026 15:00 a 18:00",
    "Fierro 10 mm x 6 m, $12.990 el kilo; 1.500.000 unidades al año",
    "Código de barras 7801234567890",
    "SKU 1234567890123",
    "Ver https://jurmaq.cl/contacto y https://barraca.jurmaq.cl/pago/error",
    "Aceptamos Webpay o transferencia bancaria; el banco de carpintero pesa 40 kg",
    "RUT de la empresa 76.111.222-3",
    "https://ejemplo.cl/catalogo/fierros",
  ];
  for (const t of buenos) assert.equal(DP.contieneDatosDePago(t), false, t);
  // lo que ya estaba (línea base) se puede dejar; agregarlo no
  const antes = "Escríbenos: https://wa.me/56988887777 o llama.";
  assert.equal(DP.agregaDatosDePago(antes, `${antes} Gracias.`), false);
  assert.equal(DP.agregaDatosDePago(antes, "Escríbenos: https://wa.me/56911112222"), true);
});

test("datos de pago: nombre y descripción de producto y categoría, crear y editar, los rechazan", async () => {
  const db = crearD1Simulada();
  const Tn = crearTienda([ficha({ id: 1, codigo: "A", precio: 5000, costo: 1000 })]);
  const ctx = (h) => crearCtx(db, JORGE, T0, h);
  const MALO = /datos bancarios o un enlace de pago/;
  await assert.rejects(Prod.editarProducto(Tn.deps, ctx("editar_producto"), { codigo: "A", nombre: "Fierro, paga a la cuenta 12345678901" }), MALO);
  await assert.rejects(Prod.editarProducto(Tn.deps, ctx("editar_producto"), { codigo: "A", descripcion: "Compra aquí: bit.ly/xyz" }), MALO);
  await assert.rejects(Prod.crearProducto(Tn.deps, ctx("crear_producto"), { codigo: "N-1", nombre: "Pago directo en wa.me/56999999999", precio_web: 5000 }), MALO);
  await assert.rejects(Prod.crearProducto(Tn.deps, ctx("crear_producto"), { codigo: "N-2", nombre: "Ok", descripcion: "Transfiere a 98765432109876", precio_web: 5000 }), MALO);
  await assert.rejects(Prod.crearCategoria(Tn.deps, ctx("crear_categoria"), { nombre: "Cat pagos.ejemplo.cl" }), MALO);
  await assert.rejects(Prod.crearCategoria(Tn.deps, ctx("crear_categoria"), { nombre: "Cat", descripcion: "tinyurl.com/abc" }), MALO);
  assert.equal(Tn.filas.length, 1, "no se creó nada");
  // lo normal sigue funcionando
  const ok = await Prod.editarProducto(Tn.deps, ctx("editar_producto"), { codigo: "A", nombre: "Fierro estriado 10 mm", descripcion: "Barra de 6 m. Llama al +56 9 6123 4567." });
  assert.equal(ok.datos.aplicado !== false, true);
});

// ───────── BAJO: clasificación 4xx de Transbank + 5. pago tardío ─────────
const tb = (m) => Object.assign(new Error(m), { name: "TransbankError" });
test("Transbank: solo 400, 401, 403, 404 y 422 garantizan que no se devolvió; 408, 409, 429 y 5xx son inciertos", () => {
  for (const c of [400, 401, 403, 404, 422]) assert.equal(fallaGarantizaQueNoSeDevolvio(tb(`AxiosError: Request failed with status code ${c}\n`)), true, String(c));
  for (const c of [402, 405, 408, 409, 410, 418, 429, 500, 502, 503, 504]) assert.equal(fallaGarantizaQueNoSeDevolvio(tb(`AxiosError: Request failed with status code ${c}\n`)), false, String(c));
  assert.equal(fallaGarantizaQueNoSeDevolvio(Object.assign(new Error("x"), { sinEnviar: true })), true);
  assert.equal(fallaGarantizaQueNoSeDevolvio(new Error("timeout")), false);
});

test("pago tardío (retorno de Webpay con el pedido ya cerrado): la devolución usa la misma función, y un tiempo agotado o 5xx queda incierto sin reintentar", async () => {
  const fuente = readFileSync(new URL("../src/app/api/pagos/webpay/retorno/route.ts", import.meta.url), "utf8");
  assert.match(fuente, /ejecutarDevolucionWebpay\(/, "el retorno usa la función común");
  assert.ok(!/reembolsarWebpay\(tokenWs/.test(fuente), "el retorno ya no llama a Transbank por su cuenta");
  for (const falla of [new Error("AxiosError: timeout of 5000ms exceeded"), tb("AxiosError: Request failed with status code 503\n")]) {
    let reembolso = null; let llamadas = 0;
    const deps = {
      tomarReembolso: async (_n, r) => { if (reembolso && reembolso.estado !== "error") return false; reembolso = r; return true; },
      guardarReembolso: async (_n, r) => { reembolso = r; },
      reembolsar: async () => { llamadas++; throw falla; },
    };
    const r = await ejecutarDevolucionWebpay(deps, { numero: "BJ-261120-AAAA", total: 15000, pasarela_referencia: "T" });
    assert.equal(r.resultado, "incierta");
    assert.equal(reembolso.estado, "incierto");
    assert.equal((await ejecutarDevolucionWebpay(deps, { numero: "BJ-261120-AAAA", total: 15000, pasarela_referencia: "T" })).resultado, "ocupada", "no se reintenta sola");
    assert.equal(llamadas, 1);
  }
});

// ═════════ Herramientas de dinero y borrado (con el arnés compartido) ═════════
const { montar, pedido, webpayPagado, T0: TA, NUM, JORGE: JORGE_A, PIMIENTA } = await import("./pruebas/dinero-arnes.mjs");
const { TOPES_DINERO, APROBACION_CORREO_CANCELAR_PAGADO, reservarCupoDinero } = await import("../src/lib/mcp/topes-dinero.ts");
const { motivoNoBorrable, motivoNoArchivable } = await import("../src/lib/mcp/tools/borrado.ts");
const { evaluarCancelacion, cobradoSinDevolucion } = await import("../src/lib/mcp/tools/dinero.ts");
const { sincronizarDevolucionPanel, leerDevolucion, reservarDevolucion } = await import("../src/lib/pedidos/devoluciones-d1.ts");
const { retomarDevolucionEnCurso, reembolsoEnCursoViejo, MINUTOS_EN_CURSO_VIEJO } = await import("../src/lib/pedidos/devolucion-webpay.ts");
const { filtrarArchivadosInformando, textoArchivados, ARCHIVADOS_NO_DISPONIBLES } = await import("../src/lib/pedidos/archivados.ts");
const { referenciaPersona, hmacSha256Hex } = await import("../src/lib/borrado/personas.ts");
const { sha256Hex } = await import("../src/lib/gestion/util.ts");
const { registro } = await import("../src/lib/mcp/tools/index.ts");
const HORA = 3_600_000;
const MIN = 60_000;

const conModo = async (modo, fn) => {
  const antes = { m: process.env.BARRACA_MODO_APROBACION, a: process.env.BARRACA_APROBADOR_EMAIL };
  process.env.BARRACA_MODO_APROBACION = modo; process.env.BARRACA_APROBADOR_EMAIL = "jorge.personal@example.com";
  try { await fn(); } finally {
    for (const [k, v] of [["BARRACA_MODO_APROBACION", antes.m], ["BARRACA_APROBADOR_EMAIL", antes.a]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
};

// ───────── 1. topes duros de volumen ─────────
test("tope: la operación 11 en una hora se rechaza, no hace nada, avisa a Jorge, y es igual en exigir y avisar", async () => {
  for (const modo of ["exigir", "avisar"]) {
    await conModo(modo, async () => {
      const m = await montar();
      for (let i = 0; i < TOPES_DINERO.operacionesPorHora; i++) await m.llamar("desarchivar_pedido", { numeros: [NUM("A")] });
      const antes = m.correos.length;
      await m.falla("desarchivar_pedido", { numeros: [NUM("A")] }, /Tope de seguridad[^]*10 operaciones[^]*hágalo desde el panel/);
      const aviso = m.correos.slice(antes).find((c) => /BLOQUEADA por tope/.test(c.asunto));
      assert.ok(aviso, `${modo}: Jorge recibe el aviso del intento`);
      assert.ok(aviso.filas.some((f) => /BLOQUEADO/.test(f.valor)));
      // pasada la hora vuelve a andar
      await m.llamar("desarchivar_pedido", { numeros: [NUM("A")] }, JORGE_A, TA + HORA + 11 * 10_000 + MIN);
    });
  }
});

test("tope: 30 operaciones en 24 horas, aunque cada hora esté por debajo de 10", async () => {
  const m = await montar();
  for (let h = 0; h < 3; h++) for (let i = 0; i < 10; i++) await m.llamar("desarchivar_pedido", { numeros: [NUM("A")] }, JORGE_A, TA + h * (HORA + MIN) + i * 20_000);
  await assert.rejects(() => m.llamar("desarchivar_pedido", { numeros: [NUM("A")] }, JORGE_A, TA + 3 * (HORA + MIN)), /30 operaciones[^]*24 horas/);
  await m.llamar("desarchivar_pedido", { numeros: [NUM("A")] }, JORGE_A, TA + 25 * HORA);
});

test("tope: cada usuario tiene su propio contador", async () => {
  const m = await montar();
  for (let i = 0; i < TOPES_DINERO.operacionesPorHora; i++) await m.llamar("desarchivar_pedido", { numeros: [NUM("A")] });
  await m.llamar("desarchivar_pedido", { numeros: [NUM("A")] }, { id: "2", email: "otro@example.com" });
});

test("tope: la reserva es atómica (12 llamadas a la vez dejan pasar exactamente 10)", async () => {
  const m = await montar();
  const rs = await Promise.allSettled(Array.from({ length: 12 }, () => m.llamar("desarchivar_pedido", { numeros: [NUM("A")] }, JORGE_A, TA + 5_000)));
  assert.equal(rs.filter((r) => r.status === "fulfilled").length, 10);
  assert.equal(rs.filter((r) => r.status === "rejected" && /Tope de seguridad/.test(r.reason.message)).length, 2);
});

test("tope de devoluciones: la 6.ª cancelación con devolución en una hora se rechaza y NO llama a Transbank", async () => {
  const letras = ["A", "B", "C", "D", "E", "F"];
  const m = await montar({ pedidos: letras.map((c) => webpayPagado(c)) });
  const hacer = async (c) => {
    const v = await m.llamar("previsualizar_cancelar_pedido_pagado", { numero: NUM(c), motivo: "cliente" });
    return m.llamar("confirmar_cancelar_pedido_pagado", { numero: NUM(c), motivo: "cliente", monto: 15000, id_vista_previa: v.datos.idVistaPrevia });
  };
  for (const c of letras.slice(0, 5)) assert.match((await hacer(c)).texto, /devolución HECHA/);
  assert.equal(m.llamadasTransbank.length, 5);
  const v = await m.llamar("previsualizar_cancelar_pedido_pagado", { numero: NUM("F"), motivo: "cliente" });
  await m.falla("confirmar_cancelar_pedido_pagado", { numero: NUM("F"), motivo: "cliente", monto: 15000, id_vista_previa: v.datos.idVistaPrevia }, /5 devoluciones en una hora[^]*hágalo desde el panel/);
  assert.equal(m.llamadasTransbank.length, 5, "no se tocó Transbank");
  assert.equal(m.store.mapa.get(NUM("F")).estado, "pagado", "el pedido no se canceló");
  assert.ok(m.correos.some((c) => /BLOQUEADA por tope/.test(c.asunto)));
});

test("tope de monto: no se devuelve más de $1.000.000 acumulados en 24 horas", async () => {
  const grande = (c) => webpayPagado(c, { total: 400_000, pago_detalle: { monto: 400_000 }, items: [{ productoId: 1, codigo: "X", nombre: "Viga", cantidad: 1, precio: 400_000, subtotal: 400_000 }] });
  const m = await montar({ pedidos: [grande("A"), grande("B"), grande("C")] });
  const hacer = async (c, ahora) => {
    const v = await m.llamar("previsualizar_cancelar_pedido_pagado", { numero: NUM(c), motivo: "otro" }, JORGE_A, ahora);
    return m.llamar("confirmar_cancelar_pedido_pagado", { numero: NUM(c), motivo: "otro", monto: 400_000, id_vista_previa: v.datos.idVistaPrevia }, JORGE_A, ahora + 20_000);
  };
  await hacer("A", TA); await hacer("B", TA + 5 * MIN);
  const v = await m.llamar("previsualizar_cancelar_pedido_pagado", { numero: NUM("C"), motivo: "otro" }, JORGE_A, TA + 3 * HORA);
  await assert.rejects(() => m.llamar("confirmar_cancelar_pedido_pagado", { numero: NUM("C"), motivo: "otro", monto: 400_000, id_vista_previa: v.datos.idVistaPrevia }, JORGE_A, TA + 3 * HORA + 20_000), /\$1\.000\.000 devueltos en 24 horas/);
  assert.equal(m.llamadasTransbank.length, 2);
  // pasadas 24 horas el cupo vuelve
  const v2 = await m.llamar("previsualizar_cancelar_pedido_pagado", { numero: NUM("C"), motivo: "otro" }, JORGE_A, TA + 25 * HORA);
  await m.llamar("confirmar_cancelar_pedido_pagado", { numero: NUM("C"), motivo: "otro", monto: 400_000, id_vista_previa: v2.datos.idVistaPrevia }, JORGE_A, TA + 25 * HORA + 20_000);
  assert.equal(m.llamadasTransbank.length, 3);
});

test("tope: si no se puede leer el contador, la operación NO se hace (falla cerrado) y se avisa", async () => {
  const m = await montar({ pedidos: [webpayPagado("A")] });
  const v = await m.llamar("previsualizar_cancelar_pedido_pagado", { numero: NUM("A"), motivo: "cliente" });
  await m.db.prepare("DROP TABLE operaciones_dinero").run();
  await m.falla("confirmar_cancelar_pedido_pagado", { numero: NUM("A"), motivo: "cliente", monto: 15000, id_vista_previa: v.datos.idVistaPrevia }, /no pude comprobar[^]*No se hizo nada/);
  assert.equal(m.llamadasTransbank.length, 0);
  assert.equal(m.store.mapa.get(NUM("A")).estado, "pagado");
});

test("tope: los valores viven solo en el código; ningún esquema de herramienta los menciona ni los puede cambiar", () => {
  assert.deepEqual({ ...TOPES_DINERO }, { operacionesPorHora: 10, operacionesPor24h: 30, devolucionesPorHora: 5, montoDevueltoPor24h: 1_000_000, vistaPreviaDuraMs: 600_000, esperaMinimaConfirmacionMs: 8_000 });
  for (const h of registro.lista()) {
    const campos = Object.keys(h.esquema.shape ?? {}).join(" ");
    assert.ok(!/tope|limite_dinero|operaciones_por|maximo_dinero|esperaMinima|espera_minima|ttl/i.test(campos), `${h.nombre}: ${campos}`);
  }
  const src = readFileSync(new URL("../src/lib/mcp/topes-dinero.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /process\.env/, "los topes no se leen de variables");
  assert.equal(APROBACION_CORREO_CANCELAR_PAGADO, false, "modo solo aviso: la aprobación por correo para cancelar con devolución es decisión pendiente de Jorge");
  assert.match(readFileSync(new URL("../src/lib/mcp/tools/dinero.ts", import.meta.url), "utf8"), /if \(APROBACION_CORREO_CANCELAR_PAGADO\) throw/, "el interruptor está conectado y falla cerrado");
});

test("tope: el SQL de reserva respeta el monto exacto en el límite", async () => {
  const db = crearD1Simulada();
  const r1 = await reservarCupoDinero(db, { usuarioId: "9", herramienta: "x", esDevolucion: true, monto: 1_000_000, ahora: TA });
  assert.equal(r1.ok, true);
  const r2 = await reservarCupoDinero(db, { usuarioId: "9", herramienta: "x", esDevolucion: true, monto: 1, ahora: TA + 1000 });
  assert.equal(r2.ok, false);
  assert.equal(r2.motivo, "monto_devuelto_dia");
  const r3 = await reservarCupoDinero(db, { usuarioId: "9", herramienta: "x", esDevolucion: false, ahora: TA + 2000 });
  assert.equal(r3.ok, true, "una operación sin devolución sigue pudiendo");
});

// ───────── 1b. vista previa y confirmación ─────────
test("vista previa y confirmación: no pueden ir pegadas (ni en la misma llamada), no se gasta el id, y a los segundos sí sirve", async () => {
  const m = await montar({ pedidos: [webpayPagado("A")] });
  const v = await m.llamar("previsualizar_cancelar_pedido_pagado", { numero: NUM("A"), motivo: "cliente" }, JORGE_A, TA);
  const args = { numero: NUM("A"), motivo: "cliente", monto: 15000, id_vista_previa: v.datos.idVistaPrevia };
  await assert.rejects(() => m.llamar("confirmar_cancelar_pedido_pagado", args, JORGE_A, TA), /demasiado pronto/);
  await assert.rejects(() => m.llamar("confirmar_cancelar_pedido_pagado", args, JORGE_A, TA + TOPES_DINERO.esperaMinimaConfirmacionMs - 1), /demasiado pronto/);
  assert.equal(m.llamadasTransbank.length, 0);
  assert.equal(m.store.mapa.get(NUM("A")).estado, "pagado");
  const r = await m.llamar("confirmar_cancelar_pedido_pagado", args, JORGE_A, TA + TOPES_DINERO.esperaMinimaConfirmacionMs);
  assert.match(r.texto, /devolución HECHA/);
});

test("vista previa de dinero: dura 10 minutos y luego vence", async () => {
  const m = await montar({ pedidos: [webpayPagado("A")] });
  const v = await m.llamar("previsualizar_cancelar_pedido_pagado", { numero: NUM("A"), motivo: "cliente" }, JORGE_A, TA);
  assert.equal(v.datos.expiraEn - TA, 10 * MIN);
  await assert.rejects(() => m.llamar("confirmar_cancelar_pedido_pagado", { numero: NUM("A"), motivo: "cliente", monto: 15000, id_vista_previa: v.datos.idVistaPrevia }, JORGE_A, TA + 10 * MIN + 1), /venció/);
  assert.equal(m.llamadasTransbank.length, 0);
});

// ───────── 3. cobrado sin devolución ─────────
test("muere el proceso DESPUÉS de cancelar: queda cancelado y cobrado, se avisa, la herramienta lo explica y no se repite desde Claude", async () => {
  const m = await montar({ pedidos: [webpayPagado("A")] });
  m.deps.devolverWebpay = async () => { throw new Error("worker muerto"); };
  const v = await m.llamar("previsualizar_cancelar_pedido_pagado", { numero: NUM("A"), motivo: "cliente" });
  await m.falla("confirmar_cancelar_pedido_pagado", { numero: NUM("A"), motivo: "cliente", monto: 15000, id_vista_previa: v.datos.idVistaPrevia }, /se CORTÓ después de cancelar[^]*NO repitas[^]*Reintentar devolución/);
  const p = m.store.mapa.get(NUM("A"));
  assert.equal(p.estado, "cancelado");
  assert.equal(p.reembolso, null, "el cliente sigue cobrado y sin devolución registrada");
  assert.equal((await leerDevolucion(m.db, NUM("A"))).estado, "devolucion_en_curso", "D1 queda en curso: Claude no puede repetirla");
  assert.ok(m.correos.some((c) => /Cancelar pedido pagado/.test(c.asunto) && c.filas.some((f) => /falló|no se pudo confirmar/i.test(f.valor))), "aviso a Jorge con resultado de error");
  // la vista previa siguiente explica la situación y avisa a Jorge (una sola vez)
  const antes = m.correos.length;
  await m.falla("previsualizar_cancelar_pedido_pagado", { numero: NUM("A"), motivo: "cliente" }, /ya está cancelado y PAGADO, pero SIN devolución[^]*Reintentar devolución/);
  assert.equal(m.correos.length, antes + 1);
  assert.match(m.correos.at(-1).asunto, /Pedido cobrado sin devolución terminada/);
  await m.falla("previsualizar_cancelar_pedido_pagado", { numero: NUM("A"), motivo: "cliente" }, /SIN devolución/);
  assert.equal(m.correos.length, antes + 1, "no se repite el aviso en 6 horas");
  // el panel lo termina: reembolso nulo + cancelado → la devolución sale con el candado de siempre y D1 se pone al día
  assert.equal(cobradoSinDevolucion(await m.store.porNumero(NUM("A"))), true);
  const r = await retomarOEjecutarComoPanel(m, NUM("A"));
  assert.equal(r.resultado, "hecho");
  assert.equal(m.store.mapa.get(NUM("A")).reembolso.estado, "hecho");
  assert.equal(await sincronizarDevolucionPanel(m.db, NUM("A"), "devolucion_hecha", TA + 60 * MIN), true);
  assert.equal((await leerDevolucion(m.db, NUM("A"))).estado, "devolucion_hecha");
});

async function retomarOEjecutarComoPanel(m, numero) {
  const p = await m.store.porNumero(numero);
  return ejecutarDevolucionWebpay(
    { tomarReembolso: m.store.tomarReembolso, guardarReembolso: m.store.guardarReembolso, reembolsar: async (t, mo) => { m.llamadasTransbank.push({ t, mo }); return { ok: true, tipo: "REVERSED", autorizacion: "9" }; } },
    { numero, total: p.total, pasarela_referencia: p.pasarela_referencia },
  );
}

test("devolución «en curso» vieja: el panel consulta Transbank antes (ya devuelto = hecha sin pedir otra; cobrado = se pide; dudoso = incierta)", async () => {
  const hace = (min) => new Date(TA - min * MIN).toISOString();
  const nuevoEntorno = (estadoTb, extra = {}) => {
    const e = { reembolso: { estado: "en_curso", medio: "webpay", monto: 15000, fecha: hace(30) }, pedidas: 0, ...extra };
    e.deps = {
      ahora: () => new Date(TA).toISOString(),
      retomarReembolso: async (_n, f, r) => { if (e.reembolso?.estado === "en_curso" && e.reembolso.fecha === f) { e.reembolso = r; return true; } return false; },
      guardarReembolso: async (_n, r) => { e.reembolso = r; },
      estadoTransaccion: async () => { if (estadoTb instanceof Error) throw estadoTb; return { estado: estadoTb, monto: 15000, saldo: 15000 }; },
      tomarReembolso: async () => false,
      reembolsar: async () => { e.pedidas++; return { ok: true, tipo: "REVERSED", autorizacion: "1" }; },
    };
    return e;
  };
  const ped = (e) => ({ numero: NUM("A"), total: 15000, pasarela_referencia: "T", fechaEnCurso: e.reembolso.fecha });
  assert.equal(reembolsoEnCursoViejo({ estado: "en_curso", medio: "webpay", fecha: hace(MINUTOS_EN_CURSO_VIEJO - 1) }, TA), false);
  assert.equal(reembolsoEnCursoViejo({ estado: "en_curso", medio: "webpay", fecha: hace(MINUTOS_EN_CURSO_VIEJO + 1) }, TA), true);
  assert.equal(reembolsoEnCursoViejo({ estado: "error", medio: "webpay", fecha: hace(99) }, TA), false);
  // ya devuelto en Transbank: se marca hecha y NO se pide otra
  let e = nuevoEntorno("REVERSED");
  assert.equal((await retomarDevolucionEnCurso(e.deps, ped(e))).resultado, "hecho");
  assert.equal(e.reembolso.estado, "hecho"); assert.equal(e.pedidas, 0);
  // sigue cobrado: se pide una
  e = nuevoEntorno("AUTHORIZED");
  assert.equal((await retomarDevolucionEnCurso(e.deps, ped(e))).resultado, "hecho");
  assert.equal(e.pedidas, 1);
  // no se pudo consultar, o estado raro: incierta y no se pide nada
  for (const x of [new Error("red"), "PARTIALLY_NULLIFIED", "FAILED", null]) {
    e = nuevoEntorno(x);
    assert.equal((await retomarDevolucionEnCurso(e.deps, ped(e))).resultado, "incierta", String(x));
    assert.equal(e.reembolso.estado, "incierto"); assert.equal(e.pedidas, 0);
  }
  // dos clics a la vez: avanza uno solo (guarda atómica contra la misma fecha)
  e = nuevoEntorno("AUTHORIZED");
  const pedido2 = ped(e);
  const rs = await Promise.all([retomarDevolucionEnCurso(e.deps, pedido2), retomarDevolucionEnCurso(e.deps, pedido2)]);
  assert.deepEqual(rs.map((r) => r.resultado).sort(), ["hecho", "ocupada"]);
  assert.equal(e.pedidas, 1);
});

test("el panel (resolver incierta / reintentar) pone al día devoluciones_mcp para no bloquear archivar ni borrar", async () => {
  const db = crearD1Simulada();
  await reservarDevolucion(db, { numero: NUM("A"), medio: "webpay", monto: 15000, usuarioId: "1", ahora: TA });
  await db.prepare("UPDATE devoluciones_mcp SET estado = 'devolucion_incierta' WHERE numero = ?").bind(NUM("A")).run();
  const ped = webpayPagado("A", { estado: "cancelado", reembolso: { estado: "incierto", medio: "webpay", monto: 15000, fecha: "x" } });
  assert.match(motivoNoArchivable(ped, "devolucion_incierta") ?? "", /a medias|en curso o incierta/);
  assert.equal(await sincronizarDevolucionPanel(db, NUM("A"), "devolucion_hecha", TA + 1000, "resuelta desde el panel"), true);
  assert.equal((await leerDevolucion(db, NUM("A"))).estado, "devolucion_hecha");
  assert.equal(motivoNoArchivable(webpayPagado("A", { estado: "cancelado", reembolso: { estado: "hecho", medio: "webpay", monto: 15000, fecha: "x" } }), "devolucion_hecha"), null, "ya no bloquea archivar");
  // «No se devolvió» deja la fila en «rechazada» (el panel puede reintentar), tampoco queda incierta
  await reservarDevolucion(db, { numero: NUM("B"), medio: "webpay", monto: 15000, usuarioId: "1", ahora: TA });
  await db.prepare("UPDATE devoluciones_mcp SET estado = 'devolucion_incierta' WHERE numero = ?").bind(NUM("B")).run();
  assert.equal(await sincronizarDevolucionPanel(db, NUM("B"), "devolucion_rechazada", TA + 2000), true);
  assert.equal((await leerDevolucion(db, NUM("B"))).estado, "devolucion_rechazada");
  // una fila ya terminada no se pisa
  assert.equal(await sincronizarDevolucionPanel(db, NUM("A"), "devolucion_rechazada", TA + 3000), false);
  assert.equal((await leerDevolucion(db, NUM("A"))).estado, "devolucion_hecha");
});

test("el panel ofrece el reintento seguro en los tres estados colgados (revisión del código de la pantalla)", () => {
  const ui = readFileSync(new URL("../src/app/admin/ventas/[numero]/DetalleVenta.tsx", import.meta.url), "utf8");
  assert.match(ui, /cerradoSinDevolucion/);
  assert.match(ui, /devolucionColgada/);
  assert.match(ui, /MINUTOS_EN_CURSO_VIEJO/);
  const rechazo = readFileSync(new URL("../src/lib/pedidos/rechazo.ts", import.meta.url), "utf8");
  assert.match(rechazo, /retomarDevolucionEnCurso/);
  assert.match(rechazo, /sincronizarConMcp\(numero, resultado === 'hecha'/);
});

test("pago_detalle sin monto: no se devuelve por Webpay sin un monto verificable", () => {
  const sin = webpayPagado("A", { pago_detalle: {} });
  const r = evaluarCancelacion(sin, { archivado: false });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /monto cobrado verificable/);
  assert.equal(evaluarCancelacion(webpayPagado("A", { pago_detalle: null }), { archivado: false }).ok, false);
  assert.equal(evaluarCancelacion(webpayPagado("A", { pago_detalle: { monto: "15000" } }), { archivado: false }).ok, false);
  assert.equal(evaluarCancelacion(webpayPagado("A"), { archivado: false }).ok, true);
  // la transferencia no tiene monto de pasarela: sigue funcionando
  assert.equal(evaluarCancelacion(pedido("T", { estado: "pagado", pagado_at: "x" }), { archivado: false }).ok, true);
});

// ───────── 4. borrado de pedido ─────────
test("borrar pedido: se rechaza con cualquier rastro de cobro, comprobante, devolución o documento", () => {
  const base = pedido("A", { estado: "cancelado", stock_descontado: false });
  assert.equal(motivoNoBorrable(base, null), null);
  const casos = [
    [{ pasarela_referencia: "TOKEN" }, /cobro en la pasarela/],
    [{ pago_id: "P1" }, /cobro en la pasarela/],
    [{ pago_detalle: { monto: 15000 } }, /cobro en la pasarela/],
    [{ transferencia_informada_at: "2026-11-20T10:00:00Z" }, /informó una transferencia/],
    [{ comprobante_path: "comp/a.jpg" }, /informó una transferencia|comprobante/],
    [{ pagado_at: "2026-11-20T10:00:00Z" }, /PAGADO/],
    [{ reembolso: { estado: "error", medio: "webpay", monto: 1, fecha: "x" } }, /devolución registrada/],
    [{ documento_path: "d.pdf" }, /boleta o factura/],
    [{ documento_subido_at: "x" }, /boleta o factura/],
    [{ courier_envio_id: "E1" }, /courier/],
    [{ stock_descontado: true }, /stock/],
  ];
  for (const [extra, patron] of casos) assert.match(motivoNoBorrable({ ...base, ...extra }, null) ?? "", patron, JSON.stringify(extra));
  assert.match(motivoNoBorrable(base, "devolucion_hecha") ?? "", /devolución registrada/);
  assert.match(motivoNoBorrable({ ...base, estado: "pagado" }, null) ?? "", /solo se borra un pedido cancelado/);
});

test("borrar pedido: la herramienta lo rechaza y el delete real es condicional a lo mismo (defensa en profundidad)", async () => {
  const m = await montar({ pedidos: [pedido("A", { estado: "cancelado", stock_descontado: false, pasarela_referencia: "TOKEN-A" })] });
  await m.falla("borrar_pedido_definitivo", { numero: NUM("A") }, /registro de un cobro en la pasarela/);
  assert.equal(m.store.mapa.size, 1);
  const src = readFileSync(new URL("../src/lib/pedidos/index.ts", import.meta.url), "utf8");
  const bloque = src.slice(src.indexOf("async borrarPedidoNuncaPagado"), src.indexOf("async cambiarEstado("));
  for (const campo of ["estado", "pagado_at", "documento_path", "documento_subido_at", "documento_enviado_at", "reembolso", "pasarela_referencia", "pago_id", "pago_detalle", "transferencia_informada_at", "comprobante_path", "courier_envio_id", "stock_descontado"]) {
    assert.match(bloque, new RegExp(`\\.(is|eq)\\('${campo}'`), `el delete debe condicionar ${campo}`);
  }
});

// ───────── 6. archivados en reportes ─────────
test("archivados: los reportes dicen cuántos pedidos archivados (y cuánta venta) quedaron fuera", async () => {
  const m = await montar({ pedidos: [transferPagadoEnMes("A"), transferPagadoEnMes("B"), pedido("C", { created_at: "2026-11-20T14:00:00.000Z" })] });
  const v = await m.llamar("archivar_pedido", { numeros: [NUM("A")] });
  await m.llamar("archivar_pedido", { numeros: [NUM("A")], id_vista_previa: v.datos.idVistaPrevia });
  const r = await m.llamar("reporte_ventas", { periodo: "mes" });
  assert.match(r.texto, /Quedaron fuera 1 pedido archivado, entre ellos 1 venta pagada por \$15\.000/);
  assert.equal(r.datos.archivadosFuera, 1);
  assert.equal(r.datos.ventasArchivadasFuera, 1);
  assert.equal(r.datos.montoVentasArchivadasFuera, 15000);
  assert.equal(r.datos.filtroArchivadosAplicado, true);
  assert.equal(r.datos.total, 15000, "solo cuenta la no archivada");
  const mv = await m.llamar("reporte_mas_vendidos", { periodo: "mes" });
  assert.match(mv.texto, /Quedaron fuera 1 pedido archivado/);
  const l = await m.llamar("listar_pedidos", {});
  assert.match(l.texto, /Quedaron fuera 1 pedido archivado/);
  assert.equal(l.datos.archivadosFuera, 1);
});

const transferPagadoEnMes = (c) => pedido(c, { estado: "pagado", pagado_at: "2026-11-20T15:00:00.000Z", created_at: "2026-11-20T14:00:00.000Z" });

test("archivados: si D1 falla, los reportes lo dicen (no incluyen ni excluyen en silencio)", async () => {
  const m = await montar({ pedidos: [transferPagadoEnMes("A")] });
  await m.db.prepare("DROP TABLE pedidos_archivados").run();
  const r = await m.llamar("reporte_ventas", { periodo: "mes" });
  assert.match(r.texto, /ATENCIÓN: no pude leer la lista de pedidos archivados[^]*NO se aplicó/);
  assert.equal(r.datos.filtroArchivadosAplicado, false);
  const l = await m.llamar("listar_pedidos", {});
  assert.match(l.texto, /ATENCIÓN: no pude leer la lista de pedidos archivados/);
  assert.equal(l.datos.filtroArchivadosAplicado, false);
});

test("archivados (panel de Ventas): el resumen cuenta lo excluido y su monto, y avisa si no hubo lista", () => {
  const lista = [
    { numero: "A", estado: "pagado", total: 10000 }, { numero: "B", estado: "entregado", total: 5000 },
    { numero: "C", estado: "cancelado", total: 7000 }, { numero: "D", estado: "pagado", total: 3000 },
  ];
  const f = filtrarArchivadosInformando(lista, { numeros: new Set(["A", "C"]), truncado: false });
  assert.deepEqual(f.lista.map((p) => p.numero), ["B", "D"]);
  assert.deepEqual(f.excluidos, { pedidos: 2, ventasPagadas: 1, montoVentas: 10000 });
  assert.match(textoArchivados(f).join(" "), /Quedaron fuera 2 pedidos archivados, entre ellos 1 venta pagada por \$10\.000/);
  const sinLista = filtrarArchivadosInformando(lista, ARCHIVADOS_NO_DISPONIBLES);
  assert.equal(sinLista.lista.length, 4);
  assert.equal(sinLista.filtroAplicado, false);
  assert.match(textoArchivados(sinLista).join(" "), /NO se aplicó/);
  assert.deepEqual(textoArchivados(filtrarArchivadosInformando(lista, { numeros: new Set(), truncado: false })), []);
  const srv = readFileSync(new URL("../src/lib/admin/ventas-servidor.ts", import.meta.url), "utf8");
  assert.match(srv, /archivados: \{ excluidos: filtroArch\.excluidos/);
  assert.match(readFileSync(new URL("../src/app/admin/VentasClient.tsx", import.meta.url), "utf8"), /textoArchivados\(archivados\)/);
});

// ───────── 7. referencia de persona ─────────
test("persona: la referencia es un HMAC con el secreto del worker (no un hash que se adivine por diccionario)", async () => {
  const a = await referenciaPersona("Juana.Perez@correo.cl", PIMIENTA);
  assert.match(a, /^[0-9a-f]{12}$/);
  assert.equal(a, await referenciaPersona("juana.perez@correo.cl", PIMIENTA), "estable y sin mayúsculas");
  assert.notEqual(a, await referenciaPersona("juana.perez@correo.cl", `${PIMIENTA}-otra`), "depende del secreto");
  assert.notEqual(a, (await sha256Hex("persona:juana.perez@correo.cl")).slice(0, 12), "ya no es el SHA-256 simple");
  assert.equal(a, (await hmacSha256Hex(PIMIENTA, "persona:juana.perez@correo.cl")).slice(0, 12));
  await assert.rejects(() => referenciaPersona("a@b.cl", "corta"), /falta_pimienta/);
  await assert.rejects(() => referenciaPersona("a@b.cl", ""), /falta_pimienta/);
});

test("persona: sin BORRADO_REF_PEPPER la herramienta queda bloqueada con un mensaje claro", async () => {
  const m = await montar({ pimienta: null });
  await m.falla("borrar_datos_persona", { correo: "a@correo.cl", alcance: "suscriptor" }, /BLOQUEADO[^]*BORRADO_REF_PEPPER[^]*No se hizo nada/);
  await m.falla("borrar_datos_persona", { correo: "a@correo.cl", alcance: "cliente_completo", id_vista_previa: "ABCDEFGHJKMN" }, /BLOQUEADO/);
  const fuente = readFileSync(new URL("../src/lib/borrado/pimienta.ts", import.meta.url), "utf8");
  assert.match(fuente, /process\.env\.BORRADO_REF_PEPPER/);
  assert.doesNotMatch(readFileSync(new URL("../src/lib/mcp/tools/borrado.ts", import.meta.url), "utf8"), /process\.env/);
});

test("persona: la vista previa es igual exista o no la persona (sin oráculo) y la existencia se sabe recién al confirmar, gastando un cupo", async () => {
  const datos = { suscriptores: [{ id: 1, email: "existe@correo.cl" }], carritos: [], cotizaciones: [], pedidos: [], opiniones: [] };
  const m = await montar({ datosPersonas: datos });
  const vSi = await m.llamar("borrar_datos_persona", { correo: "existe@correo.cl", alcance: "suscriptor" });
  const vNo = await m.llamar("borrar_datos_persona", { correo: "noexiste@correo.cl", alcance: "suscriptor" });
  const normal = (v) => v.texto.replace(/referencia [0-9a-f]{12}/, "referencia R").replace(/id_vista_previa [A-Z0-9]{12}/, "id_vista_previa ID");
  assert.equal(normal(vSi), normal(vNo), "mismo texto");
  assert.deepEqual(Object.keys(vSi.datos).sort(), Object.keys(vNo.datos).sort(), "mismas claves");
  assert.doesNotMatch(JSON.stringify([vSi, vNo]), /noexiste|existe@|\bplan\b/i);
  // confirmar la inexistente recién ahí dice que no hay nada, y gastó un cupo del tope de volumen
  await m.falla("borrar_datos_persona", { correo: "noexiste@correo.cl", alcance: "suscriptor", id_vista_previa: vNo.datos.idVistaPrevia }, /No encontré datos/);
  assert.equal((await m.db.prepare("SELECT COUNT(*) AS n FROM operaciones_dinero").first()).n, 1);
  // con el tope agotado, probar correos no revela nada: sale el tope, no «No encontré»
  const vOtra = await m.llamar("borrar_datos_persona", { correo: "otra@correo.cl", alcance: "suscriptor" });
  for (let i = 0; i < TOPES_DINERO.operacionesPorHora - 1; i++) await reservarCupoDinero(m.db, { usuarioId: "1", herramienta: "x", ahora: TA + 120_000 });
  await assert.rejects(() => m.llamar("borrar_datos_persona", { correo: "otra@correo.cl", alcance: "suscriptor", id_vista_previa: vOtra.datos.idVistaPrevia }, JORGE_A, TA + 130_000), /Tope de seguridad/);
});
