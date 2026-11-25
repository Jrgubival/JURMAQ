// Parte B, base: scope `tienda:dinero` (dinero y borrado) separado del básico.
// Correr: node --test scripts/mcp-dinero-scope.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";
import {
  registrarCliente, validarSolicitudAutorizacion, emitirCodigo, canjearCodigo, refrescar, listarConexiones,
  normalizarScope, scopeConcedido, scopeIncluye,
} from "../src/lib/mcp/oauth.ts";
import { manejarSolicitudMcp, listarHerramientasMcp } from "../src/lib/mcp/servidor.ts";
import { crearRegistro, defineHerramienta, z } from "../src/lib/mcp/tools/registro.ts";
import { registro as registroReal } from "../src/lib/mcp/tools/index.ts";
import { metadataRecursoProtegido, metadataServidorAutorizacion, SCOPE_DINERO } from "../src/lib/mcp/config.ts";
import {
  DINERO_PUEDE, DINERO_SIGUE_FUERA, NO_PUEDE, etiquetaPermiso, textoPermisos,
} from "../src/lib/mcp/permisos-texto.ts";

const BASE = "https://barraca.jurmaq.cl";
const RECURSO = `${BASE}/api/mcp`;
const CLAUDE = "https://claude.ai/api/mcp/auth_callback";
const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const JORGE = { id: "1", email: "contacto@jurmaq.cl" };
const nuevaDb = () => crearD1Simulada({ migraciones: "0002_oauth.sql" });
const verificador = () => randomBytes(48).toString("base64url");
const desafio = (v) => createHash("sha256").update(v).digest("base64url");
const deps = () => ({ base: BASE, verificarUsuario: async (id) => (id === JORGE.id ? { ok: true, usuario: JORGE } : { ok: false, motivo: "no_autorizado" }) });

/** Hace TODO el camino: DCR → autorizar (con lo que pide el cliente) → «consentimiento» → código → tokens. */
async function conectar(db, { scopePedido, consentimientoDinero }) {
  const reg = await registrarCliente(db, { nombre: "Claude", redirectUris: [CLAUDE] }, T0);
  const v = verificador();
  const val = await validarSolicitudAutorizacion(db, {
    client_id: reg.cliente.id, redirect_uri: CLAUDE, response_type: "code", code_challenge: desafio(v),
    code_challenge_method: "S256", state: "x", resource: RECURSO, ...(scopePedido === undefined ? {} : { scope: scopePedido }),
  }, deps());
  assert.ok(val.ok, JSON.stringify(val));
  const s = val.solicitud;
  // Igual que /oauth/decision: el scope concedido sale de scopeConcedido(pedido, casilla).
  const scope = scopeConcedido(s.scope, consentimientoDinero);
  const code = await emitirCodigo(db, { clienteId: s.cliente.id, usuario: JORGE, redirectUri: s.redirectUri, codeChallenge: s.codeChallenge, scope, resource: s.resource }, T0);
  const r = await canjearCodigo(db, { code, clientId: s.cliente.id, redirectUri: s.redirectUri, codeVerifier: v, resource: RECURSO }, deps(), T0);
  assert.ok(r.ok, JSON.stringify(r));
  return { cliente: reg.cliente, tokens: r.tokens, solicitud: s };
}

// ───────── scopes ─────────
test("scope: sin scope pedido (o solo el básico) NUNCA da dinero; dinero implica escribir y leer", () => {
  assert.equal(normalizarScope(undefined).scope, "tienda:leer tienda:escribir");
  assert.equal(normalizarScope("offline_access").scope, "tienda:leer tienda:escribir");
  assert.equal(normalizarScope("tienda:leer tienda:escribir").scope, "tienda:leer tienda:escribir");
  assert.equal(normalizarScope("tienda:dinero").scope, "tienda:leer tienda:escribir tienda:dinero");
  assert.equal(normalizarScope("tienda:dinero tienda:leer").scope, "tienda:leer tienda:escribir tienda:dinero");
  assert.equal(normalizarScope("tienda:dinero extra").error, "invalid_scope");
  assert.equal(scopeIncluye("tienda:leer tienda:escribir", SCOPE_DINERO), false);
  assert.equal(scopeIncluye("tienda:leer", SCOPE_DINERO), false);
  assert.equal(scopeIncluye("tienda:leer tienda:escribir tienda:dinero", SCOPE_DINERO), true);
  assert.equal(scopeIncluye("tienda:dinero", "tienda:escribir"), true);
});

