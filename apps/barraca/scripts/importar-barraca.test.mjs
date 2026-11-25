// Pruebas del importador de Excel (src/lib/import-barraca-smart.ts) con Supabase FALSO:
// no tocan la base real (ver scripts/pruebas/supabase-falso.mjs).
// Correr: node --test scripts/importar-barraca.test.mjs
//
// Tras la corrección (25-11-2026): convención precio = lo que se cobra, precio_original = tachado;
// cruce automático Id/código; vista previa que informa aparte cada estado.
import "./pruebas/cargar-alias.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import XLSX from "xlsx";

const { parseExcelFile, detectColumnMapping, matchProducts, executeImport, resumirImportacion, leerNumero } = await import("../src/lib/import-barraca-smart.ts");
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
async function previa(filas, { matchBy = "auto", createNew = false, fields = CAMPOS_UI, promo = false } = {}) {
  const parsed = parseExcelFile(archivo(filas));
  const mapping = detectColumnMapping(parsed.headers);
  const matches = await matchProducts(parsed.rows, mapping, matchBy, fields, promo, { createNew, hoy: "2026-11-25" });
  return { mapping, matches, resumen: resumirImportacion(matches) };
}
async function aplicar(r, createNew = false) {
  return executeImport(r.matches, { createNew, createPromotionalPrices: false });
}
const escrituras = () => globalThis.__ESCRITURAS_FALSAS__;

test("el archivo Id, Codigo, Nombre, Precio, Precio Tachado se detecta completo", () => {
  const m = detectColumnMapping(CABECERA);
  assert.equal(m.id, "Id");
  assert.equal(m.codigo, "Codigo");
  assert.equal(m.nombre, "Nombre");
  assert.equal(m.precio, "Precio");
  assert.equal(m.precio_tachado, "Precio Tachado");
});

// ───────── (b) "0 a actualizar" ─────────

test("Ids que no son los de la base: el cruce automático cae a código y SÍ actualiza", async () => {
  cargarBase([
    producto({ id: 101, codigo: "A1", nombre: "Clavo", precio: 1000 }),
    producto({ id: 102, codigo: "B2", nombre: "Tornillo", precio: 2000 }),
  ]);
  const filas = [CABECERA, [1, "A1", "Clavo", 900, 1000], [2, "B2", "Tornillo", 1800, 2000]];
  const r = await previa(filas);
  assert.equal(r.resumen.aActualizar, 2);
  assert.equal(r.resumen.noEncontradas, 0);
  assert.equal(r.resumen.porCodigo, 2);
  assert.equal(r.matches[0].alertas.length, 0); // el Id 1 no existe en la base: no hay conflicto que avisar
});

test("un Id que existe pero es de OTRO producto no pisa nada: se cruza por código", async () => {
  cargarBase([
    producto({ id: 1, codigo: "ZZ", nombre: "Otro producto", precio: 7000 }),
    producto({ id: 101, codigo: "A1", nombre: "Clavo", precio: 1000 }),
  ]);
  const r = await previa([CABECERA, [1, "A1", "Clavo", 900, 1000]]);
  await aplicar(r);
  assert.deepEqual(escrituras().map((e) => e.id), [101]); // jamás el 1
  assert.ok(r.matches[0].alertas.some((a) => /otro producto/.test(a)));
});

test("Id existente con código distinto y código inexistente: no se toca, se informa", async () => {
  cargarBase([producto({ id: 1, codigo: "ZZ", precio: 7000 })]);
  const r = await previa([CABECERA, [1, "NOEXISTE", "x", 900, 1000]]);
  assert.equal(r.resumen.noEncontradas, 1);
  await aplicar(r);
  assert.equal(escrituras().length, 0);
});

test("con los Ids correctos el mismo archivo SÍ da a actualizar (cruce por Id)", async () => {
  cargarBase([
    producto({ id: 101, codigo: "A1", nombre: "Clavo", precio: 1000 }),
    producto({ id: 102, codigo: "B2", nombre: "Tornillo", precio: 2000 }),
  ]);
  const r = await previa([CABECERA, [101, "A1", "Clavo", 900, 1000], [102, "B2", "Tornillo", 1800, 2000]]);
  assert.equal(r.resumen.aActualizar, 2);
  assert.equal(r.resumen.porId, 2);
});

