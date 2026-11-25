// Pruebas de la base de gestión (D1): auditoría y vistas previas de un solo uso.
// Correr: node --test scripts/gestion.test.mjs   (Node 22.15+; D1 simulada con node:sqlite)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { crearD1Simulada, listarMigraciones, DIR_MIGRACIONES_GESTION } from "./pruebas/d1-simulada.mjs";
import {
  registrarLote, registrarCambio, listarLotes, obtenerLote, historialDeEntidad, marcarDeshecho,
  marcarEntradaDeshecha, nuevoLoteId,
} from "../src/lib/gestion/auditoria.ts";
import {
  crearVistaPrevia, consumirVistaPrevia, limpiarVistasPrevias, TTL_VISTA_PREVIA_MS,
} from "../src/lib/gestion/vistas-previas.ts";
import { huellaDeDatos, idCorto, jsonEstable } from "../src/lib/gestion/util.ts";
import { GestionEntradaError, GestionNoDisponibleError, esGestionNoDisponible } from "../src/lib/gestion/tipos.ts";
import { obtenerGestionDb, requerirGestionDb, usarGestion } from "../src/lib/gestion/d1.ts";

const ANA = { id: "u-ana", email: "ana@example.com" };
const LUIS = { id: "u-luis", email: "luis@example.com" };
const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);

test("migraciones: numeradas 0001, 0002... sin saltos ni repetidos", () => {
  const archivos = listarMigraciones();
  assert.ok(archivos.length >= 1);
  archivos.forEach((f, i) => {
    assert.match(f, /^\d{4}_[a-z0-9_]+\.sql$/, f);
    assert.equal(Number(f.slice(0, 4)), i + 1, `salto o repetido en ${f}`);
  });
  // Ninguna migración usa IF NOT EXISTS: debe fallar fuerte si se aplica dos veces.
  for (const f of archivos) assert.doesNotMatch(readFileSync(path.join(DIR_MIGRACIONES_GESTION, f), "utf8"), /IF NOT EXISTS/i);
});

test("las migraciones reales crean las tablas base", async () => {
  const db = crearD1Simulada();
  const tablas = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results.map((t) => t.name);
  assert.ok(tablas.includes("auditoria") && tablas.includes("vistas_previas"));
});

// ───────── Auditoría ─────────

test("auditoría: registra un lote atómico y lo devuelve con JSON", async () => {
  const db = crearD1Simulada();
  const lote = nuevoLoteId();
  const ids = await registrarLote(db, lote, ANA, [
    { herramienta: "cambiar_precios", entidad: "producto", entidadId: 101, antes: { precio: 1000 }, despues: { precio: 900 } },
    { herramienta: "cambiar_precios", entidad: "producto", entidadId: 102, antes: { precio: 2000 }, despues: { precio: 1800 } },
  ], T0);
  assert.equal(ids.length, 2);
  const filas = await obtenerLote(db, lote);
  assert.equal(filas.length, 2);
  assert.deepEqual(filas[0].antes, { precio: 1000 });
  assert.deepEqual(filas[1].despues, { precio: 1800 });
  assert.equal(filas[0].usuarioEmail, "ana@example.com");
  assert.equal(filas[0].entidadId, "101");
  assert.equal(filas[0].deshechoEn, null);
});

test("auditoría: si una fila del lote falla no queda ninguna (atómico)", async () => {
  const db = crearD1Simulada();
  const lote = nuevoLoteId();
  await assert.rejects(
    registrarLote(db, lote, ANA, [
      { herramienta: "h", entidad: "producto", entidadId: 1, antes: 1, despues: 2 },
      { herramienta: "", entidad: "producto", entidadId: 2 }, // inválida
    ], T0),
    GestionEntradaError,
  );
  assert.equal((await obtenerLote(db, lote)).length, 0);
});

test("auditoría: rechaza JSON enorme", async () => {
  const db = crearD1Simulada();
  await assert.rejects(
    registrarCambio(db, ANA, { herramienta: "h", entidad: "x", entidadId: 1, despues: "a".repeat(300 * 1024) }),
    GestionEntradaError,
  );
});

