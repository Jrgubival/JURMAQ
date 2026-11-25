// Borradores de campañas a suscriptores: saneamiento, versiones, auditoría, deshacer y la garantía de que
// NADA envía, programa ni dispara envíos. Correr: node --test scripts/campanas.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";
import { crearCtx } from "./pruebas/tienda-falsa.mjs";

const Co = await import("../src/lib/campanas/contenido.ts");
const Rp = await import("../src/lib/campanas/repositorio.ts");
const TCa = await import("../src/lib/mcp/tools/campanas.ts");
const { registro } = await import("../src/lib/mcp/tools/index.ts");
const { crearRegistro } = await import("../src/lib/mcp/tools/registro.ts");
const { obtenerLote } = await import("../src/lib/gestion/index.ts");
const { deshacerLote } = await import("../src/lib/mcp/deshacer.ts");

const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const JORGE = { id: "1", email: "contacto@jurmaq.cl" };
const nuevaDb = () => crearD1Simulada();
const buena = { asunto: "Publicidad: catálogo de fierro JURMAQ", texto: "Hola,\n\nLlegó el fierro que pedían.\n\nPasa por la barraca o míralo en la tienda.", enlace: "https://barraca.jurmaq.cl/categoria/fierro", segmento: "Clientes que compraron fierro este año", fecha_sugerida: "2026-12-05" };

const herramientas = [TCa.verCampanas, TCa.guardarCampanaBorrador, TCa.restaurarCampanaVersion, TCa.borrarCampanaBorrador];
const registroMio = () => { const r = crearRegistro(); r.agregar(...herramientas); return r; };
async function usar(h, args, db, t) {
  const ctx = crearCtx(db, JORGE, t, h.nombre);
  const salida = await h.ejecutar(h.esquema.strict().parse(args), ctx);
  return { ...(typeof salida === "string" ? { texto: salida } : salida), ctx };
}
TCa.fijarDepsCampanas({ contarSuscriptores: async () => 42 });

test("una campaña buena valida; el contenido pasa por el mismo saneamiento que los correos", () => {
  const v = Co.validarCampana(buena);
  assert.equal(v.ok, true);
  assert.equal(v.valor.enlace, "https://barraca.jurmaq.cl/categoria/fierro");
  assert.equal(Co.validarCampana({ ...buena, enlace: null, segmento: null, fecha_sugerida: null }).ok, true);
});

test("se rechaza HTML, enlaces externos, correos, teléfonos, datos largos, asunto sin «Publicidad» y fechas falsas", () => {
  const malas = [
    { texto: "Mira <b>esto</b>" }, { texto: "<script>alert(1)</script>" }, { texto: "Compra en https://evil.com/oferta" }, { texto: "Entra a bit.ly/xyz" }, { texto: "Escribe a ventas@gmail.com" },
    { texto: "Llámame al +56 9 1234 5678" }, { texto: "RUT 12.345.678-5" }, { texto: "a‮b" }, { texto: "Hola &amp; chao" }, { texto: "Hola {nombre}" }, { texto: "x".repeat(4001) }, { texto: "" },
    { asunto: "Catálogo de fierro" }, { asunto: "Publicidad\nBcc: a@b.c" }, { asunto: "Publicidad <b>" }, { asunto: "x".repeat(151) + "Publicidad" },
    { segmento: "Todos los de ventas@gmail.com" }, { segmento: "x".repeat(201) },
    { fecha_sugerida: "2026-02-30" }, { fecha_sugerida: "mañana" }, { fecha_sugerida: "05-12-2026" },
    { enlace: "https://evil.com" }, { enlace: "http://barraca.jurmaq.cl" }, { enlace: "https://jurmaq.cl.evil.com" }, { enlace: "https://evil-jurmaq.cl" }, { enlace: "https://user:pass@jurmaq.cl" },
    { enlace: "https://jurmaq.cl:8443/x" }, { enlace: "javascript:alert(1)" }, { enlace: "data:text/html,<b>x" }, { enlace: "//evil.com" }, { enlace: "/categoria/fierro" }, { enlace: "https://jurmaq.cl/a b" },
    { enlace: "https://jurmaq.cl/\"onclick=1" }, { enlace: "https://jurmaq.cl\\@evil.com" }, { enlace: "x".repeat(401) },
  ];
  for (const m of malas) assert.equal(Co.validarCampana({ ...buena, ...m }).ok, false, JSON.stringify(m).slice(0, 80));
  // Datos bancarios y de pago: los mismos que en los correos al cliente.
  for (const m of [{ texto: "Transfiere al Banco Estado, cuenta RUT" }, { texto: "Paga con Webpay hoy" }, { texto: "Usa este link de pago" }, { texto: "Número de cuenta 12345" }, { asunto: "Publicidad: Mercado Pago sin interés" }, { segmento: "Clientes de Transbank" }, { texto: "Mira el IBAN" }]) {
    const r = Co.validarCampana({ ...buena, ...m });
    assert.equal(r.ok, false, JSON.stringify(m));
    assert.match(r.errores.join("\n"), /datos bancarios ni de pago/, JSON.stringify(m));
  }
  assert.equal(Co.validarCampana({ ...buena, texto: "Llegó el fierro nuevo a la barraca." }).ok, true);
  assert.equal(Co.validarCampana({ ...buena, extra: "x" }).ok, false);
  for (const raro of [null, "x", 5, [], undefined]) assert.equal(Co.validarCampana(raro).ok, false);
  assert.equal(Co.validarCampana({ ...buena, enlace: "https://www.jurmaq.cl/envios" }).ok, true);
  assert.equal(Co.validarCampana({ ...buena, texto: "Más info en barraca.jurmaq.cl" }).ok, true);
});

