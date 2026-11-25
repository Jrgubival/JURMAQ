// Correos al cliente con textos editables: validación, armado seguro, respaldo EXACTO en el código
// (byte a byte contra los 98 correos de hoy), lector de D1, borrador/publicar con aprobación/restaurar/deshacer.
// Correr: node --test scripts/correos-cliente.test.mjs   (D1 simulada con node:sqlite, sin red, nada se envía)
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import "./pruebas/cargar-correos.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";
import { aprobarUltimoCorreo, crearCtx, crearTienda } from "./pruebas/tienda-falsa.mjs";
import { huella, recorrerCorreos, PEDIDOS } from "./pruebas/correos-fixtures.mjs";

const Pl = await import("../src/lib/correos-cliente/plantillas.ts");
const Va = await import("../src/lib/correos-cliente/validar.ts");
const Re = await import("../src/lib/correos-cliente/render.ts");
const Rp = await import("../src/lib/correos-cliente/repositorio.ts");
const Lector = await import("../src/lib/correos-cliente/lector.ts");
const { escapeHtml } = await import("@jurmaq/shared/mail/utils");
const { resolverAprobacion } = await import("../src/lib/mcp/aprobaciones.ts");
const { obtenerLote } = await import("../src/lib/gestion/index.ts");
const { deshacerLote } = await import("../src/lib/mcp/deshacer.ts");
const { crearRegistro } = await import("../src/lib/mcp/tools/registro.ts");
const { fijarDepsGestion } = await import("../src/lib/mcp/tools/productos-comun.ts");
const TC = await import("../src/lib/mcp/tools/correos.ts");
const C = await import("../src/lib/pedidos/correos.ts");

const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const JORGE = { id: "1", email: "contacto@jurmaq.cl" };
const OTRO = { id: "2", email: "otro@example.com" };
const golden = JSON.parse(readFileSync(new URL("./pruebas/correos-golden.json", import.meta.url), "utf8"));
const nuevaDb = () => crearD1Simulada();
const defecto = (k) => Pl.textosPorDefecto(k);

const herramientasCorreos = [TC.listarPlantillasCorreo, TC.verPlantillaCorreo, TC.editarBorradorCorreo, TC.previsualizarCorreo, TC.publicarCorreo, TC.restaurarCorreo];
const registroMio = () => { const r = crearRegistro(); r.agregar(...herramientasCorreos); return r; };
/** Ejecuta una herramienta como lo hace el servidor: valida con su esquema y le pasa un contexto con auditoría real. */
async function usar(h, args, db, t, usuario = JORGE) {
  const ctx = crearCtx(db, usuario, t, h.nombre);
  const salida = await h.ejecutar(h.esquema.strict().parse(args), ctx);
  return { ...(typeof salida === "string" ? { texto: salida } : salida), ctx };
}

// ───────── plantillas y validación ─────────
test("los textos del código validan con sus propias reglas y se arman sin errores", () => {
  assert.equal(Pl.CLAVES_CORREO.length, 8);
  for (const k of Pl.CLAVES_CORREO) {
    const v = Va.validarPlantilla(k, defecto(k));
    assert.equal(v.ok, true, `${k}: ${v.errores?.join(" | ")}`);
    const r = Re.resolverTextos(k, null, Re.variablesEjemplo(k));
    assert.equal(r.origen, "codigo");
    for (const c of Pl.PLANTILLAS[k].campos) assert.equal(typeof r.campos[c.clave], "string");
    // Toda variable de un campo está en la lista blanca de su correo.
    for (const c of Pl.PLANTILLAS[k].campos) for (const m of c.defecto.matchAll(/\{([^}]*)\}/g)) assert.ok(Pl.PLANTILLAS[k].variables.includes(m[1]), `${k}.${c.clave} usa {${m[1]}}`);
  }
});

test("texto del código = las expresiones que estaban escritas en correos.ts (nombres con HTML incluidos)", () => {
  const nombres = ["Juana Pérez", "Ana<b>\"&'Z</b> Lopez", "X"];
  for (const nombre of nombres) {
    const p = { nombre, numero: "BJ-261120-AAAA", total: 15000 };
    const vars = { nombre: nombre.split(" ")[0], numero_pedido: p.numero, total: "$15.000", email_tienda: "contacto@jurmaq.cl", whatsapp_tienda: "+56 9 7667 3577", monto_devolucion: "$15.000", cuenta_devolucion: "Banco <X>, cuenta terminada en 9012", documento: "boleta", documento_cap: "Boleta" };
    const h = (k, campo) => Re.resolverTextos(k, null, vars).campos[campo];
    const n = escapeHtml(nombre.split(" ")[0]);
    const nro = escapeHtml(p.numero);
    assert.equal(h("pago_recibido", "saludo"), `Hola ${n}, este es el detalle de tu pedido <strong>${nro}</strong>.`);
    assert.equal(h("rechazo_pedido", "saludo"), `Hola ${n}, lamentamos avisarte que no podemos aprobar tu pedido <strong>${nro}</strong>.`);
    assert.equal(h("rechazo_pedido", "dudas"), `Si tienes dudas, escríbenos a contacto@jurmaq.cl o al +56 9 7667 3577.`);
    assert.equal(h("cancelacion_pedido", "intro_vencido"), `Hola ${n}, no recibimos la transferencia de tu pedido <strong>${nro}</strong> dentro de 48 horas, así que lo anulamos sin costo para ti (Términos 8.3).`);
    assert.equal(h("devolucion_hecha", "saludo"), `Hola ${n}, te transferimos <strong>$15.000</strong> del pedido <strong>${nro}</strong> a ${escapeHtml("Banco <X>")}, cuenta terminada en 9012.`);
    assert.equal(h("pedir_opinion", "saludo"), `Hola ${n}, ya entregamos tu pedido <strong>${nro}</strong>.`);
    assert.equal(h("documento_tributario", "saludo"), `Hola ${n}, te adjuntamos la boleta de tu pedido <strong>${nro}</strong> por <strong>$15.000</strong>.`);
    assert.equal(h("documento_tributario", "titulo"), `Tu boleta del pedido ${p.numero}`);
    assert.equal(h("documento_tributario", "preheader"), "Boleta adjunta en PDF");
    assert.equal(h("confirmacion_pedido", "preheader"), `Pedido ${p.numero} por $15.000`);
    assert.equal(h("pago_recibido", "asunto"), `Pago recibido · pedido ${p.numero} | Barraca JURMAQ`);
  }
});

