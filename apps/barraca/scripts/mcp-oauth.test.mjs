// Pruebas del OAuth y del servidor MCP (D1 simulada, sin red ni Supabase).
// Correr: node --test scripts/mcp-oauth.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";
import {
  registrarCliente, validarSolicitudAutorizacion, emitirCodigo, canjearCodigo, refrescar, autenticarAcceso,
  revocarFamilia, revocarPorToken, listarConexiones, normalizarScope,
} from "../src/lib/mcp/oauth.ts";
import { manejarSolicitudMcp } from "../src/lib/mcp/servidor.ts";
import { limitar } from "../src/lib/mcp/limites.ts";
import { redirectCoincide, esRedirectPermitida } from "../src/lib/mcp/redirects.ts";
import { crearRegistro, defineHerramienta, z, ErrorHerramienta } from "../src/lib/mcp/tools/registro.ts";
import { registro as registroReal } from "../src/lib/mcp/tools/index.ts";
import { deshacerLote, loteSePuedeDeshacer } from "../src/lib/mcp/deshacer.ts";
import { registrarLote, obtenerLote } from "../src/lib/gestion/auditoria.ts";
import { evaluarUsuario } from "../src/lib/mcp/evaluar-usuario.ts";
import { encabezadoNoAutenticado, metadataServidorAutorizacion, metadataRecursoProtegido } from "../src/lib/mcp/config.ts";

const BASE = "https://barraca.jurmaq.cl";
const RECURSO = `${BASE}/api/mcp`;
const CLAUDE = "https://claude.ai/api/mcp/auth_callback";
const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);

const nuevaDb = () => crearD1Simulada({ migraciones: "0002_oauth.sql" });
const verificador = () => randomBytes(48).toString("base64url");
const desafio = (v) => createHash("sha256").update(v).digest("base64url");
const JORGE = { id: "1", email: "contacto@jurmaq.cl" };

function deps(estado = { ok: true }) {
  return {
    base: BASE,
    verificarUsuario: async (id) => {
      if (estado.ok === true && id === JORGE.id) return { ok: true, usuario: JORGE };
      return { ok: false, motivo: estado.ok === "caido" ? "no_disponible" : "no_autorizado" };
    },
  };
}

async function conectar(db, { ahora = T0, redirect = CLAUDE, d = deps() } = {}) {
  const reg = await registrarCliente(db, { nombre: "Claude", redirectUris: [redirect] }, ahora);
  assert.ok(reg.ok);
  const v = verificador();
  const val = await validarSolicitudAutorizacion(db, {
    client_id: reg.cliente.id, redirect_uri: redirect, response_type: "code", code_challenge: desafio(v),
    code_challenge_method: "S256", state: "abc", resource: RECURSO,
  }, d);
  assert.ok(val.ok, JSON.stringify(val));
  const s = val.solicitud;
  const code = await emitirCodigo(db, { clienteId: s.cliente.id, usuario: JORGE, redirectUri: s.redirectUri, codeChallenge: s.codeChallenge, scope: s.scope, resource: s.resource }, ahora);
  const r = await canjearCodigo(db, { code, clientId: s.cliente.id, redirectUri: s.redirectUri, codeVerifier: v, resource: RECURSO }, d, ahora);
  assert.ok(r.ok, JSON.stringify(r));
  return { cliente: reg.cliente, tokens: r.tokens, code, v, solicitud: s };
}

// ───────── Registro y redirects ─────────
test("registro dinámico: solo redirects de la lista blanca", async () => {
  const db = nuevaDb();
  for (const malo of ["https://evil.example/cb", "https://claude.ai.evil.example/api/mcp/auth_callback", "http://claude.ai/api/mcp/auth_callback",
    "https://claude.ai/api/mcp/auth_callback?x=1", "http://localhost:3118/otra", "http://127.0.0.1:80/callback#f", "http://user@localhost:1/callback", "javascript:alert(1)", "http://evil.example:3000/callback"]) {
    const r = await registrarCliente(db, { nombre: "x", redirectUris: [malo] });
    assert.equal(r.ok, false, malo);
    assert.equal(r.error, "invalid_redirect_uri");
  }
  // Una buena junto a una mala: se rechaza todo.
  assert.equal((await registrarCliente(db, { nombre: "x", redirectUris: [CLAUDE, "https://evil.example/cb"] })).ok, false);
  assert.equal((await registrarCliente(db, { nombre: "x", redirectUris: [] })).ok, false);
  assert.equal((await registrarCliente(db, { nombre: "x", redirectUris: "no" })).ok, false);
  for (const bueno of [CLAUDE, "https://claude.com/api/mcp/auth_callback", "http://localhost:3118/callback", "http://127.0.0.1:5555/callback", "http://[::1]:7/callback"]) {
    assert.equal((await registrarCliente(db, { nombre: "Claude", redirectUris: [bueno] })).ok, true, bueno);
  }
});

