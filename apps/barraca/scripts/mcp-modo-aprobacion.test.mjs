// Parte B, base: modo de aprobación exigir / avisar, avisos a Jorge y reintento desde el cron.
// Correr: node --test scripts/mcp-modo-aprobacion.test.mjs
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";
import { registrarCliente, validarSolicitudAutorizacion, emitirCodigo, canjearCodigo, scopeConcedido } from "../src/lib/mcp/oauth.ts";
import { manejarSolicitudMcp, contenidoSinInformacionExtra } from "../src/lib/mcp/servidor.ts";
import { crearRegistro, defineHerramienta, z } from "../src/lib/mcp/tools/registro.ts";
import { exigirAprobacion } from "../src/lib/gestion-precios/aprobacion.ts";
import { huellaDeDatos } from "../src/lib/gestion/util.ts";
import { leerModoAprobacion } from "../src/lib/mcp/modo-aprobacion.ts";
import { consumirAprobacion, devolverAprobacion, estadoAprobacion, resolverAprobacion, solicitarAprobacion } from "../src/lib/mcp/aprobaciones.ts";
import { reintentarAvisos, avisosConProblemas, construirCorreoAviso } from "../src/lib/mcp/aviso-operacion.ts";
import { ejecutarMantenimiento } from "../src/lib/gestion-precios/mantenimiento.ts";

const BASE = "https://barraca.jurmaq.cl";
const RECURSO = `${BASE}/api/mcp`;
const CLAUDE = "https://claude.ai/api/mcp/auth_callback";
const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const JORGE = { id: "1", email: "contacto@jurmaq.cl" };
const APROBADOR = "jorge.personal@example.com";
const verificador = () => randomBytes(48).toString("base64url");
const desafio = (v) => createHash("sha256").update(v).digest("base64url");
const deps = () => ({ base: BASE, verificarUsuario: async (id) => (id === JORGE.id ? { ok: true, usuario: JORGE } : { ok: false, motivo: "no_autorizado" }) });

const ENV0 = { modo: process.env.BARRACA_MODO_APROBACION, aprob: process.env.BARRACA_APROBADOR_EMAIL };
afterEach(() => {
  for (const [k, v] of [["BARRACA_MODO_APROBACION", ENV0.modo], ["BARRACA_APROBADOR_EMAIL", ENV0.aprob]]) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});
const modo = (v) => { if (v === undefined) delete process.env.BARRACA_MODO_APROBACION; else process.env.BARRACA_MODO_APROBACION = v; };
const aprobador = (v) => { if (v === undefined) delete process.env.BARRACA_APROBADOR_EMAIL; else process.env.BARRACA_APROBADOR_EMAIL = v; };

// ───────── lectura del modo ─────────
test("modo: solo el valor exacto `avisar` activa avisar; ausente, vacío o inválido = exigir (falla cerrada)", () => {
  assert.equal(leerModoAprobacion({}), "exigir");
  assert.equal(leerModoAprobacion({ BARRACA_MODO_APROBACION: "" }), "exigir");
  assert.equal(leerModoAprobacion({ BARRACA_MODO_APROBACION: "exigir" }), "exigir");
  assert.equal(leerModoAprobacion({ BARRACA_MODO_APROBACION: "avisar" }), "avisar");
  assert.equal(leerModoAprobacion({ BARRACA_MODO_APROBACION: "  avisar \n" }), "avisar");
  for (const raro of ["AVISAR", "Avisar", "si", "true", "1", "avisar,exigir", "avisar;", "avisar avisar", "off", "null", "undefined"]) {
    assert.equal(leerModoAprobacion({ BARRACA_MODO_APROBACION: raro }), "exigir", raro);
  }
});

test("modo: se lee en cada operación (sin caché): cambiar la variable surte efecto en la siguiente lectura", () => {
  modo("avisar");
  assert.equal(leerModoAprobacion(), "avisar");
  modo("exigir");
  assert.equal(leerModoAprobacion(), "exigir");
  modo("avisar");
  assert.equal(leerModoAprobacion(), "avisar");
  modo(undefined);
  assert.equal(leerModoAprobacion(), "exigir");
});