test("la vista previa NUNCA oculta filas: no encontradas, sin cambios y a actualizar van por separado", async () => {
  cargarBase([
    producto({ id: 1, codigo: "X", precio: 100 }),
    producto({ id: 2, codigo: "Y", precio: 200 }),
  ]);
  const r = await previa([["Codigo", "Precio"], ["X", 150], ["Y", 200], ["NO", 10]]);
  assert.deepEqual(
    { act: r.resumen.aActualizar, sin: r.resumen.sinCambios, nf: r.resumen.noEncontradas, inv: r.resumen.invalidas },
    { act: 1, sin: 1, nf: 1, inv: 0 },
  );
  assert.equal(r.resumen.totalFilas, 3);
});

test("sin columna Id y modo 'solo Id': se informa 'no tiene columna Id', no 'sin cambios'", async () => {
  cargarBase([producto({ id: 1, codigo: "X" })]);
  const r = await previa([["Codigo", "Precio"], ["X", 10]], { matchBy: "id" });
  assert.equal(r.matches[0].status, "notfound");
  assert.match(r.matches[0].motivo, /columna Id/);
});

test("precios como texto: '$ 900' y '1.800' se leen bien", async () => {
  assert.equal(leerNumero("$ 900").valor, 900);
  assert.equal(leerNumero("1.800").valor, 1800);
  assert.equal(leerNumero("$ 1.800").valor, 1800);
  assert.equal(leerNumero("1.800,50").valor, 1800.5);
  assert.equal(leerNumero("1,800").valor, 1800);
  assert.equal(leerNumero("900,5").valor, 900.5);
  assert.equal(leerNumero(1234).valor, 1234);
  assert.equal(leerNumero("").vacio, true);
  assert.equal(leerNumero("abc").ok, false);
  cargarBase([producto({ id: 101, codigo: "A1", precio: 1000 }), producto({ id: 102, codigo: "B2", precio: 2000 })]);
  const r = await previa([CABECERA, [101, "A1", "Clavo", "$ 900", "$ 1.000"], [102, "B2", "Tornillo", "1.800", "2.000"]]);
  assert.equal(r.resumen.aActualizar, 2);
  await aplicar(r);
  const e = escrituras();
  assert.equal(e[0].valores.precio, 900);
  assert.equal(e[1].valores.precio, 1800);
});

test("re-importar un export sin tocarlo da 0 a actualizar (ofertas en la convención nueva y en la vieja)", async () => {
  cargarBase([
    producto({ id: 101, codigo: "A1", precio: 900, precio_original: 1000, en_oferta: true }), // nueva
    producto({ id: 102, codigo: "B2", precio: 2000, precio_original: 1800, en_oferta: true }), // vieja (al revés)
    producto({ id: 103, codigo: "C3", precio: 500 }),
  ]);
  const r = await previa([CABECERA, [101, "A1", "a", 900, 1000], [102, "B2", "b", 1800, 2000], [103, "C3", "c", 500, ""]]);
  assert.equal(r.resumen.aActualizar, 0);
  assert.equal(r.resumen.sinCambios, 3);
});

test("ficha duplicada por código: el cambio va a TODAS las fichas con ese código", async () => {
  cargarBase([
    producto({ id: 201, codigo: "DUP", precio: 1000 }),
    producto({ id: 202, codigo: "DUP", precio: 1200 }),
    producto({ id: 203, codigo: "OTRO", precio: 1000 }),
  ]);
  const r = await previa([["Codigo", "Precio"], ["DUP", 1500]], { matchBy: "codigo" });
  assert.equal(r.resumen.aActualizar, 1);
  assert.equal(r.resumen.fichasAfectadas, 2);
  const res = await aplicar(r);
  assert.deepEqual(escrituras().map((e) => e.id).sort(), [201, 202]);
  assert.equal(res.fichasActualizadas, 2);
  assert.equal(res.updated, 1);
  // en modo automático (sin Id en el archivo) también
  cargarBase([producto({ id: 201, codigo: "DUP", precio: 1000 }), producto({ id: 202, codigo: "DUP", precio: 1000 })]);
  const r2 = await previa([["Codigo", "Precio"], ["DUP", 1500]]);
  await aplicar(r2);
  assert.equal(escrituras().length, 2);
});

