// Pruebas de la capa web del MCP: paquete firmado (CSRF), retorno OAuth, encabezados y lectura con tope.
// Correr: node --test scripts/mcp-web.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { firmarSolicitud, abrirSolicitud, urlRetorno } from "../src/lib/mcp/autorizar.ts";
import { empaquetarFirmado, abrirFirmado, pkceCoincide, desafioS256, igualesSeguro } from "../src/lib/mcp/cripto.ts";
import { escapar, leerTextoLimitado, mismoOrigen, paginaError, paginaHtml, respuestaHtml, respuestaJson } from "../src/lib/mcp/http.ts";
import { construirCorreoAprobacion } from "./pruebas/correo-aprobacion-sin-servidor.mjs";

const SECRETO = "secreto-de-prueba-0123456789";
const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const S = {
  cliente: { id: "mcpcli_1", nombre: "Claude", redirectUris: [], creadoEn: T0 },
  redirectUri: "https://claude.ai/api/mcp/auth_callback", scope: "tienda:leer tienda:escribir",
  resource: "https://barraca.jurmaq.cl/api/mcp", codeChallenge: "a".repeat(43), state: "xyz",
};

test("paquete de autorización: firma, usuario y vencimiento (anti CSRF)", async () => {
  const p = await firmarSolicitud(SECRETO, S, "1", T0);
  const ok = await abrirSolicitud(SECRETO, p, "1", T0 + 1000);
  assert.equal(ok.cliente_id, "mcpcli_1");
  assert.equal(ok.redirect_uri, S.redirectUri);
  assert.equal(ok.state, "xyz");
  assert.equal(await abrirSolicitud(SECRETO, p, "2", T0 + 1000), null, "otro usuario no puede usarlo");
  assert.equal(await abrirSolicitud(SECRETO, p, "1", T0 + 11 * 60_000), null, "vence a los 10 min");
  assert.equal(await abrirSolicitud("otro-secreto-0123456789xx", p, "1", T0), null, "otra clave");
  const [cuerpo, firma] = p.split(".");
  const alterado = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(cuerpo, "base64url")), ru: "https://evil.example/cb" })).toString("base64url");
  assert.equal(await abrirSolicitud(SECRETO, `${alterado}.${firma}`, "1", T0), null, "parámetros alterados");
  for (const basura of [undefined, null, "", "x", "a.b.c", 5, "a".repeat(5000)]) assert.equal(await abrirSolicitud(SECRETO, basura, "1", T0), null);
});

test("la firma de una pantalla no sirve en otra (subclave por uso)", async () => {
  const p = await empaquetarFirmado(SECRETO, "aprobar-v1", { t: "x", exp: T0 + 1000 });
  assert.ok(await abrirFirmado(SECRETO, "aprobar-v1", p, T0));
  assert.equal(await abrirFirmado(SECRETO, "autorizar-v1", p, T0), null);
});

test("urlRetorno agrega code/state/iss y respeta lo existente", () => {
  const u = new URL(urlRetorno("https://claude.ai/api/mcp/auth_callback", { code: "mcpc_abc", state: "s 1&x" }, "https://barraca.jurmaq.cl"));
  assert.equal(u.searchParams.get("code"), "mcpc_abc");
  assert.equal(u.searchParams.get("state"), "s 1&x");
  assert.equal(u.searchParams.get("iss"), "https://barraca.jurmaq.cl");
  assert.equal(u.origin + u.pathname, "https://claude.ai/api/mcp/auth_callback");
  const e = new URL(urlRetorno("http://localhost:3118/callback", { error: "access_denied", state: null }, "https://barraca.jurmaq.cl"));
  assert.equal(e.searchParams.get("error"), "access_denied");
  assert.equal(e.searchParams.has("state"), false);
});