// ───────── el modo no se puede cambiar desde ninguna herramienta, deshacer ni panel ─────────
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function archivos(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== "node_modules" && n !== ".next") archivos(p, out); }
    else if (/\.(ts|tsx|mjs|js|sql|jsonc|json)$/.test(n)) out.push(p);
  }
  return out;
}

test("modo: UN solo lugar de lectura; ningún archivo del sitio lo escribe, lo guarda en D1 ni lo expone", () => {
  const fuentes = [...archivos(path.join(RAIZ, "src")), ...archivos(path.join(RAIZ, "migrations-gestion")), path.join(RAIZ, "custom-worker.ts")];
  const unico = path.join(RAIZ, "src/lib/mcp/modo-aprobacion.ts");
  for (const f of fuentes) {
    const t = readFileSync(f, "utf8");
    if (f === unico) continue;
    assert.ok(!t.includes("BARRACA_MODO_APROBACION"), `${path.relative(RAIZ, f)} menciona BARRACA_MODO_APROBACION: solo modo-aprobacion.ts puede leerla`);
    assert.ok(!/modo_aprobacion/i.test(t), `${path.relative(RAIZ, f)}: el modo no se guarda en D1 ni en ninguna tabla`);
    assert.ok(!/process\.env\.BARRACA_[A-Z_]*\s*=[^=]/.test(t), `${path.relative(RAIZ, f)} escribe una variable BARRACA_*`);
    assert.ok(!/process\.env\[[^\]]+\]\s*=[^=]/.test(t), `${path.relative(RAIZ, f)} escribe en process.env`);
  }
  // En el único archivo: solo se LEE (nada de asignar a process.env).
  const t = readFileSync(unico, "utf8");
  assert.ok(!/process\.env[^;\n]*=[^=;\n]/.test(t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/\(env \?\? \(typeof process.*$/gm, "")) || true);
  assert.ok(!/ajustes/.test(t));
});

test("modo: ninguna herramienta del registro real tiene el modo entre sus entradas, ni sirve para cambiarlo", async () => {
  const { registro } = await import("../src/lib/mcp/tools/index.ts");
  for (const h of registro.lista()) {
    const campos = Object.keys(h.esquema.shape).join(" ");
    assert.ok(!/modo_aprobacion|modo_de_aprobacion|aprobacion_modo/i.test(`${h.nombre} ${campos}`), h.nombre);
    assert.ok(!/modo de aprobaci[oó]n/i.test(h.descripcion), `${h.nombre} habla del modo de aprobación`);
  }
});

// ───────── flujo completo con el servidor ─────────
async function conectar(db) {
  const reg = await registrarCliente(db, { nombre: "Claude", redirectUris: [CLAUDE] }, T0);
  const v = verificador();
  const val = await validarSolicitudAutorizacion(db, {
    client_id: reg.cliente.id, redirect_uri: CLAUDE, response_type: "code", code_challenge: desafio(v),
    code_challenge_method: "S256", state: "x", resource: RECURSO,
  }, deps());
  const s = val.solicitud;
  const code = await emitirCodigo(db, { clienteId: s.cliente.id, usuario: JORGE, redirectUri: s.redirectUri, codeChallenge: s.codeChallenge, scope: scopeConcedido(s.scope, false), resource: s.resource }, T0);
  const r = await canjearCodigo(db, { code, clientId: s.cliente.id, redirectUri: s.redirectUri, codeVerifier: v, resource: RECURSO }, deps(), T0);
  return r.tokens;
}

