// Pruebas de ofertas con vigencia y del mantenimiento programado (cron de 30 min):
// empezar y terminar solas, con y sin cambio intermedio, cron doble, reanudar una corrida
// caída, aprobaciones, vista previa de masivas y limpiezas.
// Correr: node --test scripts/ofertas.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";
import { aprobarUltimoCorreo, crearCtx, crearTienda, ficha } from "./pruebas/tienda-falsa.mjs";

const O = await import("../src/lib/gestion-precios/ofertas.ts");
const Mant = await import("../src/lib/gestion-precios/mantenimiento.ts");
const { resolverAprobacion } = await import("../src/lib/mcp/aprobaciones.ts");
const { obtenerLote, listarLotes } = await import("../src/lib/gestion/index.ts");
const { deshacerLote } = await import("../src/lib/mcp/deshacer.ts");
const { crearRegistro } = await import("../src/lib/mcp/tools/registro.ts");
const TO = await import("../src/lib/mcp/tools/ofertas.ts");
const { fijarDepsGestion } = await import("../src/lib/mcp/tools/productos-comun.ts");

const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const DIA = 86_400_000;
const MIN = 60_000;
const JORGE = { id: "1", email: "contacto@jurmaq.cl" };
const iso = (ms) => new Date(ms).toISOString();
const nuevaDb = () => crearD1Simulada();
const ctxDe = (db, t = T0) => crearCtx(db, JORGE, t, "programar_oferta");

// Producto con dos fichas repetidas, tachado de $1.500 y costo $400.
const tienda = (extra = {}) => crearTienda([
  ficha({ id: 1, codigo: "O1", precio: 1000, precio_original: 1500, en_oferta: true, costo: 400 }),
  ficha({ id: 2, codigo: "O1", precio: 1000, precio_original: 1500, en_oferta: true, costo: 400 }),
  ficha({ id: 3, codigo: "O2", precio: 2000, costo: 800 }),
], extra);

const estado = (f) => [f.precio, f.precio_original, f.en_oferta];
const filaOferta = (db, codigo) => db.prepare("SELECT * FROM ofertas WHERE codigo = ? ORDER BY creado_en DESC").bind(codigo).first();

async function programar(T, db, args, t = T0) {
  return O.programarOferta(T.deps, ctxDe(db, t), { inicio: iso(T0 + DIA), fin: iso(T0 + 3 * DIA), ...args });
}

test("una oferta empieza y termina sola y deja los precios como estaban", async () => {
  const db = nuevaDb();
  const T = tienda();
  const r = await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 800 }] });
  assert.equal(r.datos.programada, true);
  assert.deepEqual(T.filas.map(estado), [[1000, 1500, true], [1000, 1500, true], [2000, null, false]], "programar no toca la tienda");

  assert.deepEqual(await O.procesarOfertas(db, T.deps, T0 + DIA - 1000), { activadas: 0, terminadas: 0, omitidas: 0, conAviso: 0, errores: 0 });
  const a = await O.procesarOfertas(db, T.deps, T0 + DIA + MIN);
  assert.equal(a.activadas, 1);
  assert.deepEqual(T.filas.slice(0, 2).map(estado), [[800, 1500, true], [800, 1500, true]]);
  assert.equal(T.filas[2].precio, 2000);
  assert.equal((await filaOferta(db, "O1")).estado, "activa");

  const b = await O.procesarOfertas(db, T.deps, T0 + 3 * DIA + MIN);
  assert.equal(b.terminadas, 1);
  assert.deepEqual(T.filas.slice(0, 2).map(estado), [[1000, 1500, true], [1000, 1500, true]]);
  const fin = await filaOferta(db, "O1");
  assert.equal(fin.estado, "terminada");
  assert.equal(fin.aviso, null);
  assert.ok(T.contadores.revalidados.length >= 2, "refresca las fichas al empezar y al terminar");
});

test("una ficha sin tachado vuelve a quedar sin tachado al terminar", async () => {
  const db = nuevaDb();
  const T = tienda();
  await programar(T, db, { productos: [{ codigo: "O2", precio_oferta: 1700 }] });
  await O.procesarOfertas(db, T.deps, T0 + DIA + MIN);
  assert.deepEqual(estado(T.filas[2]), [1700, 2000, true]);
  await O.procesarOfertas(db, T.deps, T0 + 3 * DIA + MIN);
  assert.deepEqual(estado(T.filas[2]), [2000, null, false]);
});