const campo = (k, c) => Pl.campoDe(k, c);
const errores = (k, c, t) => Va.validarTexto(k, campo(k, c), t);

test("se rechaza HTML, códigos HTML, variables desconocidas o rotas, llaves sueltas", () => {
  const casos = [
    ["<b>Hola</b> {nombre}", /HTML/], ["<script>alert(1)</script>", /HTML/], ["Hola &amp; {nombre}", /códigos HTML/], ["Hola {nombre} <img src=x onerror=1>", /HTML/],
    ["Hola {apellido}, tu pedido {numero_pedido}", /no existe en este correo/], ["Hola {Nombre}", /mal escrita/], ["Hola {nombre", /llave/], ["Hola nombre}", /llave/], ["Hola {{nombre}}", /llave|mal escrita/],
    ["Hola {nombre.toString()}", /mal escrita/], ["Hola {nombre}{", /llave/],
  ];
  for (const [t, re] of casos) {
    const e = errores("rechazo_pedido", "saludo", t);
    assert.ok(e.some((x) => re.test(x)), `${t} → ${e.join(" | ")}`);
  }
});

test("se rechazan enlaces fuera de jurmaq.cl, teléfonos, correos, datos bancarios, RUT y montos escritos a mano", () => {
  const malos = [
    "Paga en https://evil.com/pago", "Entra a evil.com", "Escríbenos por wa.me/56912345678", "Mira bit.ly/abc", "Escríbenos a ventas@gmail.com", "Llámanos al +56 9 1234 5678", "Llama al 912345678",
    "Transfiere a BancoEstado", "Cuenta corriente 42500240045", "Deposita en la cuenta RUT", "RUT 77.722.788-2", "Paga con Webpay aquí", "Te cobramos $5.000 extra", "Son 5000 pesos", "Usa el link de pago",
    "Hola‮foo", "Hola\u0000", "Hola​x",
  ];
  for (const t of malos) assert.ok(errores("pago_recibido", "saludo", t).length > 0, `debía rechazar: ${t}`);
  // jurmaq.cl se puede nombrar (es de la tienda); un dominio parecido no.
  assert.deepEqual(errores("pago_recibido", "saludo", "Más info en barraca.jurmaq.cl"), []);
  assert.ok(errores("pago_recibido", "saludo", "Más info en jurmaq.cl.evil.com").length > 0);
  assert.ok(errores("pago_recibido", "saludo", "Más info en evil-jurmaq.cl").length > 0);
  // Texto normal de Chile pasa.
  assert.deepEqual(errores("pago_recibido", "saludo", "Hola {nombre}, gracias por comprar en la barraca. Tu pedido **{numero_pedido}** va en camino."), []);
});

test("reglas por campo: largo, vacío, asunto con número de pedido, negrita, variables solo de cuerpo, una línea", () => {
  assert.ok(errores("pago_recibido", "asunto", "x".repeat(151) + " {numero_pedido}").some((e) => /máximo/.test(e)));
  assert.ok(errores("pago_recibido", "asunto", "Gracias por tu compra").some((e) => /numero_pedido/.test(e)));
  assert.ok(errores("pago_recibido", "titulo", "").some((e) => /vacío/.test(e)));
  assert.deepEqual(errores("pago_recibido", "despedida", ""), []); // opcional
  assert.ok(errores("pago_recibido", "saludo", "").some((e) => /vacío/.test(e)));
  assert.ok(errores("pago_recibido", "asunto", "**Hola** {numero_pedido}").some((e) => /negrita/.test(e)));
  assert.ok(errores("pago_recibido", "saludo", "Hola **{nombre}").some((e) => /sin cerrar/.test(e)));
  assert.ok(errores("pago_recibido", "saludo", "Hola ****").some((e) => /vacía/.test(e)));
  assert.ok(errores("pago_recibido", "asunto", "Pedido {numero_pedido}\nsegunda línea").some((e) => /una sola línea/.test(e)));
  assert.deepEqual(errores("pago_recibido", "despedida", "Gracias por preferirnos.\n\nUn abrazo."), []);
  assert.ok(errores("pago_recibido", "despedida", "a\n\n\n\nb").some((e) => /línea en blanco/.test(e)));
  assert.ok(errores("pago_recibido", "saludo", " con espacio").some((e) => /espacios/.test(e)));
  // La cuenta de la devolución solo en párrafos, nunca en asunto, título ni resumen.
  assert.ok(errores("devolucion_hecha", "asunto", "Devolución {numero_pedido} a {cuenta_devolucion}").some((e) => /no existe en este correo/.test(e)));
  assert.ok(errores("devolucion_hecha", "preheader", "A {cuenta_devolucion}").some((e) => /no existe en este correo/.test(e)));
  assert.deepEqual(errores("devolucion_hecha", "saludo", "Te transferimos {monto_devolucion} a {cuenta_devolucion}"), []);
  // Variables de otro correo no valen.
  assert.ok(errores("pago_recibido", "saludo", "Hola {monto_devolucion}").some((e) => /no existe en este correo/.test(e)));
  assert.ok(errores("pago_recibido", "saludo", 42).length > 0);
});