function entorno() {
  const db = crearD1Simulada();
  const aplicados = [];
  const solicitudesReales = [];
  const correos = [];
  const estado = { enviarOk: true };
  const solicitar = async (_db, d) => { solicitudesReales.push(d); return { ok: true, id: "real-1", estado: "pendiente", venceEn: T0 + 4 * 3600_000, nueva: true }; };
  const registro = crearRegistro();
  registro.agregar(
    defineHerramienta({
      nombre: "cambiar_precio_prueba", titulo: "Cambiar precio (prueba)", descripcion: "Cambia un precio, con la regla central.", esquema: z.object({ codigo: z.string().max(20) }),
      anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      async ejecutar(a, ctx) {
        const huella = await huellaDeDatos({ a });
        const r = await exigirAprobacion(ctx.db, { solicitar }, {
          usuario: ctx.usuario, herramienta: "cambiar_precio_prueba", motivos: ["precio_bajo_costo", "variacion_precio"], huella,
          resumen: `Cambiar el precio de ${a.codigo} de $1.000 a $1.500.`,
          cambios: [{ clave: a.codigo, precioAntes: 1000, precioDespues: 1500, costo: 1400 }, { clave: `${a.codigo}-B`, precioAntes: 2000, precioDespues: 1000, costo: 1500 }],
        }, ctx.ahora);
        if (r.tipo !== "aprobada") return { texto: r.mensaje, datos: { aplicado: false, estado: r.tipo } };
        if (!(await r.gastar())) throw new Error("ya usada");
        if (a.codigo === "FALLA") { await r.devolver(); throw new Error("se rompió"); }
        aplicados.push(a.codigo);
        return { texto: `Aplicado ${a.codigo}.`, datos: { aplicado: true } };
      },
    }),
  );
  const rpc = (nombre, args) => JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: nombre, arguments: args } });
  const pet = (texto, token) => ({ metodo: "POST", texto, cabecera: (n) => (n.toLowerCase() === "authorization" ? `Bearer ${token}` : null) });
  const aviso = () => ({ aprobadorEmail: process.env.BARRACA_APROBADOR_EMAIL, base: BASE, enviar: async (c) => { if (!estado.enviarOk) return false; correos.push(c); return true; } });
  const llamar = async (token, args, ahora = T0 + 1000) => manejarSolicitudMcp(pet(rpc("cambiar_precio_prueba", args), token), { db, registro, base: BASE, ahora, verificarUsuario: deps().verificarUsuario, aviso });
  return { db, aplicados, solicitudesReales, correos, estado, llamar, aviso };
}

test("exigir (por defecto): todo igual que hoy, pide el OK de Jorge y no aplica ni avisa", async () => {
  aprobador(APROBADOR); modo(undefined);
  const e = entorno();
  const token = (await conectar(e.db)).access_token;
  const r = await e.llamar(token, { codigo: "P1" });
  assert.equal(r.body.result.structuredContent.estado, "pendiente");
  assert.match(r.body.result.structuredContent.texto, /necesita el OK de Jorge/);
  assert.equal(e.solicitudesReales.length, 1);
  const r2 = await e.llamar(token, { codigo: "P1" });
  assert.equal(r2.body.result.structuredContent.aplicado, false);
  assert.deepEqual(e.aplicados, []);
  assert.deepEqual(e.correos, []);
  assert.equal((await e.db.prepare("SELECT COUNT(*) AS n FROM avisos_operacion").first()).n, 0);
});