test("si alguien cambia un precio mientras dura la oferta, al terminar NO se pisa y queda aviso", async () => {
  const db = nuevaDb();
  const T = tienda();
  await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 800 }] });
  await O.procesarOfertas(db, T.deps, T0 + DIA + MIN);
  T.filas[0].precio = 700; // cambio intermedio de otra persona (ficha 1)
  const b = await O.procesarOfertas(db, T.deps, T0 + 3 * DIA + MIN);
  assert.equal(b.terminadas, 1);
  assert.equal(b.conAviso, 1);
  assert.equal(T.filas[0].precio, 700, "no se pisó");
  assert.deepEqual(estado(T.filas[1]), [1000, 1500, true], "la otra ficha sí volvió");
  const fila = await filaOferta(db, "O1");
  assert.equal(fila.estado, "terminada");
  assert.match(fila.aviso, /ficha 1/);
  assert.match(fila.aviso, /NO se devolvió/);
  const ver = await O.verOfertas(db, { estado: "todas" });
  assert.match(ver.texto, /AVISO/);
  assert.equal(ver.datos.ofertas[0].aviso, fila.aviso);
  // queda en la auditoría
  const lotes = await listarLotes(db, { limite: 10 });
  const entradas = (await Promise.all(lotes.map((l) => obtenerLote(db, l.loteId)))).flat();
  assert.ok(entradas.some((e) => e.entidad === "oferta" && e.despues?.estado === "terminada" && /NO se devolvió/.test(e.despues.aviso)));
});

test("cron doble: dos corridas a la vez empiezan y terminan la oferta una sola vez", async () => {
  const db = nuevaDb();
  const T = tienda();
  await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 800 }] });
  const [a, b] = await Promise.all([O.procesarOfertas(db, T.deps, T0 + DIA + MIN), O.procesarOfertas(db, T.deps, T0 + DIA + MIN)]);
  assert.equal(a.activadas + b.activadas, 1);
  assert.equal(T.contadores.escrituras, 2, "cada ficha se escribe una vez");
  const antes = JSON.parse((await filaOferta(db, "O1")).antes);
  assert.deepEqual(antes.map((x) => x.precio), [1000, 1000], "la foto de 'antes' es la original, no la de la oferta");
  const [c, d] = await Promise.all([O.procesarOfertas(db, T.deps, T0 + 3 * DIA + MIN), O.procesarOfertas(db, T.deps, T0 + 3 * DIA + MIN)]);
  assert.equal(c.terminadas + d.terminadas, 1);
  assert.equal(T.contadores.escrituras, 4);
  assert.deepEqual(T.filas.slice(0, 2).map(estado), [[1000, 1500, true], [1000, 1500, true]]);
  // y una corrida más no hace nada
  assert.deepEqual(await O.procesarOfertas(db, T.deps, T0 + 4 * DIA), { activadas: 0, terminadas: 0, omitidas: 0, conAviso: 0, errores: 0 });
  assert.equal(T.contadores.escrituras, 4);
});

test("una corrida que se cae a la mitad la retoma otra, sin duplicar ni perder la foto", async () => {
  const db = nuevaDb();
  const T = tienda();
  await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 800 }] });
  const fila = await filaOferta(db, "O1");
  // Simula: reclamó, guardó la foto, escribió solo la ficha 1 y se cayó.
  const antes = [{ id: 1, precio: 1000, precio_original: 1500, en_oferta: true }, { id: 2, precio: 1000, precio_original: 1500, en_oferta: true }];
  const aplicado = antes.map((a) => ({ ...a, precio: 800 }));
  const t = T0 + DIA + MIN;
  await db.prepare("UPDATE ofertas SET estado='activando', reclamada_en=?, antes=?, aplicado=? WHERE id=?").bind(t, JSON.stringify(antes), JSON.stringify(aplicado), fila.id).run();
  T.filas[0].precio = 800;
  // Dentro de los 10 minutos no se toca (otra corrida podría estar trabajando).
  assert.equal((await O.procesarOfertas(db, T.deps, t + 5 * MIN)).activadas, 0);
  assert.equal(T.filas[1].precio, 1000);
  const r = await O.procesarOfertas(db, T.deps, t + 11 * MIN);
  assert.equal(r.activadas, 1);
  assert.deepEqual(T.filas.slice(0, 2).map(estado), [[800, 1500, true], [800, 1500, true]]);
  assert.equal(T.contadores.escrituras, 1, "solo escribió la ficha que faltaba");
  assert.equal((await filaOferta(db, "O1")).estado, "activa");
  await O.procesarOfertas(db, T.deps, T0 + 3 * DIA + MIN);
  assert.deepEqual(T.filas.slice(0, 2).map(estado), [[1000, 1500, true], [1000, 1500, true]]);
});