test("redirect: exacta, salvo bucle local donde el puerto se ignora", () => {
  assert.equal(redirectCoincide(CLAUDE, CLAUDE), true);
  assert.equal(redirectCoincide(CLAUDE, CLAUDE + "/"), false);
  assert.equal(redirectCoincide(CLAUDE, "https://claude.com/api/mcp/auth_callback"), false);
  assert.equal(redirectCoincide("http://localhost:1000/callback", "http://localhost:9999/callback"), true);
  assert.equal(redirectCoincide("http://localhost/callback", "http://127.0.0.1:9999/callback"), false);
  assert.equal(redirectCoincide("http://localhost:1/callback", "http://localhost:1/otra"), false);
  assert.equal(esRedirectPermitida("http://localhost:1/callback?x=1"), false);
});

test("autorizar con redirect_uri inexacta NO redirige: pantalla de error", async () => {
  const db = nuevaDb();
  const { cliente } = await conectar(db);
  const base = { client_id: cliente.id, response_type: "code", code_challenge: desafio(verificador()), code_challenge_method: "S256" };
  for (const ru of [CLAUDE + "/x", "https://evil.example/cb", "https://claude.com/api/mcp/auth_callback", "", undefined]) {
    const r = await validarSolicitudAutorizacion(db, { ...base, redirect_uri: ru }, deps());
    assert.equal(r.ok, false);
    assert.equal(r.modo, "pagina");
  }
  assert.equal((await validarSolicitudAutorizacion(db, { ...base, client_id: "mcpcli_no", redirect_uri: CLAUDE }, deps())).modo, "pagina");
});

test("autorizar exige PKCE S256 y response_type=code (error vuelve a la redirect confiable)", async () => {
  const db = nuevaDb();
  const { cliente } = await conectar(db);
  const ok = { client_id: cliente.id, redirect_uri: CLAUDE, response_type: "code", code_challenge: desafio(verificador()), code_challenge_method: "S256", state: "s1" };
  assert.equal((await validarSolicitudAutorizacion(db, ok, deps())).ok, true);
  for (const roto of [{ code_challenge: undefined }, { code_challenge_method: "plain" }, { code_challenge_method: undefined }, { code_challenge: "corto" }, { response_type: "token" }]) {
    const r = await validarSolicitudAutorizacion(db, { ...ok, ...roto }, deps());
    assert.equal(r.ok, false);
    assert.equal(r.modo, "redirigir");
    assert.equal(r.error, "invalid_request");
    assert.equal(r.state, "s1");
  }
});

test("resource (audiencia) equivocada se rechaza al autorizar y al canjear", async () => {
  const db = nuevaDb();
  const { cliente } = await conectar(db);
  const p = { client_id: cliente.id, redirect_uri: CLAUDE, response_type: "code", code_challenge: desafio(verificador()), code_challenge_method: "S256" };
  const r = await validarSolicitudAutorizacion(db, { ...p, resource: "https://otro.example/api/mcp" }, deps());
  assert.equal(r.error, "invalid_target");
  assert.equal((await validarSolicitudAutorizacion(db, { ...p, resource: RECURSO + "/" }, deps())).ok, true); // barra final tolerada
  const v = verificador();
  const code = await emitirCodigo(db, { clienteId: cliente.id, usuario: JORGE, redirectUri: CLAUDE, codeChallenge: desafio(v), scope: "tienda:leer", resource: RECURSO }, T0);
  const c = await canjearCodigo(db, { code, clientId: cliente.id, redirectUri: CLAUDE, codeVerifier: v, resource: "https://otro.example/api/mcp" }, deps(), T0);
  assert.equal(c.error, "invalid_target");
});

test("scopes: se normalizan y lo desconocido se rechaza", () => {
  assert.equal(normalizarScope(undefined).scope, "tienda:leer tienda:escribir");
  assert.equal(normalizarScope("tienda:leer offline_access").scope, "tienda:leer");
  assert.equal(normalizarScope("tienda:escribir").scope, "tienda:leer tienda:escribir");
  assert.equal(normalizarScope("admin").error, "invalid_scope");
});

// ───────── Código, PKCE, tokens ─────────
test("PKCE: un verificador malo se rechaza y el código queda gastado", async () => {
  const db = nuevaDb();
  const reg = await registrarCliente(db, { nombre: "Claude", redirectUris: [CLAUDE] });
  const v = verificador();
  const code = await emitirCodigo(db, { clienteId: reg.cliente.id, usuario: JORGE, redirectUri: CLAUDE, codeChallenge: desafio(v), scope: "tienda:leer", resource: RECURSO }, T0);
  const malo = await canjearCodigo(db, { code, clientId: reg.cliente.id, redirectUri: CLAUDE, codeVerifier: verificador() }, deps(), T0);
  assert.equal(malo.error, "invalid_grant");
  const bueno = await canjearCodigo(db, { code, clientId: reg.cliente.id, redirectUri: CLAUDE, codeVerifier: v }, deps(), T0);
  assert.equal(bueno.ok, false, "el código ya se gastó con el intento fallido");
  // Verificador demasiado corto o con caracteres raros.
  const code2 = await emitirCodigo(db, { clienteId: reg.cliente.id, usuario: JORGE, redirectUri: CLAUDE, codeChallenge: desafio(v), scope: "tienda:leer", resource: RECURSO }, T0);
  assert.equal((await canjearCodigo(db, { code: code2, clientId: reg.cliente.id, redirectUri: CLAUDE, codeVerifier: "corto" }, deps(), T0)).error, "invalid_request");
});

