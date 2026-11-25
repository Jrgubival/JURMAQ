// Pruebas del importador de Excel (src/lib/import-barraca-smart.ts) con Supabase FALSO:
// no tocan la base real (ver scripts/pruebas/supabase-falso.mjs).
// Correr: node --test scripts/importar-barraca.test.mjs
//
// Los tests que dicen "[reproduce el bug]" documentan el comportamiento ACTUAL, que está
// mal. Quien lo corrija debe invertir esas aserciones (los "todo" de abajo ya dicen
// qué se espera). Hallazgos con archivo y línea: docs/MCP-NOTAS.md, sección "Hallazgos".
import "./pruebas/cargar-alias.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import XLSX from "xlsx";

const { parseExcelFile, detectColumnMapping, matchProducts, executeImport } = await import("../src/lib/import-barraca-smart.ts");
const { resolvePrice } = await import("../src/lib/pricing.ts");

const CABECERA = ["Id", "Codigo", "Nombre", "Precio", "Precio Tachado"];
// Config por defecto de la pantalla /admin/importar (page.tsx:38-39): cruce por id; precio, costo y stock.
const CAMPOS_UI = ["precio", "costo", "stock"];

function producto(extra) {
  return { id: 0, codigo: "", nombre: "", precio: 0, precio_original: null, en_oferta: false, costo: 500, stock: 5, activo: true, ...extra };
}
function archivo(filas) {
  const ws = XLSX.utils.aoa_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
function cargarBase(productos) {
  globalThis.__PRODUCTOS_FALSOS__ = productos;
  globalThis.__ESCRITURAS_FALSAS__ = [];
}
/** Lo mismo que hace la pantalla: parse → mapeo → preview. Devuelve el resumen que ve el usuario. */
async function previa(filas, { matchBy = "id", createNew = false, fields = CAMPOS_UI, promo = false } = {}) {
  const parsed = parseExcelFile(archivo(filas));
  const mapping = detectColumnMapping(parsed.headers);
  const matches = await matchProducts(parsed.rows, mapping, matchBy, fields, promo);
  // Misma lógica que src/app/api/importar/preview/route.ts:30-42.
  const filtrados = matches.map((m) => (m.status === "create" && !createNew ? { ...m, status: "skip" } : m));
  const resumen = {
    aActualizar: filtrados.filter((m) => m.status === "update").length,
    aCrear: filtrados.filter((m) => m.status === "create").length,
    sinCambios: filtrados.filter((m) => m.status === "skip").length,
  };
  return { mapping, matches, filtrados, resumen };
}

test("el archivo Id, Codigo, Nombre, Precio, Precio Tachado se detecta completo", () => {
  const m = detectColumnMapping(CABECERA);
  assert.equal(m.id, "Id");
  assert.equal(m.codigo, "Codigo");
  assert.equal(m.nombre, "Nombre");
  assert.equal(m.precio, "Precio");
  assert.equal(m.precio_tachado, "Precio Tachado");
});

// ───────── (b) "0 a actualizar" ─────────

test("[reproduce el bug] Ids que no son los de la base: todo cae en 'create', se oculta como 'sin cambios' y el resumen dice 0 a actualizar", async () => {
  cargarBase([
    producto({ id: 101, codigo: "A1", nombre: "Clavo", precio: 1000 }),
    producto({ id: 102, codigo: "B2", nombre: "Tornillo", precio: 2000 }),
  ]);
  // Ids de otro sistema (p. ej. Softmad): 1 y 2. Los códigos sí coinciden.
  const filas = [CABECERA, [1, "A1", "Clavo", 900, 1000], [2, "B2", "Tornillo", 1800, 2000]];
  const porId = await previa(filas, { matchBy: "id" });
  assert.deepEqual(porId.resumen, { aActualizar: 0, aCrear: 0, sinCambios: 2 }); // el usuario ve "0 a actualizar"
  assert.ok(porId.matches.every((m) => m.status === "create" && m.matchedProduct === null)); // en realidad: sin coincidencia
  // Mismo archivo cruzando por código: sí actualiza. O sea, el archivo está bien; falla el cruce.
  const porCodigo = await previa(filas, { matchBy: "codigo" });
  assert.equal(porCodigo.resumen.aActualizar, 2);
});

test("con los Ids correctos, el mismo archivo SÍ da a actualizar (la detección de columnas no es la causa)", async () => {
  cargarBase([
    producto({ id: 101, codigo: "A1", nombre: "Clavo", precio: 1000 }),
    producto({ id: 102, codigo: "B2", nombre: "Tornillo", precio: 2000 }),
  ]);
  const r = await previa([CABECERA, [101, "A1", "Clavo", 900, 1000], [102, "B2", "Tornillo", 1800, 2000]]);
  assert.equal(r.resumen.aActualizar, 2);
});

test("[reproduce el bug] precios escritos como texto: '$ 900' se ignora y '1.000' se lee como 1 peso", async () => {
  cargarBase([producto({ id: 101, codigo: "A1", precio: 1000 }), producto({ id: 102, codigo: "B2", precio: 2000 })]);
  const r = await previa([CABECERA, [101, "A1", "Clavo", "$ 900", "$ 1.000"], [102, "B2", "Tornillo", "1.800", "2.000"]]);
  assert.equal(r.matches[0].status, "skip"); // "$ 900" → NaN → null → se descarta en silencio
  const cambios = r.matches[1].changes;
  assert.ok(cambios.some((c) => c.field === "precio" && c.newValue === 1.8), "1.800 se lee como 1,8"); // Number("1.800")
  assert.ok(cambios.some((c) => c.field === "precio_original" && c.newValue === 1.8));
});

test("[reproduce el bug] re-importar un export sin tocarlo rompe las ofertas: precio queda igual a precio_original", async () => {
  // Estado en la base según la convención del importador/export: precio = tachado, precio_original = el que se cobra.
  cargarBase([producto({ id: 101, codigo: "A1", precio: 1000, precio_original: 900, en_oferta: true })]);
  // Lo que escribe /api/productos/export:54-55 para ese producto: Precio = precio_original, Tachado = precio.
  const r = await previa([CABECERA, [101, "A1", "Clavo", 900, 1000]]);
  assert.equal(r.resumen.aActualizar, 1, "un export sin cambios debería dar 0 a actualizar");
  await executeImport(r.filtrados, { createNew: false, createPromotionalPrices: false });
  const [esc] = globalThis.__ESCRITURAS_FALSAS__;
  assert.equal(esc.valores.precio, 900); // el generic loop pisó `precio` con el valor de la columna Precio
  assert.equal(esc.valores.precio_original, undefined); // y como precio_original ya era 900 no se toca: la oferta queda 900/900
});

test("[reproduce el bug] fichas con el mismo código: cruzando por código solo se actualiza la última", async () => {
  cargarBase([
    producto({ id: 201, codigo: "DUP", precio: 1000 }),
    producto({ id: 202, codigo: "DUP", precio: 1000 }),
  ]);
  const r = await previa([["Codigo", "Precio"], ["DUP", 1500]], { matchBy: "codigo" });
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0].matchedProduct.id, 202); // la ficha 201 jamás se entera
});

