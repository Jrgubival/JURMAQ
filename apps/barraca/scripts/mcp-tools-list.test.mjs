// Tamaño y forma del `tools/list` real del registro (cada byte se paga en el contexto de Claude).
// Correr: node --test scripts/mcp-tools-list.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { registro } = await import("../src/lib/mcp/tools/index.ts");
const { listarHerramientasMcp, compactarEsquema } = await import("../src/lib/mcp/servidor.ts");
const { SECCIONES, TEMAS, guia } = await import("../src/lib/mcp/tools/guia.ts");

const TOPE_BYTES = 85_000;

test(`tools/list real pesa menos de ${TOPE_BYTES / 1000} KB (con escritura y solo lectura)`, () => {
  const todo = listarHerramientasMcp(registro, true);
  const bytes = Buffer.byteLength(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { tools: todo } }), "utf8");
  assert.ok(bytes <= TOPE_BYTES, `tools/list pesa ${bytes} bytes (${todo.length} herramientas); el tope es ${TOPE_BYTES}. Acorta descripciones o esquemas, o mueve reglas repetidas al tema que corresponda de «guia».`);
  // También con el permiso de dinero y borrado (las herramientas de la Parte B se suman aquí): el tope es el mismo.
  const conDinero = listarHerramientasMcp(registro, true, true);
  const bytesDinero = Buffer.byteLength(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { tools: conDinero } }), "utf8");
  assert.ok(bytesDinero <= TOPE_BYTES, `tools/list con tienda:dinero pesa ${bytesDinero} bytes (${conDinero.length} herramientas); el tope es ${TOPE_BYTES}.`);
  const lectura = listarHerramientasMcp(registro, false);
  assert.ok(lectura.length > 0 && lectura.length < todo.length);
  assert.ok(lectura.every((t) => t.annotations.readOnlyHint === true));
});

test("cada herramienta del tools/list tiene nombre válido, único, inputSchema type object y anotaciones completas", () => {
  const lista = listarHerramientasMcp(registro, true);
  const vistos = new Set();
  for (const t of lista) {
    assert.match(t.name, /^[a-z][a-z0-9_]{1,63}$/, t.name);
    assert.ok(!vistos.has(t.name), `repetida: ${t.name}`);
    vistos.add(t.name);
    assert.equal(t.inputSchema.type, "object", `${t.name}: inputSchema.type`);
    assert.equal(t.inputSchema.additionalProperties, false, `${t.name}: debe rechazar campos extra`);
    assert.equal(t.inputSchema.$schema, undefined, t.name);
    assert.ok(typeof t.description === "string" && t.description.length > 30, `${t.name}: descripción`);
    assert.ok(typeof t.title === "string" && t.title.length > 3, `${t.name}: título`);
    for (const k of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]) assert.equal(typeof t.annotations[k], "boolean", `${t.name}: ${k}`);
  }
  assert.ok(lista.length >= 80);
});

test("compactarEsquema solo quita lo redundante: conserva tipos, requeridos, enums y el additionalProperties de arriba", () => {
  const origen = {
    type: "object",
    additionalProperties: false,
    required: ["a"],
    properties: {
      a: { type: "string", maxLength: 500, description: "Un texto." },
      b: { anyOf: [{ type: "integer", minimum: 1, maximum: 50 }, { type: "null" }], description: "Un número o nada." },
      c: { type: "string", enum: ["x", "y"], description: "Un texto." },
      d: { type: "object", additionalProperties: false, properties: { z: { type: "string", maxLength: 40 } }, required: ["z"] },
      e: { type: "array", maxItems: 5, items: { type: "string", maxLength: 20 } },
    },
  };
  const c = compactarEsquema(structuredClone(origen), new Set());
  assert.equal(c.additionalProperties, false);
  assert.deepEqual(c.required, ["a"]);
  assert.equal(c.properties.a.maxLength, undefined);
  assert.equal(c.properties.a.type, "string");
  assert.deepEqual(c.properties.b.type, ["integer", "null"]);
  assert.equal(c.properties.b.minimum, 1);
  assert.equal(c.properties.b.maximum, 50);
  assert.equal(c.properties.c.description, undefined); // repetida en la misma herramienta
  assert.deepEqual(c.properties.c.enum, ["x", "y"]);
  assert.equal(c.properties.d.additionalProperties, undefined);
  assert.deepEqual(c.properties.d.required, ["z"]);
  assert.equal(c.properties.d.properties.z.maxLength, 40);
  assert.equal(c.properties.e.maxItems, 5);
  assert.equal(c.properties.e.items.maxLength, 20);
});

test("guia: el índice cubre TODAS las herramientas y los temas hablan de cada grupo nuevo", async () => {
  const catalogo = registro.lista().map((h) => ({ nombre: h.nombre, titulo: h.titulo, descripcion: h.descripcion, soloLectura: h.anotaciones.readOnlyHint }));
  const salida = await guia.ejecutar({ tema: "herramientas" }, { catalogo });
  const texto = typeof salida === "string" ? salida : salida.texto;
  for (const h of catalogo) assert.ok(texto.includes(`- ${h.nombre} (`), `la guía no lista ${h.nombre}`);
  for (const t of TEMAS.filter((x) => x !== "herramientas")) assert.ok(SECCIONES[t].length > 80, t);
  // Cada herramienta (salvo la guía y utilidades del historial) se menciona en el índice y su grupo está en algún tema.
  const todosTemas = Object.values(SECCIONES).join("\n");
  for (const n of ["ver_seo", "editar_seo", "fijar_relacionados", "ver_marcas", "publicar_correo", "guardar_campana_borrador", "ver_campanas", "confirmar_descuento_transferencia", "guardar_borrador_guia", "programar_oferta", "cambiar_despacho"]) {
    assert.ok(todosTemas.includes(n), `ningún tema de guia menciona ${n}`);
  }
  // Las correcciones: aprobaciones se aplican repitiendo la llamada; vencimiento 15 min y 5 h.
  assert.match(SECCIONES.aprobaciones, /REPITIENDO LA MISMA LLAMADA/);
  assert.match(SECCIONES.reglas, /15 minutos, o en 5 horas/);
  assert.ok(!/«confirmar_…» o «aplicar_…»/.test(SECCIONES.reglas));
  assert.match(SECCIONES.campanas, /SOLO BORRADORES/);
});