test("el código es de un solo uso; reusarlo revoca lo que se emitió", async () => {
  const db = nuevaDb();
  const { cliente, tokens, code, v } = await conectar(db);
  assert.equal((await autenticarAcceso(db, tokens.access_token, T0, { base: BASE })).ok, true);
  const otra = await canjearCodigo(db, { code, clientId: cliente.id, redirectUri: CLAUDE, codeVerifier: v }, deps(), T0 + 1000);
  assert.equal(otra.error, "invalid_grant");
  assert.equal((await autenticarAcceso(db, tokens.access_token, T0 + 2000, { base: BASE })).motivo, "revocado");
});

test("el código vence a los 60 segundos y exige el mismo client_id y redirect_uri", async () => {
  const db = nuevaDb();
  const reg = await registrarCliente(db, { nombre: "Claude", redirectUris: [CLAUDE, "https://claude.com/api/mcp/auth_callback"] });
  const v = verificador();
  const nuevo = () => emitirCodigo(db, { clienteId: reg.cliente.id, usuario: JORGE, redirectUri: CLAUDE, codeChallenge: desafio(v), scope: "tienda:leer", resource: RECURSO }, T0);
  assert.equal((await canjearCodigo(db, { code: await nuevo(), clientId: reg.cliente.id, redirectUri: CLAUDE, codeVerifier: v }, deps(), T0 + 61_000)).error, "invalid_grant");
  assert.equal((await canjearCodigo(db, { code: await nuevo(), clientId: "mcpcli_otro", redirectUri: CLAUDE, codeVerifier: v }, deps(), T0)).error, "invalid_grant");
  assert.equal((await canjearCodigo(db, { code: await nuevo(), clientId: reg.cliente.id, redirectUri: "https://claude.com/api/mcp/auth_callback", codeVerifier: v }, deps(), T0)).error, "invalid_grant");
  assert.equal((await canjearCodigo(db, { code: await nuevo(), clientId: reg.cliente.id, redirectUri: CLAUDE, codeVerifier: v }, deps(), T0 + 59_000)).ok, true);
});

test("tokens: solo se guarda el hash (nunca el token en claro)", async () => {
  const db = nuevaDb();
  const { tokens, code } = await conectar(db);
  const volcado = JSON.stringify([
    ...(await db.prepare("SELECT * FROM oauth_tokens").all()).results,
    ...(await db.prepare("SELECT * FROM oauth_codigos").all()).results,
  ]);
  assert.ok(!volcado.includes(tokens.access_token));
  assert.ok(!volcado.includes(tokens.refresh_token));
  assert.ok(!volcado.includes(code));
  assert.match(tokens.access_token, /^mcpa_/);
  assert.equal(tokens.expires_in, 3600);
});

test("refresco: rota; reusar el viejo revoca TODA la familia", async () => {
  const db = nuevaDb();
  const { cliente, tokens } = await conectar(db);
  const r1 = await refrescar(db, { refreshToken: tokens.refresh_token, clientId: cliente.id }, deps(), T0 + 1000);
  assert.ok(r1.ok);
  assert.notEqual(r1.tokens.refresh_token, tokens.refresh_token);
  assert.equal((await autenticarAcceso(db, r1.tokens.access_token, T0 + 2000, { base: BASE })).ok, true);
  // El acceso viejo aguanta la gracia y luego muere.
  assert.equal((await autenticarAcceso(db, tokens.access_token, T0 + 30_000, { base: BASE })).ok, true);
  assert.equal((await autenticarAcceso(db, tokens.access_token, T0 + 120_000, { base: BASE })).ok, false);
  // Reuso del refresco viejo = robo: cae todo.
  const robo = await refrescar(db, { refreshToken: tokens.refresh_token, clientId: cliente.id }, deps(), T0 + 3000);
  assert.equal(robo.error, "invalid_grant");
  assert.equal((await autenticarAcceso(db, r1.tokens.access_token, T0 + 4000, { base: BASE })).motivo, "revocado");
  assert.equal((await refrescar(db, { refreshToken: r1.tokens.refresh_token, clientId: cliente.id }, deps(), T0 + 5000)).error, "invalid_grant");
});

test("refresco: otro client_id, scope mayor y vencimiento se rechazan", async () => {
  const db = nuevaDb();
  const { cliente, tokens } = await conectar(db);
  assert.equal((await refrescar(db, { refreshToken: tokens.refresh_token, clientId: "mcpcli_otro" }, deps(), T0)).error, "invalid_grant");
  const reg = await registrarCliente(db, { nombre: "Claude", redirectUris: [CLAUDE] });
  void reg;
  assert.equal((await refrescar(db, { refreshToken: tokens.refresh_token, clientId: cliente.id }, deps(), T0 + 31 * 86_400_000)).error, "invalid_grant");
  // Achicar el scope está bien; ampliar no.
  const { cliente: c2, tokens: t2 } = await conectar(db, { ahora: T0 });
  const menos = await refrescar(db, { refreshToken: t2.refresh_token, clientId: c2.id, scope: "tienda:leer" }, deps(), T0 + 10);
  assert.equal(menos.tokens.scope, "tienda:leer");
  assert.equal((await refrescar(db, { refreshToken: menos.tokens.refresh_token, clientId: c2.id, scope: "tienda:leer tienda:escribir" }, deps(), T0 + 20)).error, "invalid_scope");
});

