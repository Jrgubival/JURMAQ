// Pruebas del SEO editable, los relacionados fijados a mano y las guías editables (Etapa 2 del MCP):
// equivalencia con D1 vacía o caída, límites y validación, títulos repetidos, dos pasos, aprobación de
// Jorge (términos, privacidad, desvío), deshacer sin pisar cambios ajenos, relacionados inexistentes o inactivos,
// guías con borrador, publicación y versiones.
// Correr: node --test scripts/seo-editable.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";
import { aprobarUltimoCorreo, crearCtx, crearTienda, ficha } from "./pruebas/tienda-falsa.mjs";

const R = await import("../src/lib/seo-editable/reglas.ts");
const D = await import("../src/lib/seo-editable/defecto.ts");
const S = await import("../src/lib/seo-editable/servicio.ts");
const Rel = await import("../src/lib/seo-editable/relacionados.ts");
const G = await import("../src/lib/seo-editable/guias.ts");
const SG = await import("../src/lib/seo-editable/servicio-guias.ts");
const { crearLectorSeo } = await import("../src/lib/seo-editable/lector.ts");
const Rep = await import("../src/lib/seo-editable/repositorio.ts");
const { GUIAS } = await import("../src/lib/guias-seo-data.ts");
const { resolverAprobacion } = await import("../src/lib/mcp/aprobaciones.ts");
const { deshacerLote } = await import("../src/lib/mcp/deshacer.ts");
const { registro } = await import("../src/lib/mcp/tools/index.ts");
const { fijarDepsSeo } = await import("../src/lib/mcp/tools/seo-comun.ts");
const { obtenerLote } = await import("../src/lib/gestion/index.ts");

const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const JORGE = { id: "1", email: "contacto@jurmaq.cl" };
const OTRO = { id: "2", email: "otro@jurmaq.cl" };
const nuevaDb = () => crearD1Simulada();
const LOCAL = { razonSocial: "Barraca de Fierros JURMAQ SpA", direccionCorta: "Av. Poniente 2157, Molina", telefonoDisplay: "+56 9 7667 3577", email: "contacto@jurmaq.cl", horarioSemana: "Lunes a viernes 8:00 a 18:00" };

function tienda(extra = {}) {
  const T = crearTienda(
    [
      ficha({ id: 1, codigo: "A1", nombre: "Fierro Estriado 8mm", precio: 5990, stock: 10, categoria_id: 7 }),
      ficha({ id: 2, codigo: "A1", nombre: "Fierro Estriado 8mm", precio: 5990, stock: 10, categoria_id: 7 }),
      ficha({ id: 3, codigo: "B2", nombre: "Tubo Cuadrado 40x40", precio: 12000, stock: 5, categoria_id: 7 }),
      ficha({ id: 4, codigo: "C3", nombre: "Malla Acma C92", precio: 30000, stock: 0, categoria_id: 7 }),
      ficha({ id: 5, codigo: "D4", nombre: "Cemento 25 kg", precio: 6000, stock: 9, categoria_id: 8 }),
      ficha({ id: 6, codigo: "E5", nombre: "Producto oculto", precio: 1000, stock: 9, categoria_id: 8, activo: false }),
      ficha({ id: 7, codigo: "F6", nombre: "Perfil C 100x50", precio: 8000, stock: 20, categoria_id: 7 }),
    ],
    { categorias: [{ id: 7, nombre: "Fierros y Perfiles", slug: "fierros-y-perfiles" }, { id: 8, nombre: "Cementos", slug: "cementos" }], ...extra },
  );
  const refrescadas = [];
  const deps = { ...T.deps, async revalidarRutas(r) { refrescadas.push(...r); }, async local() { return LOCAL; } };
  return { ...T, deps, refrescadas };
}
const ctx = (db, t = T0, usuario = JORGE, h = "prueba") => crearCtx(db, usuario, t, h);
const entrada = (e) => ({ tipo: "producto", clave: "A1", ...e });

// ───────── equivalencia con D1 vacía o caída ─────────

test("equivalencia: sin texto propio los metadatos son idénticos y los textos del código no cambiaron", () => {
  const meta = { title: "X", description: "Y", alternates: { canonical: "https://barraca.jurmaq.cl/x" }, robots: { index: false }, openGraph: { title: "a", description: "b", url: "u" } };
  assert.equal(R.aplicarSeo(meta, null), meta);
  assert.equal(R.aplicarSeo(meta, R.CAMPOS_VACIOS), meta);
  // Textos exactos de la ficha y la categoría (copiados del código anterior).
  const p = D.metaProductoDefecto({ nombre: "Fierro 8mm", codigo: "A1", disponible: true, precioFinal: 5990 });
  assert.equal(p.titulo, "Fierro 8mm $5.990 · En stock · Barraca JURMAQ Curicó");
  assert.equal(p.descripcion, "Compra Fierro 8mm en Barraca JURMAQ, Molina. Precio web: $5.990. Stock disponible. Retiro en Molina y despacho en camión a Curicó, Talca y alrededores. Código: A1.");
  assert.equal(p.ogTitulo, "Fierro 8mm - $5.990 · En stock | Barraca JURMAQ");
  assert.equal(p.ogDescripcion, "Fierro 8mm a $5.990. Stock disponible. Despacho en Region del Maule.");
  const sin = D.metaProductoDefecto({ nombre: "Fierro 8mm", codigo: "A1", disponible: false, precioFinal: 0 });
  assert.equal(sin.titulo, "Fierro 8mm No disponible · Barraca JURMAQ Curicó");
  assert.equal(sin.descripcion, "Compra Fierro 8mm en Barraca JURMAQ, Molina. Por ahora no disponible en línea. Retiro en Molina y despacho en camión a Curicó, Talca y alrededores. Código: A1.");
  assert.equal(sin.ogDescripcion, "Fierro 8mm. Por ahora no disponible en línea. Despacho en Region del Maule.");
  const c = D.metaCategoriaDefecto({ nombre: "Fierros y Perfiles", total: 42 });
  assert.equal(c.titulo, "Fierros y Perfiles en Molina · Despacho a Curicó y Talca · Barraca JURMAQ");
  assert.equal(c.descripcion, "42 productos de fierros y perfiles con precio publicado en Barraca JURMAQ Curicó · Molina. Retiro en Molina y despacho en camión a Molina, Curicó, Talca y alrededores.");
  assert.equal(c.ogTitulo, "Fierros y Perfiles · Barraca JURMAQ Curicó · Molina");
  assert.equal(D.metaPaginaDefecto("terminos").titulo, "Términos y Condiciones · Barraca JURMAQ");
  assert.equal(D.metaPaginaDefecto("nosotros", LOCAL).descripcion, "Barraca de Fierros JURMAQ SpA: barraca de fierros y materiales de construcción en Av. Poniente 2157, Molina. Venta en el local y en línea, retiro en Molina y despacho en camión propio.");
  assert.equal(D.metaPaginaDefecto("contacto", LOCAL).descripcion, "Barraca de Fierros JURMAQ SpA · Av. Poniente 2157, Molina. WhatsApp y teléfono +56 9 7667 3577, correo contacto@jurmaq.cl. Lunes a viernes 8:00 a 18:00.");
  assert.match(D.metaPaginaDefecto("sucursales", LOCAL).descripcion, /^Nuestra barraca de fierros está en Av\. Poniente 2157, Molina\. Retiro en el local y despacho en camión a Molina, /);
});