test("[reproduce el bug] el resumen cuenta como 'sin cambios' lo que no se encontró", async () => {
  cargarBase([producto({ id: 1, codigo: "X" })]);
  const r = await previa([["Id", "Precio"], [999, 10]]);
  assert.equal(r.resumen.sinCambios, 1);
  assert.equal(r.filtrados[0].matchedProduct, null);
});

// Lo que se espera tras la corrección (hoy fallan; "todo" no rompe la suite).
test("ESPERADO: filas sin coincidencia se informan aparte (o se cruza por código si el Id no existe)", { todo: "lo corrige otro ejecutor" }, async () => {
  cargarBase([producto({ id: 101, codigo: "A1", precio: 1000 })]);
  const r = await previa([CABECERA, [1, "A1", "Clavo", 900, 1000]]);
  assert.equal(r.resumen.aActualizar, 1);
});
test("ESPERADO: re-importar un export sin cambios da 0 a actualizar", { todo: "lo corrige otro ejecutor" }, async () => {
  cargarBase([producto({ id: 101, codigo: "A1", precio: 1000, precio_original: 900, en_oferta: true })]);
  const r = await previa([CABECERA, [101, "A1", "Clavo", 900, 1000]]);
  assert.equal(r.resumen.aActualizar, 0);
});
test("ESPERADO: '1.800' o '$ 1.800' se leen como 1800", { todo: "lo corrige otro ejecutor" }, async () => {
  cargarBase([producto({ id: 102, codigo: "B2", precio: 2000 })]);
  const r = await previa([["Id", "Precio"], [102, "$ 1.800"]]);
  assert.equal(r.matches[0].changes.find((c) => c.field === "precio")?.newValue, 1800);
});

// ───────── (a) precio tachado invertido ─────────

test("(a) con 'Precio Tachado' el importador guarda precio = tachado y precio_original = precio real (al revés del resto)", async () => {
  cargarBase([producto({ id: 101, codigo: "A1", precio: 1200 })]);
  const r = await previa([CABECERA, [101, "A1", "Clavo", 900, 1000]]);
  await executeImport(r.filtrados, { createNew: false, createPromotionalPrices: false });
  const [esc] = globalThis.__ESCRITURAS_FALSAS__;
  assert.equal(esc.valores.precio, 1000); // = Precio Tachado
  assert.equal(esc.valores.precio_original, 900); // = Precio (el real)
  assert.equal(esc.valores.en_oferta, true);
});

test("(a) la tienda igual cobra el menor de los dos (resolvePrice usa Math.min), así que cobraría 900, no 1000", async () => {
  const cobrado = resolvePrice({ precio: 1000, precio_original: 900, en_oferta: true });
  assert.equal(cobrado.precioFinal, 900);
  assert.equal(cobrado.precioTachado, 1000);
  // Con la convención "buena" (precio = cobrado, precio_original = tachado) da lo mismo.
  assert.equal(resolvePrice({ precio: 900, precio_original: 1000, en_oferta: true }).precioFinal, 900);
});

test("(a) caso peligroso: si el tachado es menor o igual al real, el importador igual lo marca como oferta y se cobra el tachado", async () => {
  // Excel con Precio = 1000 (real) y Tachado = 900 (error de digitación): precio=900, precio_original=1000.
  cargarBase([producto({ id: 101, codigo: "A1", precio: 1200 })]);
  const r = await previa([CABECERA, [101, "A1", "Clavo", 1000, 900]]);
  await executeImport(r.filtrados, { createNew: false, createPromotionalPrices: false });
  const [esc] = globalThis.__ESCRITURAS_FALSAS__;
  const guardado = { precio: esc.valores.precio, precio_original: esc.valores.precio_original, en_oferta: esc.valores.en_oferta };
  assert.deepEqual(guardado, { precio: 900, precio_original: 1000, en_oferta: true });
  assert.equal(resolvePrice(guardado).precioFinal, 900); // se cobra 900 aunque Claudia quería cobrar 1000
});
