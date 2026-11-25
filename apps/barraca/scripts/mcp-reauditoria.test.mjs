// Pruebas de la re-auditoría del MCP: desvío en textos libres, detalle incompleto, correos del mismo usuario,
// combos de menos de un peso y escrituras libres de stock/visibilidad.
// Correr: node --test scripts/mcp-reauditoria.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";
import { aprobarUltimoCorreo, crearCtx, crearTienda, ficha } from "./pruebas/tienda-falsa.mjs";

const D = await import("../src/lib/contenido/desvio.ts");
const Tipos = await import("../src/lib/contenido/tipos.ts");
const A = await import("../src/lib/mcp/aprobaciones.ts");
const R = await import("../src/lib/gestion-precios/reglas.ts");
const Prod = await import("../src/lib/gestion-precios/productos-servicio.ts");
const { ESCRITURAS_LIBRES_CON_APROBACION: LIBRES } = await import("../src/lib/mcp/escrituras-libres.ts");

const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const JORGE = { id: "1", email: "contacto@jurmaq.cl" };
const nuevaDb = () => crearD1Simulada();

// ───────── 2. Desvío en textos libres ─────────
test("desvío: teléfonos, correos y enlaces nuevos se detectan; lo que ya estaba, jurmaq.cl y fechas no", () => {
  const base = { intro: "Escríbenos o pasa por la barraca.", nota: "Horario de 09:00 a 18:00." };
  const con = (nota) => ({ ...base, nota });
  assert.equal(D.agregaDesvio(base, con("Horario de 09:00 a 18:00. Desde 2026-12-01 hasta el 25-12-2026.")), false);
  assert.equal(D.agregaDesvio(base, con("Visita https://jurmaq.cl/contacto o https://www.jurmaq.cl o https://tienda.jurmaq.cl/x")), false);
  assert.equal(D.agregaDesvio(base, con("Llámanos al +56 9 7667 3577")), true);
  assert.equal(D.agregaDesvio(base, con("Llámanos al 976673577")), true);
  assert.equal(D.agregaDesvio(base, con("Llama al 9-7-6-6-7-3-5-7-7")), true);
  assert.equal(D.agregaDesvio(base, con("Llama al 9 7667 3577")), true);
  assert.equal(D.agregaDesvio(base, con("Llama al ９７６６７３５７７")), true, "dígitos de ancho completo");
  assert.equal(D.agregaDesvio(base, con("Escribe a pagos@gmail.com")), true);
  assert.equal(D.agregaDesvio(base, con("Escribe a contacto@jurmaq.cl")), true, "todo correo nuevo se revisa");
  assert.equal(D.agregaDesvio(base, con("Paga en https://pagos-seguros.example/cobro")), true);
  assert.equal(D.agregaDesvio(base, con("Paga en https://jurmaq.cl.evil.example/x")), true);
  assert.equal(D.agregaDesvio(base, con("Paga en https://jurmaq.cl@evil.example/x")), true);
  assert.equal(D.agregaDesvio(base, con("Paga en [jurmaq.cl](https://evil.example/x)")), true);
  assert.equal(D.agregaDesvio(base, con("Escríbenos por wa.me/56911112222")), true, "dominio suelto");
  assert.equal(D.agregaDesvio(base, con("Precio desde $12.990 el metro")), false);
  // lo que el contenido vigente ya traía no cuenta como nuevo
  const vigente = { intro: "Mira https://instagram.com/barraca o llama al +56 9 7667 3577", nota: "" };
  assert.equal(D.agregaDesvio(vigente, { ...vigente, nota: "Seguimos en https://instagram.com/barraca y al 976673577" }), false);
  assert.equal(D.agregaDesvio(vigente, { ...vigente, nota: "Ahora en https://tiktok.com/@barraca" }), true);
  // imágenes propias no se revisan
  assert.equal(D.agregaDesvio({ imagen: "" }, { imagen: "https://x.supabase.co/storage/v1/object/public/barraca-redes/tienda/a.jpg" }), false);
});