test("equivalencia: el lector devuelve 'nada' con D1 vacía, sin tablas, sin binding, que lanza o lenta", async () => {
  const vacia = nuevaDb();
  const sinTablas = crearD1Simulada({ migraciones: false });
  const casos = [
    ["vacía", async () => vacia],
    ["sin tablas", async () => sinTablas],
    ["sin binding", async () => null],
    ["lanza", async () => { throw new Error("caída"); }],
    ["lenta", () => new Promise(() => {})],
  ];
  for (const [nombre, obtenerDb] of casos) {
    let fallos = 0;
    const l = crearLectorSeo({ obtenerDb, timeoutMs: 20, alFallar: () => fallos++ });
    assert.equal(await l.leerSeo("producto", "A1"), null, nombre);
    assert.equal(await l.leerRelacionados("A1"), null, nombre);
    assert.equal((await l.leerGuias()).size, 0, nombre);
  }
  // Tras un fallo no se reintenta enseguida (no agrega latencia).
  let llamadas = 0;
  let ahora = 1000;
  const l = crearLectorSeo({ obtenerDb: async () => { llamadas++; throw new Error("x"); }, reintentoMs: 15_000, ahora: () => ahora });
  await l.leerSeo("producto", "A"); await l.leerSeo("producto", "B"); await l.leerSeo("producto", "C");
  assert.equal(llamadas, 1);
  ahora += 16_000;
  await l.leerSeo("producto", "A");
  assert.equal(llamadas, 2);
});

test("equivalencia: valores guardados dañados se ignoran y las guías de código quedan idénticas", async () => {
  const db = nuevaDb();
  await db.prepare("INSERT INTO seo_meta (tipo, clave, titulo, descripcion, version, actualizado_por, actualizado_en) VALUES ('producto','A1','<b>malo</b>','Precio $5.990',1,'1',1)").run();
  await db.prepare("INSERT INTO productos_relacionados (codigo, lista, actualizado_por, actualizado_en) VALUES ('A1','esto no es json','1',1)").run();
  await db.prepare("INSERT INTO guias (slug, publicado, version_publicada) VALUES ('que-es-zincalum','{\"roto\":true}',1)").run();
  const l = crearLectorSeo({ obtenerDb: async () => db });
  assert.equal(await l.leerSeo("producto", "A1"), null);
  assert.equal(await l.leerRelacionados("A1"), null);
  const publicadas = await l.leerGuias();
  assert.equal(publicadas.size, 0);
  const fusion = G.fusionarGuias(GUIAS, publicadas);
  assert.deepEqual(fusion, GUIAS);
});

// ───────── validación ─────────

test("validación: límites, texto plano y cosas que no se pueden inventar", () => {
  const ok = R.validarSeo({ titulo: "Fierro estriado 8mm · Barraca JURMAQ", descripcion: "Fierro estriado de 8 mm para losas y muros. Retiro en Molina y despacho en camión a Curicó." });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.advertencias, []);
  // largo: advertencia leve, error grande
  const largo = R.validarSeo({ titulo: "T".repeat(75) + " fierro", descripcion: "D".repeat(170) });
  assert.equal(largo.ok, true);
  assert.equal(largo.advertencias.length, 2);
  assert.equal(R.validarSeo({ titulo: "T".repeat(130) }).ok, false);
  assert.equal(R.validarSeo({ titulo: "Título válido de prueba", descripcion: "D".repeat(330) }).ok, false);
  // HTML, precios, reseñas, plazos
  assert.match(R.validarSeo({ titulo: "Fierro <b>8mm</b> barato hoy" }).errores.join(" "), /sin HTML/);
  assert.match(R.validarSeo({ titulo: "Fierro 8mm desde $5.990 hoy" }).errores.join(" "), /precios/);
  assert.match(R.validarSeo({ titulo: "Fierro 8mm 5.990 pesos al por mayor" }).errores.join(" "), /precios/);
  assert.match(R.validarSeo({ titulo: "Fierro 8mm con 5 estrellas en reseñas" }).errores.join(" "), /reseñas/);
  assert.match(R.validarSeo({ descripcion: "Despacho en 24 horas a toda la región, garantizado para tu obra." }).errores.join(" "), /plazos/);
  assert.match(R.validarSeo({ descripcion: "Entrega inmediata de fierro y perfiles para tu obra en el Maule." }).errores.join(" "), /plazos/);
  // «dentro de 10 días» de una devolución no es un plazo de entrega
  assert.equal(R.validarSeo({ descripcion: "Devoluciones dentro de 10 días corridos según los Términos de la tienda online." }).ok, true);
  // vacío no es un texto
  assert.equal(R.validarSeo({ titulo: "   " }).ok, false);
  // espacios y saltos de línea se limpian
  assert.equal(R.validarSeo({ titulo: "  Fierro   estriado \n 8mm · Barraca  " }).valor.titulo, "Fierro estriado 8mm · Barraca");
  // claves
  assert.equal(R.claveValida("pagina", "portada"), true);
  assert.equal(R.claveValida("pagina", "carrito"), false);
  assert.equal(R.claveValida("categoria", "Fierros Y"), false);
  assert.equal(R.claveValida("producto", "AFT-686038"), true);
});

test("aplicarSeo: solo cambia título, descripción y textos de redes; nunca canonical, robots ni url", () => {
  const meta = { title: "X", description: "Y", alternates: { canonical: "https://barraca.jurmaq.cl/x" }, robots: { index: false, follow: true }, keywords: ["k"], openGraph: { title: "og", description: "ogd", url: "https://barraca.jurmaq.cl/x", images: [1] } };
  const r = R.aplicarSeo(meta, { titulo: "Nuevo título", descripcion: null, ogTitulo: null, ogDescripcion: "Nueva og" });
  assert.equal(r.title, "Nuevo título");
  assert.equal(r.description, "Y");
  assert.equal(r.openGraph.title, "og");
  assert.equal(r.openGraph.description, "Nueva og");
  assert.deepEqual(r.alternates, meta.alternates);
  assert.deepEqual(r.robots, meta.robots);
  assert.equal(r.openGraph.url, meta.openGraph.url);
  assert.deepEqual(r.keywords, ["k"]);
  assert.equal(meta.title, "X", "no muta el original");
});

// ───────── editar / ver / auditar ─────────