test("se omite sin tocar nada si ya pasó el plazo, si el precio web ya es menor o si falta el OK de margen", async () => {
  const db = nuevaDb();
  const T = tienda();
  await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 800 }] });
  // el cron estuvo caído y ya pasó todo el plazo
  const r1 = await O.procesarOfertas(db, T.deps, T0 + 5 * DIA);
  assert.equal(r1.omitidas, 1);
  assert.match((await filaOferta(db, "O1")).aviso, /ya había terminado/);
  assert.deepEqual(estado(T.filas[0]), [1000, 1500, true]);

  // alguien bajó el precio web por debajo de la oferta antes de empezar
  const db2 = nuevaDb();
  const T2 = tienda();
  await programar(T2, db2, { productos: [{ codigo: "O1", precio_oferta: 800 }] });
  T2.filas[0].precio = 700;
  T2.filas[1].precio = 700;
  assert.equal((await O.procesarOfertas(db2, T2.deps, T0 + DIA + MIN)).omitidas, 1);
  assert.equal(T2.filas[0].precio, 700);

  // el costo subió: la oferta queda bajo el costo y no tenía el OK de Jorge
  const db3 = nuevaDb();
  const T3 = tienda();
  await programar(T3, db3, { productos: [{ codigo: "O1", precio_oferta: 800 }] });
  T3.filas[0].costo = 790;
  const r3 = await O.procesarOfertas(db3, T3.deps, T0 + DIA + MIN);
  assert.equal(r3.omitidas, 1);
  assert.match((await filaOferta(db3, "O1")).aviso, /sin el OK|no tenía el OK/);
  assert.deepEqual(estado(T3.filas[0]), [1000, 1500, true]);
});

test("oferta bajo el costo: queda pendiente, y con el OK de Jorge sí se activa", async () => {
  const db = nuevaDb();
  const T = tienda();
  const p = await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 300 }] });
  assert.match(p.texto, /necesita el OK de Jorge/);
  assert.equal(await filaOferta(db, "O1"), null);
  assert.equal(T.correos.length, 1);
  await aprobarUltimoCorreo(db, T.correos, resolverAprobacion);
  const ok = await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 300 }] });
  assert.equal(ok.datos.programada, true);
  assert.equal((await filaOferta(db, "O1")).aprobada, 1);
  assert.equal((await O.procesarOfertas(db, T.deps, T0 + DIA + MIN)).activadas, 1);
  assert.equal(T.filas[0].precio, 300);
});

test("validaciones: precio no menor al web, fechas, cruces y repetidos", async () => {
  const db = nuevaDb();
  const T = tienda();
  const sin = await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 1000 }] });
  assert.match(sin.texto, /debe ser menor al precio web actual/);
  assert.equal(await filaOferta(db, "O1"), null);
  assert.match((await programar(T, db, { productos: [{ codigo: "ZZ", precio_oferta: 5 }] })).texto, /No encontrados/);
  for (const malo of [0, -3, 10.5]) assert.match((await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: malo }] })).texto, /entero de pesos/);
  await assert.rejects(programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 900 }], fin: "mañana" }), /fecha de fin no es válida/);
  await assert.rejects(programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 900 }], fin: iso(T0 - DIA) }), /posterior al inicio|ya pasó/);
  await assert.rejects(programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 900 }], inicio: iso(T0 + 2 * DIA), fin: iso(T0 + DIA) }), /posterior al inicio/);
  await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 900 }] });
  const cruce = await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 850 }], inicio: iso(T0 + 2 * DIA), fin: iso(T0 + 4 * DIA) });
  assert.match(cruce.texto, /se cruza/);
  // fuera de la ventana sí se puede
  const ok = await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 850 }], inicio: iso(T0 + 3 * DIA), fin: iso(T0 + 5 * DIA) });
  assert.equal(ok.datos.programada, true);
  // por porcentaje sobre el precio web más bajo del código
  const pct = await programar(T, db, { codigos: ["O2"], descuento_pct: 10 });
  assert.equal(pct.datos.programada, true);
  assert.equal((await filaOferta(db, "O2")).precio_oferta, 1800);
});

test("oferta que ya debe empezar se activa de inmediato, sin esperar al cron", async () => {
  const db = nuevaDb();
  const T = tienda();
  const r = await O.programarOferta(T.deps, ctxDe(db), { productos: [{ codigo: "O2", precio_oferta: 1500 }], fin: iso(T0 + DIA) });
  assert.equal(r.datos.activadas, 1);
  assert.match(r.texto, /Ya está activa/);
  assert.deepEqual(estado(T.filas[2]), [1500, 2000, true]);
});