test("una plantilla completa: campos desconocidos, faltantes y objetos raros", () => {
  const ok = { ...defecto("pago_recibido"), saludo: "Hola {nombre}, recibimos tu pago del pedido **{numero_pedido}**." };
  assert.equal(Va.validarPlantilla("pago_recibido", ok).ok, true);
  assert.equal(Va.validarPlantilla("pago_recibido", { ...ok, extra: "x" }).ok, false);
  const { saludo, ...sinSaludo } = ok;
  assert.equal(Va.validarPlantilla("pago_recibido", sinSaludo).ok, false);
  for (const raro of [null, undefined, "texto", 5, [], [ok]]) assert.equal(Va.validarPlantilla("pago_recibido", raro).ok, false);
  assert.equal(Va.validarPlantilla("no_existe", ok).ok, false);
  assert.equal(Va.validarPlantilla("__proto__", ok).ok, false);
});

test("armado: todo se escapa, los valores no se vuelven a interpretar y no entra HTML por las variables", () => {
  const vars = { ...Re.variablesEjemplo("pago_recibido"), nombre: "<script>alert(1)</script>", total: "{nombre}", numero_pedido: "**x**" };
  const pub = { ...defecto("pago_recibido"), saludo: "Hola {nombre}, tu total {total} del pedido **{numero_pedido}**.", despedida: "Un abrazo, {nombre}" };
  const r = Re.resolverTextos("pago_recibido", pub, vars);
  assert.equal(r.origen, "publicado");
  assert.equal(r.campos.saludo, "Hola &lt;script&gt;alert(1)&lt;/script&gt;, tu total {nombre} del pedido <strong>**x**</strong>.");
  assert.ok(!/<script/i.test(r.campos.despedida));
  // En asunto: sin saltos de línea ni invisibles aunque el nombre los traiga.
  const r2 = Re.resolverTextos("pago_recibido", { ...defecto("pago_recibido"), asunto: "Hola {nombre}, pedido {numero_pedido}" }, { ...vars, nombre: "Ana\r\nBcc: x@y.z‮" });
  assert.ok(!/[\r\n‮]/.test(r2.campos.asunto), r2.campos.asunto);
});

test("respaldo: plantilla publicada dañada, con variable que ya no existe o ausente → texto exacto del código; nunca lanza", () => {
  const vars = Re.variablesEjemplo("pago_recibido");
  const base = Re.resolverTextos("pago_recibido", null, vars);
  for (const dañada of [{ ...defecto("pago_recibido"), saludo: "<b>Hola</b>" }, { ...defecto("pago_recibido"), saludo: "Hola {fecha_entrega}" }, { saludo: "x" }, "texto", 5, [], { ...defecto("pago_recibido"), asunto: "sin numero" }]) {
    const r = Re.resolverTextos("pago_recibido", dañada, vars);
    assert.equal(r.origen, "codigo");
    assert.deepEqual(r.campos, base.campos);
  }
  // Variables que faltan no rompen el armado: salen vacías.
  assert.doesNotThrow(() => Re.resolverTextos("pago_recibido", null, {}));
});