test("la conexión muere a los 90 días aunque se siga refrescando", async () => {
  const db = nuevaDb();
  const { cliente, tokens } = await conectar(db);
  let t = tokens;
  let ahora = T0;
  for (let i = 0; i < 3; i++) {
    ahora += 29 * 86_400_000;
    const r = await refrescar(db, { refreshToken: t.refresh_token, clientId: cliente.id }, deps(), ahora);
    assert.ok(r.ok, `ronda ${i}`);
    t = r.tokens;
  }
  ahora += 29 * 86_400_000; // día 116 > 90
  assert.equal((await refrescar(db, { refreshToken: t.refresh_token, clientId: cliente.id }, deps(), ahora)).error, "invalid_grant");
});

test("revocación inmediata: el acceso deja de servir al instante", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  const con = await listarConexiones(db, T0 + 1);
  assert.equal(con.length, 1);
  assert.equal(con[0].usuarioEmail, "contacto@jurmaq.cl");
  assert.equal(con[0].clienteNombre, "Claude");
  assert.equal((await autenticarAcceso(db, tokens.access_token, T0 + 1, { base: BASE })).ok, true);
  assert.equal(await revocarFamilia(db, con[0].familiaId, "revocado_en_panel", T0 + 2), 1);
  assert.equal((await autenticarAcceso(db, tokens.access_token, T0 + 3, { base: BASE })).motivo, "revocado");
  assert.equal((await listarConexiones(db, T0 + 4)).length, 0);
});

test("RFC 7009: revocar por token (acceso o refresco)", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  assert.equal(await revocarPorToken(db, tokens.refresh_token, T0 + 1), true);
  assert.equal((await autenticarAcceso(db, tokens.access_token, T0 + 2, { base: BASE })).motivo, "revocado");
  assert.equal(await revocarPorToken(db, "mcpa_desconocido", T0 + 3), false);
});

test("audiencia equivocada en el token: no sirve en este servidor", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  await db.prepare("UPDATE oauth_tokens SET resource = ?").bind("https://otro.example/api/mcp").run();
  assert.equal((await autenticarAcceso(db, tokens.access_token, T0 + 1, { base: BASE })).motivo, "audiencia");
});

test("acceso: formato raro, ausente y vencido", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  assert.equal((await autenticarAcceso(db, null, T0, { base: BASE })).motivo, "ausente");
  assert.equal((await autenticarAcceso(db, "basura", T0, { base: BASE })).motivo, "invalido");
  assert.equal((await autenticarAcceso(db, tokens.access_token + "x", T0, { base: BASE })).motivo, "invalido");
  assert.equal((await autenticarAcceso(db, tokens.access_token, T0 + 3_600_001, { base: BASE })).motivo, "vencido");
});

test("al canjear o refrescar, un usuario que ya no es admin no obtiene tokens", async () => {
  const db = nuevaDb();
  const { cliente, tokens } = await conectar(db);
  const r = await refrescar(db, { refreshToken: tokens.refresh_token, clientId: cliente.id }, deps({ ok: false }), T0 + 1);
  assert.equal(r.error, "invalid_grant");
  assert.equal((await autenticarAcceso(db, tokens.access_token, T0 + 2, { base: BASE })).motivo, "revocado");
  const reg = await registrarCliente(db, { nombre: "Claude", redirectUris: [CLAUDE] });
  const v = verificador();
  const code = await emitirCodigo(db, { clienteId: reg.cliente.id, usuario: JORGE, redirectUri: CLAUDE, codeChallenge: desafio(v), scope: "tienda:leer", resource: RECURSO }, T0);
  assert.equal((await canjearCodigo(db, { code, clientId: reg.cliente.id, redirectUri: CLAUDE, codeVerifier: v }, deps({ ok: false }), T0)).error, "invalid_grant");
});

// ───────── Quién puede usarlo ─────────
test("evaluarUsuario: solo admin con scope barraca/both y correo permitido", () => {
  const P = ["contacto@jurmaq.cl"];
  assert.equal(evaluarUsuario({ id: 1, email: "contacto@jurmaq.cl", role: "admin", scope: "both" }, P).ok, true);
  assert.equal(evaluarUsuario({ id: 1, email: "Contacto@jurmaq.cl", role: "admin", scope: "barraca" }, P).ok, true);
  for (const mala of [
    { id: 1, email: "contacto@jurmaq.cl", role: "gerente", scope: "both" },
    { id: 1, email: "contacto@jurmaq.cl", role: "vendedor", scope: "barraca" },
    { id: 1, email: "contacto@jurmaq.cl", role: "admin", scope: "constructora" },
    { id: 1, email: "otro@jurmaq.cl", role: "admin", scope: "both" },
    { id: 1, role: "admin", scope: "both" },
  ]) assert.equal(evaluarUsuario(mala, P).ok, false);
  assert.equal(evaluarUsuario(null, P).ok, false);
});