test("la vista previa muestra solo el NÚMERO de suscriptores", () => {
  const t = Co.vistaPreviaCampana(buena, 42);
  assert.match(t, /SUSCRIPTORES ACTIVOS HOY: 42/);
  assert.match(t, /nada lo envía/);
  assert.match(t, /\[BOTÓN → https:\/\/barraca\.jurmaq\.cl\/categoria\/fierro\]/);
  assert.match(Co.vistaPreviaCampana(buena, null), /no disponible/);
  assert.ok(!/@/.test(t.replace("Pasa por", "")));
});

test("crear, editar, listar, ver, versiones, restaurar y borrar un borrador; todo auditado", async () => {
  const db = nuevaDb();
  const c = await usar(TCa.guardarCampanaBorrador, buena, db, T0);
  const id = c.datos.id;
  assert.equal(c.datos.enviada, false);
  assert.match(c.texto, /42/);
  assert.match(c.texto, /ninguna herramienta lo envía/);
  assert.equal((await obtenerLote(db, c.ctx.loteId))[0].entidad, "campana");
  const e = await usar(TCa.guardarCampanaBorrador, { id, asunto: "Publicidad: fierro con descuento de bodega", fecha_sugerida: null }, db, T0 + 1);
  assert.equal(e.datos.version, 2);
  const sinCambio = await usar(TCa.guardarCampanaBorrador, { id, asunto: "Publicidad: fierro con descuento de bodega" }, db, T0 + 2);
  assert.equal(sinCambio.datos.version, 2);
  assert.match(sinCambio.texto, /no cambió nada/);
  assert.equal((await obtenerLote(db, sinCambio.ctx.loteId)).length, 0);
  await assert.rejects(usar(TCa.guardarCampanaBorrador, { id, texto: "Mira https://evil.com" }, db, T0 + 3), /No cambié la campaña/);
  assert.throws(() => TCa.guardarCampanaBorrador.esquema.strict().parse({ id }));
  assert.throws(() => TCa.guardarCampanaBorrador.esquema.strict().parse({ asunto: "Publicidad: solo asunto" }));
  // El servidor valida con la forma sin refine: la herramienta también lo revisa.
  await assert.rejects(usar(TCa.guardarCampanaBorrador, { id }, db, T0 + 3), /al menos un campo/);
  await assert.rejects(usar(TCa.guardarCampanaBorrador, { asunto: "Publicidad: solo asunto" }, db, T0 + 3), /hacen falta asunto y texto/);
  assert.match((await usar(TCa.verCampanas, {}, db, T0 + 4)).texto, new RegExp(`${id}: «Publicidad: fierro con descuento`));
  const v1 = await usar(TCa.verCampanas, { id, version: 1 }, db, T0 + 5);
  assert.match(v1.texto, /Asunto: Publicidad: catálogo de fierro JURMAQ/);
  assert.match(v1.texto, /Historial: v2, v1/);
  const r = await usar(TCa.restaurarCampanaVersion, { id, version: 1 }, db, T0 + 6);
  assert.equal(r.datos.version, 3);
  assert.equal((await Rp.obtenerCampana(db, id)).asunto, buena.asunto);
  assert.equal((await Rp.versionesDeCampana(db, id)).length, 3); // el historial no se borra
  const b = await usar(TCa.borrarCampanaBorrador, { id }, db, T0 + 7);
  assert.match(b.texto, /borrado/);
  assert.match((await usar(TCa.verCampanas, {}, db, T0 + 8)).texto, /No hay borradores/);
  assert.match((await usar(TCa.verCampanas, { incluir_borradas: true }, db, T0 + 8)).texto, /BORRADA/);
  await assert.rejects(usar(TCa.guardarCampanaBorrador, { id, texto: "x" }, db, T0 + 9), /No encontré ese borrador|No cambié/);
  await assert.rejects(usar(TCa.borrarCampanaBorrador, { id }, db, T0 + 9), /ya estaba borrado/);
  await assert.rejects(usar(TCa.verCampanas, { id: "AAAAAAAAAA" }, db, T0 + 9), /No encontré/);
});