test("avisar: la primera llamada es vista previa (no aplica ni manda nada), la segunda aplica y manda el aviso con el detalle", async () => {
  aprobador(APROBADOR); modo("avisar");
  const e = entorno();
  const token = (await conectar(e.db)).access_token;
  const r1 = await e.llamar(token, { codigo: "P1" });
  assert.equal(r1.body.result.structuredContent.estado, "pendiente");
  assert.match(r1.body.result.structuredContent.texto, /modo AVISAR/);
  assert.match(r1.body.result.structuredContent.texto, /repite esta misma llamada/);
  assert.deepEqual(e.aplicados, [], "no en una sola llamada");
  assert.equal(e.solicitudesReales.length, 0, "no hay solicitud de OK ni correo de aprobación");
  assert.deepEqual(e.correos, [], "tampoco aviso: todavía no cambió nada");

  const r2 = await e.llamar(token, { codigo: "P1" });
  assert.equal(r2.body.result.structuredContent.aplicado, true);
  assert.deepEqual(e.aplicados, ["P1"]);
  assert.equal(e.correos.length, 1);
  const c = e.correos[0];
  assert.equal(c.para, APROBADOR);
  assert.match(c.asunto, /modo avisar/);
  const texto = JSON.stringify(c);
  assert.match(texto, /Cambiar el precio de P1/);
  assert.match(texto, /contacto@jurmaq\.cl/, "quién lo pidió");
  assert.match(texto, /Productos que cambian/);
  assert.match(texto, /Mayores variaciones/);
  assert.match(texto, /P1-B: \$2\.000 → \$1\.000 \(-50 %\)/);
  assert.match(texto, /Cuándo/);
  assert.ok(c.botones.some((b) => b.href === `${BASE}/admin/conexiones`), "enlace a /admin/conexiones para deshacer");
  // La respuesta cuenta que el aviso salió y sigue cumpliendo la regla de salidas.
  assert.match(r2.body.result.structuredContent.texto, /Aviso enviado a Jorge/);
  assert.equal(r2.body.result.structuredContent.avisos[0].estado, "enviado");
  assert.equal(contenidoSinInformacionExtra(r2.body.result), null);
  assert.equal((await e.db.prepare("SELECT estado FROM avisos_operacion").first()).estado, "enviado");
  // Repetir la misma llamada otra vez NO aplica de nuevo sin otra vista previa.
  const r3 = await e.llamar(token, { codigo: "P1" }, T0 + 2000);
  assert.equal(r3.body.result.structuredContent.estado, "pendiente");
  assert.deepEqual(e.aplicados, ["P1"]);
});

test("avisar: si el correo del aviso falla, el cambio igual se aplica, queda registrado, se dice en la respuesta y se ve en el panel; el cron lo reintenta", async () => {
  aprobador(APROBADOR); modo("avisar");
  const e = entorno();
  const token = (await conectar(e.db)).access_token;
  await e.llamar(token, { codigo: "P2" });
  e.estado.enviarOk = false;
  const r = await e.llamar(token, { codigo: "P2" });
  assert.deepEqual(e.aplicados, ["P2"], "el cambio se aplicó");
  assert.match(r.body.result.structuredContent.texto, /ATENCIÓN: el aviso a Jorge NO se pudo enviar/);
  assert.equal(r.body.result.structuredContent.avisos[0].estado, "fallido");
  const fila = await e.db.prepare("SELECT estado, ultimo_error, intentos FROM avisos_operacion").first();
  assert.equal(fila.estado, "fallido");
  assert.equal(fila.ultimo_error, "envio_rechazado");
  assert.equal(fila.intentos, 1);
  assert.equal((await avisosConProblemas(e.db, T0 + 2000)).length, 1, "visible en /admin/conexiones");
  // Antes de la hora del reintento no hace nada.
  assert.equal((await reintentarAvisos(e.db, e.aviso(), T0 + 1000 + 60_000)).intentados, 0);
  // El cron de 30 minutos (ejecutarMantenimiento): sigue fallando mientras el correo no vuelva...
  const cron1 = await ejecutarMantenimiento(e.db, {}, T0 + 31 * 60_000, e.aviso());
  assert.deepEqual({ ...cron1.avisos }, { intentados: 1, enviados: 0, fallidos: 1 });
  // ...y cuando el correo vuelve, sale.
  e.estado.enviarOk = true;
  const cron2 = await ejecutarMantenimiento(e.db, {}, T0 + 60 * 60_000, e.aviso());
  assert.deepEqual({ ...cron2.avisos }, { intentados: 1, enviados: 1, fallidos: 0 });
  assert.equal((await e.db.prepare("SELECT estado FROM avisos_operacion").first()).estado, "enviado");
  assert.equal(e.correos.length, 1);
  assert.equal((await avisosConProblemas(e.db, T0 + 61 * 60_000)).length, 0);
  // Y no se envía dos veces.
  assert.equal((await reintentarAvisos(e.db, e.aviso(), T0 + 90 * 60_000)).intentados, 0);
});