test("más de 5 productos: dos pasos, un solo uso y se rechaza si los precios cambiaron", async () => {
  const db = nuevaDb();
  const T = crearTienda(Array.from({ length: 8 }, (_, i) => ficha({ id: i + 1, codigo: `M${i}`, precio: 1000, costo: 100 })));
  const codigos = T.filas.map((f) => f.codigo);
  await assert.rejects(O.programarOferta(T.deps, ctxDe(db), { codigos, descuento_pct: 10, inicio: iso(T0 + DIA), fin: iso(T0 + 2 * DIA) }), /dos pasos/);
  const args = { codigos, descuento_pct: 10, inicio: iso(T0 + DIA), fin: iso(T0 + 2 * DIA) };
  const prev = await O.programarOferta(T.deps, ctxDe(db), { ...args, modo: "previsualizar" });
  const id = prev.datos.vista_previa_id;
  assert.match(prev.texto, /8 productos/);
  assert.match(prev.texto, /redondeado al peso más cercano/);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM ofertas").first()).n, 0);
  // los precios cambian entre medio
  T.filas[0].precio = 1200;
  await assert.rejects(O.programarOferta(T.deps, ctxDe(db, T0 + 10), { modo: "confirmar", vista_previa_id: id, fin: args.fin }), /cambiaron/);
  T.filas[0].precio = 1000;
  const ok = await O.programarOferta(T.deps, ctxDe(db, T0 + 20), { modo: "confirmar", vista_previa_id: id, fin: args.fin });
  assert.equal(ok.datos.ofertas.length, 8);
  assert.equal((await db.prepare("SELECT precio_oferta FROM ofertas WHERE codigo='M0'").first()).precio_oferta, 900);
  await assert.rejects(O.programarOferta(T.deps, ctxDe(db, T0 + 30), { modo: "confirmar", vista_previa_id: id, fin: args.fin }), /ya se aplicó/);
});

test("cancelar: programada no llega a empezar; activa vuelve al precio anterior sin pisar cambios", async () => {
  const db = nuevaDb();
  const T = tienda();
  await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 900 }] });
  const c1 = await O.cancelarOferta(T.deps, ctxDe(db), { codigo: "O1" });
  assert.equal(c1.datos.canceladas, 1);
  assert.equal((await O.procesarOfertas(db, T.deps, T0 + DIA + MIN)).activadas, 0);
  assert.equal(T.filas[0].precio, 1000);

  await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 900 }] });
  await O.procesarOfertas(db, T.deps, T0 + DIA + MIN);
  T.filas[1].precio = 650; // alguien la cambia
  const c2 = await O.cancelarOferta(T.deps, ctxDe(db, T0 + DIA + 2 * MIN), { codigo: "O1" });
  assert.equal(c2.datos.canceladas, 1, c2.texto);
  assert.equal(T.filas[0].precio, 1000);
  assert.equal(T.filas[1].precio, 650);
  const f = await db.prepare("SELECT * FROM ofertas WHERE estado='cancelada' AND aviso IS NOT NULL").first();
  assert.match(f.aviso, /ficha 2/);
  await assert.rejects(O.cancelarOferta(T.deps, ctxDe(db), {}), /una sola cosa/);
  assert.equal((await O.cancelarOferta(T.deps, ctxDe(db), { codigo: "NADA" })).datos.canceladas, 0);
});

test("deshacer programar_oferta cancela las programadas y termina las activas", async () => {
  const db = nuevaDb();
  const reg = crearRegistro();
  reg.agregar(TO.programarOferta, TO.verOfertas, TO.cancelarOferta);
  const T = tienda();
  fijarDepsGestion(T.deps);
  try {
    const c = ctxDe(db);
    await TO.programarOferta.ejecutar({ productos: [{ codigo: "O1", precio_oferta: 800 }], inicio: iso(T0 + DIA), fin: iso(T0 + 3 * DIA) }, c);
    assert.equal((await deshacerLote(db, reg, c.loteId, JORGE, T0 + 5)).ok, true);
    assert.equal((await filaOferta(db, "O1")).estado, "cancelada");
    assert.equal((await O.procesarOfertas(db, T.deps, T0 + DIA + MIN)).activadas, 0);

    const c2 = ctxDe(db, T0 + 10);
    await TO.programarOferta.ejecutar({ productos: [{ codigo: "O2", precio_oferta: 1500 }], fin: iso(T0 + DIA) }, c2);
    assert.equal(T.filas[2].precio, 1500);
    assert.equal((await deshacerLote(db, reg, c2.loteId, JORGE, T0 + 20)).ok, true);
    assert.deepEqual(estado(T.filas[2]), [2000, null, false]);
    assert.equal(reg.obtener("cancelar_oferta").revertidor, undefined);
  } finally {
    fijarDepsGestion(null);
  }
});