// ───────── Metadata ─────────
test("metadata: recurso protegido, servidor de autorización y desafío 401", () => {
  const prm = metadataRecursoProtegido(BASE);
  assert.equal(prm.resource, RECURSO);
  assert.deepEqual(prm.authorization_servers, [BASE]);
  const asm = metadataServidorAutorizacion(BASE);
  assert.equal(asm.issuer, BASE);
  assert.deepEqual(asm.code_challenge_methods_supported, ["S256"]);
  assert.ok(asm.registration_endpoint.startsWith(BASE));
  assert.deepEqual(asm.token_endpoint_auth_methods_supported, ["none"]);
  assert.equal(asm.authorization_response_iss_parameter_supported, true);
  const h = encabezadoNoAutenticado(BASE);
  assert.match(h, /^Bearer /);
  assert.ok(h.includes(`resource_metadata="${BASE}/.well-known/oauth-protected-resource/api/mcp"`));
  assert.match(h, /scope="tienda:leer tienda:escribir"/);
});

// ───────── Límite ─────────
test("límite de uso por ventana", async () => {
  const db = nuevaDb();
  for (let i = 1; i <= 3; i++) assert.equal((await limitar(db, "k", 3, 60_000, T0)).permitido, true);
  const r = await limitar(db, "k", 3, 60_000, T0 + 5_000);
  assert.equal(r.permitido, false);
  assert.ok(r.reintentarEnSeg >= 1 && r.reintentarEnSeg <= 60);
  assert.equal((await limitar(db, "otra", 3, 60_000, T0)).permitido, true);
  assert.equal((await limitar(db, "k", 3, 60_000, T0 + 61_000)).permitido, true);
});

// ───────── Servidor MCP ─────────
function reg() {
  const r = crearRegistro();
  r.agregar(
    defineHerramienta({
      nombre: "leer_algo", titulo: "Leer algo", descripcion: "Lee algo.", esquema: z.object({ n: z.number().int().optional() }),
      anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      ejecutar: async ({ n }) => ({ texto: `leído ${n ?? 0}`, datos: { n: n ?? 0 } }),
    }),
    defineHerramienta({
      nombre: "cambiar_algo", titulo: "Cambiar algo", descripcion: "Cambia algo.", esquema: z.object({ valor: z.string().max(20) }),
      anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      async ejecutar({ valor }, ctx) {
        await ctx.auditar([{ entidad: "cosa", entidadId: "1", antes: { v: "a" }, despues: { v: valor } }]);
        return `cambiado a ${valor} (lote ${ctx.loteId})`;
      },
      revertidor: async ({ entradas }) => ({ ok: true, mensaje: `revertí ${entradas.length}` }),
    }),
    defineHerramienta({
      nombre: "se_rompe", titulo: "Se rompe", descripcion: "Falla.", esquema: z.object({}),
      anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      ejecutar: async () => { throw new Error("SECRETO interno: postgres://user:clave@host/db"); },
    }),
    defineHerramienta({
      nombre: "avisa", titulo: "Avisa", descripcion: "Error esperado.", esquema: z.object({}),
      anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      ejecutar: async () => { throw new ErrorHerramienta("No existe ese producto."); },
    }),
  );
  return r;
}

const rpc = (method, params, id = 1) => JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) });
function peticion(texto, { token, metodo = "POST", cab = {} } = {}) {
  const h = { ...(token ? { authorization: `Bearer ${token}` } : {}), ...cab };
  return { metodo, texto, cabecera: (n) => h[n.toLowerCase()] ?? null };
}
const llamar = (db, p, d = deps(), registro = reg(), ahora = T0 + 1000) => manejarSolicitudMcp(p, { db, registro, base: BASE, ahora, verificarUsuario: d.verificarUsuario });

test("MCP: sin token = 401 con WWW-Authenticate y resource_metadata", async () => {
  const db = nuevaDb();
  for (const texto of [rpc("initialize", {}), rpc("tools/list"), rpc("tools/call", { name: "leer_algo" })]) {
    const r = await llamar(db, peticion(texto));
    assert.equal(r.status, 401);
    assert.ok(r.headers["WWW-Authenticate"].includes("resource_metadata="));
  }
  const malo = await llamar(db, peticion(rpc("ping"), { token: "mcpa_" + "a".repeat(43) }));
  assert.equal(malo.status, 401);
  assert.match(malo.headers["WWW-Authenticate"], /error="invalid_token"/);
});