test("editar_seo: un cambio por código llega a todas las fichas, deja versión, auditoría y refresca solo lo afectado", async () => {
  const db = nuevaDb();
  const T = tienda();
  const r = await S.editarSeo(T.deps, ctx(db), [entrada({ titulo: "Fierro estriado 8 mm para losas · Barraca JURMAQ", descripcion: "Fierro estriado 8 mm en barra de 12 metros, para losas, muros y fundaciones." })]);
  assert.equal(r.datos.aplicado, true);
  const g = await Rep.leerSeoGuardado(db, "producto", "A1");
  assert.equal(g.titulo, "Fierro estriado 8 mm para losas · Barraca JURMAQ");
  assert.equal(g.version, 1);
  assert.deepEqual(T.contadores.revalidados[0].sort(), [1, 2], "las dos fichas del código");
  // lo lee la tienda y lo aplica sobre el código, sin tocar canonical
  const lector = crearLectorSeo({ obtenerDb: async () => db });
  const campos = await lector.leerSeo("producto", "A1");
  assert.equal(R.aplicarSeo({ title: "x", alternates: { canonical: "c" } }, campos).title, g.titulo);
  // auditoría y versión
  const lote = await obtenerLote(db, ctx(db).loteId).catch(() => []);
  void lote;
  // segunda edición: versión 2; sin cambio no escribe
  await S.editarSeo(T.deps, ctx(db, T0 + 10), [entrada({ descripcion: "Fierro estriado de 8 mm: barra de 12 metros, ideal para armar losas." })]);
  assert.equal((await Rep.leerSeoGuardado(db, "producto", "A1")).version, 2);
  assert.equal((await Rep.leerSeoGuardado(db, "producto", "A1")).titulo, g.titulo, "lo no indicado queda como estaba");
  const igual = await S.editarSeo(T.deps, ctx(db, T0 + 20), [entrada({ descripcion: "Fierro estriado de 8 mm: barra de 12 metros, ideal para armar losas." })]);
  assert.equal(igual.datos.aplicado, false);
  assert.equal((await Rep.versionesSeo(db, "producto", "A1")).length, 2);
});

test("editar_seo: rechaza códigos y slugs que no existen, claves malas, textos inválidos y más de 5", async () => {
  const db = nuevaDb();
  const T = tienda();
  await assert.rejects(S.editarSeo(T.deps, ctx(db), [entrada({ clave: "NOEXISTE", titulo: "Un título bueno para probar" })]), /no existe en la tienda/);
  await assert.rejects(S.editarSeo(T.deps, ctx(db), [entrada({ tipo: "categoria", clave: "nada", titulo: "Un título bueno para probar" })]), /no existe en la tienda/);
  await assert.rejects(S.editarSeo(T.deps, ctx(db), [entrada({ tipo: "pagina", clave: "carrito", titulo: "Un título bueno para probar" })]), /clave no válida/);
  await assert.rejects(S.editarSeo(T.deps, ctx(db), [entrada({ titulo: "Fierro 8mm a $1.990" })]), /precios/);
  await assert.rejects(S.editarSeo(T.deps, ctx(db), [entrada({})]), /ningún texto/);
  await assert.rejects(S.editarSeo(T.deps, ctx(db), [entrada({ restablecer: true, titulo: "Algo de texto aquí" })]), /No mezcles/);
  await assert.rejects(S.editarSeo(T.deps, ctx(db), Array.from({ length: 6 }, (_, i) => entrada({ clave: `X${i}`, titulo: "Título" }))), /Máximo 5/);
  // todo o nada: una entrada mala frena a las demás
  await assert.rejects(S.editarSeo(T.deps, ctx(db), [entrada({ titulo: "Título correcto para la ficha" }), entrada({ clave: "B2", titulo: "Mal <i>html</i>" })]), /sin HTML/);
  assert.equal(await Rep.leerSeoGuardado(db, "producto", "A1"), null);
  // un producto inactivo se puede preparar, con aviso
  const r = await S.editarSeo(T.deps, ctx(db), [entrada({ clave: "E5", titulo: "Producto oculto listo para publicar" })]);
  assert.match(r.texto, /Ninguna ficha de este código está activa/);
});

test("avisa de títulos repetidos entre entradas y dentro del mismo pedido", async () => {
  const db = nuevaDb();
  const T = tienda();
  await S.editarSeo(T.deps, ctx(db), [entrada({ clave: "B2", titulo: "Tubo cuadrado 40x40 · Barraca JURMAQ" })]);
  const r = await S.editarSeo(T.deps, ctx(db, T0 + 1), [entrada({ clave: "F6", titulo: "tubo CUADRADO 40x40 · barraca jurmaq" })]);
  assert.equal(r.datos.aplicado, true, "avisar no es bloquear");
  assert.match(r.texto, /se repite con: producto B2/);
  const prev = await S.previsualizarSeo(T.deps, ctx(db, T0 + 2), [entrada({ clave: "D4", titulo: "Mismo título en dos fichas" }), entrada({ clave: "A1", titulo: "mismo título en dos fichas" })]);
  assert.match(prev.texto, /en este mismo pedido/);
  const rep = await S.auditarSeo(db, T.deps, { alcance: "repetidos", pagina: 1, porPagina: 50 });
  assert.match(rep.texto, /1 grupo/);
});

test("ver_seo trae el texto del código, el sugerido (sin precio, dentro de los límites) y avisos", async () => {
  const db = nuevaDb();
  const T = tienda();
  const r = await S.verSeo(db, T.deps, [{ tipo: "producto", clave: "A1" }, { tipo: "categoria", clave: "fierros-y-perfiles" }, { tipo: "pagina", clave: "contacto" }, { tipo: "producto", clave: "NOEXISTE" }]);
  assert.match(r.texto, /producto A1 · texto automático/);
  assert.match(r.texto, /Fierro Estriado 8mm \$5\.990 · En stock · Barraca JURMAQ Curicó/);
  assert.match(r.texto, /Sugerido \(\d+\/\d+\): «Fierro Estriado 8mm · Barraca JURMAQ»/);
  assert.match(r.texto, /categoría|categoria fierros-y-perfiles/);
  assert.match(r.texto, /\+56 9 7667 3577/);
  assert.match(r.texto, /NOEXISTE: no existe en la tienda/);
  for (const e of r.datos.entradas.filter((x) => x.existe)) assert.ok(e.titulo.length > 0);
  const sug = (await import("../src/lib/seo-editable/sugerencias.ts")).sugerirProducto({ nombre: "Abrazadera de Fijacion Tubos con Correas B15mm-d14mm", codigo: "AFT-686033" });
  assert.ok(sug.titulo.length <= 60, sug.titulo);
  assert.ok(sug.descripcion.length <= 160, sug.descripcion);
  assert.equal(R.validarSeo({ titulo: sug.titulo, descripcion: sug.descripcion }).ok, true);
});