test("ver_ofertas: vigentes por defecto y avisos recientes", async () => {
  const db = nuevaDb();
  const T = tienda();
  assert.match((await O.verOfertas(db, {})).texto, /No hay ofertas vigentes/);
  await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 800 }] });
  const v = await O.verOfertas(db, {});
  assert.match(v.texto, /O1 \| \$800 \| PROGRAMADA/);
  assert.equal(v.datos.ofertas.length, 1);
});

// ───────── mantenimiento (cron) ─────────
test("el mantenimiento corre las ofertas y las limpiezas una vez por hora", async () => {
  const db = nuevaDb();
  const T = tienda();
  await programar(T, db, { productos: [{ codigo: "O1", precio_oferta: 800 }] });
  const viejo = T0 - 40 * DIA;
  await db.prepare("INSERT INTO oauth_codigos (codigo_hash, cliente_id, usuario_id, redirect_uri, code_challenge, scope, resource, creado_en, expira_en) VALUES ('h','c','1','r','x','s','r',?,?)").bind(viejo, viejo + 60_000).run();
  await db.prepare("INSERT INTO mcp_limites (clave, ventana, cuenta) VALUES ('k', ?, 1)").bind(T0 - 5 * 3600_000).run();
  await db.prepare("INSERT INTO vistas_previas (id, usuario_id, tipo, payload, creado_en, expira_en) VALUES ('VIEJA2345678','1','t','{}',?,?)").bind(viejo, viejo + 1000).run();
  await db.prepare("INSERT INTO cambios_acumulados (id, usuario_id, clave, variacion_pct, aprobado, creado_en) VALUES ('a','1','X',5,0,?)").bind(viejo).run();
  const acumViejo = async () => (await db.prepare("SELECT COUNT(*) n FROM cambios_acumulados WHERE id = 'a'").first()).n;
  await db.prepare("INSERT INTO ofertas (id, grupo_id, codigo, precio_oferta, inicio_en, fin_en, estado, usuario_id, creado_en, terminada_en) VALUES ('o-vieja','g','Z',1,?,?,'terminada','1',?,?)").bind(T0 - 131 * DIA, T0 - 130 * DIA, T0 - 130 * DIA, T0 - 130 * DIA).run();
  const cuenta = async (t) => (await db.prepare(`SELECT COUNT(*) n FROM ${t}`).first()).n;

  // minuto 45: solo ofertas, sin limpieza
  const tarde = Date.UTC(2026, 10, 26, 12, 45, 0);
  const r1 = await Mant.ejecutarMantenimiento(db, T.deps, tarde);
  assert.equal(r1.ofertas.activadas, 1);
  assert.equal(r1.limpieza.hecha, false);
  assert.equal(await cuenta("oauth_codigos"), 1);

  // minuto 05: ofertas y limpieza
  const r2 = await Mant.ejecutarMantenimiento(db, T.deps, Date.UTC(2026, 10, 26, 13, 5, 0));
  assert.equal(r2.limpieza.hecha, true);
  assert.deepEqual(r2.limpieza.fallidas, []);
  for (const t of ["oauth_codigos", "mcp_limites", "vistas_previas"]) assert.equal(await cuenta(t), 0, t);
  assert.equal(await acumViejo(), 0);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM ofertas WHERE id='o-vieja'").first()).n, 0);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM ofertas WHERE codigo='O1'").first()).n, 1);
  // repetir no rompe nada
  const r3 = await Mant.ejecutarMantenimiento(db, T.deps, Date.UTC(2026, 10, 26, 13, 6, 0));
  assert.equal(r3.ofertas.activadas, 0);
});

test("el mantenimiento no se cae si la base de ofertas falla en una tarea", async () => {
  const db = nuevaDb();
  const T = tienda();
  const r = await Mant.ejecutarMantenimiento({ prepare: () => { throw new Error("D1 caída"); }, batch: async () => { throw new Error("x"); } }, T.deps, Date.UTC(2026, 10, 26, 12, 5, 0));
  assert.equal(r.ofertas, null);
  assert.equal(r.limpieza.fallidas.length, 6);
  assert.ok(db);
});