test("MCP: initialize, ping, tools/list y tools/call de punta a punta", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  const t = tokens.access_token;
  const init = await llamar(db, peticion(rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "x", version: "1" } }), { token: t }));
  assert.equal(init.status, 200);
  assert.equal(init.body.result.protocolVersion, "2025-06-18");
  assert.equal(init.body.result.serverInfo.name, "jurmaq-barraca");
  assert.equal((await llamar(db, peticion(rpc("initialize", { protocolVersion: "1999-01-01" }), { token: t }))).body.result.protocolVersion, "2025-11-25");
  assert.equal((await llamar(db, peticion(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }), { token: t }))).status, 202);
  assert.deepEqual((await llamar(db, peticion(rpc("ping"), { token: t }))).body.result, {});
  const lista = await llamar(db, peticion(rpc("tools/list"), { token: t }));
  const nombres = lista.body.result.tools.map((x) => x.name);
  assert.deepEqual(nombres.sort(), ["avisa", "cambiar_algo", "leer_algo", "se_rompe"]);
  const cambiar = lista.body.result.tools.find((x) => x.name === "cambiar_algo");
  assert.equal(cambiar.annotations.readOnlyHint, false);
  assert.equal(cambiar.annotations.idempotentHint, true);
  assert.equal(cambiar.inputSchema.additionalProperties, false);
  assert.equal(cambiar.inputSchema.$schema, undefined);
  const c = await llamar(db, peticion(rpc("tools/call", { name: "leer_algo", arguments: { n: 5 } }), { token: t }));
  assert.equal(c.body.result.content[0].text, "leído 5");
  assert.deepEqual(c.body.result.structuredContent, { n: 5, texto: "leído 5" });
  assert.equal(c.body.result.isError, undefined);
  assert.equal((await llamar(db, peticion(rpc("cosa/rara"), { token: t }))).body.error.code, -32601);
});

test("MCP: la herramienta guia base responde", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  const r = await llamar(db, peticion(rpc("tools/call", { name: "guia", arguments: { tema: "aprobaciones" } }), { token: tokens.access_token }), deps(), registroReal);
  assert.match(r.body.result.content[0].text, /300 productos/);
  const h = await llamar(db, peticion(rpc("tools/call", { name: "guia", arguments: { tema: "herramientas" } }), { token: tokens.access_token }), deps(), registroReal);
  assert.match(h.body.result.content[0].text, /guia/);
});

test("MCP: entrada estricta (campos extra, tipos malos) y herramienta desconocida", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  const t = tokens.access_token;
  for (const args of [{ valor: "x", extra: 1 }, { valor: 5 }, {}, { valor: "x".repeat(21) }]) {
    const r = await llamar(db, peticion(rpc("tools/call", { name: "cambiar_algo", arguments: args }), { token: t }));
    assert.equal(r.body.result.isError, true, JSON.stringify(args));
    assert.match(r.body.result.content[0].text, /no son válidos/);
  }
  assert.equal((await llamar(db, peticion(rpc("tools/call", { name: "no_existe", arguments: {} }), { token: t }))).body.error.code, -32602);
  assert.equal((await llamar(db, peticion(rpc("tools/call", { name: 5 }), { token: t }))).body.error.code, -32602);
});

test("MCP: errores de herramienta sin filtrar internos; los esperados sí se dicen", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  const t = tokens.access_token;
  const mudo = console.error;
  console.error = () => {};
  try {
    const r = await llamar(db, peticion(rpc("tools/call", { name: "se_rompe", arguments: {} }), { token: t }));
    assert.equal(r.body.result.isError, true);
    const texto = JSON.stringify(r.body);
    assert.ok(!texto.includes("SECRETO") && !texto.includes("postgres"));
  } finally { console.error = mudo; }
  const e = await llamar(db, peticion(rpc("tools/call", { name: "avisa", arguments: {} }), { token: t }));
  assert.equal(e.body.result.content[0].text, "No existe ese producto.");
});

test("MCP: una herramienta que escribe audita en el lote de la llamada y se puede deshacer", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  const r = await llamar(db, peticion(rpc("tools/call", { name: "cambiar_algo", arguments: { valor: "nuevo" } }), { token: tokens.access_token }));
  const loteId = /lote ([0-9a-f-]{36})/.exec(r.body.result.content[0].text)[1];
  const lote = await obtenerLote(db, loteId);
  assert.equal(lote.length, 1);
  assert.equal(lote[0].herramienta, "cambiar_algo");
  assert.equal(lote[0].usuarioEmail, "contacto@jurmaq.cl");
  const registro = reg();
  assert.equal(await loteSePuedeDeshacer(db, registro, loteId), true);
  const d = await deshacerLote(db, registro, loteId, JORGE, T0 + 5);
  assert.equal(d.ok, true);
  assert.equal(d.revertidos, 1);
  assert.equal((await deshacerLote(db, registro, loteId, JORGE, T0 + 6)).motivo, "ya_deshecho");
  assert.equal(await loteSePuedeDeshacer(db, registro, loteId), false);
});