test("scopeConcedido: sin consentimiento explícito no hay dinero; la casilla no agrega lo que el cliente no pidió", () => {
  const todo = "tienda:leer tienda:escribir tienda:dinero";
  assert.equal(scopeConcedido(todo, false), "tienda:leer tienda:escribir");
  assert.equal(scopeConcedido(todo, undefined), "tienda:leer tienda:escribir");
  assert.equal(scopeConcedido(todo, "si"), "tienda:leer tienda:escribir", "solo `true` cuenta: nada de textos que parezcan sí");
  assert.equal(scopeConcedido(todo, 1), "tienda:leer tienda:escribir");
  assert.equal(scopeConcedido(todo, true), todo);
  // El cliente pidió solo lo básico: marcar la casilla no le suma dinero.
  assert.equal(scopeConcedido("tienda:leer tienda:escribir", true), "tienda:leer tienda:escribir");
  assert.equal(scopeConcedido("tienda:leer", true), "tienda:leer");
  // Pidió SOLO dinero y no marcó: queda con lo que dinero implica, sin dinero.
  assert.equal(scopeConcedido("tienda:dinero", false), "tienda:leer tienda:escribir");
  // Basura: falla cerrado al mínimo.
  assert.equal(scopeConcedido("cualquier cosa", true), "tienda:leer");
});

test("la metadata del recurso y del servidor anuncia tienda:dinero", () => {
  assert.ok(metadataRecursoProtegido(BASE).scopes_supported.includes("tienda:dinero"));
  assert.ok(metadataServidorAutorizacion(BASE).scopes_supported.includes("tienda:dinero"));
});

// ───────── conexión completa ─────────
test("conexión nueva que pide solo el scope básico no obtiene dinero, ni siquiera con la casilla marcada", async () => {
  for (const pedido of [undefined, "tienda:leer tienda:escribir", "tienda:leer"]) {
    const { tokens } = await conectar(nuevaDb(), { scopePedido: pedido, consentimientoDinero: true });
    assert.ok(!tokens.scope.includes("tienda:dinero"), `pidió ${pedido}: ${tokens.scope}`);
  }
});

test("pedir dinero SIN marcar la casilla (autorización sin consentimiento explícito) no da dinero", async () => {
  const { tokens } = await conectar(nuevaDb(), { scopePedido: "tienda:leer tienda:escribir tienda:dinero", consentimientoDinero: false });
  assert.equal(tokens.scope, "tienda:leer tienda:escribir");
});

test("pedir dinero y marcar la casilla sí lo da, y /admin/conexiones lo muestra", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db, { scopePedido: "tienda:leer tienda:escribir tienda:dinero", consentimientoDinero: true });
  assert.equal(tokens.scope, "tienda:leer tienda:escribir tienda:dinero");
  const [c] = await listarConexiones(db, T0 + 1);
  assert.equal(c.scope, "tienda:leer tienda:escribir tienda:dinero");
  assert.match(etiquetaPermiso(c.scope), /dinero y borrado/);
  assert.match(etiquetaPermiso("tienda:leer tienda:escribir"), /sin dinero ni borrado/);
  assert.equal(etiquetaPermiso("tienda:leer"), "solo ver");
});

test("el refresco no puede ampliar scopes (ni a dinero), solo achicar, y achicar es definitivo", async () => {
  const db = nuevaDb();
  const base = await conectar(db, { scopePedido: "tienda:leer tienda:escribir tienda:dinero", consentimientoDinero: false });
  const amplia = await refrescar(db, { refreshToken: base.tokens.refresh_token, clientId: base.cliente.id, scope: "tienda:dinero" }, deps(), T0 + 10);
  assert.equal(amplia.error, "invalid_scope");
  // El intento fallido no gasta el refresco: sin scope sigue igual que antes.
  const igual = await refrescar(db, { refreshToken: base.tokens.refresh_token, clientId: base.cliente.id }, deps(), T0 + 20);
  assert.equal(igual.tokens.scope, "tienda:leer tienda:escribir");

  const db2 = nuevaDb();
  const con = await conectar(db2, { scopePedido: "tienda:dinero", consentimientoDinero: true });
  assert.ok(con.tokens.scope.includes("tienda:dinero"));
  const menos = await refrescar(db2, { refreshToken: con.tokens.refresh_token, clientId: con.cliente.id, scope: "tienda:leer tienda:escribir" }, deps(), T0 + 10);
  assert.equal(menos.tokens.scope, "tienda:leer tienda:escribir");
  const otra = await refrescar(db2, { refreshToken: menos.tokens.refresh_token, clientId: con.cliente.id, scope: "tienda:dinero" }, deps(), T0 + 20);
  assert.equal(otra.error, "invalid_scope");
  // Sin pedir scope, se mantiene (nunca crece).
  const sigue = await refrescar(db2, { refreshToken: menos.tokens.refresh_token, clientId: con.cliente.id }, deps(), T0 + 30);
  assert.equal(sigue.tokens.scope, "tienda:leer tienda:escribir");
});