test("deshacer: crear, editar y borrar vuelven atrás y no pisan ediciones posteriores", async () => {
  const db = nuevaDb();
  const reg = registroMio();
  const c = await usar(TCa.guardarCampanaBorrador, buena, db, T0);
  const id = c.datos.id;
  const e = await usar(TCa.guardarCampanaBorrador, { id, texto: "Texto nuevo para la campaña" }, db, T0 + 1);
  const b = await usar(TCa.borrarCampanaBorrador, { id }, db, T0 + 2);
  assert.equal((await deshacerLote(db, reg, b.ctx.loteId, JORGE, T0 + 3)).ok, true);
  assert.equal((await Rp.obtenerCampana(db, id)).borradoEn, null);
  assert.equal((await deshacerLote(db, reg, e.ctx.loteId, JORGE, T0 + 4)).ok, true);
  assert.equal((await Rp.obtenerCampana(db, id)).texto, buena.texto);
  // Una edición ajena posterior no se pisa.
  const e2 = await usar(TCa.guardarCampanaBorrador, { id, segmento: "Segmento A" }, db, T0 + 5);
  await Rp.editarCampana(db, id, { segmento: "Segmento de otra persona" }, { id: "2" }, T0 + 6);
  assert.equal((await deshacerLote(db, reg, e2.ctx.loteId, JORGE, T0 + 7)).ok, false);
  assert.equal((await Rp.obtenerCampana(db, id)).segmento, "Segmento de otra persona");
  // Deshacer la creación borra el borrador (marca), nunca otra cosa.
  const c2 = await usar(TCa.guardarCampanaBorrador, buena, db, T0 + 8);
  assert.equal((await deshacerLote(db, reg, c2.ctx.loteId, JORGE, T0 + 9)).ok, true);
  assert.notEqual((await Rp.obtenerCampana(db, c2.datos.id)).borradoEn, null);
});

test("hay un tope de borradores vigentes", async () => {
  const db = nuevaDb();
  for (let i = 0; i < Rp.MAX_CAMPANAS_VIGENTES; i++) await db.prepare("INSERT INTO campanas (id, asunto, texto, version, creado_por, creado_en, actualizado_en) VALUES (?, 'Publicidad', 't', 1, '1', 1, 1)").bind(`ID${i}`).run();
  const r = await Rp.crearCampana(db, buena, JORGE, T0);
  assert.equal(r.ok, false);
  assert.match(r.errores[0], /Ya hay 200 borradores/);
});