test("una ficha no la pueden tocar dos filas del archivo: la segunda queda como no válida", async () => {
  cargarBase([producto({ id: 201, codigo: "DUP", precio: 1000 })]);
  const r = await previa([["Codigo", "Precio"], ["DUP", 1500], ["DUP", 1600]]);
  assert.equal(r.matches[0].status, "update");
  assert.equal(r.matches[1].status, "invalid");
  await aplicar(r);
  assert.equal(escrituras().length, 1);
  assert.equal(escrituras()[0].valores.precio, 1500);
});

// ───────── precio nunca 0, negativo ni no numérico ─────────

test("precio 0, negativo o no numérico: la fila no se toca y se informa", async () => {
  cargarBase([
    producto({ id: 1, codigo: "A", precio: 100 }),
    producto({ id: 2, codigo: "B", precio: 100 }),
    producto({ id: 3, codigo: "C", precio: 100 }),
    producto({ id: 4, codigo: "D", precio: 100 }),
  ]);
  const r = await previa([["Codigo", "Precio", "Stock"], ["A", 0, 9], ["B", -5, 9], ["C", "abc", 9], ["D", "", 9]]);
  assert.deepEqual(r.matches.map((m) => m.status), ["invalid", "invalid", "invalid", "update"]);
  const res = await aplicar(r);
  assert.equal(res.invalid, 3);
  assert.deepEqual(escrituras().map((e) => e.id), [4]); // D: precio vacío = no cambia, pero stock sí
  assert.equal(escrituras()[0].valores.precio, undefined);
});

test("producto nuevo sin precio válido no se crea", async () => {
  cargarBase([]);
  const r = await previa([["Codigo", "Nombre", "Precio"], ["N1", "Nuevo uno", 0], ["N2", "Nuevo dos", 500]], { createNew: true });
  assert.deepEqual(r.matches.map((m) => m.status), ["invalid", "create"]);
  const res = await aplicar(r, true);
  assert.equal(res.created, 1);
  assert.equal(escrituras()[0].valores.precio, 500);
});

// ───────── (a) convención: precio = cobrado, precio_original = tachado ─────────

test("'Precio' va a precio y 'Precio Tachado' a precio_original, con en_oferta", async () => {
  cargarBase([producto({ id: 101, codigo: "A1", precio: 1200 })]);
  const r = await previa([CABECERA, [101, "A1", "Clavo", 900, 1000]]);
  await aplicar(r);
  const v = escrituras()[0].valores;
  assert.equal(v.precio, 900);
  assert.equal(v.precio_original, 1000);
  assert.equal(v.en_oferta, true);
  assert.equal(resolvePrice({ precio: v.precio, precio_original: v.precio_original, en_oferta: true }).precioFinal, 900);
  assert.equal(resolvePrice({ precio: v.precio, precio_original: v.precio_original, en_oferta: true }).precioTachado, 1000);
});

test("tachado menor que el precio: la fila es no válida y no cambia nada (antes se cobraba el tachado)", async () => {
  cargarBase([producto({ id: 101, codigo: "A1", precio: 1200 })]);
  const r = await previa([CABECERA, [101, "A1", "Clavo", 1000, 900]]);
  assert.equal(r.matches[0].status, "invalid");
  assert.match(r.matches[0].motivo, /tachado/);
  await aplicar(r);
  assert.equal(escrituras().length, 0);
});

test("tachado igual al precio no crea oferta", async () => {
  cargarBase([producto({ id: 101, codigo: "A1", precio: 1200 })]);
  const r = await previa([CABECERA, [101, "A1", "Clavo", 1000, 1000]]);
  await aplicar(r);
  const v = escrituras()[0].valores;
  assert.equal(v.precio, 1000);
  assert.equal(v.en_oferta, undefined);
});