test("razones de publicación: textos libres, Instagram y datos sensibles", () => {
  assert.deepEqual(Tipos.razonesPublicacion("cinta", { activa: true, texto: "Hola", enlace: null, desde: null, hasta: null }, { activa: true, texto: "Hola", enlace: { texto: "ver", enlace: "https://otro.example/x" }, desde: null, hasta: null }), ["desvio"]);
  assert.deepEqual(Tipos.razonesPublicacion("cinta", { texto: "Hola", enlace: null }, { texto: "Hola y chao", enlace: { texto: "ver", enlace: "/categorias" } }), []);
  assert.deepEqual(Tipos.razonesPublicacion("datos_local", { instagram: "https://instagram.com/a" }, { instagram: "https://instagram.com/b" }), ["datos_local"]);
  assert.deepEqual(Tipos.razonesPublicacion("datos_local", { nombre: "A", instagram: "x" }, { nombre: "A tienda https://otro.example", instagram: "x" }), ["desvio"]);
  assert.deepEqual(Tipos.razonesPublicacion("terminos", { texto: "a" }, { texto: "b" }), ["legal"]);
});

// ───────── 3. Detalle incompleto ─────────
test("detalle incompleto (más de 256 KB): se puede rechazar pero NO aprobar, ni por la función ni dejando la solicitud 'aprobada'", async () => {
  const db = nuevaDb();
  const correos = [];
  const deps = { aprobadorEmail: "aprobador@example.com", base: "https://barraca.jurmaq.cl", enviar: async (a) => { correos.push(a); return true; } };
  const grande = { cifras: { productos: 5 }, texto: "x".repeat(A.MAX_DETALLE_BYTES + 10) };
  const r = await A.solicitarAprobacion(db, { usuario: JORGE, herramienta: "t", motivos: ["despacho"], resumen: "r", detalle: grande, huella: "h1" }, deps, T0);
  assert.ok(r.ok);
  assert.equal(correos[0].detalleIncompleto, true);
  const token = correos[0].enlace.split("/aprobar/")[1];
  const v = await A.verAprobacionPorToken(db, token, T0);
  assert.equal(v.detalleIncompleto, true);
  const ap = await A.resolverAprobacion(db, token, "aprobar", T0 + 1000);
  assert.deepEqual(ap, { ok: false, motivo: "detalle_incompleto" });
  assert.equal((await A.verAprobacionPorToken(db, token, T0)).estado, "pendiente");
  assert.equal(await A.consumirAprobacion(db, r.id, { usuarioId: "1", huellaActual: "h1" }, T0 + 2000), false);
  assert.deepEqual(await A.resolverAprobacion(db, token, "rechazar", T0 + 3000), { ok: true, estado: "rechazada" });
  // un detalle normal sí se aprueba
  const r2 = await A.solicitarAprobacion(db, { usuario: JORGE, herramienta: "t", motivos: ["despacho"], resumen: "r", detalle: { n: 1 }, huella: "h2" }, deps, T0);
  const t2 = correos[1].enlace.split("/aprobar/")[1];
  assert.equal((await A.verAprobacionPorToken(db, t2, T0)).detalleIncompleto, false);
  assert.deepEqual(await A.resolverAprobacion(db, t2, "aprobar", T0 + 1000), { ok: true, estado: "aprobada" });
  assert.ok(r2.ok);
  // la página no ofrece el botón Aprobar
  const fuente = readFileSync(new URL("../src/app/aprobar/[token]/route.ts", import.meta.url), "utf8");
  assert.match(fuente, /soloRechazar \? "" : `<button class="primario"/);
});

// ───────── 4. Mismo correo ─────────
test("mismoCorreo normaliza como el control de un uso por cliente; usuario sin correo bloquea", async () => {
  assert.equal(A.mismoCorreo("jorge.ubilla@gmail.com", "jorgeubilla@gmail.com"), true);
  assert.equal(A.mismoCorreo("jorgeubilla+x@googlemail.com", "Jorge.Ubilla@GMAIL.com"), true);
  assert.equal(A.mismoCorreo(" A@b.cl ", "a+z@b.cl"), true);
  assert.equal(A.mismoCorreo("a.b@empresa.cl", "ab@empresa.cl"), false, "los puntos solo se ignoran en Gmail");
  assert.equal(A.mismoCorreo("", ""), false);
  assert.equal(A.mismoCorreo(null, "a@b.cl"), false);
  const deps = { aprobadorEmail: "jorgeubilla@gmail.com", base: "https://x", enviar: async () => true };
  const d = (email) => ({ usuario: { id: "1", email }, herramienta: "x", motivos: ["despacho"], resumen: "r", huella: "h" });
  assert.equal((await A.solicitarAprobacion(nuevaDb(), d("jorge.ubilla@googlemail.com"), deps, T0)).motivo, "mismo_usuario");
  for (const vacio of [null, undefined, "", "   "]) {
    const r = await A.solicitarAprobacion(nuevaDb(), d(vacio), deps, T0);
    assert.equal(r.ok, false);
    assert.equal(r.motivo, "usuario_sin_correo");
  }
});

// ───────── 5. Combos de menos de un peso ─────────
test("combo: el precio unitario bajo $1 no se redondea hacia arriba antes de compararlo con el costo", async () => {
  const db = nuevaDb();
  const e = await R.evaluarCambioPrecios(db, { usuarioId: "1", ahora: T0, cambios: [{ clave: "A", precioAntes: 10, precioDespues: 10, costo: 0.5, precioComboUnitario: 1 / 3 }] });
  assert.ok(e.motivos.includes("precio_bajo_costo"), "1/3 de peso está bajo un costo de 0,5");
  const fuente = readFileSync(new URL("../src/lib/gestion-precios/productos-servicio.ts", import.meta.url), "utf8") + readFileSync(new URL("../src/lib/gestion-precios/revertir.ts", import.meta.url), "utf8");
  assert.ok(!/Math\.ceil\(/.test(fuente), "ya no se redondea hacia arriba");
  // y por el servicio: 3 unidades por $1 con costo 0,5
  const T = crearTienda([ficha({ id: 1, codigo: "A", precio: 10, costo: 0.5 })]);
  const c = await Prod.editarProducto(T.deps, crearCtx(db, JORGE, T0, "editar_producto"), { codigo: "A", combo_cantidad: 3, combo_precio: 1 });
  assert.match(c.texto, /necesita el OK de Jorge/);
  assert.ok(T.correos[0].motivos.includes("precio_bajo_costo"));
  assert.equal(T.filas[0].combo_precio, null);
});

// ───────── 7. Stock y visibilidad: libres, con interruptor ─────────
test("stock y activo: libres por defecto; con el interruptor encendido piden el OK de Jorge", async () => {
  const db = nuevaDb();
  const T = crearTienda([ficha({ id: 1, codigo: "A", precio: 1000, costo: 100, stock: 10 })]);
  const ctx = (t) => crearCtx(db, JORGE, t, "editar_producto");
  assert.equal(LIBRES.stock || LIBRES.activo, false);
  assert.equal((await Prod.editarProducto(T.deps, ctx(T0), { codigo: "A", stock: 5 })).datos.aplicado, true);
  try {
    LIBRES.stock = true;
    const p = await Prod.editarProducto(T.deps, ctx(T0 + 1), { codigo: "A", stock: 7 });
    assert.match(p.texto, /necesita el OK de Jorge/);
    assert.equal(T.filas[0].stock, 5);
    assert.deepEqual(T.correos[0].motivos, ["escritura_libre"]);
    // activo sigue libre mientras su interruptor esté apagado
    assert.equal((await Prod.editarProducto(T.deps, ctx(T0 + 2), { codigo: "A", activo: false })).datos.aplicado, true);
    await aprobarUltimoCorreo(db, [T.correos[0]], A.resolverAprobacion);
    assert.equal((await Prod.editarProducto(T.deps, ctx(T0 + 3), { codigo: "A", stock: 7 })).datos.aplicado, true);
    assert.equal(T.filas[0].stock, 7);
  } finally {
    LIBRES.stock = false;
  }
});