// ───────── servidor: lista y ejecución ─────────
function regConDinero(contador) {
  const r = crearRegistro();
  r.agregar(
    defineHerramienta({
      nombre: "leer_algo", titulo: "Leer algo", descripcion: "Lee algo.", esquema: z.object({}),
      anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      ejecutar: async () => "leído",
    }),
    defineHerramienta({
      nombre: "cambiar_algo", titulo: "Cambiar algo", descripcion: "Cambia algo.", esquema: z.object({}),
      anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      ejecutar: async () => "cambiado",
    }),
    defineHerramienta({
      nombre: "mover_dinero_prueba", titulo: "Mover dinero (prueba)", descripcion: "Herramienta de dinero de prueba.", esquema: z.object({}),
      anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      scope: "tienda:dinero",
      async ejecutar(_a, ctx) { contador.n++; return `hecho (scope ${ctx.scope})`; },
    }),
  );
  return r;
}
const rpc = (method, params, id = 1) => JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) });
const pet = (texto, token) => ({ metodo: "POST", texto, cabecera: (n) => (n.toLowerCase() === "authorization" ? `Bearer ${token}` : null) });
const llamar = (db, registro, texto, token) => manejarSolicitudMcp(pet(texto, token), { db, registro, base: BASE, ahora: T0 + 1000, verificarUsuario: deps().verificarUsuario });

test("servidor: un token sin tienda:dinero no ve la herramienta de dinero en tools/list ni puede ejecutarla aunque sepa el nombre", async () => {
  const db = nuevaDb();
  const n = { n: 0 };
  const registro = regConDinero(n);
  for (const scopePedido of ["tienda:leer tienda:escribir", "tienda:leer"]) {
    const { tokens } = await conectar(db, { scopePedido, consentimientoDinero: true });
    const lista = await llamar(db, registro, rpc("tools/list"), tokens.access_token);
    assert.ok(!lista.body.result.tools.some((t) => t.name === "mover_dinero_prueba"), scopePedido);
    const c = await llamar(db, registro, rpc("tools/call", { name: "mover_dinero_prueba", arguments: {} }), tokens.access_token);
    assert.equal(c.status, 403);
    assert.match(c.headers["WWW-Authenticate"], /insufficient_scope/);
    assert.match(c.headers["WWW-Authenticate"], /tienda:dinero/);
    assert.match(c.body.error_description, /volver a autorizar/i);
  }
  assert.equal(n.n, 0, "la herramienta no debe ejecutarse sin el scope");
  // Con un token «refrescado a lo básico» después de haber tenido dinero, tampoco.
  const db2 = nuevaDb();
  const con = await conectar(db2, { scopePedido: "tienda:dinero", consentimientoDinero: true });
  const achicado = await refrescar(db2, { refreshToken: con.tokens.refresh_token, clientId: con.cliente.id, scope: "tienda:leer tienda:escribir" }, deps(), T0 + 10);
  const c2 = await llamar(db2, registro, rpc("tools/call", { name: "mover_dinero_prueba", arguments: {} }), achicado.tokens.access_token);
  assert.equal(c2.status, 403);
  assert.equal(n.n, 0);
});

test("servidor: con tienda:dinero la herramienta se lista y se ejecuta, y recibe el scope en el contexto", async () => {
  const db = nuevaDb();
  const n = { n: 0 };
  const registro = regConDinero(n);
  const { tokens } = await conectar(db, { scopePedido: "tienda:dinero", consentimientoDinero: true });
  const lista = await llamar(db, registro, rpc("tools/list"), tokens.access_token);
  assert.ok(lista.body.result.tools.some((t) => t.name === "mover_dinero_prueba"));
  const c = await llamar(db, registro, rpc("tools/call", { name: "mover_dinero_prueba", arguments: {} }), tokens.access_token);
  assert.equal(c.status, 200);
  assert.match(c.body.result.structuredContent.texto, /tienda:dinero/);
  assert.equal(n.n, 1);
});

test("listarHerramientasMcp: dinero solo con escribir Y dinero; lo básico no cambia", () => {
  const registro = regConDinero({ n: 0 });
  const nombres = (e, d) => listarHerramientasMcp(registro, e, d).map((t) => t.name);
  assert.deepEqual(nombres(true, true), ["leer_algo", "cambiar_algo", "mover_dinero_prueba"]);
  assert.deepEqual(nombres(true, false), ["leer_algo", "cambiar_algo"]);
  assert.deepEqual(nombres(true), ["leer_algo", "cambiar_algo"]);
  assert.deepEqual(nombres(false, true), ["leer_algo"], "sin escribir no hay dinero aunque se diga");
});