test("auditoría: listarLotes agrupa, ordena y pagina", async () => {
  const db = crearD1Simulada();
  const a = nuevoLoteId(), b = nuevoLoteId(), c = nuevoLoteId();
  await registrarLote(db, a, ANA, [{ herramienta: "precios", entidad: "producto", entidadId: 1 }, { herramienta: "precios", entidad: "producto", entidadId: 2 }], T0);
  await registrarLote(db, b, LUIS, [{ herramienta: "cupones", entidad: "cupon", entidadId: "X" }], T0 + 1000);
  await registrarLote(db, c, ANA, [{ herramienta: "contenido", entidad: "pagina", entidadId: "terminos" }], T0 + 2000);
  const todos = await listarLotes(db);
  assert.deepEqual(todos.map((l) => l.loteId), [c, b, a]);
  assert.equal(todos[2].cambios, 2);
  assert.equal(todos[2].herramienta, "precios");
  assert.equal(todos[1].usuarioEmail, "luis@example.com");
  assert.deepEqual((await listarLotes(db, { usuarioId: ANA.id })).map((l) => l.loteId), [c, a]);
  assert.deepEqual((await listarLotes(db, { limite: 1 })).map((l) => l.loteId), [c]);
  assert.deepEqual((await listarLotes(db, { antesDe: T0 + 2000, limite: 5 })).map((l) => l.loteId), [b, a]);
});

test("auditoría: marcarDeshecho marca una vez y es idempotente", async () => {
  const db = crearD1Simulada();
  const lote = nuevoLoteId(), otro = nuevoLoteId();
  await registrarLote(db, lote, ANA, [{ herramienta: "p", entidad: "producto", entidadId: 1 }, { herramienta: "p", entidad: "producto", entidadId: 2 }], T0);
  await registrarLote(db, otro, ANA, [{ herramienta: "p", entidad: "producto", entidadId: 3 }], T0 + 5);
  assert.equal(await marcarDeshecho(db, lote, LUIS.id, T0 + 10_000), 2);
  assert.equal(await marcarDeshecho(db, lote, LUIS.id, T0 + 20_000), 0); // segunda vez: nada
  const filas = await obtenerLote(db, lote);
  assert.ok(filas.every((f) => f.deshechoEn === T0 + 10_000 && f.deshechoPor === LUIS.id));
  assert.ok((await obtenerLote(db, otro)).every((f) => f.deshechoEn === null)); // el otro lote intacto
  const lotes = await listarLotes(db);
  assert.equal(lotes.find((l) => l.loteId === lote).deshecho, true);
  assert.equal(lotes.find((l) => l.loteId === otro).deshecho, false);
  assert.deepEqual((await listarLotes(db, { soloVigentes: true })).map((l) => l.loteId), [otro]);
});

test("auditoría: deshacer una entrada y ver el historial de un producto", async () => {
  const db = crearD1Simulada();
  const l1 = nuevoLoteId(), l2 = nuevoLoteId();
  const [e1] = await registrarLote(db, l1, ANA, [{ herramienta: "p", entidad: "producto", entidadId: 7, antes: { precio: 1 }, despues: { precio: 2 } }], T0);
  await registrarLote(db, l2, ANA, [{ herramienta: "p", entidad: "producto", entidadId: 7, antes: { precio: 2 }, despues: { precio: 3 } }], T0 + 1);
  assert.equal(await marcarEntradaDeshecha(db, e1, ANA.id, T0 + 9), true);
  assert.equal(await marcarEntradaDeshecha(db, e1, ANA.id, T0 + 10), false);
  const h = await historialDeEntidad(db, "producto", 7);
  assert.equal(h.length, 2);
  assert.deepEqual(h[0].despues, { precio: 3 }); // lo más nuevo primero
});

test("auditoría: más de 90 cambios se guardan en tandas", async () => {
  const db = crearD1Simulada();
  const lote = nuevoLoteId();
  const cambios = Array.from({ length: 200 }, (_, i) => ({ herramienta: "p", entidad: "producto", entidadId: i }));
  await registrarLote(db, lote, ANA, cambios, T0);
  assert.equal((await obtenerLote(db, lote)).length, 200);
});