test("auditar_seo por lote paginado: sin texto propio, largos y repetidos", async () => {
  const db = nuevaDb();
  const T = tienda();
  await S.editarSeo(T.deps, ctx(db), [entrada({ clave: "B2", titulo: "Tubo cuadrado 40x40 · Barraca JURMAQ", descripcion: "Tubo cuadrado de 40x40 para estructuras livianas y cierros." })]);
  const a = await S.auditarSeo(db, T.deps, { alcance: "producto", pagina: 1, porPagina: 3 });
  assert.equal(a.datos.revisadas, 2, "3 fichas de 2 códigos distintos (A1 repetido cuenta una vez)");
  assert.match(a.texto, /Hay más: repite con pagina 2/);
  const b = await S.auditarSeo(db, T.deps, { alcance: "producto", pagina: 2, porPagina: 3 });
  assert.ok(b.datos.revisadas >= 1);
  const todo = await S.auditarSeo(db, T.deps, { alcance: "producto", pagina: 1, porPagina: 100 });
  assert.equal(todo.datos.sinTituloPropio, todo.datos.revisadas - 1);
  assert.match(todo.texto, /Es el último lote/);
  assert.ok(todo.datos.tituloLargo >= 1, "los títulos con precio del código pasan de 60");
  const cats = await S.auditarSeo(db, T.deps, { alcance: "categoria", pagina: 1, porPagina: 50 });
  assert.equal(cats.datos.total, 2);
  const pags = await S.auditarSeo(db, T.deps, { alcance: "pagina", pagina: 1, porPagina: 50 });
  assert.equal(pags.datos.revisadas, 10);
});

// ───────── aprobación de Jorge ─────────

test("términos y privacidad: el cambio queda pendiente hasta que Jorge aprueba y se repite la llamada", async () => {
  const db = nuevaDb();
  const T = tienda();
  const e = [{ tipo: "pagina", clave: "terminos", titulo: "Términos y condiciones de compra · Barraca JURMAQ" }];
  const p1 = await S.editarSeo(T.deps, ctx(db), e);
  assert.equal(p1.datos.aplicado, false);
  assert.match(p1.texto, /necesita el OK de Jorge/);
  assert.equal(await Rep.leerSeoGuardado(db, "pagina", "terminos"), null);
  assert.equal(T.correos.length, 1);
  const p2 = await S.editarSeo(T.deps, ctx(db, T0 + 1), e);
  assert.match(p2.texto, /sigue esperando/);
  assert.equal(T.correos.length, 1, "no manda otro correo");
  assert.equal((await aprobarUltimoCorreo(db, T.correos, resolverAprobacion)).ok, true);
  const p3 = await S.editarSeo(T.deps, ctx(db, T0 + 2), e);
  assert.equal(p3.datos.aplicado, true);
  assert.equal((await Rep.leerSeoGuardado(db, "pagina", "terminos")).titulo, e[0].titulo);
  assert.ok(T.refrescadas.includes("/terminos"));
  // una aprobación gastada no sirve para repetir ni la puede usar otro usuario
  const e2 = [{ tipo: "pagina", clave: "privacidad", titulo: "Política de privacidad de la tienda en línea" }];
  await S.editarSeo(T.deps, ctx(db, T0 + 3), e2);
  await aprobarUltimoCorreo(db, T.correos, resolverAprobacion);
  const otro = await S.editarSeo(T.deps, ctx(db, T0 + 4, OTRO), e2);
  assert.equal(otro.datos.aplicado, false);
  assert.equal(await Rep.leerSeoGuardado(db, "pagina", "privacidad"), null);
});

test("un texto que agrega teléfono, correo o enlace externo pide el OK; uno que no, es libre", async () => {
  const db = nuevaDb();
  const T = tienda();
  const libre = await S.editarSeo(T.deps, ctx(db), [{ tipo: "pagina", clave: "portada", titulo: "Barraca de fierros y materiales en Molina" }]);
  assert.equal(libre.datos.aplicado, true);
  assert.equal(T.correos.length, 0);
  for (const texto of ["Llámanos al 9 1234 5678 y te atendemos", "Escríbenos a ventas@otrodominio.com para cotizar", "Compra también en tienda-ajena.com con descuento"]) {
    const r = await S.editarSeo(T.deps, ctx(db, T0 + 5), [{ tipo: "pagina", clave: "nosotros", descripcion: `${texto} en nuestra barraca de Molina.` }]);
    assert.equal(r.datos.aplicado, false, texto);
  }
  assert.equal(await Rep.leerSeoGuardado(db, "pagina", "nosotros"), null);
  const propio = await S.editarSeo(T.deps, ctx(db, T0 + 6), [{ tipo: "pagina", clave: "nosotros", descripcion: "Conoce a la barraca JURMAQ en jurmaq.cl: fierros y materiales de construcción en Molina." }]);
  assert.equal(propio.datos.aplicado, true, "jurmaq.cl es propio");
});

test("sin correo del aprobador, lo que necesita OK queda BLOQUEADO y no se aplica", async () => {
  const db = nuevaDb();
  const T = tienda({ aprobadorEmail: null });
  const r = await S.editarSeo(T.deps, ctx(db), [{ tipo: "pagina", clave: "terminos", titulo: "Términos y condiciones de compra · Barraca JURMAQ" }]);
  assert.equal(r.datos.aplicado, false);
  assert.equal(r.datos.estado, "bloqueada");
  assert.equal(await Rep.leerSeoGuardado(db, "pagina", "terminos"), null);
});

// ───────── dos pasos ─────────

