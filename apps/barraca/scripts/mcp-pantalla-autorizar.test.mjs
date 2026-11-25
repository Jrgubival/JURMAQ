// La casilla de dinero tiene que viajar en el POST: debe quedar DENTRO del <form> de /oauth/decision.
// Correr: node --test scripts/mcp-pantalla-autorizar.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACCION_DECISION, dineroMarcado, htmlPantallaAutorizar } from "../src/lib/mcp/pantalla-autorizar.ts";
import { scopeConcedido } from "../src/lib/mcp/oauth.ts";

const base = { nombreCliente: "Claude", hostRedirect: "claude.ai", loopback: false, emailUsuario: "contacto@jurmaq.cl", paquete: "paquete.firmado" };

/** Mini analizador: recorre las etiquetas y anota en qué <form> cae cada <input>. */
function analizar(html) {
  const forms = [];
  const pila = [];
  const atr = (t) => Object.fromEntries([...t.matchAll(/([a-zA-Z-]+)(?:="([^"]*)")?/g)].map((m) => [m[1], m[2] ?? ""]));
  for (const m of html.matchAll(/<(\/?)(form|input|button)\b([^>]*)>/gi)) {
    const [, cierra, tag, resto] = m;
    if (tag.toLowerCase() === "form") {
      if (cierra) pila.pop();
      else { const f = { ...atr(resto), controles: [] }; forms.push(f); pila.push(f); }
    } else if (!cierra) {
      const a = atr(resto);
      const c = { tag: tag.toLowerCase(), ...a, dentro: pila.length > 0 };
      if (pila.length) pila[pila.length - 1].controles.push(c);
      else forms.fuera = [...(forms.fuera ?? []), c];
    }
  }
  return forms;
}

/** Lo que enviaría el navegador: hidden siempre, checkbox solo si está marcada, y el botón que se pulsa. */
function enviar(form, { marcarDinero, boton }) {
  const p = new URLSearchParams();
  for (const c of form.controles) {
    if (c.tag === "input" && c.type === "hidden") p.append(c.name, c.value);
    if (c.tag === "input" && c.type === "checkbox" && marcarDinero) p.append(c.name, c.value ?? "on");
    if (c.tag === "button" && c.name && c.value === boton) p.append(c.name, c.value);
  }
  return p;
}

test("pantalla con dinero: la casilla queda dentro del único <form> que va a /oauth/decision", () => {
  const html = htmlPantallaAutorizar({ ...base, scopePedido: "tienda:leer tienda:escribir tienda:dinero" });
  const forms = analizar(html);
  assert.equal(forms.length, 1);
  assert.equal(forms[0].action, ACCION_DECISION);
  assert.equal(forms[0].method, "post");
  const casillas = forms[0].controles.filter((c) => c.type === "checkbox");
  assert.equal(casillas.length, 1);
  assert.equal(casillas[0].name, "dinero");
  assert.equal(forms.fuera, undefined, "ningún input ni botón fuera del formulario");
  assert.ok(forms[0].controles.some((c) => c.name === "solicitud" && c.type === "hidden"));
});

test("el valor enviado llega a scopeConcedido: marcada da dinero, sin marcar no", () => {
  const scopePedido = "tienda:leer tienda:escribir tienda:dinero";
  const [form] = analizar(htmlPantallaAutorizar({ ...base, scopePedido }));
  const marcada = enviar(form, { marcarDinero: true, boton: "permitir" });
  assert.equal(marcada.get("decision"), "permitir");
  assert.equal(dineroMarcado(marcada), true);
  assert.ok(scopeConcedido(scopePedido, dineroMarcado(marcada)).split(" ").includes("tienda:dinero"));
  const sin = enviar(form, { marcarDinero: false, boton: "permitir" });
  assert.equal(dineroMarcado(sin), false);
  assert.ok(!scopeConcedido(scopePedido, dineroMarcado(sin)).split(" ").includes("tienda:dinero"));
});

test("sin pedir dinero no hay casilla; y una casilla forzada no agrega un permiso no pedido", () => {
  const scopePedido = "tienda:leer tienda:escribir";
  const forms = analizar(htmlPantallaAutorizar({ ...base, scopePedido }));
  assert.equal(forms[0].controles.filter((c) => c.type === "checkbox").length, 0);
  const forzado = new URLSearchParams({ dinero: "si", decision: "permitir" });
  assert.ok(!scopeConcedido(scopePedido, dineroMarcado(forzado)).split(" ").includes("tienda:dinero"));
});

test("las rutas usan estas piezas (no hay otro HTML ni otra lectura de la casilla)", () => {
  const a = readFileSync(new URL("../src/app/admin/conexiones/autorizar/route.ts", import.meta.url), "utf8");
  const d = readFileSync(new URL("../src/app/oauth/decision/route.ts", import.meta.url), "utf8");
  assert.match(a, /htmlPantallaAutorizar\(/);
  assert.doesNotMatch(a, /type="checkbox"/);
  assert.match(d, /dineroMarcado\(form\)/);
  assert.doesNotMatch(d, /form\.get\("dinero"\)/);
});

test("el HTML escapa el nombre del cliente", () => {
  const html = htmlPantallaAutorizar({ ...base, nombreCliente: '<img src=x onerror=alert(1)>', scopePedido: "tienda:leer tienda:escribir" });
  assert.ok(!html.includes("<img src=x"));
});