test("deshacer: todo o nada (sin revertidor o con fallo no se marca nada)", async () => {
  const db = nuevaDb();
  await registrarLote(db, "L1", JORGE, [{ herramienta: "sin_rev", entidad: "x", entidadId: "1", antes: 1, despues: 2 }], T0);
  const r = crearRegistro();
  r.agregar(defineHerramienta({
    nombre: "sin_rev", titulo: "s", descripcion: "s", esquema: z.object({}),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }, ejecutar: async () => "ok",
  }));
  const a = await deshacerLote(db, r, "L1", JORGE, T0 + 1);
  assert.equal(a.motivo, "sin_revertidor");
  assert.equal((await obtenerLote(db, "L1"))[0].deshechoEn, null);
  await registrarLote(db, "L2", JORGE, [
    { herramienta: "rompe_al_revertir", entidad: "x", entidadId: "1", antes: 1, despues: 2 },
  ], T0);
  const r2 = crearRegistro();
  r2.agregar(defineHerramienta({
    nombre: "rompe_al_revertir", titulo: "s", descripcion: "s", esquema: z.object({}),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }, ejecutar: async () => "ok",
    revertidor: async () => ({ ok: false, mensaje: "Alguien cambió el precio después." }),
  }));
  const b = await deshacerLote(db, r2, "L2", JORGE, T0 + 1);
  assert.equal(b.ok, false);
  assert.equal(b.mensaje, "Alguien cambió el precio después.");
  assert.equal((await obtenerLote(db, "L2"))[0].deshechoEn, null);
  assert.equal((await deshacerLote(db, r2, "no_hay", JORGE)).motivo, "no_existe");
});

test("MCP: el usuario que deja de ser admin pierde acceso en la siguiente llamada y la conexión se revoca", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  const t = tokens.access_token;
  assert.equal((await llamar(db, peticion(rpc("ping"), { token: t }))).status, 200);
  const r = await llamar(db, peticion(rpc("ping"), { token: t }), deps({ ok: false }));
  assert.equal(r.status, 401);
  assert.match(r.headers["WWW-Authenticate"], /invalid_token/);
  // Aunque vuelva a ser admin, esa conexión ya está cortada: hay que autorizar de nuevo.
  assert.equal((await llamar(db, peticion(rpc("ping"), { token: t }))).status, 401);
  assert.equal((await listarConexiones(db, T0 + 2000)).length, 0);
});

test("MCP: si Supabase no responde, 503 (no se aprueba ni se revoca)", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  const r = await llamar(db, peticion(rpc("ping"), { token: tokens.access_token }), deps({ ok: "caido" }));
  assert.equal(r.status, 503);
  assert.equal((await llamar(db, peticion(rpc("ping"), { token: tokens.access_token }))).status, 200);
});

test("MCP: revocar en el panel corta la siguiente llamada", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  const [c] = await listarConexiones(db, T0 + 1);
  await revocarFamilia(db, c.familiaId, "revocado_en_panel", T0 + 2);
  assert.equal((await llamar(db, peticion(rpc("ping"), { token: tokens.access_token }))).status, 401);
});

test("MCP: scope de solo lectura oculta y bloquea las herramientas que escriben (403 insufficient_scope)", async () => {
  const db = nuevaDb();
  const { cliente, tokens } = await conectar(db);
  const r = await refrescar(db, { refreshToken: tokens.refresh_token, clientId: cliente.id, scope: "tienda:leer" }, deps(), T0 + 10);
  const t = r.tokens.access_token;
  const lista = await llamar(db, peticion(rpc("tools/list"), { token: t }));
  assert.ok(!lista.body.result.tools.some((x) => x.name === "cambiar_algo"));
  const c = await llamar(db, peticion(rpc("tools/call", { name: "cambiar_algo", arguments: { valor: "x" } }), { token: t }));
  assert.equal(c.status, 403);
  assert.match(c.headers["WWW-Authenticate"], /insufficient_scope/);
});

test("MCP: límite de uso por conexión (429 con Retry-After)", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  let ultimo;
  for (let i = 0; i < 121; i++) ultimo = await llamar(db, peticion(rpc("ping"), { token: tokens.access_token }));
  assert.equal(ultimo.status, 429);
  assert.ok(Number(ultimo.headers["Retry-After"]) >= 1);
  // Otra ventana de tiempo, otra cuota.
  assert.equal((await llamar(db, peticion(rpc("ping"), { token: tokens.access_token }), deps(), reg(), T0 + 61_000)).status, 200);
});

test("MCP: límite de escrituras más estricto que el de lecturas", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  let ultimo;
  for (let i = 0; i < 31; i++) ultimo = await llamar(db, peticion(rpc("tools/call", { name: "cambiar_algo", arguments: { valor: "x" } }), { token: tokens.access_token }));
  assert.equal(ultimo.status, 429);
});