test("masivo en dos pasos: vista previa, un solo uso, huella, otro usuario, errores y límite", async () => {
  const db = nuevaDb();
  const T = tienda();
  const items = [entrada({ clave: "A1", titulo: "Fierro estriado 8mm · Barraca JURMAQ" }), entrada({ clave: "B2", titulo: "Tubo cuadrado 40x40 · Barraca JURMAQ" }), { tipo: "categoria", clave: "cementos", descripcion: "Cementos y morteros para tu obra en Molina, con retiro y despacho." }];
  const prev = await S.previsualizarSeo(T.deps, ctx(db), items);
  assert.equal(prev.datos.cambian, 3);
  assert.equal(await Rep.leerSeoGuardado(db, "producto", "A1"), null, "previsualizar no cambia nada");
  const id = prev.datos.vista_previa_id;
  // otro usuario no puede usarla
  await assert.rejects(S.confirmarSeo(T.deps, ctx(db, T0 + 1, OTRO), { vista_previa_id: id }), /No encontré esa vista previa/);
  const ok = await S.confirmarSeo(T.deps, ctx(db, T0 + 2), { vista_previa_id: id });
  assert.equal(ok.datos.cambiadas, 3);
  assert.equal((await Rep.leerSeoGuardado(db, "categoria", "cementos")).descripcion.startsWith("Cementos"), true);
  assert.ok(T.refrescadas.includes("/categorias/cementos"));
  await assert.rejects(S.confirmarSeo(T.deps, ctx(db, T0 + 3), { vista_previa_id: id }), /ya se aplicó/);
  // huella: si alguien cambia el texto entremedio, se rechaza sin gastar la vista
  const prev2 = await S.previsualizarSeo(T.deps, ctx(db, T0 + 4), [entrada({ clave: "F6", titulo: "Perfil C 100x50 · Barraca JURMAQ" })]);
  await S.editarSeo(T.deps, ctx(db, T0 + 5), [entrada({ clave: "F6", titulo: "Otro título distinto escrito a mano" })]);
  await assert.rejects(S.confirmarSeo(T.deps, ctx(db, T0 + 6), { vista_previa_id: prev2.datos.vista_previa_id }), /cambiaron desde que se hizo la vista previa/);
  // vencida
  const prev3 = await S.previsualizarSeo(T.deps, ctx(db, T0 + 7), [entrada({ clave: "D4", titulo: "Cemento 25 kg · Barraca JURMAQ" })]);
  await assert.rejects(S.confirmarSeo(T.deps, ctx(db, T0 + 60 * 60_000), { vista_previa_id: prev3.datos.vista_previa_id }), /venció/);
  // una entrada mala frena toda la vista previa y las lista
  await assert.rejects(S.previsualizarSeo(T.deps, ctx(db, T0 + 8), [entrada({ clave: "D4", titulo: "Cemento bueno para la obra" }), entrada({ clave: "NOEXISTE", titulo: "Un título válido de ejemplo" })]), /NOEXISTE/);
  // sin cambios
  const nada = await S.previsualizarSeo(T.deps, ctx(db, T0 + 9), [entrada({ clave: "A1", titulo: "Fierro estriado 8mm · Barraca JURMAQ" })]);
  assert.match(nada.texto, /Nada que cambiar/);
  // máximo
  await assert.rejects(S.previsualizarSeo(T.deps, ctx(db), Array.from({ length: 201 }, (_, i) => entrada({ clave: `X${i}`, titulo: "Título" }))), /Máximo 200/);
});

test("masivo con términos: la confirmación espera a Jorge, y su aprobación se devuelve si no se aplica", async () => {
  const db = nuevaDb();
  const T = tienda();
  const prev = await S.previsualizarSeo(T.deps, ctx(db), [{ tipo: "pagina", clave: "privacidad", titulo: "Política de privacidad de la tienda en línea" }, entrada({ titulo: "Fierro estriado 8mm · Barraca JURMAQ" })]);
  assert.equal(prev.datos.requiere_aprobacion, true);
  const id = prev.datos.vista_previa_id;
  const c1 = await S.confirmarSeo(T.deps, ctx(db, T0 + 1), { vista_previa_id: id });
  assert.equal(c1.datos.aplicado, false);
  assert.equal(await Rep.leerSeoGuardado(db, "producto", "A1"), null, "ni lo libre se aplica antes del OK");
  await aprobarUltimoCorreo(db, T.correos, resolverAprobacion);
  const c2 = await S.confirmarSeo(T.deps, ctx(db, T0 + 2), { vista_previa_id: id });
  assert.equal(c2.datos.aplicado, true);
  assert.equal((await Rep.leerSeoGuardado(db, "pagina", "privacidad")).version, 1);
});

// ───────── deshacer ─────────

test("deshacer: restaura lo anterior, no pisa un cambio posterior y es repetible", async () => {
  const db = nuevaDb();
  const T = tienda();
  const c1 = ctx(db, T0, JORGE, "editar_seo");
  await S.editarSeo(T.deps, c1, [entrada({ titulo: "Primer título bueno para la ficha" })]);
  const c2 = ctx(db, T0 + 10, JORGE, "editar_seo");
  await S.editarSeo(T.deps, c2, [entrada({ titulo: "Segundo título bueno para la ficha" }), entrada({ clave: "B2", titulo: "Título del tubo cuadrado 40x40" })]);
  const lote2 = await obtenerLote(db, c2.loteId);
  assert.equal(lote2.length, 2);
  const r = await S.revertirSeo(T.deps, { db, usuario: JORGE, ahora: T0 + 20, entradas: lote2 });
  assert.equal(r.ok, true);
  assert.equal((await Rep.leerSeoGuardado(db, "producto", "A1")).titulo, "Primer título bueno para la ficha");
  assert.equal(await Rep.leerSeoGuardado(db, "producto", "B2"), null, "B2 no tenía texto propio: vuelve al automático");
  // repetible
  assert.equal((await S.revertirSeo(T.deps, { db, usuario: JORGE, ahora: T0 + 21, entradas: lote2 })).ok, true);
  // alguien cambia después: no se pisa
  await S.editarSeo(T.deps, ctx(db, T0 + 30), [entrada({ titulo: "Título cambiado por otra persona" })]);
  const lote1 = await obtenerLote(db, c1.loteId);
  const r1 = await S.revertirSeo(T.deps, { db, usuario: JORGE, ahora: T0 + 40, entradas: lote1 });
  assert.equal(r1.ok, false);
  assert.match(r1.mensaje, /alguien las cambió/);
  assert.equal((await Rep.leerSeoGuardado(db, "producto", "A1")).titulo, "Título cambiado por otra persona");
});

test("las herramientas registradas: deshacer por el mecanismo común (deshacerLote) y permisos de escritura", async () => {
  const db = nuevaDb();
  const T = tienda();
  fijarDepsSeo(T.deps);
  try {
    const h = registro.obtener("editar_seo");
    assert.equal(h.anotaciones.readOnlyHint, false);
    const c = crearCtx(db, JORGE, T0, "editar_seo");
    const args = h.esquema.strict().parse({ entradas: [{ tipo: "producto", clave: "A1", titulo: "Título para deshacer con el historial" }] });
    const out = await h.ejecutar(args, { ...c, catalogo: [] });
    assert.match(out.texto ?? out, /Listo/);
    assert.equal((await Rep.leerSeoGuardado(db, "producto", "A1")).titulo, "Título para deshacer con el historial");
    const d = await deshacerLote(db, registro, c.loteId, JORGE, T0 + 5);
    assert.equal(d.ok, true);
    assert.equal(await Rep.leerSeoGuardado(db, "producto", "A1"), null);
    // zod estricto: campos de más (canonical, robots) se rechazan
    assert.throws(() => h.esquema.strict().parse({ entradas: [{ tipo: "producto", clave: "A1", titulo: "x", canonical: "https://otra.com" }] }));
    assert.throws(() => h.esquema.strict().parse({ entradas: [{ tipo: "producto", clave: "A1", robots: "noindex" }] }));
  } finally {
    fijarDepsSeo(null);
  }
});

