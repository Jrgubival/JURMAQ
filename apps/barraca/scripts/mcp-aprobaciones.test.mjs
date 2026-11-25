// Pruebas de las aprobaciones por correo y del acumulado de 24 h.
// Correr: node --test scripts/mcp-aprobaciones.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";
import {
  requiereAprobacion, solicitarAprobacion, estadoAprobacion, consumirAprobacion, resolverAprobacion, verAprobacionPorToken,
  registrarAcumulado, leerAcumulado, TTL_APROBACION_MS, huellaDeDatos,
} from "../src/lib/mcp/aprobaciones.ts";

const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const HORA = 3_600_000;
const JORGE = { id: "1", email: "contacto@jurmaq.cl" };
const nuevaDb = () => crearD1Simulada({ migraciones: "0002_oauth.sql" });

function correo(opciones = {}) {
  const enviados = [];
  return {
    enviados,
    deps: {
      base: "https://barraca.jurmaq.cl",
      aprobadorEmail: "aprobador@example.com",
      enviar: async (a) => { if (opciones.falla) return false; enviados.push(a); return true; },
      ...opciones.deps,
    },
  };
}
const datos = async (extra = {}) => ({
  usuario: JORGE, herramienta: "cambiar_precios", motivos: ["masivo_cantidad"], resumen: "Subir 400 precios 5 %.",
  detalle: { n: 400 }, huella: await huellaDeDatos({ n: 400 }), ...extra,
});
const tokenDe = (aviso) => aviso.enlace.split("/aprobar/")[1];

// ───────── Reglas ─────────
test("requiereAprobacion: umbral de 300 productos y 30 % de variación", () => {
  const prods = (n, v = 5) => Array.from({ length: n }, (_, i) => ({ clave: `P${i}`, variacionPct: v }));
  assert.equal(requiereAprobacion({ productos: prods(300) }).requiere, false);
  assert.deepEqual(requiereAprobacion({ productos: prods(301) }).motivos, ["masivo_cantidad"]);
  assert.equal(requiereAprobacion({ productos: [{ clave: "A", variacionPct: 30 }] }).requiere, false);
  assert.deepEqual(requiereAprobacion({ productos: [{ clave: "A", variacionPct: 30.1 }] }).motivos, ["variacion_precio"]);
  assert.deepEqual(requiereAprobacion({ productos: [{ clave: "A", variacionPct: -45 }] }).motivos, ["variacion_precio"]);
});

test("requiereAprobacion: margen sobre costo (bajo costo y menos de 15 %)", () => {
  assert.deepEqual(requiereAprobacion({ precios: [{ precio: 900, costo: 1000 }] }).motivos, ["precio_bajo_costo"]);
  assert.deepEqual(requiereAprobacion({ precios: [{ precio: 1100, costo: 1000 }] }).motivos, ["margen_menor_15"]);
  assert.equal(requiereAprobacion({ precios: [{ precio: 1150, costo: 1000 }] }).requiere, false);
  assert.equal(requiereAprobacion({ precios: [{ precio: 500, costo: null }, { precio: 500, costo: 0 }] }).requiere, false);
  assert.equal(requiereAprobacion({ precios: [{ precio: NaN, costo: 100 }] }).requiere, false);
});

test("requiereAprobacion: banderas explícitas pasan tal cual y se combinan", () => {
  const r = requiereAprobacion({ banderas: ["descuento_transferencia", "envio_gratis"], precios: [{ precio: 10, costo: 100 }] });
  assert.equal(r.requiere, true);
  assert.deepEqual(new Set(r.motivos), new Set(["descuento_transferencia", "envio_gratis", "precio_bajo_costo"]));
  assert.equal(requiereAprobacion({}).requiere, false);
});

test("acumulado 24 h: dividir un cambio grande en varios chicos no evade el umbral", async () => {
  const db = nuevaDb();
  // 3 tandas de 120 productos (cada una bajo 300).
  for (let t = 0; t < 3; t++) {
    const items = Array.from({ length: 120 }, (_, i) => ({ clave: `T${t}-${i}`, variacionPct: 5 }));
    assert.equal(requiereAprobacion({ acumulado: await leerAcumulado(db, "1", T0 + t * HORA), productos: items }).requiere, t === 2, `tanda ${t}`);
    await registrarAcumulado(db, "1", items, { ahora: T0 + t * HORA });
  }
  // Otro usuario no se mezcla.
  assert.equal(requiereAprobacion({ acumulado: await leerAcumulado(db, "2", T0 + 3 * HORA), productos: [{ clave: "X", variacionPct: 1 }] }).requiere, false);
});