test("PKCE y comparación segura", async () => {
  const v = "A".repeat(43);
  assert.equal(await pkceCoincide(v, await desafioS256(v)), true);
  assert.equal(await pkceCoincide("B".repeat(43), await desafioS256(v)), false);
  assert.equal(await pkceCoincide("corto", await desafioS256(v)), false);
  assert.equal(igualesSeguro("abc", "abc"), true);
  assert.equal(igualesSeguro("abc", "abd"), false);
  assert.equal(igualesSeguro("abc", "abcd"), false);
  // Vector oficial RFC 7636 apéndice B.
  assert.equal(await desafioS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("HTML: todo se escapa y la página sale con encabezados anti clickjacking", async () => {
  assert.equal(escapar(`<img src=x onerror="a()">&'`), "&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;");
  const html = paginaHtml({ titulo: "<b>", cuerpo: "<p>x</p>" });
  assert.match(html, /<title>&lt;b&gt;<\/title>/);
  assert.match(html, /noindex/);
  const r = respuestaHtml(html);
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.match(r.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.match(r.headers.get("content-security-policy"), /default-src 'none'/);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(r.headers.get("referrer-policy"), "same-origin");
  assert.match(html, /<meta name="referrer" content="same-origin">/);
  assert.equal(respuestaJson({ a: 1 }).headers.get("cache-control"), "no-store");
});

test("mismo origen: Origin propio, o Sec-Fetch-Site same-origin; lo demás no", () => {
  const base = "https://barraca.jurmaq.cl";
  const req = (h) => new Request("https://barraca.jurmaq.cl/oauth/decision", { method: "POST", headers: h });
  assert.equal(mismoOrigen(req({ origin: base }), base), true);
  assert.equal(mismoOrigen(req({ origin: "https://evil.example" }), base), false);
  assert.equal(mismoOrigen(req({ origin: "null" }), base), false);
  assert.equal(mismoOrigen(req({ "sec-fetch-site": "same-origin" }), base), true);
  assert.equal(mismoOrigen(req({ "sec-fetch-site": "cross-site" }), base), false);
  assert.equal(mismoOrigen(req({}), base), false);
});

test("lectura de cuerpo con tope", async () => {
  const mk = (t, h = {}) => new Request("https://x.example/", { method: "POST", body: t, headers: h });
  assert.equal(await leerTextoLimitado(mk("hola"), 10), "hola");
  assert.equal(await leerTextoLimitado(mk("a".repeat(50)), 10), null);
  assert.equal(await leerTextoLimitado(mk("ok", { "content-length": "99999" }), 10), null);
});

test("correo de aprobación: escapa el contenido y no filtra nada más", async () => {
  const { asunto, html } = await construirCorreoAprobacion({
    para: "a@b.cl", enlace: "https://barraca.jurmaq.cl/aprobar/mcpv_x", solicitante: "x@y.cl", herramienta: "t",
    resumen: "<script>alert(1)</script> Subir precios", motivos: ["masivo_cantidad", "precio_bajo_costo"], venceEn: Date.now() + 4 * 3600_000,
  });
  assert.ok(!html.includes("<script>alert(1)"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /aprobar\/mcpv_x/);
  assert.match(html, /Cambia más de 300 productos/);
  assert.ok(asunto.length < 80);
});

test("pantallas con POST: Referrer-Policy same-origin (con no-referrer el navegador manda Origin: null y se rechaza todo)", async () => {
  const base = "https://barraca.jurmaq.cl";
  for (const r of [respuestaHtml(paginaHtml({ titulo: "t", cuerpo: "c" })), paginaError("t", "m")]) {
    assert.equal(r.headers.get("referrer-policy"), "same-origin");
    assert.match(r.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.match(r.headers.get("content-security-policy"), /form-action 'self'/);
    assert.equal(r.headers.get("x-frame-options"), "DENY");
  }
  const post = (h) => new Request(`${base}/oauth/decision`, { method: "POST", headers: h });
  // Lo que manda el navegador según la política: con no-referrer, "null" (rechazado); con same-origin, el origen propio.
  assert.equal(mismoOrigen(post({ origin: "null" }), base), false);
  assert.equal(mismoOrigen(post({ origin: base }), base), true);
});

test("next.config: las pantallas del conector quedan fuera de los encabezados globales (si no, los pisan)", async () => {
  // next.config.ts no se puede importar en Node (usa __dirname): se lee el texto de la regla global.
  const { readFileSync } = await import("node:fs");
  const texto = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  const m = texto.match(/source: "(\/\(\(\?!aprobar[^"]*)",\s*headers: \[\s*\{\s*key: "Content-Security-Policy"/);
  const global = m ? { source: m[1] } : null;
  assert.ok(global, "debe existir la regla global con exclusiones");
  const re = new RegExp(`^${global.source}$`);
  for (const ruta of ["/aprobar/abc123", "/oauth/decision", "/admin/conexiones/autorizar"]) {
    assert.equal(re.test(ruta), false, `${ruta} no debe recibir los encabezados globales`);
  }
  for (const ruta of ["/", "/admin/conexiones", "/producto/x", "/oauth/token", "/api/mcp"]) {
    assert.equal(re.test(ruta), true, `${ruta} sí debe recibirlos`);
  }
});

test("WWW-Authenticate: la descripcion del error va en ASCII (una tilde llegaba rota en el encabezado)", async () => {
  const { encabezadoNoAutenticado } = await import("../src/lib/mcp/config.ts");
  const h = encabezadoNoAutenticado("https://barraca.jurmaq.cl", { codigo: "invalid_token", descripcion: "El token no es válido o venció." });
  assert.match(h, /error_description="El token no es valido o vencio\."/);
  assert.equal(/^[\x20-\x7e]*$/.test(h), true);
});