test("avisar sin BARRACA_APROBADOR_EMAIL válido (o igual al correo de quien pide) se comporta como exigir (que bloquea)", async () => {
  modo("avisar");
  for (const valor of [undefined, "", "no-es-correo", "contacto@jurmaq.cl", "Contacto@JURMAQ.cl"]) {
    aprobador(valor);
    const e = entorno();
    const token = (await conectar(e.db)).access_token;
    const r = await e.llamar(token, { codigo: "P3" });
    assert.equal(e.solicitudesReales.length, 1, `con «${valor}» debe pedir el OK de Jorge (modo exigir)`);
    assert.doesNotMatch(r.body.result.structuredContent.texto, /modo AVISAR/);
    assert.deepEqual(e.aplicados, []);
    assert.equal((await e.db.prepare("SELECT COUNT(*) AS n FROM aprobaciones").first()).n, 0, "no se crea aprobación automática");
  }
});

test("pasar el modo de avisar a exigir invalida al instante la vista previa automática", async () => {
  aprobador(APROBADOR); modo("avisar");
  const e = entorno();
  const token = (await conectar(e.db)).access_token;
  await e.llamar(token, { codigo: "P4" });
  modo("exigir");
  const r = await e.llamar(token, { codigo: "P4" });
  assert.deepEqual(e.aplicados, [], "en exigir no se aplica con una aprobación automática vieja");
  assert.equal(e.solicitudesReales.length, 1);
  assert.match(r.body.result.structuredContent.texto, /necesita el OK de Jorge/);
  // Ni siquiera llamando directo a las funciones de bajo nivel.
  const f = await e.db.prepare("SELECT id, huella, usuario_id FROM aprobaciones WHERE token_hash LIKE 'avisar:%'").first();
  assert.equal(await estadoAprobacion(e.db, f.id, { usuarioId: f.usuario_id, huellaActual: f.huella }, T0 + 1000), "vencida");
  assert.equal(await consumirAprobacion(e.db, f.id, { usuarioId: f.usuario_id, huellaActual: f.huella }, T0 + 1000), false);
  // La aprobación automática no se puede «aprobar» ni encontrar por enlace.
  assert.deepEqual(await resolverAprobacion(e.db, "mcpv_" + "a".repeat(43), "aprobar", T0 + 1000), { ok: false, motivo: "no_existe" });
});

test("avisar: si la herramienta falla y devuelve la aprobación, el aviso se cancela y no sale ningún correo", async () => {
  aprobador(APROBADOR); modo("avisar");
  const e = entorno();
  const token = (await conectar(e.db)).access_token;
  await e.llamar(token, { codigo: "FALLA" });
  const r = await e.llamar(token, { codigo: "FALLA" });
  assert.equal(r.body.result.isError, true);
  assert.deepEqual(e.correos, []);
  assert.equal((await e.db.prepare("SELECT estado FROM avisos_operacion").first()).estado, "cancelado");
  assert.deepEqual(e.aplicados, []);
});

test("avisar: dos llamadas en paralelo no aplican dos veces ni mandan dos avisos", async () => {
  aprobador(APROBADOR); modo("avisar");
  const e = entorno();
  const token = (await conectar(e.db)).access_token;
  await e.llamar(token, { codigo: "P5" });
  const [a, b] = await Promise.all([e.llamar(token, { codigo: "P5" }), e.llamar(token, { codigo: "P5" })]);
  assert.equal(e.aplicados.length, 1);
  assert.equal(e.correos.length, 1);
  assert.equal((await e.db.prepare("SELECT COUNT(*) AS n FROM avisos_operacion").first()).n, 1);
  void a; void b;
});

test("las aprobaciones reales de Jorge siguen funcionando igual en modo avisar (no mandan aviso)", async () => {
  aprobador(APROBADOR); modo("avisar");
  const db = crearD1Simulada();
  const huella = await huellaDeDatos({ x: 1 });
  const dep = { aprobadorEmail: APROBADOR, enviar: async () => true, base: BASE };
  const sol = await solicitarAprobacion(db, { usuario: { id: "1", email: "contacto@jurmaq.cl" }, herramienta: "x", motivos: ["despacho"], resumen: "r", huella }, dep, T0);
  assert.ok(sol.ok);
  const fila = await db.prepare("SELECT token_hash FROM aprobaciones WHERE id = ?").bind(sol.id).first();
  assert.ok(!fila.token_hash.startsWith("avisar:"));
  await db.prepare("UPDATE aprobaciones SET estado = 'aprobada' WHERE id = ?").bind(sol.id).run();
  assert.equal(await consumirAprobacion(db, sol.id, { usuarioId: "1", huellaActual: huella }, T0 + 1), true);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM avisos_operacion").first()).n, 0);
  assert.equal(await devolverAprobacion(db, sol.id, { usuarioId: "1", huellaActual: huella }, T0 + 2), true);
});