test("vista previa: datos de ejemplo, bloques fijos marcados y el borrador distinto del actual", () => {
  const t = Re.vistaPreviaTexto("pago_recibido", { ...defecto("pago_recibido"), saludo: "Hola {nombre}, ya tenemos tu pago.", despedida: "Hasta pronto." }, Re.variablesEjemplo("pago_recibido"));
  assert.match(t, /^ASUNTO: Pago recibido · pedido BJ-261120-AB12 \| Barraca JURMAQ/);
  assert.match(t, /Hola Juana, ya tenemos tu pago\./);
  assert.match(t, /\[FIJO, lo arma la tienda: Forma de pago: datos de la cuenta para transferir/);
  assert.match(t, /Hasta pronto\./);
});

// ───────── correos.ts de punta a punta: el correo de hoy no cambia ─────────
test(`con D1 vacía los ${Object.keys(golden).length} correos al cliente salen idénticos a los de antes (byte a byte)`, async () => {
  globalThis.__PLANTILLAS_PUBLICADAS__ = {};
  globalThis.__PLANTILLAS_FALLA__ = false;
  const out = await recorrerCorreos(C);
  const claves = Object.keys(golden);
  assert.equal(out.length, claves.length);
  out.forEach((c, i) => assert.equal(huella(c), golden[claves[i]], `cambió el correo ${c.caso}`));
});

test("si la lectura de D1 lanza o la plantilla publicada está dañada, los correos siguen saliendo con el texto de siempre", async () => {
  const claves = Object.keys(golden);
  globalThis.__PLANTILLAS_PUBLICADAS__ = {};
  globalThis.__PLANTILLAS_FALLA__ = true; // el lector lanza
  let out = await recorrerCorreos(C);
  out.forEach((c, i) => assert.equal(huella(c), golden[claves[i]], `falló el respaldo en ${c.caso}`));
  globalThis.__PLANTILLAS_FALLA__ = false;
  // Todas las plantillas publicadas con HTML, una variable inexistente o basura.
  globalThis.__PLANTILLAS_PUBLICADAS__ = Object.fromEntries(Pl.CLAVES_CORREO.map((k, i) => [k, i % 2 ? { ...defecto(k), saludo: "<script>x</script>" } : i % 3 ? "basura" : { ...defecto(k), titulo: "Hola {fecha_entrega}" }]));
  out = await recorrerCorreos(C);
  out.forEach((c, i) => assert.equal(huella(c), golden[claves[i]], `plantilla dañada en ${c.caso}`));
  globalThis.__PLANTILLAS_PUBLICADAS__ = {};
});

test("un texto publicado cambia SOLO esos textos: los bloques fijos (cuenta de transferencia, total, botón, Términos) salen idénticos", async () => {
  const sacar = async (clave) => {
    globalThis.__CORREOS_ENVIADOS__ = [];
    await C.correoConfirmacionComprador(PEDIDOS.transferenciaPendiente);
    return globalThis.__CORREOS_ENVIADOS__[0];
  };
  globalThis.__PLANTILLAS_PUBLICADAS__ = {};
  const antes = await sacar();
  globalThis.__PLANTILLAS_PUBLICADAS__ = { confirmacion_transferencia: {
    asunto: "Tu pedido {numero_pedido} está listo para pagar", titulo: "Gracias, {nombre}", preheader: "Pedido {numero_pedido}",
    saludo: "Hola {nombre}, anotamos tu pedido **{numero_pedido}**.", despedida: "Cualquier duda, aquí estamos." } };
  const despues = await sacar();
  assert.equal(despues.subject, "Tu pedido BJ-261120-BBBB está listo para pagar");
  assert.match(despues.html, /Hola Juana, anotamos tu pedido <strong>BJ-261120-BBBB<\/strong>\./);
  assert.match(despues.html, /<p style="margin:0 0 16px;">Cualquier duda, aquí estamos\.<\/p>\n<p style="margin:0;color:#6b7280;font-size:12px;">Esta compra/);
  // El resto del HTML es idéntico: reponiendo los textos de antes, sale el mismo correo.
  const repuesto = despues.html
    .replace("Hola Juana, anotamos tu pedido <strong>BJ-261120-BBBB</strong>.", "Hola Juana, este es el detalle de tu pedido <strong>BJ-261120-BBBB</strong>.")
    .replace('\n<p style="margin:0 0 16px;">Cualquier duda, aquí estamos.</p>', "")
    .replace("Gracias, Juana", "Recibimos tu pedido BJ-261120-BBBB")
    .replace(/Pedido BJ-261120-BBBB(?! por)/g, "Pedido BJ-261120-BBBB por $19.990");
  for (const dato of ["BancoEstado", "42500240045", "77.722.788-2", "Monto exacto", "$19.990", "Ver tu pedido", "https://barraca.jurmaq.cl/terminos", "Ya transferí"]) {
    assert.ok(antes.html.includes(dato), `el correo de hoy trae ${dato}`);
    assert.ok(despues.html.includes(dato), `el correo editado trae ${dato}`);
  }
  assert.equal(repuesto.length, antes.html.length);
  globalThis.__PLANTILLAS_PUBLICADAS__ = {};
});

test("cada correo usa su propia plantilla publicada (asunto distinto por tipo)", async () => {
  globalThis.__PLANTILLAS_PUBLICADAS__ = Object.fromEntries(Pl.CLAVES_CORREO.map((k) => [k, { ...defecto(k), asunto: `Prueba ${k} {numero_pedido}` }]));
  const out = await recorrerCorreos(C);
  const vistos = new Set(out.filter((c) => c.subject.startsWith("Prueba ")).map((c) => c.subject.split(" ")[1]));
  assert.deepEqual([...vistos].sort(), [...Pl.CLAVES_CORREO].sort());
  // Confirmación: pagado → pago_recibido, transferencia → confirmacion_transferencia, otro → confirmacion_pedido.
  const sub = (caso) => out.find((c) => c.caso === caso).subject;
  assert.match(sub("confirmacion:pagadoWebpay"), /^Prueba pago_recibido /);
  assert.match(sub("confirmacion:transferenciaPendiente"), /^Prueba confirmacion_transferencia /);
  assert.match(sub("confirmacion:webpayPendiente"), /^Prueba confirmacion_pedido /);
  globalThis.__PLANTILLAS_PUBLICADAS__ = {};
});

// ───────── lector de D1 ─────────
test("lector: devuelve lo publicado; D1 vacía, sin tablas, sin binding, lenta o que lanza → nada publicado y nunca lanza", async () => {
  const db = nuevaDb();
  const u = JORGE;
  await Rp.guardarBorrador(db, "pago_recibido", { ...defecto("pago_recibido"), saludo: "Hola {nombre}, pago listo **{numero_pedido}**." }, u, T0);
  const vacio = Lector.crearLectorCorreos({ obtenerDb: async () => db });
  assert.equal(await vacio.publicado("pago_recibido"), null); // hay borrador, nada publicado: el envío no lo usa
  await db.prepare("UPDATE correo_plantillas SET publicado = borrador, version_publicada = 1 WHERE clave = 'pago_recibido'").run();
  const lec = Lector.crearLectorCorreos({ obtenerDb: async () => db });
  assert.equal((await lec.publicado("pago_recibido")).saludo, "Hola {nombre}, pago listo **{numero_pedido}**.");
  assert.equal(await lec.publicado("rechazo_pedido"), null);
  for (const obtenerDb of [async () => null, async () => crearD1Simulada({ migraciones: false }), async () => { throw new Error("D1 caída"); }, () => new Promise(() => {})]) {
    const fallos = [];
    const l = Lector.crearLectorCorreos({ obtenerDb, timeoutMs: 30, alFallar: (m) => fallos.push(m) });
    assert.equal(await l.publicado("pago_recibido"), null);
  }
});

test("lector: tras un fallo no reintenta de inmediato (una D1 caída no agrega latencia) y conserva lo último bueno", async () => {
  const db = nuevaDb();
  let t = 1000;
  let llamadas = 0;
  let caida = false;
  await Rp.guardarBorrador(db, "pago_recibido", defecto("pago_recibido"), JORGE, T0);
  await db.prepare("UPDATE correo_plantillas SET publicado = borrador, version_publicada = 1").run();
  const lec = Lector.crearLectorCorreos({ obtenerDb: async () => { llamadas++; if (caida) throw new Error("x"); return db; }, ahora: () => t, ttlMs: 100, reintentoMs: 5000 });
  assert.ok(await lec.publicado("pago_recibido"));
  caida = true; t += 200;
  assert.ok(await lec.publicado("pago_recibido")); // falla pero devuelve lo último bueno
  const n = llamadas;
  t += 1000;
  await lec.publicado("pago_recibido");
  assert.equal(llamadas, n); // dentro de la ventana de reintento no vuelve a consultar
});

// ───────── herramientas: borrador libre, publicar con aprobación ─────────
test("las herramientas declaran bien lectura/escritura y nombres en español", () => {
  for (const h of herramientasCorreos) {
    assert.match(h.nombre, /^[a-z_]+$/);
    assert.ok(h.descripcion.length > 60);
  }
  const lectura = ["listar_plantillas_correo", "ver_plantilla_correo", "previsualizar_correo"];
  for (const h of herramientasCorreos) assert.equal(h.anotaciones.readOnlyHint, lectura.includes(h.nombre), h.nombre);
  assert.equal(TC.publicarCorreo.revertidor !== undefined && TC.editarBorradorCorreo.revertidor !== undefined && TC.restaurarCorreo.revertidor !== undefined, true);
});

test("listar y ver: sin borrador sale el texto del código; el esquema es estricto", async () => {
  const db = nuevaDb();
  const l = await usar(TC.listarPlantillasCorreo, {}, db, T0);
  for (const k of Pl.CLAVES_CORREO) assert.match(l.texto, new RegExp(`- ${k}:`));
  assert.match(l.texto, /texto original del código/);
  const v = await usar(TC.verPlantillaCorreo, { clave: "rechazo_pedido" }, db, T0);
  assert.match(v.texto, /\{nombre\}/);
  assert.match(v.texto, /lamentamos avisarte/);
  assert.equal(v.datos.borrador, null);
  await assert.rejects(usar(TC.verPlantillaCorreo, { clave: "no_existe" }, db, T0), /No existe el correo/);
  await assert.rejects(usar(TC.verPlantillaCorreo, { clave: "rechazo_pedido", version: 3 }, db, T0), /No existe la versión 3/);
  assert.equal((await usar(TC.verPlantillaCorreo, { clave: "rechazo_pedido", version: 0 }, db, T0)).datos.clave, "rechazo_pedido");
  assert.throws(() => TC.verPlantillaCorreo.esquema.strict().parse({ clave: "rechazo_pedido", otra: 1 }));
});

test("editar borrador: libre, validado, auditado y deshacible; rechaza HTML, enlaces, datos bancarios y campos inventados", async () => {
  const db = nuevaDb();
  const reg = registroMio();
  const ed = await usar(TC.editarBorradorCorreo, { clave: "pago_recibido", campos: { saludo: "Hola {nombre}, ya tenemos tu pago del pedido **{numero_pedido}**.", despedida: "Gracias por comprar con nosotros." } }, db, T0);
  assert.match(ed.texto, /NO se envía|Todavía NO/);
  assert.equal(ed.datos.publicado, false);
  const est = await Rp.estadoCorreo(db, "pago_recibido");
  assert.equal(est.borrador.despedida, "Gracias por comprar con nosotros.");
  assert.equal(est.origen, "codigo"); // la tienda sigue igual
  assert.equal(est.borradorSinPublicar, true);
  assert.equal((await obtenerLote(db, ed.ctx.loteId))[0].herramienta, "editar_borrador_correo");
  for (const campos of [
    { saludo: "<b>Hola</b>" }, { saludo: "Paga en https://evil.com" }, { saludo: "Deposita en BancoEstado cuenta 42500240045" }, { saludo: "Hola {fecha_entrega}" },
    { asunto: "Sin número de pedido" }, { inventado: "x" }, { saludo: "Te cobramos $9.990 más" },
  ]) await assert.rejects(usar(TC.editarBorradorCorreo, { clave: "pago_recibido", campos }, db, T0 + 1), /No guardé el borrador|no existe en este correo/, JSON.stringify(campos));
  assert.equal((await Rp.estadoCorreo(db, "pago_recibido")).borrador.despedida, "Gracias por comprar con nosotros.");
  // Deshacer vuelve a "sin borrador" y no pisa cambios ajenos.
  const ed2 = await usar(TC.editarBorradorCorreo, { clave: "pago_recibido", campos: { despedida: "Otra despedida" } }, db, T0 + 5);
  const d2 = await deshacerLote(db, reg, ed2.ctx.loteId, JORGE, T0 + 6);
  assert.equal(d2.ok, true);
  assert.equal((await Rp.estadoCorreo(db, "pago_recibido")).borrador.despedida, "Gracias por comprar con nosotros.");
  const d1 = await deshacerLote(db, reg, ed.ctx.loteId, JORGE, T0 + 7);
  assert.equal(d1.ok, true);
  assert.equal((await Rp.estadoCorreo(db, "pago_recibido")).borrador, null);
  // Si alguien editó después, no se pisa.
  const ed3 = await usar(TC.editarBorradorCorreo, { clave: "pago_recibido", campos: { despedida: "Una" } }, db, T0 + 10);
  await Rp.guardarBorrador(db, "pago_recibido", { ...defecto("pago_recibido"), despedida: "De otra persona" }, OTRO, T0 + 11);
  const dx = await deshacerLote(db, reg, ed3.ctx.loteId, JORGE, T0 + 12);
  assert.equal(dx.ok, false);
  assert.equal((await Rp.estadoCorreo(db, "pago_recibido")).borrador.despedida, "De otra persona");
});

test("previsualizar: borrador, publicado y código; sin borrador lo pide", async () => {
  const db = nuevaDb();
  await assert.rejects(usar(TC.previsualizarCorreo, { clave: "pago_recibido", fuente: "borrador" }, db, T0), /No hay borrador/);
  const hoy = await usar(TC.previsualizarCorreo, { clave: "pago_recibido" }, db, T0);
  assert.match(hoy.texto, /ASUNTO: Pago recibido/);
  await usar(TC.editarBorradorCorreo, { clave: "pago_recibido", campos: { despedida: "Hasta pronto." } }, db, T0);
  const p = await usar(TC.previsualizarCorreo, { clave: "pago_recibido" }, db, T0 + 1);
  assert.match(p.texto, /BORRADOR/);
  assert.match(p.texto, /Hasta pronto\./);
  const c = await usar(TC.previsualizarCorreo, { clave: "pago_recibido", fuente: "codigo" }, db, T0 + 1);
  assert.match(c.texto, /sin despedida/);
});

async function conBorrador(T, extra = {}) {
  const db = nuevaDb();
  await usar(TC.editarBorradorCorreo, { clave: "pago_recibido", campos: { saludo: "Hola {nombre}, tu pago del pedido **{numero_pedido}** está confirmado.", despedida: "Gracias por preferirnos.", ...extra } }, db, T0);
  return db;
}

test("publicar: dos pasos, SIEMPRE pide el OK de Jorge, no publica hasta que aprueba, se aplica una sola vez", async () => {
  const T = crearTienda([]);
  fijarDepsGestion(T.deps);
  try {
    const db = await conBorrador(T);
    const p1 = await usar(TC.publicarCorreo, { clave: "pago_recibido" }, db, T0 + 1);
    assert.ok(p1.datos.vista_previa_id);
    assert.match(p1.texto, /ningún correo se envía ahora/);
    assert.equal(T.correos.length, 0); // el paso 1 no pide nada todavía
    const id = p1.datos.vista_previa_id;
    // Paso 2: pide el OK; NO publica.
    const p2 = await usar(TC.publicarCorreo, { clave: "pago_recibido", vista_previa_id: id }, db, T0 + 2);
    assert.equal(p2.datos.publicado, false);
    assert.equal(p2.datos.estado, "pendiente");
    assert.equal(T.correos.length, 1);
    assert.deepEqual(T.correos[0].motivos, ["correo_cliente"]);
    assert.match(T.correos[0].resumen, /Pago recibido/);
    assert.match(T.correos[0].resumen, /Hola Juana, tu pago del pedido BJ-261120-AB12 está confirmado\./); // vista previa en el correo de aprobación
    assert.equal((await Rp.estadoCorreo(db, "pago_recibido")).origen, "codigo");
    // Repetir antes de que apruebe: sigue pendiente y no manda otro correo.
    const p3 = await usar(TC.publicarCorreo, { clave: "pago_recibido", vista_previa_id: id }, db, T0 + 3);
    assert.equal(p3.datos.publicado, false);
    assert.equal(T.correos.length, 1);
    // Jorge aprueba y se repite la misma llamada: se publica.
    assert.equal((await aprobarUltimoCorreo(db, T.correos, resolverAprobacion)).ok, true);
    const p4 = await usar(TC.publicarCorreo, { clave: "pago_recibido", vista_previa_id: id, nota: "Texto más cercano" }, db, T0 + 4);
    assert.equal(p4.datos.publicado, true);
    assert.equal(p4.datos.version, 1);
    const est = await Rp.estadoCorreo(db, "pago_recibido");
    assert.equal(est.origen, "d1");
    assert.equal(est.versionPublicada, 1);
    assert.equal(est.efectivo.despedida, "Gracias por preferirnos.");
    assert.equal((await obtenerLote(db, p4.ctx.loteId))[0].entidad, "correo");
    // Un solo uso: ni la vista previa ni la aprobación sirven otra vez.
    await assert.rejects(usar(TC.publicarCorreo, { clave: "pago_recibido", vista_previa_id: id }, db, T0 + 5), /sin cambios|ya se aplicó|nada que publicar/);
    // El detalle que ve Jorge trae el correo completo con los bloques fijos marcados.
    const ap = await db.prepare("SELECT detalle FROM aprobaciones").first();
    assert.match(ap.detalle, /textoCompleto/);
    assert.match(ap.detalle, /FIJO, lo arma la tienda/);
  } finally {
    fijarDepsGestion(null);
  }
});

test("publicar sin el correo del aprobador (o igual al de quien pide) queda BLOQUEADO y no publica nada", async () => {
  for (const aprobadorEmail of ["", null, "no-es-un-correo", "contacto@jurmaq.cl"]) {
    const T = crearTienda([], { aprobadorEmail });
    fijarDepsGestion(T.deps);
    try {
      const db = await conBorrador(T);
      const id = (await usar(TC.publicarCorreo, { clave: "pago_recibido" }, db, T0 + 1)).datos.vista_previa_id;
      const r = await usar(TC.publicarCorreo, { clave: "pago_recibido", vista_previa_id: id }, db, T0 + 2);
      assert.equal(r.datos.publicado, false, String(aprobadorEmail));
      assert.equal(r.datos.estado, "bloqueada");
      assert.equal(T.correos.length, 0);
      assert.equal((await Rp.estadoCorreo(db, "pago_recibido")).origen, "codigo");
    } finally {
      fijarDepsGestion(null);
    }
  }
});

test("publicar: si cambia el borrador o lo publicado entre medio, la vista previa y la aprobación dejan de servir", async () => {
  const T = crearTienda([]);
  fijarDepsGestion(T.deps);
  try {
    const db = await conBorrador(T);
    const id = (await usar(TC.publicarCorreo, { clave: "pago_recibido" }, db, T0 + 1)).datos.vista_previa_id;
    await usar(TC.publicarCorreo, { clave: "pago_recibido", vista_previa_id: id }, db, T0 + 2);
    await aprobarUltimoCorreo(db, T.correos, resolverAprobacion);
    // Alguien cambia el borrador DESPUÉS de aprobar: no se publica lo que Jorge no vio.
    await usar(TC.editarBorradorCorreo, { clave: "pago_recibido", campos: { despedida: "Texto que Jorge no vio" } }, db, T0 + 3);
    await assert.rejects(usar(TC.publicarCorreo, { clave: "pago_recibido", vista_previa_id: id }, db, T0 + 4), /cambiaron|Genera una nueva/);
    assert.equal((await Rp.estadoCorreo(db, "pago_recibido")).origen, "codigo");
    // La vista previa de otro usuario, de otro correo o inventada no sirve.
    const id2 = (await usar(TC.publicarCorreo, { clave: "pago_recibido" }, db, T0 + 5)).datos.vista_previa_id;
    await assert.rejects(usar(TC.publicarCorreo, { clave: "pago_recibido", vista_previa_id: id2 }, db, T0 + 6, OTRO), /No encontré esa vista previa/);
    await assert.rejects(usar(TC.publicarCorreo, { clave: "pago_recibido", vista_previa_id: "AAAAAAAAAAAA" }, db, T0 + 6), /No encontré esa vista previa/);
    await usar(TC.editarBorradorCorreo, { clave: "rechazo_pedido", campos: { despedida: "Hasta pronto." } }, db, T0 + 7);
    await assert.rejects(usar(TC.publicarCorreo, { clave: "rechazo_pedido", vista_previa_id: id2 }, db, T0 + 8), /otro correo/);
    // Sin borrador o sin cambios no hay nada que publicar.
    await assert.rejects(usar(TC.publicarCorreo, { clave: "pedir_opinion" }, db, T0 + 9), /No hay borrador/);
    await Rp.guardarBorrador(db, "devolucion_hecha", defecto("devolucion_hecha"), JORGE, T0 + 9);
    await assert.rejects(usar(TC.publicarCorreo, { clave: "devolucion_hecha" }, db, T0 + 10), /igual a lo que sale hoy/);
  } finally {
    fijarDepsGestion(null);
  }
});

test("el repositorio no publica sin el id de una aprobación ni si el borrador no es el que se aprobó", async () => {
  const db = nuevaDb();
  await Rp.guardarBorrador(db, "pago_recibido", { ...defecto("pago_recibido"), despedida: "Hola" }, JORGE, T0);
  const est = await Rp.estadoCorreo(db, "pago_recibido");
  await assert.rejects(Rp.publicarBorrador(db, { clave: "pago_recibido", usuario: JORGE, aprobacionId: "", esperado: { borrador: est.borrador, versionPublicada: 0 } }), /aprobación de Jorge/);
  const r = await Rp.publicarBorrador(db, { clave: "pago_recibido", usuario: JORGE, aprobacionId: "ap1", esperado: { borrador: { ...est.borrador, despedida: "Otra" }, versionPublicada: 0 } });
  assert.deepEqual([r.ok, r.motivo], [false, "conflicto"]);
  assert.equal((await Rp.estadoCorreo(db, "pago_recibido")).origen, "codigo");
  const ok = await Rp.publicarBorrador(db, { clave: "pago_recibido", usuario: JORGE, aprobacionId: "ap1", esperado: { borrador: est.borrador, versionPublicada: 0 } });
  assert.equal(ok.ok, true);
  const otra = await Rp.publicarBorrador(db, { clave: "pago_recibido", usuario: JORGE, aprobacionId: "ap2", esperado: { borrador: est.borrador, versionPublicada: 0 } });
  assert.equal(otra.ok, false); // ya no coincide la versión vigente
});

test("historial, restaurar (siempre a borrador) y deshacer una publicación sin pisar publicaciones posteriores", async () => {
  const T = crearTienda([]);
  fijarDepsGestion(T.deps);
  try {
    const db = nuevaDb();
    const reg = registroMio();
    let t = T0;
    const publicar = async (campos) => {
      await usar(TC.editarBorradorCorreo, { clave: "pago_recibido", campos }, db, ++t);
      const id = (await usar(TC.publicarCorreo, { clave: "pago_recibido" }, db, ++t)).datos.vista_previa_id;
      await usar(TC.publicarCorreo, { clave: "pago_recibido", vista_previa_id: id }, db, ++t);
      await aprobarUltimoCorreo(db, T.correos, resolverAprobacion);
      return usar(TC.publicarCorreo, { clave: "pago_recibido", vista_previa_id: id }, db, ++t);
    };
    const v1 = await publicar({ despedida: "Primera despedida" });
    const v2 = await publicar({ despedida: "Segunda despedida" });
    assert.deepEqual([v1.datos.version, v2.datos.version], [1, 2]);
    const hist = await usar(TC.verPlantillaCorreo, { clave: "pago_recibido" }, db, ++t);
    assert.match(hist.texto, /v2 \(vigente\), v1/);
    assert.match((await usar(TC.verPlantillaCorreo, { clave: "pago_recibido", version: 1 }, db, ++t)).texto, /Primera despedida/);
    // Restaurar NO cambia lo que sale: copia al borrador.
    const rest = await usar(TC.restaurarCorreo, { clave: "pago_recibido", version: 1 }, db, ++t);
    assert.equal(rest.datos.publicado, false);
    assert.equal((await Rp.estadoCorreo(db, "pago_recibido")).efectivo.despedida, "Segunda despedida");
    assert.equal((await Rp.estadoCorreo(db, "pago_recibido")).borrador.despedida, "Primera despedida");
    await assert.rejects(usar(TC.restaurarCorreo, { clave: "pago_recibido", version: 9 }, db, ++t), /No existe la versión 9/);
    const r0 = await usar(TC.restaurarCorreo, { clave: "pago_recibido", version: 0 }, db, ++t);
    assert.equal((await Rp.estadoCorreo(db, "pago_recibido")).borrador.despedida, "");
    assert.match(r0.texto, /texto original del código/);
    // Deshacer la v1 sin pisar la v2: se rechaza y la v2 sigue vigente.
    const noPisa = await deshacerLote(db, reg, v1.ctx.loteId, JORGE, ++t);
    assert.equal(noPisa.ok, false);
    assert.equal((await Rp.estadoCorreo(db, "pago_recibido")).versionPublicada, 2);
    // Deshacer la v2 vuelve a la v1 (ya aprobada), sin borrar el historial; luego la v1 vuelve al código.
    const d2 = await deshacerLote(db, reg, v2.ctx.loteId, JORGE, ++t);
    assert.equal(d2.ok, true);
    let est = await Rp.estadoCorreo(db, "pago_recibido");
    assert.equal(est.versionPublicada, 1);
    assert.equal(est.efectivo.despedida, "Primera despedida");
    assert.equal((await Rp.listarVersiones(db, "pago_recibido")).length, 2);
    assert.equal((await deshacerLote(db, reg, v2.ctx.loteId, JORGE, ++t)).motivo, "ya_deshecho");
    const d1 = await deshacerLote(db, reg, v1.ctx.loteId, JORGE, ++t);
    assert.equal(d1.ok, true);
    est = await Rp.estadoCorreo(db, "pago_recibido");
    assert.equal(est.origen, "codigo");
    assert.equal(est.efectivo.despedida, "");
    // Volver a publicar después de deshacer usa un número nuevo (nunca reutiliza una versión).
    const v3 = await publicar({ despedida: "Tercera" });
    assert.equal(v3.datos.version, 3);
  } finally {
    fijarDepsGestion(null);
  }
});

test("lo publicado por la herramienta lo ve el envío (lector real sobre la misma D1) y sale en el correo", async () => {
  const T = crearTienda([]);
  fijarDepsGestion(T.deps);
  try {
    const db = await conBorrador(T);
    const id = (await usar(TC.publicarCorreo, { clave: "pago_recibido" }, db, T0 + 1)).datos.vista_previa_id;
    const lec = Lector.crearLectorCorreos({ obtenerDb: async () => db, ttlMs: 0 });
    assert.equal(await lec.publicado("pago_recibido"), null); // todavía no
    await usar(TC.publicarCorreo, { clave: "pago_recibido", vista_previa_id: id }, db, T0 + 2);
    await aprobarUltimoCorreo(db, T.correos, resolverAprobacion);
    await usar(TC.publicarCorreo, { clave: "pago_recibido", vista_previa_id: id }, db, T0 + 3);
    const publicado = await lec.publicado("pago_recibido");
    const r = Re.resolverTextos("pago_recibido", publicado, Re.variablesEjemplo("pago_recibido"));
    assert.equal(r.origen, "publicado");
    assert.equal(r.campos.despedida, "Gracias por preferirnos.");
    assert.match(r.campos.saludo, /está confirmado\.$/);
  } finally {
    fijarDepsGestion(null);
  }
});

test("el módulo de correos y su herramienta no envían correos (solo texto)", () => {
  for (const ruta of ["../src/lib/mcp/tools/correos.ts", "../src/lib/correos-cliente/repositorio.ts", "../src/lib/correos-cliente/render.ts", "../src/lib/correos-cliente/validar.ts", "../src/lib/correos-cliente/plantillas.ts"]) {
    const src = readFileSync(new URL(ruta, import.meta.url), "utf8");
    assert.ok(!/transporter|sendMail|resend|@jurmaq\/shared\/mail\/(email|transport)/i.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), `${ruta} no debe enviar correos`);
  }
});