test("ver_campanas: el listado trae solo el número de suscriptores y la vista previa funciona (nunca correos ni nombres)", async () => {
  const db = nuevaDb();
  const r = await usar(TCa.verCampanas, {}, db, T0);
  assert.equal(r.datos.suscriptores_activos, 42);
  assert.deepEqual(Object.keys(r.datos).sort(), ["campanas", "suscriptores_activos"]);
  assert.ok(!/@/.test(r.texto));
  const c = await usar(TCa.guardarCampanaBorrador, buena, db, T0);
  const vp = await usar(TCa.verCampanas, { id: c.datos.id, vista_previa: true }, db, T0 + 1);
  assert.match(vp.texto, /SUSCRIPTORES ACTIVOS HOY: 42/);
  assert.match(vp.texto, /nada lo envía/);
  TCa.fijarDepsCampanas({ contarSuscriptores: async () => null });
  assert.match((await usar(TCa.verCampanas, {}, db, T0)).texto, /no pude consultarlo/);
  TCa.fijarDepsCampanas({ contarSuscriptores: async () => 42 });
});

// ───────── nada envía ─────────
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("el módulo de campañas y sus herramientas no importan ni llaman nada que envíe correos", () => {
  const archivos = ["../src/lib/mcp/tools/campanas.ts", ...readdirSync(new URL("../src/lib/campanas/", import.meta.url)).map((f) => `../src/lib/campanas/${f}`)];
  assert.ok(archivos.length >= 4);
  const PROHIBIDO = /transporter|sendMail|\bresend\b|enviar-campana|broadcast|audiences|@jurmaq\/shared\/mail|\bfetch\s*\(|child_process|\.send\s*\(|schedule|setTimeout|setInterval|cron/i;
  for (const ruta of archivos) {
    const src = sinComentarios(readFileSync(new URL(ruta, import.meta.url), "utf8"));
    const m = PROHIBIDO.exec(src);
    assert.equal(m, null, `${ruta} menciona «${m?.[0]}»`);
    for (const imp of src.matchAll(/from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
      const destino = imp[1] ?? imp[2];
      assert.ok(!/mail|resend|correos|pedidos|cron|enviar/i.test(destino) || destino.includes("correos-cliente/validar"), `${ruta} importa ${destino}`);
    }
  }
  // De los suscriptores solo se pide un conteo (head), sin traer filas.
  const susc = readFileSync(new URL("../src/lib/campanas/suscriptores.ts", import.meta.url), "utf8");
  assert.match(susc, /count: "exact", head: true/);
  assert.ok(!/select\("\*"\)|email|nombre/i.test(sinComentarios(susc)));
});

test("ninguna herramienta registrada envía, programa o dispara envíos; las de campañas no tienen estado de envío", async () => {
  const nombres = registro.lista().map((h) => h.nombre);
  // (programar_oferta es de precios con fecha, no de correos.)
  for (const n of nombres.filter((x) => x !== "programar_oferta")) assert.ok(!/enviar|envia|programar|dispar|send|schedule|broadcast|campana.*(lanzar|publicar)/i.test(n), `herramienta sospechosa: ${n}`);
  for (const n of ["ver_campanas", "guardar_campana_borrador", "borrar_campana_borrador", "restaurar_campana_version"]) assert.ok(nombres.includes(n), n);
  // La tabla no tiene columna de estado: no hay a qué estado pasar.
  const db = nuevaDb();
  const cols = (await db.prepare("PRAGMA table_info(campanas)").all()).results.map((c) => c.name);
  assert.ok(!cols.some((c) => /estado|enviada|programada|enviado_en|envio/i.test(c)), cols.join(","));
  // Anotaciones: lectura marcada como tal.
  for (const h of herramientas) assert.equal(h.anotaciones.readOnlyHint, h.nombre === "ver_campanas", h.nombre);
});

test("el catálogo real registra las 10 herramientas nuevas (correos y campañas) con descripciones claras", () => {
  const esperadas = ["listar_plantillas_correo", "ver_plantilla_correo", "editar_borrador_correo", "previsualizar_correo", "publicar_correo", "restaurar_correo", ...["ver_campanas", "guardar_campana_borrador", "borrar_campana_borrador", "restaurar_campana_version"]];
  for (const n of esperadas) {
    const h = registro.obtener(n);
    assert.ok(h, n);
    assert.ok(h.descripcion.length > 60, n);
    assert.ok(h.revertidor || h.anotaciones.readOnlyHint || n === "publicar_correo", `${n} sin forma de deshacer`);
  }
});