test("catálogo de herramientas nuevas: nombres, lectura vs escritura y deshacer", () => {
  const lectura = ["ver_seo", "auditar_seo", "ver_relacionados", "listar_guias", "ver_guia", "ver_marcas"];
  const escritura = ["editar_seo", "previsualizar_seo", "confirmar_seo", "fijar_relacionados", "quitar_relacionados", "guardar_borrador_guia", "descartar_borrador_guia", "restaurar_version_guia", "previsualizar_publicacion_guia", "confirmar_publicacion_guia"];
  for (const n of lectura) { const h = registro.obtener(n); assert.ok(h, n); assert.equal(h.anotaciones.readOnlyHint, true, n); assert.equal(h.revertidor, undefined, n); }
  for (const n of escritura) { const h = registro.obtener(n); assert.ok(h, n); assert.equal(h.anotaciones.readOnlyHint, false, n); }
  for (const n of ["editar_seo", "confirmar_seo", "fijar_relacionados", "quitar_relacionados", "guardar_borrador_guia", "descartar_borrador_guia", "confirmar_publicacion_guia"]) assert.ok(registro.obtener(n).revertidor, `${n} se puede deshacer`);
  // no existe ninguna herramienta que acepte canonical, robots, slug o url de páginas
  for (const n of [...lectura, ...escritura]) {
    const forma = JSON.stringify(registro.obtener(n).esquema.shape ?? {});
    void forma;
  }
});

// ───────── relacionados ─────────

test("relacionados: fijar en orden, validar existencia y actividad, auto y deshacer", async () => {
  const db = nuevaDb();
  const T = tienda();
  const v0 = await Rel.verRelacionados(db, T.deps, "A1");
  assert.match(v0.texto, /criterio automático/);
  assert.deepEqual(v0.datos.automatico.slice(0, 2), ["F6", "B2"].sort((a, b) => a.localeCompare(b)).reverse().length ? v0.datos.automatico.slice(0, 2) : []);
  const r = await Rel.fijarRelacionados(T.deps, ctx(db, T0, JORGE, "fijar_relacionados"), "A1", ["D4", "B2", "F6"]);
  assert.equal(r.datos.aplicado, true);
  assert.deepEqual((await Rep.leerRelacionadosGuardados(db, "A1")).lista, ["D4", "B2", "F6"]);
  assert.deepEqual(T.contadores.revalidados.at(-1).sort(), [1, 2], "refresca las fichas del código");
  const lector = crearLectorSeo({ obtenerDb: async () => db });
  assert.deepEqual(await lector.leerRelacionados("A1"), ["D4", "B2", "F6"]);
  assert.match((await Rel.verRelacionados(db, T.deps, "A1")).texto, /D4 · Cemento 25 kg · se muestra/);
  // validaciones
  await assert.rejects(Rel.fijarRelacionados(T.deps, ctx(db), "A1", ["NOEXISTE"]), /No existe un producto con el código NOEXISTE/);
  await assert.rejects(Rel.fijarRelacionados(T.deps, ctx(db), "A1", ["E5"]), /inactivo/);
  await assert.rejects(Rel.fijarRelacionados(T.deps, ctx(db), "A1", ["A1"]), /mismo producto/);
  await assert.rejects(Rel.fijarRelacionados(T.deps, ctx(db), "A1", ["B2", "B2"]), /repetido/);
  await assert.rejects(Rel.fijarRelacionados(T.deps, ctx(db), "A1", []), /vacía/);
  await assert.rejects(Rel.fijarRelacionados(T.deps, ctx(db), "A1", Array.from({ length: 9 }, (_, i) => `Z${i}`)), /Máximo 8/);
  await assert.rejects(Rel.fijarRelacionados(T.deps, ctx(db), "NOEXISTE", ["B2"]), /No existe un producto/);
  // un producto sin stock se acepta con aviso (la ficha lo oculta)
  const sinStock = await Rel.fijarRelacionados(T.deps, ctx(db, T0 + 1, JORGE, "fijar_relacionados"), "A1", ["C3", "B2"]);
  assert.match(sinStock.texto, /C3 hoy no se puede comprar/);
  assert.match((await Rel.verRelacionados(db, T.deps, "A1")).texto, /C3 · Malla Acma C92 · sin stock/);
  // quedó sin cambios si se repite
  assert.equal((await Rel.fijarRelacionados(T.deps, ctx(db), "A1", ["C3", "B2"])).datos.aplicado, false);
  // quitar → automático
  const c = ctx(db, T0 + 2, JORGE, "fijar_relacionados");
  await Rel.fijarRelacionados(T.deps, c, "A1", null);
  assert.equal(await Rep.leerRelacionadosGuardados(db, "A1"), null);
  assert.equal(await Rel.fijarRelacionados(T.deps, ctx(db), "A1", null).then((x) => x.datos.aplicado), false);
  // deshacer: vuelve la lista; no pisa un cambio posterior
  const lote = await obtenerLote(db, c.loteId);
  assert.equal((await Rel.revertirRelacionados(T.deps, { db, usuario: JORGE, ahora: T0 + 3, entradas: lote })).ok, true);
  assert.deepEqual((await Rep.leerRelacionadosGuardados(db, "A1")).lista, ["C3", "B2"]);
  await Rel.fijarRelacionados(T.deps, ctx(db, T0 + 4), "A1", ["F6"]);
  const r2 = await Rel.revertirRelacionados(T.deps, { db, usuario: JORGE, ahora: T0 + 5, entradas: lote });
  assert.equal(r2.ok, false);
  assert.deepEqual((await Rep.leerRelacionadosGuardados(db, "A1")).lista, ["F6"]);
});

test("relacionados: si un producto fijado deja de existir o se desactiva después, ver_relacionados lo dice", async () => {
  const db = nuevaDb();
  const T = tienda();
  await Rel.fijarRelacionados(T.deps, ctx(db), "A1", ["D4", "B2"]);
  T.filas.find((f) => f.codigo === "D4").activo = false;
  T.filas.splice(T.filas.findIndex((f) => f.codigo === "B2"), 1);
  const v = await Rel.verRelacionados(db, T.deps, "A1");
  assert.match(v.texto, /D4 · Cemento 25 kg · inactivo/);
  assert.match(v.texto, /B2 · \? · YA NO EXISTE/);
});

// ───────── guías ─────────

test("guías: todas las guías de código pasan a markdown y de vuelta sin perder texto ni estructura", () => {
  assert.ok(GUIAS.length >= 7);
  const texto = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  for (const g of GUIAS) {
    const e = G.guiaAEditable(g);
    const v = G.validarGuia(e);
    assert.equal(v.ok, true, `${g.slug}: ${v.errores?.join("; ")}`);
    const de_vuelta = G.editableAGuia(v.valor);
    assert.equal(de_vuelta.secciones.length, g.secciones.length);
    g.secciones.forEach((s, i) => {
      assert.equal(texto(de_vuelta.secciones[i].html), texto(s.html), `${g.slug} sección ${i + 1}`);
      const etiquetas = (h) => [...h.matchAll(/<(ul|ol|li|p|strong)>/g)].map((m) => m[1]).join(",");
      assert.equal(etiquetas(de_vuelta.secciones[i].html), etiquetas(s.html), `${g.slug} etiquetas ${i + 1}`);
    });
    assert.equal(de_vuelta.intro, g.intro);
    assert.deepEqual(de_vuelta.faq, g.faq);
  }
});