test("cambiar solo el precio de un producto en oferta mantiene el tachado; si lo alcanza, quita la oferta", async () => {
  cargarBase([producto({ id: 101, codigo: "A1", precio: 900, precio_original: 1000, en_oferta: true })]);
  let r = await previa([["Codigo", "Precio"], ["A1", 800]]);
  await aplicar(r);
  assert.deepEqual(escrituras()[0].valores, { precio: 800 });
  cargarBase([producto({ id: 101, codigo: "A1", precio: 900, precio_original: 1000, en_oferta: true, oferta_fin: "2026-12-31" })]);
  r = await previa([["Codigo", "Precio"], ["A1", 1100]]);
  await aplicar(r);
  const v = escrituras()[0].valores;
  assert.equal(v.precio, 1100);
  assert.equal(v.precio_original, null);
  assert.equal(v.en_oferta, false);
  assert.equal(v.oferta_fin, null);
  assert.ok(r.matches[0].alertas.some((a) => /quita la oferta/.test(a)));
});

test("oferta nueva sobre una ficha con oferta_fin vencida limpia oferta_fin (si no, el cron la revertiría)", async () => {
  cargarBase([producto({ id: 101, codigo: "A1", precio: 1000, oferta_fin: "2026-01-01" })]);
  const r = await previa([CABECERA, [101, "A1", "Clavo", 800, 1000]]);
  await aplicar(r);
  assert.equal(escrituras()[0].valores.oferta_fin, null);
});

test("dato viejo guardado al revés se normaliza al cambiar de verdad el precio", async () => {
  cargarBase([producto({ id: 102, codigo: "B2", precio: 2000, precio_original: 1800, en_oferta: true })]);
  const r = await previa([CABECERA, [102, "B2", "b", 1700, 2000]]);
  await aplicar(r);
  const v = escrituras()[0].valores;
  assert.equal(v.precio, 1700);
  assert.equal(v.precio_original, 2000);
});

// ───────── margen ─────────

test("vista previa: bajo el costo, margen menor a 15% y mayores subidas y bajadas", async () => {
  cargarBase([
    producto({ id: 1, codigo: "A", precio: 1000, costo: 800 }),
    producto({ id: 2, codigo: "B", precio: 1000, costo: 800 }),
    producto({ id: 3, codigo: "C", precio: 1000, costo: 500 }),
    producto({ id: 4, codigo: "D", precio: 1000, costo: 500 }),
  ]);
  const r = await previa([["Codigo", "Precio"], ["A", 700], ["B", 900], ["C", 1500], ["D", 800]]);
  assert.deepEqual(r.resumen.bajoCosto.map((x) => x.codigo), ["A"]);
  assert.deepEqual(r.resumen.margenBajo.map((x) => x.codigo), ["B"]); // 900 < 800*1.15
  assert.equal(r.resumen.mayoresSubidas[0].codigo, "C");
  assert.equal(r.resumen.mayoresSubidas[0].porcentaje, 50);
  assert.equal(r.resumen.mayoresBajadas[0].codigo, "A");
});

test("el costo que viene en el mismo archivo es el que se usa para el control de margen", async () => {
  cargarBase([producto({ id: 1, codigo: "A", precio: 1000, costo: 100 })]);
  const r = await previa([["Codigo", "Precio", "Costo"], ["A", 1000, 1200]]);
  assert.deepEqual(r.resumen.bajoCosto.map((x) => x.codigo), ["A"]);
});

test("si Supabase falla al leer el catálogo no se finge 'sin coincidencia'", async () => {
  globalThis.__PRODUCTOS_FALSOS__ = null; // el falso devuelve error si no hay arreglo
  globalThis.__FALLA_SELECT__ = true;
  await assert.rejects(() => previa([["Codigo", "Precio"], ["A", 10]]), /catálogo/);
  globalThis.__FALLA_SELECT__ = false;
});