test("una herramienta de dinero no puede declararse de solo lectura ni con otro scope", () => {
  assert.throws(() => defineHerramienta({
    nombre: "x_dinero", titulo: "X", descripcion: "X.", esquema: z.object({}),
    anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }, scope: "tienda:dinero", ejecutar: async () => "x",
  }), /solo lectura/);
  assert.throws(() => defineHerramienta({
    nombre: "x_otro", titulo: "X", descripcion: "X.", esquema: z.object({}),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }, scope: "tienda:admin", ejecutar: async () => "x",
  }), /scope desconocido/);
});

test("el registro real: toda herramienta que declare tienda:dinero es de escritura, y las demás siguen visibles sin dinero", () => {
  const todas = registroReal.lista();
  for (const h of todas.filter((x) => x.scope === "tienda:dinero")) assert.equal(h.anotaciones.readOnlyHint, false, h.nombre);
  const sinDinero = listarHerramientasMcp(registroReal, true, false);
  const conDinero = listarHerramientasMcp(registroReal, true, true);
  assert.equal(conDinero.length - sinDinero.length, todas.filter((x) => x.scope === "tienda:dinero").length);
  assert.ok(sinDinero.length >= 80);
});

// ───────── texto de consentimiento ─────────
test("texto de permisos: sin dinero dice que NO puede tocar pagos ni borrar; con dinero lista exactamente lo que podrá y lo que sigue fuera", () => {
  const sin = textoPermisos("tienda:leer tienda:escribir");
  assert.equal(sin.dinero, false);
  const noSin = sin.noPuede.join("\n");
  assert.match(noSin, /pagos/i);
  assert.match(noSin, /transferencias/i);
  assert.match(noSin, /Borrar/);
  assert.ok(!sin.puede.some((l) => /transferencia|devoluci|Borrar para siempre|archivar/i.test(l)));

  const con = textoPermisos("tienda:leer tienda:escribir tienda:dinero");
  assert.equal(con.dinero, true);
  for (const l of DINERO_PUEDE) assert.ok(con.puede.includes(l));
  const puede = con.puede.join("\n");
  assert.match(puede, /Confirmar una transferencia/);
  assert.match(puede, /Cancelar un pedido ya pagado con su devolución/);
  assert.match(puede, /Archivar pedidos/);
  assert.match(puede, /Borrar para siempre un pedido que nunca se pagó/);
  assert.match(puede, /Borrar los datos de un cliente o suscriptor, de uno en uno/);
  assert.match(puede, /Marcar como hecha una devolución por transferencia/);
  const fuera = con.noPuede.join("\n");
  assert.match(fuera, /cuentas bancarias/);
  assert.match(fuera, /enlaces de pago/);
  assert.match(fuera, /datos de la cuenta de la barraca/);
  assert.match(fuera, /claves, usuarios ni roles/);
  assert.match(fuera, /pedidos que ya fueron pagados/);
  assert.match(fuera, /correos masivos/);
  assert.match(fuera, /modo de aprobación/);
  for (const l of DINERO_SIGUE_FUERA) assert.ok(con.noPuede.includes(l));
  // Con dinero ya no se promete que no puede tocar pagos.
  assert.doesNotMatch(fuera, /no puede confirmar transferencias/);
  assert.ok(NO_PUEDE.length >= 4);
});

test("pantalla de autorización: sección «Dinero y borrado» aparte, casilla desmarcada, y la decisión usa scopeConcedido", () => {
  const pantalla = readFileSync(new URL("../src/app/admin/conexiones/autorizar/route.ts", import.meta.url), "utf8");
  assert.match(pantalla, /Dinero y borrado/);
  assert.match(pantalla, /pideDinero/);
  const casilla = /<input type="checkbox" name="dinero" value="si"[^>]*>/.exec(pantalla)?.[0] ?? "";
  assert.ok(casilla, "falta la casilla");
  assert.doesNotMatch(casilla, /checked/, "la casilla va desmarcada");
  const decision = readFileSync(new URL("../src/app/oauth/decision/route.ts", import.meta.url), "utf8");
  assert.match(decision, /scopeConcedido\(s\.scope, form\.get\("dinero"\) === "si"\)/);
  assert.doesNotMatch(decision, /scope: s\.scope/, "el código no puede emitirse con el scope pedido sin pasar por scopeConcedido");
  // Ninguna otra ruta emite códigos.
  const token = readFileSync(new URL("../src/app/oauth/token/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(token, /emitirCodigo/);
});