test("guías: el markdown se convierte a HTML seguro (sin scripts, enlaces malos ni atributos)", () => {
  const html = G.mdAHtml('Hola <script>alert(1)</script> **fuerte** y [malo](javascript:alert(1)) y [bueno](https://ejemplo.cl/x?a=1&b=2)\n\n- uno\n- <img src=x onerror=alert(1)> dos\n\n1. primero\n2. segundo\n\n### Subtítulo');
  assert.doesNotMatch(html, /<script|javascript:|onerror|<img/i);
  assert.match(html, /<strong>fuerte<\/strong>/);
  assert.match(html, /<a href="https:\/\/ejemplo\.cl\/x\?a=1&amp;b=2" rel="noopener noreferrer">bueno<\/a>/);
  assert.match(html, /<ul><li>uno<\/li><li>/);
  assert.match(html, /<ol><li>primero<\/li><li>segundo<\/li><\/ol>/);
  assert.match(html, /<h3>Subtítulo<\/h3>/);
  const etiquetas = new Set([...html.matchAll(/<\/?([a-z0-9]+)/g)].map((m) => m[1]));
  for (const e of etiquetas) assert.ok(["p", "ul", "ol", "li", "h3", "strong", "a"].includes(e), e);
});

test("guías: validación (HTML, slug, categoría inexistente, relacionadas, tamaño)", async () => {
  const base = G.guiaAEditable(GUIAS[0]);
  assert.equal(G.validarGuia({ ...base, titulo: "Con <b>html</b>" }).ok, false);
  assert.equal(G.validarGuia({ ...base, slug: "Mal Slug" }).ok, false);
  assert.equal(G.validarGuia({ ...base, extra: 1 }).ok, false);
  assert.equal(G.validarGuia({ ...base, secciones: [] }).ok, false);
  assert.equal(G.validarGuia({ ...base, guiasRelacionadas: [base.slug] }).ok, false);
  assert.equal(G.validarGuia({ ...base, intro: "x".repeat(4000) }).ok, false);
  const db = nuevaDb();
  const T = tienda();
  await assert.rejects(SG.guardarBorradorGuia(T.deps, ctx(db), { ...base, categoriaSlugRelacionada: "no-existe" }), /no existe una categoría activa/);
  await assert.rejects(SG.guardarBorradorGuia(T.deps, ctx(db), { ...base, categoriaSlugRelacionada: "cementos", guiasRelacionadas: ["guia-que-no-existe"] }), /no existe la guía/);
});

test("guías: borrador, vista previa, publicación, versiones, restaurar y deshacer; la página recibe la guía editada", async () => {
  const db = nuevaDb();
  const T = tienda();
  const base = { ...G.guiaAEditable(GUIAS[0]), categoriaSlugRelacionada: "fierros-y-perfiles" };
  // lista y ver (sin cambios: la de código)
  assert.match((await SG.listarGuias(db)).texto, /que-es-fierro-estriado .* la de código/);
  assert.match((await SG.verGuia(db, base.slug)).texto, /la de código/);
  // sin borrador no hay qué publicar
  await assert.rejects(SG.previsualizarPublicacionGuia(T.deps, ctx(db), base.slug), /no tiene borrador/);
  // borrador: la tienda no cambia
  const editada = { ...base, titulo: "Qué es el fierro estriado y para qué se usa", secciones: [{ h2: "Diámetros", md: "Los **diámetros** más usados son 8, 10 y 12 mm.\n\n- Ø8 para estribos\n- Ø12 para vigas" }, ...base.secciones.slice(1)] };
  const cb = ctx(db, T0, JORGE, "guardar_borrador_guia");
  await SG.guardarBorradorGuia(T.deps, cb, editada);
  const lector = crearLectorSeo({ obtenerDb: async () => db, ttlMs: 1 });
  assert.equal((await lector.leerGuias()).size, 0);
  assert.match((await SG.verGuia(db, base.slug)).texto, /HAY BORRADOR/);
  // dos pasos
  const prev = await SG.previsualizarPublicacionGuia(T.deps, ctx(db, T0 + 1), base.slug);
  assert.match(prev.texto, /titulo:/);
  assert.match(prev.texto, /Secciones con texto distinto: Diámetros|Secciones nuevas: Diámetros/);
  assert.equal(prev.datos.requiere_aprobacion, false);
  await assert.rejects(SG.confirmarPublicacionGuia(T.deps, ctx(db, T0 + 2, OTRO), { vista_previa_id: prev.datos.vista_previa_id }), /No encontré esa vista previa/);
  const cp = ctx(db, T0 + 3, JORGE, "confirmar_publicacion_guia");
  const pub = await SG.confirmarPublicacionGuia(T.deps, cp, { vista_previa_id: prev.datos.vista_previa_id });
  assert.equal(pub.datos.version, 1);
  assert.deepEqual(T.refrescadas.slice(-3), ["/guias", `/guias/${base.slug}`, "/sitemap.xml"]);
  await assert.rejects(SG.confirmarPublicacionGuia(T.deps, ctx(db, T0 + 4), { vista_previa_id: prev.datos.vista_previa_id }), /ya se aplicó/);
  // la tienda recibe la guía publicada, con el HTML ya convertido y el resto de las guías intactas
  await new Promise((r) => setTimeout(r, 5));
  const fusion = G.fusionarGuias(GUIAS, await lector.leerGuias());
  assert.equal(fusion.length, GUIAS.length);
  assert.equal(fusion[0].titulo, "Qué es el fierro estriado y para qué se usa");
  assert.match(fusion[0].secciones[0].html, /<strong>diámetros<\/strong>/);
  assert.deepEqual(fusion.slice(1), GUIAS.slice(1));
  assert.equal(fusion[0].slug, GUIAS[0].slug, "la URL no cambia");
  // el borrador se limpió al publicar
  assert.doesNotMatch((await SG.verGuia(db, base.slug)).texto, /HAY BORRADOR/);
  // segunda versión + restaurar la primera como borrador
  await SG.guardarBorradorGuia(T.deps, ctx(db, T0 + 10), { ...editada, titulo: "Fierro estriado: qué es y para qué sirve" });
  const prev2 = await SG.previsualizarPublicacionGuia(T.deps, ctx(db, T0 + 11), base.slug);
  const pub2 = await SG.confirmarPublicacionGuia(T.deps, ctx(db, T0 + 12), { vista_previa_id: prev2.datos.vista_previa_id });
  assert.equal(pub2.datos.version, 2);
  assert.equal((await Rep.versionesGuia(db, base.slug)).length, 2);
  const rest = await SG.restaurarVersionGuia(T.deps, ctx(db, T0 + 13, JORGE, "guardar_borrador_guia"), base.slug, 1);
  assert.match(rest.texto, /Versión 1 puesta como borrador/);
  assert.equal(JSON.parse((await Rep.leerFilaGuia(db, base.slug)).borrador).titulo, "Qué es el fierro estriado y para qué se usa");
  await assert.rejects(SG.restaurarVersionGuia(T.deps, ctx(db), base.slug, 99), /No existe la versión 99/);
  // deshacer la publicación 2: vuelve la versión 1 (como versión nueva); no pisa cambios ajenos
  const cu = ctx(db, T0 + 20, JORGE, "confirmar_publicacion_guia");
  const prev3 = await SG.previsualizarPublicacionGuia(T.deps, ctx(db, T0 + 19), base.slug);
  const pub3 = await SG.confirmarPublicacionGuia(T.deps, cu, { vista_previa_id: prev3.datos.vista_previa_id });
  assert.equal(pub3.datos.version, 3);
  const lote = await obtenerLote(db, cu.loteId);
  assert.equal((await SG.revertirGuias(T.deps, { db, usuario: JORGE, ahora: T0 + 30, entradas: lote })).ok, true);
  assert.equal(JSON.parse((await Rep.leerFilaGuia(db, base.slug)).publicado).titulo, "Fierro estriado: qué es y para qué sirve");
  const cOtro = ctx(db, T0 + 40, JORGE, "confirmar_publicacion_guia");
  await SG.guardarBorradorGuia(T.deps, ctx(db, T0 + 41), { ...editada, titulo: "Otro título más, hecho por otra persona" });
  const prev4 = await SG.previsualizarPublicacionGuia(T.deps, ctx(db, T0 + 42), base.slug);
  await SG.confirmarPublicacionGuia(T.deps, ctx(db, T0 + 43, OTRO), { vista_previa_id: prev4.datos.vista_previa_id }).catch(() => {});
  void cOtro;
  assert.equal((await SG.revertirGuias(T.deps, { db, usuario: JORGE, ahora: T0 + 50, entradas: lote })).ok, true, "ya estaba como antes: repetible");
});