test("acumulado 24 h: variaciones chicas repetidas sobre el mismo producto suman", async () => {
  const db = nuevaDb();
  await registrarAcumulado(db, "1", [{ clave: "A", variacionPct: 20 }], { ahora: T0 });
  const ac = await leerAcumulado(db, "1", T0 + HORA);
  assert.equal(requiereAprobacion({ acumulado: ac, productos: [{ clave: "A", variacionPct: 15 }] }).requiere, true);
  assert.equal(requiereAprobacion({ acumulado: ac, productos: [{ clave: "B", variacionPct: 15 }] }).requiere, false);
});

test("acumulado 24 h: pasadas 24 horas deja de contar; lo aprobado no cuenta", async () => {
  const db = nuevaDb();
  await registrarAcumulado(db, "1", Array.from({ length: 400 }, (_, i) => ({ clave: `P${i}`, variacionPct: 1 })), { ahora: T0 });
  assert.equal(Object.keys((await leerAcumulado(db, "1", T0 + 23 * HORA)).porClave).length, 400);
  assert.equal(Object.keys((await leerAcumulado(db, "1", T0 + 25 * HORA)).porClave).length, 0);
  await registrarAcumulado(db, "1", [{ clave: "Z", variacionPct: 80 }], { ahora: T0, aprobado: true });
  assert.equal((await leerAcumulado(db, "1", T0 + HORA)).porClave.Z, undefined);
});

// ───────── Solicitudes ─────────
test("sin BARRACA_APROBADOR_EMAIL la acción queda BLOQUEADA (nunca aprobada)", async () => {
  const db = nuevaDb();
  for (const aprobadorEmail of [undefined, "", "   ", "no-es-correo"]) {
    const { deps, enviados } = correo({ deps: { aprobadorEmail } });
    const r = await solicitarAprobacion(db, await datos(), deps, T0);
    assert.deepEqual([r.ok, r.estado, r.motivo], [false, "bloqueada", "sin_aprobador"]);
    assert.equal(enviados.length, 0);
  }
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM aprobaciones").first()).n, 0);
});

test("la solicitud manda un correo con enlace de un solo uso; en la base solo el hash", async () => {
  const db = nuevaDb();
  const { deps, enviados } = correo();
  const r = await solicitarAprobacion(db, await datos(), deps, T0);
  assert.equal(r.ok, true);
  assert.equal(r.venceEn, T0 + TTL_APROBACION_MS);
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].para, "aprobador@example.com");
  assert.match(enviados[0].enlace, /^https:\/\/barraca\.jurmaq\.cl\/aprobar\/mcpv_[A-Za-z0-9_-]{43}$/);
  const token = tokenDe(enviados[0]);
  const volcado = JSON.stringify((await db.prepare("SELECT * FROM aprobaciones").all()).results);
  assert.ok(!volcado.includes(token));
  // Misma solicitud pendiente: no se manda otro correo.
  const otra = await solicitarAprobacion(db, await datos(), deps, T0 + 1000);
  assert.equal(otra.nueva, false);
  assert.equal(otra.id, r.id);
  assert.equal(enviados.length, 1);
});

test("si el correo no sale, no queda solicitud colgada y la acción sigue bloqueada", async () => {
  const db = nuevaDb();
  const r = await solicitarAprobacion(db, await datos(), correo({ falla: true }).deps, T0);
  assert.deepEqual([r.ok, r.motivo], [false, "correo_fallo"]);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM aprobaciones").first()).n, 0);
});

test("tope de solicitudes por hora (no se llena el correo de Jorge)", async () => {
  const db = nuevaDb();
  const { deps } = correo();
  let ultimo;
  for (let i = 0; i < 11; i++) ultimo = await solicitarAprobacion(db, await datos({ huella: `h${i}` }), deps, T0 + i);
  assert.equal(ultimo.motivo, "limite");
});

test("el GET (ver) no cambia nada; aprobar/rechazar es de un solo uso", async () => {
  const db = nuevaDb();
  const { deps, enviados } = correo();
  const s = await solicitarAprobacion(db, await datos(), deps, T0);
  const token = tokenDe(enviados[0]);
  const antes = JSON.stringify((await db.prepare("SELECT * FROM aprobaciones").all()).results);
  const vista = await verAprobacionPorToken(db, token, T0 + 10);
  assert.equal(vista.estado, "pendiente");
  assert.equal(vista.resumen, "Subir 400 precios 5 %.");
  assert.deepEqual(vista.motivos, ["masivo_cantidad"]);
  await verAprobacionPorToken(db, token, T0 + 20);
  assert.equal(JSON.stringify((await db.prepare("SELECT * FROM aprobaciones").all()).results), antes, "ver no modifica");
  assert.equal(await estadoAprobacion(db, s.id, { usuarioId: "1" }, T0 + 30), "pendiente");
  const a = await resolverAprobacion(db, token, "aprobar", T0 + 40);
  assert.deepEqual([a.ok, a.estado], [true, "aprobada"]);
  // El enlace ya no sirve para nada más.
  assert.equal((await resolverAprobacion(db, token, "aprobar", T0 + 50)).motivo, "ya_resuelta");
  assert.equal((await resolverAprobacion(db, token, "rechazar", T0 + 60)).motivo, "ya_resuelta");
  assert.equal(await estadoAprobacion(db, s.id, { usuarioId: "1" }, T0 + 70), "aprobada");
});