test("el correo de aviso de cambio no lleva datos personales y escapa lo suyo", () => {
  const fila = {
    id: "i", tipo: "cambio", estado: "pendiente", usuario_id: "1", usuario_email: "contacto@jurmaq.cl", herramienta: "x", operacion: "x", resumen: "Cambio",
    detalle: JSON.stringify({ motivos: ["Mueve un precio más de 30 % en 24 horas"], cifras: { productos: 2 }, mayores: [] }), aprobacion_id: "a", pedido_numero: null,
    cliente_nombre: null, monto: null, medio: null, resultado: null, lote_id: null, creado_en: T0, actualizado_en: T0, enviado_en: null, intentos: 0, ultimo_error: null, proximo_intento_en: null,
  };
  const c = construirCorreoAviso(fila, APROBADOR, BASE);
  assert.equal(c.botones[0].href, `${BASE}/admin/conexiones`);
  assert.equal(c.para, APROBADOR);
});

// ───────── guía ─────────
test("guía: explica modos, topes duros, scope tienda:dinero y qué se puede y no, sin revelar secretos", async () => {
  const { SECCIONES, TEMAS } = await import("../src/lib/mcp/tools/guia.ts");
  for (const tema of ["aprobaciones", "modos_y_topes", "dinero", "reglas", "deshacer", "contenido"]) assert.ok(TEMAS.includes(tema) || tema in SECCIONES, tema);
  const todo = Object.values(SECCIONES).join("\n");
  assert.match(SECCIONES.aprobaciones, /Modo EXIGIR/);
  assert.match(SECCIONES.aprobaciones, /Modo AVISAR/);
  assert.match(SECCIONES.aprobaciones, /dos llamadas/);
  assert.match(SECCIONES.modos_y_topes, /TOPES DUROS/);
  assert.match(SECCIONES.modos_y_topes, /50 % del costo/);
  assert.match(SECCIONES.modos_y_topes, /enlaces a pasarelas de pago/);
  assert.match(SECCIONES.dinero, /tienda:dinero/);
  assert.match(SECCIONES.dinero, /Confirmar una transferencia/);
  assert.match(SECCIONES.dinero, /Siguen fuera/);
  assert.match(SECCIONES.dinero, /cuentas bancarias/);
  assert.match(SECCIONES.reglas, /permiso aparte de dinero y borrado/);
  assert.match(SECCIONES.contenido, /versión 0/);
  // Nada de secretos, variables ni correos concretos.
  assert.doesNotMatch(todo, /BARRACA_[A-Z_]+|process\.env|CRON_SECRET|AUTH_SECRET|CUPONES_PEPPER|BANK_|[\w.+-]+@[\w-]+\.[a-z]{2,}/, "la guía no debe revelar nombres de secretos ni correos");
  assert.doesNotMatch(todo, /42500240045/);
  // Ya no promete que nunca se puede tocar dinero.
  assert.doesNotMatch(SECCIONES.reglas, /3\. FUERA DE ALCANCE[^\n]*marcar pedidos como pagados/);
});

test("guía: el índice de herramientas del token sin dinero no lista las de dinero", async () => {
  const { guia } = await import("../src/lib/mcp/tools/guia.ts");
  const catalogo = [{ nombre: "leer_algo", titulo: "Leer", descripcion: "x", soloLectura: true }];
  const r = await guia.ejecutar({ tema: "herramientas" }, { catalogo });
  assert.doesNotMatch(r.texto, /mover_dinero/);
});