// ───────── Vistas previas ─────────

test("vista previa: id corto, de un solo uso, devuelve el payload", async () => {
  const db = crearD1Simulada();
  const { id, expiraEn } = await crearVistaPrevia(db, { usuarioId: ANA.id, tipo: "precios", payload: { cambios: [1, 2, 3] } }, T0);
  assert.match(id, /^[2-9A-HJKMNP-Z]{12}$/);
  assert.equal(expiraEn, T0 + TTL_VISTA_PREVIA_MS);
  const r = await consumirVistaPrevia(db, { id, usuarioId: ANA.id, tipo: "precios" }, T0 + 1000);
  assert.equal(r.ok, true);
  assert.deepEqual(r.payload, { cambios: [1, 2, 3] });
  const otra = await consumirVistaPrevia(db, { id, usuarioId: ANA.id, tipo: "precios" }, T0 + 2000);
  assert.deepEqual(otra, { ok: false, motivo: "usada" });
});

test("vista previa: acepta el id en minúsculas y con espacios", async () => {
  const db = crearD1Simulada();
  const { id } = await crearVistaPrevia(db, { usuarioId: ANA.id, tipo: "t", payload: 1 }, T0);
  const r = await consumirVistaPrevia(db, { id: `  ${id.toLowerCase()} `, usuarioId: ANA.id }, T0 + 1);
  assert.equal(r.ok, true);
});

test("vista previa: ligada al usuario (otro usuario no la consume ni se entera de que existe)", async () => {
  const db = crearD1Simulada();
  const { id } = await crearVistaPrevia(db, { usuarioId: ANA.id, tipo: "t", payload: {} }, T0);
  assert.deepEqual(await consumirVistaPrevia(db, { id, usuarioId: LUIS.id }, T0 + 1), { ok: false, motivo: "no_existe" });
  // y no la gastó: Ana todavía puede usarla
  assert.equal((await consumirVistaPrevia(db, { id, usuarioId: ANA.id }, T0 + 2)).ok, true);
});

test("vista previa: expira", async () => {
  const db = crearD1Simulada();
  const { id, expiraEn } = await crearVistaPrevia(db, { usuarioId: ANA.id, tipo: "t", payload: {}, ttlMs: 60_000 }, T0);
  assert.deepEqual(await consumirVistaPrevia(db, { id, usuarioId: ANA.id }, expiraEn), { ok: false, motivo: "expirada" });
  assert.deepEqual(await consumirVistaPrevia(db, { id, usuarioId: ANA.id }, expiraEn + 5), { ok: false, motivo: "expirada" });
  const viva = await crearVistaPrevia(db, { usuarioId: ANA.id, tipo: "t", payload: {}, ttlMs: 60_000 }, T0);
  assert.equal((await consumirVistaPrevia(db, { id: viva.id, usuarioId: ANA.id }, T0 + 59_999)).ok, true);
});

test("vista previa: rechaza si la huella de los datos cambió, y no se gasta", async () => {
  const db = crearD1Simulada();
  const antes = await huellaDeDatos({ productos: [{ id: 1, precio: 1000 }] });
  const despues = await huellaDeDatos({ productos: [{ id: 1, precio: 1100 }] });
  const { id } = await crearVistaPrevia(db, { usuarioId: ANA.id, tipo: "precios", payload: {}, huella: antes }, T0);
  assert.deepEqual(await consumirVistaPrevia(db, { id, usuarioId: ANA.id, huellaActual: despues }, T0 + 1), { ok: false, motivo: "huella_cambiada" });
  // sin huellaActual tampoco vale si la vista exige una
  assert.deepEqual(await consumirVistaPrevia(db, { id, usuarioId: ANA.id }, T0 + 2), { ok: false, motivo: "huella_cambiada" });
  // con la huella correcta sí
  assert.equal((await consumirVistaPrevia(db, { id, usuarioId: ANA.id, huellaActual: antes }, T0 + 3)).ok, true);
});