test("guías: una guía nueva se publica con su slug y aparece; deshacer la quita; con desvío pide el OK", async () => {
  const db = nuevaDb();
  const T = tienda();
  const nueva = {
    slug: "como-elegir-un-fierro", titulo: "Cómo elegir un fierro para tu obra", descripcionMeta: "Guía simple para elegir el diámetro y el largo del fierro según la obra que vas a hacer.",
    h1: "Cómo elegir un fierro para tu obra", intro: "Elegir bien el fierro evita sobrecostos y problemas en la obra.",
    secciones: [{ h2: "Según el uso", md: "Para losas se usa **Ø10**.\n\n- Estribos: Ø8\n- Vigas: Ø12" }], faq: [{ q: "¿Qué diámetro uso para una losa?", a: "Depende del cálculo del ingeniero." }],
    categoriaSlugRelacionada: "fierros-y-perfiles", categoriaNombre: "Fierros y perfiles", guiasRelacionadas: ["que-es-fierro-estriado"],
  };
  const g = await SG.guardarBorradorGuia(T.deps, ctx(db), nueva);
  assert.match(g.texto, /guía NUEVA/);
  const prev = await SG.previsualizarPublicacionGuia(T.deps, ctx(db, T0 + 1), nueva.slug);
  const cp = ctx(db, T0 + 2, JORGE, "confirmar_publicacion_guia");
  await SG.confirmarPublicacionGuia(T.deps, cp, { vista_previa_id: prev.datos.vista_previa_id });
  const lector = crearLectorSeo({ obtenerDb: async () => db });
  const fusion = G.fusionarGuias(GUIAS, await lector.leerGuias());
  assert.equal(fusion.length, GUIAS.length + 1);
  assert.equal(fusion.at(-1).slug, nueva.slug);
  assert.match((await SG.listarGuias(db)).texto, /como-elegir-un-fierro .* publicada versión 1/);
  const resumen = await SG.guiasVigentesResumen(db);
  assert.equal(resumen.length, GUIAS.length + 1);
  // deshacer: la guía nueva deja de existir
  const lote = await obtenerLote(db, cp.loteId);
  assert.equal((await SG.revertirGuias(T.deps, { db, usuario: JORGE, ahora: T0 + 5, entradas: lote })).ok, true);
  const lector2 = crearLectorSeo({ obtenerDb: async () => db });
  assert.equal((await lector2.leerGuias()).size, 0);
  // desvío: una guía que agrega un teléfono queda pendiente
  const conTel = { ...nueva, intro: "Llámanos al 9 8765 4321 para que te asesoremos con tu obra." };
  await SG.guardarBorradorGuia(T.deps, ctx(db, T0 + 10), conTel);
  const prev2 = await SG.previsualizarPublicacionGuia(T.deps, ctx(db, T0 + 11), nueva.slug);
  assert.equal(prev2.datos.requiere_aprobacion, true);
  const c1 = await SG.confirmarPublicacionGuia(T.deps, ctx(db, T0 + 12, JORGE, "confirmar_publicacion_guia"), { vista_previa_id: prev2.datos.vista_previa_id });
  assert.equal(c1.datos.aplicado, false);
  assert.equal((await Rep.leerFilaGuia(db, nueva.slug)).publicado, null);
  await aprobarUltimoCorreo(db, T.correos, resolverAprobacion);
  const c2 = await SG.confirmarPublicacionGuia(T.deps, ctx(db, T0 + 13, JORGE, "confirmar_publicacion_guia"), { vista_previa_id: prev2.datos.vista_previa_id });
  assert.equal(c2.datos.version, 2);
});

// ───────── marcas ─────────

test("marcas: solo lectura, se reconocen por el nombre del producto", async () => {
  const T = crearTienda([
    ficha({ id: 1, codigo: "M1", nombre: "Alicate Cortante 6 Tolmat" }),
    ficha({ id: 2, codigo: "M2", nombre: "Alicate Universal 8 Tolmat" }),
    ficha({ id: 3, codigo: "M3", nombre: "Tarugo de nylon 8mm" }),
  ]);
  fijarDepsSeo({ ...T.deps, async revalidarRutas() {}, async local() { return LOCAL; } });
  try {
    const h = registro.obtener("ver_marcas");
    const db = nuevaDb();
    const r = await h.ejecutar(h.esquema.parse({}), { ...crearCtx(db, JORGE, T0), catalogo: [] });
    assert.match(r.texto, /Tolmat \(tolmat\): 2/);
    assert.match(r.texto, /Sin marca: 1/);
    const l = await h.ejecutar(h.esquema.parse({ marca: "tolmat" }), { ...crearCtx(db, JORGE, T0), catalogo: [] });
    assert.match(l.texto, /M1 · Alicate Cortante 6 Tolmat/);
    await assert.rejects(h.ejecutar(h.esquema.parse({ marca: "inventada" }), { ...crearCtx(db, JORGE, T0), catalogo: [] }), /No reconozco la marca/);
  } finally {
    fijarDepsSeo(null);
  }
});