test("MCP: tamaño máximo, JSON roto, lotes, Origin, método y versión", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  const t = tokens.access_token;
  assert.equal((await llamar(db, peticion(rpc("tools/call", { name: "leer_algo", arguments: { x: "a".repeat(140_000) } }), { token: t }))).status, 413);
  assert.equal((await llamar(db, peticion("{no es json", { token: t }))).status, 400);
  assert.equal((await llamar(db, peticion(JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "ping" }]), { token: t }))).status, 400);
  assert.equal((await llamar(db, peticion(JSON.stringify({ id: 1, method: "ping" }), { token: t }))).status, 400);
  assert.equal((await llamar(db, peticion(rpc("ping"), { token: t, cab: { origin: "https://evil.example" } }))).status, 403);
  assert.equal((await llamar(db, peticion(rpc("ping"), { token: t, cab: { origin: "https://claude.ai" } }))).status, 200);
  assert.equal((await llamar(db, peticion(rpc("ping"), { token: t, metodo: "GET" }))).status, 405);
  assert.equal((await llamar(db, peticion(rpc("ping"), { token: t, metodo: "DELETE" }))).status, 405);
  const v = await llamar(db, peticion(rpc("ping"), { token: t, cab: { "mcp-protocol-version": "2026-07-28" } }));
  assert.equal(v.status, 400);
  assert.ok(v.body.error.data.supported.includes("2025-11-25"));
  assert.equal((await llamar(db, peticion(rpc("ping"), { token: t, cab: { "mcp-protocol-version": "2025-06-18" } }))).status, 200);
});

test("MCP: el token no se acepta en la URL ni con otro esquema", async () => {
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  const p = { metodo: "POST", texto: rpc("ping"), cabecera: (n) => (n === "authorization" ? `Basic ${tokens.access_token}` : null) };
  assert.equal((await llamar(db, p)).status, 401);
  const q = { metodo: "POST", texto: rpc("ping"), cabecera: () => null, url: `?access_token=${tokens.access_token}` };
  assert.equal((await llamar(db, q)).status, 401);
});

test("registro: nombres, anotaciones y herramientas repetidas", () => {
  const base = { titulo: "t", descripcion: "d", esquema: z.object({}), anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }, ejecutar: async () => "" };
  assert.throws(() => defineHerramienta({ ...base, nombre: "Mala Nombre" }));
  assert.throws(() => defineHerramienta({ ...base, nombre: "ok_nombre", anotaciones: { readOnlyHint: true } }));
  assert.throws(() => defineHerramienta({ ...base, nombre: "ok_nombre", anotaciones: { readOnlyHint: true, destructiveHint: true, idempotentHint: false } }));
  const r = crearRegistro();
  const h = defineHerramienta({ ...base, nombre: "una" });
  r.agregar(h);
  assert.throws(() => r.agregar(h));
});

// ───────── Interruptor de escrituras libres (mcp/escrituras-libres.ts) ─────────
test("escrituras libres: por defecto se aplican sin OK; con el interruptor encendido piden el OK de Jorge una sola vez", async () => {
  const { ESCRITURAS_LIBRES_CON_APROBACION: I } = await import("../src/lib/mcp/escrituras-libres.ts");
  const { solicitarAprobacion, resolverAprobacion } = await import("../src/lib/mcp/aprobaciones.ts");
  const db = nuevaDb();
  const { tokens } = await conectar(db);
  const t = tokens.access_token;
  let aplicadas = 0;
  const registro = crearRegistro();
  registro.agregar(defineHerramienta({
    nombre: "subir_imagen", titulo: "Subir imagen", descripcion: "Sube una imagen.", esquema: z.object({ url: z.string().max(300) }),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ejecutar({ url }) { aplicadas++; return `subida ${url}`; },
  }));
  const correos = [];
  const d = deps();
  const llamarImg = (args) => manejarSolicitudMcp(peticion(rpc("tools/call", { name: "subir_imagen", arguments: args }), { token: t }), {
    db, registro, base: BASE, ahora: T0 + 1000, verificarUsuario: d.verificarUsuario,
    solicitarAprobacion: (dbx, datos) => solicitarAprobacion(dbx, datos, { aprobadorEmail: "aprobador@example.com", base: BASE, enviar: async (a) => { correos.push(a); return true; } }, T0 + 1000),
  });
  try {
    assert.ok(Object.values(I).every((v) => v === false), "todo libre por defecto");
    assert.match((await llamarImg({ url: "https://x/a.jpg" })).body.result.content[0].text, /subida/);
    assert.equal(aplicadas, 1);

    I.subir_imagen = true;
    const p = await llamarImg({ url: "https://x/b.jpg" });
    assert.equal(p.body.result.structuredContent.estado, "pendiente");
    assert.equal(aplicadas, 1, "no se aplicó");
    assert.equal(correos.length, 1);
    assert.deepEqual(correos[0].motivos, ["escritura_libre"]);
    // otra imagen distinta no usa esa aprobación
    assert.equal((await llamarImg({ url: "https://x/c.jpg" })).body.result.structuredContent.estado, "pendiente");
    await resolverAprobacion(db, correos[0].enlace.split("/aprobar/")[1], "aprobar", T0 + 2000);
    assert.match((await llamarImg({ url: "https://x/b.jpg" })).body.result.content[0].text, /subida/);
    assert.equal(aplicadas, 2);
    // la aprobación sirvió una sola vez
    assert.equal((await llamarImg({ url: "https://x/b.jpg" })).body.result.structuredContent.estado, "pendiente");
    assert.equal(aplicadas, 2);
  } finally {
    I.subir_imagen = false;
  }
});
