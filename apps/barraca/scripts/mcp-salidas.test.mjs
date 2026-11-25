// Salidas de las herramientas MCP: Claude lee SOLO `structuredContent` y descarta `content`.
// Regla única (src/lib/mcp/servidor.ts, armarResultadoHerramienta): structuredContent = datos + `texto` (el relato completo);
// content = ese mismo texto. Estas pruebas la fijan sobre el registro completo y de punta a punta (servidor, token, D1 simulada).
// Correr: node --test scripts/mcp-salidas.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";

const { registro } = await import("../src/lib/mcp/tools/index.ts");
const { manejarSolicitudMcp, armarResultadoHerramienta, contenidoSinInformacionExtra } = await import("../src/lib/mcp/servidor.ts");
const O = await import("../src/lib/mcp/oauth.ts");

const BASE = "https://barraca.jurmaq.cl";
const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const MIN = 60_000;
const JORGE = { id: "1", email: "contacto@jurmaq.cl" };

// ───────── la regla, sobre cualquier forma de salida ─────────
test("armarResultadoHerramienta: texto y datos llegan en structuredContent y content no trae nada de más", () => {
  const formas = [
    "solo texto",
    { texto: "Con datos", datos: { a: 1, lista: [1, 2] } },
    { texto: "Sin datos" },
    { texto: "Datos con la clave texto", datos: { texto: "otro", b: 2 } },
    { texto: "Guía larga ".repeat(2000), datos: { tema: "reglas" } },
  ];
  for (const f of formas) {
    const r = armarResultadoHerramienta(f);
    assert.equal(contenidoSinInformacionExtra(r), null, JSON.stringify(f).slice(0, 60));
    const texto = typeof f === "string" ? f : f.texto;
    assert.equal(r.structuredContent.texto, texto);
    assert.equal(r.content[0].text, texto);
    assert.equal(r.content.length, 1);
    if (typeof f !== "string" && f.datos) for (const [k, v] of Object.entries(f.datos)) if (k !== "texto") assert.deepEqual(r.structuredContent[k], v);
  }
  assert.equal(armarResultadoHerramienta(formas[3]).structuredContent.texto_dato, "otro");
  assert.equal(armarResultadoHerramienta("x", { isError: true }).isError, true);
});

test("el verificador detecta un content con información que structuredContent no tiene", () => {
  assert.match(contenidoSinInformacionExtra({ content: [{ type: "text", text: "Lista: A, B, C" }], structuredContent: { tema: "x" } }), /información que structuredContent no tiene/);
  assert.match(contenidoSinInformacionExtra({ content: [{ type: "text", text: "hola" }] }), /falta structuredContent/);
  assert.match(contenidoSinInformacionExtra({ content: [{ type: "image", data: "x" }], structuredContent: { texto: "hola" } }), /solo puede llevar texto/);
  // JSON serializado del mismo objeto: también vale
  assert.equal(contenidoSinInformacionExtra({ content: [{ type: "text", text: JSON.stringify({ a: 1 }) }], structuredContent: { a: 1 } }), null);
  assert.match(contenidoSinInformacionExtra({ content: [{ type: "text", text: JSON.stringify({ a: 1, b: 2 }) }], structuredContent: { a: 1 } }), /información/);
});