test("vista previa: tipo distinto se rechaza; id inventado o mal formado también", async () => {
  const db = crearD1Simulada();
  const { id } = await crearVistaPrevia(db, { usuarioId: ANA.id, tipo: "precios", payload: {} }, T0);
  assert.deepEqual(await consumirVistaPrevia(db, { id, usuarioId: ANA.id, tipo: "cupones" }, T0 + 1), { ok: false, motivo: "tipo_distinto" });
  assert.deepEqual(await consumirVistaPrevia(db, { id: "AAAAAAAAAAAA", usuarioId: ANA.id }, T0), { ok: false, motivo: "no_existe" });
  for (const malo of ["", "x", "' OR 1=1 --", "0000000000O0", undefined, null]) {
    assert.deepEqual(await consumirVistaPrevia(db, { id: malo, usuarioId: ANA.id }, T0), { ok: false, motivo: "no_existe" });
  }
});

test("vista previa: dos confirmaciones a la vez, gana solo una", async () => {
  const db = crearD1Simulada();
  const { id } = await crearVistaPrevia(db, { usuarioId: ANA.id, tipo: "t", payload: {} }, T0);
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => consumirVistaPrevia(db, { id, usuarioId: ANA.id }, T0 + 1)));
  assert.equal(rs.filter((r) => r.ok).length, 1);
});

test("vista previa: ttl inválido y limpieza de vencidas", async () => {
  const db = crearD1Simulada();
  await assert.rejects(crearVistaPrevia(db, { usuarioId: ANA.id, tipo: "t", payload: {}, ttlMs: -1 }), GestionEntradaError);
  await assert.rejects(crearVistaPrevia(db, { usuarioId: ANA.id, tipo: "t", payload: {}, ttlMs: 1e12 }), GestionEntradaError);
  const vieja = await crearVistaPrevia(db, { usuarioId: ANA.id, tipo: "t", payload: {}, ttlMs: 1000 }, T0);
  const nueva = await crearVistaPrevia(db, { usuarioId: ANA.id, tipo: "t", payload: {} }, T0 + 3 * 24 * 3600_000);
  assert.equal(await limpiarVistasPrevias(db, T0 + 3 * 24 * 3600_000), 1);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM vistas_previas WHERE id = ?").bind(vieja.id).first()).n, 0);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM vistas_previas WHERE id = ?").bind(nueva.id).first()).n, 1);
});

// ───────── Utilidades y acceso ─────────

test("huellaDeDatos: estable ante el orden de claves y distinta si cambia el dato", async () => {
  assert.equal(await huellaDeDatos({ a: 1, b: { c: 2, d: [1, 2] } }), await huellaDeDatos({ b: { d: [1, 2], c: 2 }, a: 1 }));
  assert.notEqual(await huellaDeDatos({ a: 1 }), await huellaDeDatos({ a: 2 }));
  assert.equal(jsonEstable({ b: 1, a: undefined }), '{"a":null,"b":1}');
  assert.match(await huellaDeDatos("x"), /^[0-9a-f]{64}$/);
});

test("idCorto: largo, alfabeto y sin repetidos en 5000", () => {
  const vistos = new Set();
  for (let i = 0; i < 5000; i++) {
    const id = idCorto();
    assert.match(id, /^[2-9A-HJKMNP-Z]{12}$/);
    vistos.add(id);
  }
  assert.equal(vistos.size, 5000);
});

test("sin binding GESTION_DB: obtener devuelve null y requerir/usar lanzan el error tipado", async () => {
  assert.equal(await obtenerGestionDb(), null);
  await assert.rejects(requerirGestionDb(), (e) => esGestionNoDisponible(e) && e instanceof GestionNoDisponibleError && e.codigo === "GESTION_NO_DISPONIBLE");
  await assert.rejects(usarGestion(async () => 1), GestionNoDisponibleError);
});

test("base sin migrar falla con 'no such table' (el patrón que usarGestion traduce a 'no disponible')", async () => {
  const db = crearD1Simulada({ migraciones: false });
  await assert.rejects(listarLotes(db), /no such table/);
});