test("rechazar deja la solicitud rechazada y no se puede aprobar después", async () => {
  const db = nuevaDb();
  const { deps, enviados } = correo();
  const s = await solicitarAprobacion(db, await datos(), deps, T0);
  const token = tokenDe(enviados[0]);
  assert.equal((await resolverAprobacion(db, token, "rechazar", T0 + 1)).estado, "rechazada");
  assert.equal((await resolverAprobacion(db, token, "aprobar", T0 + 2)).ok, false);
  assert.equal(await estadoAprobacion(db, s.id, { usuarioId: "1" }, T0 + 3), "rechazada");
  assert.equal(await consumirAprobacion(db, s.id, { usuarioId: "1", huellaActual: await huellaDeDatos({ n: 400 }) }, T0 + 4), false);
});

test("tokens inventados, mal formados o de otro formato no existen", async () => {
  const db = nuevaDb();
  for (const t of ["", "mcpv_corto", "x".repeat(50), "mcpv_" + "A".repeat(43), "mcpv_" + "A".repeat(200)]) {
    assert.equal(await verAprobacionPorToken(db, t, T0), null);
    assert.equal((await resolverAprobacion(db, t, "aprobar", T0)).motivo, "no_existe");
  }
});

test("vence: pasado el plazo no se puede aprobar ni usar", async () => {
  const db = nuevaDb();
  const { deps, enviados } = correo();
  const s = await solicitarAprobacion(db, await datos(), deps, T0);
  const token = tokenDe(enviados[0]);
  const tarde = T0 + TTL_APROBACION_MS + 1;
  assert.equal((await verAprobacionPorToken(db, token, tarde)).estado, "vencida");
  assert.equal((await resolverAprobacion(db, token, "aprobar", tarde)).motivo, "vencida");
  assert.equal(await estadoAprobacion(db, s.id, { usuarioId: "1" }, tarde), "vencida");
  // Aprobada a tiempo pero usada tarde: también vence.
  const s2 = await solicitarAprobacion(db, await datos({ huella: "otra" }), deps, T0);
  await resolverAprobacion(db, tokenDe(enviados[1]), "aprobar", T0 + 5);
  assert.equal(await consumirAprobacion(db, s2.id, { usuarioId: "1", huellaActual: "otra" }, tarde), false);
  assert.equal(await estadoAprobacion(db, s2.id, { usuarioId: "1" }, tarde), "vencida");
});

test("si los datos cambiaron, la aprobación no sirve", async () => {
  const db = nuevaDb();
  const { deps, enviados } = correo();
  const huella = await huellaDeDatos({ n: 400 });
  const s = await solicitarAprobacion(db, await datos({ huella }), deps, T0);
  await resolverAprobacion(db, tokenDe(enviados[0]), "aprobar", T0 + 1);
  const cambiada = await huellaDeDatos({ n: 401 });
  assert.equal(await estadoAprobacion(db, s.id, { usuarioId: "1", huellaActual: cambiada }, T0 + 2), "datos_cambiaron");
  assert.equal(await consumirAprobacion(db, s.id, { usuarioId: "1", huellaActual: cambiada }, T0 + 3), false);
  assert.equal(await estadoAprobacion(db, s.id, { usuarioId: "1", huellaActual: huella }, T0 + 4), "aprobada");
});

test("consumir: una sola vez y solo por quien la pidió", async () => {
  const db = nuevaDb();
  const { deps, enviados } = correo();
  const huella = await huellaDeDatos({ n: 400 });
  const s = await solicitarAprobacion(db, await datos({ huella }), deps, T0);
  // Pendiente aún: no se puede consumir.
  assert.equal(await consumirAprobacion(db, s.id, { usuarioId: "1", huellaActual: huella }, T0 + 1), false);
  await resolverAprobacion(db, tokenDe(enviados[0]), "aprobar", T0 + 2);
  assert.equal(await consumirAprobacion(db, s.id, { usuarioId: "2", huellaActual: huella }, T0 + 3), false);
  assert.equal(await estadoAprobacion(db, s.id, { usuarioId: "2" }, T0 + 3), "no_existe");
  assert.equal(await consumirAprobacion(db, s.id, { usuarioId: "1", huellaActual: huella }, T0 + 4), true);
  assert.equal(await consumirAprobacion(db, s.id, { usuarioId: "1", huellaActual: huella }, T0 + 5), false);
  assert.equal(await estadoAprobacion(db, s.id, { usuarioId: "1" }, T0 + 6), "usada");
});