test("registro completo: ninguna herramienta ni módulo arma `content` o `structuredContent` por su cuenta (solo el ensamblado del servidor)", () => {
  const dirs = ["../src/lib/mcp", "../src/lib/mcp/tools"];
  let archivos = 0;
  for (const d of dirs) {
    for (const f of readdirSync(new URL(`${d}/`, import.meta.url)).filter((x) => x.endsWith(".ts"))) {
      if (d.endsWith("/mcp") && f === "servidor.ts") continue;
      archivos++;
      const src = readFileSync(new URL(`${d}/${f}`, import.meta.url), "utf8");
      assert.ok(!/structuredContent/.test(src), `${d}/${f} no debe armar structuredContent`);
      assert.ok(!/content:\s*\[\s*\{\s*type/.test(src), `${d}/${f} no debe armar content`);
    }
  }
  assert.ok(archivos > 20);
  const srv = readFileSync(new URL("../src/lib/mcp/servidor.ts", import.meta.url), "utf8");
  assert.equal((srv.match(/content:\s*\[\s*\{\s*type/g) ?? []).length, 1, "un solo lugar arma `content`");
  // cada herramienta devuelve string o {texto, datos}: sin otras formas
  for (const h of registro.lista()) assert.equal(typeof h.ejecutar, "function", h.nombre);
  for (const n of ["editar_seo", "publicar_correo", "guardar_campana_borrador", "ver_descuento_transferencia", "confirmar_publicacion_guia", "ver_historial"]) assert.ok(registro.obtener(n), `${n} (Etapa 2) está en el registro`);
  assert.ok(registro.lista().length >= 80);
});

// ───────── de punta a punta con el servidor real y el registro real ─────────
const verificador = () => randomBytes(48).toString("base64url");
const desafio = (v) => createHash("sha256").update(v).digest("base64url");
const CLAUDE = "https://claude.ai/api/mcp/auth_callback";
const deps = { base: BASE, verificarUsuario: async (id) => (id === JORGE.id ? { ok: true, usuario: JORGE } : { ok: false, motivo: "no_autorizado" }) };

async function conectar(db) {
  const reg = await O.registrarCliente(db, { nombre: "Claude", redirectUris: [CLAUDE] }, T0);
  const v = verificador();
  const val = await O.validarSolicitudAutorizacion(db, { client_id: reg.cliente.id, redirect_uri: CLAUDE, response_type: "code", code_challenge: desafio(v), code_challenge_method: "S256", state: "s", resource: `${BASE}/api/mcp` }, deps);
  const s = val.solicitud;
  const code = await O.emitirCodigo(db, { clienteId: s.cliente.id, usuario: JORGE, redirectUri: s.redirectUri, codeChallenge: s.codeChallenge, scope: s.scope, resource: s.resource }, T0);
  const r = await O.canjearCodigo(db, { code, clientId: s.cliente.id, redirectUri: s.redirectUri, codeVerifier: v, resource: `${BASE}/api/mcp` }, deps, T0);
  assert.ok(r.ok, JSON.stringify(r));
  return r.tokens.access_token;
}

function cliente(db, token) {
  let n = 0;
  return async (name, args = {}, ahora = T0 + 1000 + n * 10) => {
    n++;
    const texto = JSON.stringify({ jsonrpc: "2.0", id: n, method: "tools/call", params: { name, arguments: args } });
    const h = { authorization: `Bearer ${token}` };
    const r = await manejarSolicitudMcp({ metodo: "POST", texto, cabecera: (k) => h[k.toLowerCase()] ?? null }, { db, registro, base: BASE, ahora, verificarUsuario: deps.verificarUsuario });
    assert.equal(r.status, 200, `${name}: ${JSON.stringify(r.body).slice(0, 200)}`);
    assert.ok(r.body.result, `${name}: ${JSON.stringify(r.body).slice(0, 200)}`);
    return r.body.result;
  };
}

/** Un cliente como Claude: descarta `content` y se queda solo con structuredContent. */
const soloEstructurado = (r) => r.structuredContent;

test("de punta a punta: lo que llega en structuredContent es completo (guía, contenido, vistas previas, historial, deshacer)", async () => {
  const db = crearD1Simulada();
  const llamar = cliente(db, await conectar(db));

  // guia sin tema y con tema: la guía llega entera en structuredContent
  const g0 = await llamar("guia");
  assert.equal(contenidoSinInformacionExtra(g0), null);
  const e0 = soloEstructurado(g0);
  assert.match(e0.texto, /REGLAS QUE NO SE NEGOCIAN/);
  assert.match(e0.texto, /HERRAMIENTAS DISPONIBLES/);
  assert.ok(Array.isArray(e0.herramientas) && e0.herramientas.includes("ver_historial"));
  const gr = soloEstructurado(await llamar("guia", { tema: "reglas" }));
  assert.equal(gr.tema, "reglas");
  assert.match(gr.texto, /DOS PASOS/);
  const gt = soloEstructurado(await llamar("guia", { tema: "herramientas" }));
  assert.match(gt.texto, /- ver_contenido \(solo lee\)/);

  // ver_contenido sin clave: lista; con clave: contenido completo y versión actual
  const lista = await llamar("ver_contenido");
  assert.equal(contenidoSinInformacionExtra(lista), null);
  assert.ok(soloEstructurado(lista).contenidos.some((c) => c.clave === "cinta"));
  const vc = soloEstructurado(await llamar("ver_contenido", { clave: "cinta" }));
  assert.equal(vc.clave, "cinta");
  assert.equal(vc.origen, "codigo");
  assert.equal(vc.versionPublicada, null);
  assert.ok(vc.valor && typeof vc.valor === "object", "el valor completo, para editar a partir de él");
  assert.equal(vc.tieneBorrador, false);
  const legal = soloEstructurado(await llamar("ver_contenido", { clave: "terminos" }));
  assert.ok(typeof legal.valor.texto === "string" && legal.valor.texto.length > 1000, "el texto legal entero viene en structuredContent");

  // editar borrador + vista previa de publicación con el diff (sin confirmar)
  const ed = await llamar("editar_campos_contenido", { clave: "cinta", cambios: { texto: "Cinta de prueba salidas", activa: true } });
  assert.equal(contenidoSinInformacionExtra(ed), null);
  const loteEdicion = /./.test(ed.structuredContent.texto) ? ed : null;
  assert.ok(loteEdicion);
  const vp = await llamar("previsualizar_publicacion_contenido", { clave: "cinta" });
  assert.equal(contenidoSinInformacionExtra(vp), null);
  const ev = soloEstructurado(vp);
  assert.ok(ev.vistaPreviaId);
  assert.equal(ev.requiereAprobacion, false);
  assert.ok(Array.isArray(ev.cambiosCompletos) && ev.cambiosCompletos.some((c) => c.campo === "texto" && c.despues === "Cinta de prueba salidas"), "diff antes/después de cada campo");
  assert.match(ev.texto, /Campos que cambian/);
  const vc2 = soloEstructurado(await llamar("ver_contenido", { clave: "cinta" }));
  assert.equal(vc2.tieneBorrador, true);
  assert.equal(vc2.origen, "codigo", "previsualizar no publica nada");

  // historial: quién, cuándo, herramienta, lote, sePuedeDeshacer
  const h = soloEstructurado(await llamar("ver_historial"));
  const fila = h.lotes.find((l) => l.herramienta === "editar_campos_contenido");
  assert.ok(fila, JSON.stringify(h).slice(0, 300));
  assert.equal(fila.usuario, "contacto@jurmaq.cl");
  assert.equal(typeof fila.creadoEn, "number");
  assert.equal(typeof fila.loteId, "string");
  assert.equal(fila.sePuedeDeshacer, true);
  assert.equal(fila.cambios, 1);
  const hd = soloEstructurado(await llamar("ver_historial", { lote_id: fila.loteId }));
  assert.equal(hd.usuario, "contacto@jurmaq.cl");
  assert.equal(hd.herramienta, "editar_campos_contenido");
  assert.ok(hd.entradas.length === 1 && hd.entradas[0].entidadId === "cinta");
  assert.equal(hd.entradas[0].despues.valor.texto, "Cinta de prueba salidas", "valores de antes y de después");

  // deshacer: qué cambios, de qué entidades y valores antes/después
  const pd = await llamar("previsualizar_deshacer_lote", { lote_id: fila.loteId });
  assert.equal(contenidoSinInformacionExtra(pd), null);
  const ed2 = soloEstructurado(pd);
  assert.ok(ed2.vistaPreviaId);
  assert.equal(ed2.cambios, 1);
  assert.equal(ed2.entradas[0].entidad, "contenido_borrador");
  assert.equal(ed2.entradas[0].entidadId, "cinta");
  assert.equal(ed2.entradas[0].despues.valor.texto, "Cinta de prueba salidas");
  assert.equal(ed2.usuario, "contacto@jurmaq.cl");
  assert.match(ed2.texto, /Se deshacería el lote/);
});

test("errores: también llegan en structuredContent", async () => {
  const db = crearD1Simulada();
  const llamar = cliente(db, await conectar(db));
  const r = await llamar("ver_contenido", { clave: "cinta", fuente: "publicado" });
  assert.equal(r.isError, true);
  assert.equal(contenidoSinInformacionExtra(r), null);
  assert.match(r.structuredContent.texto, /nunca se publicó/);
});
