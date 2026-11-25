// Pruebas del contenido editable: saneamiento, vigencias, horario, versiones y
// restaurar, aprobación pendiente, respaldo con D1 caída/vacía, imágenes (tipo
// real y SSRF) y orden de la portada.
// Correr: node --test scripts/contenido.test.mjs   (Node 22.15+; D1 simulada con node:sqlite)
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";

const T = await import("../src/lib/contenido/tipos.ts");
const M = await import("../src/lib/contenido/markdown.ts");
const F = await import("../src/lib/contenido/fechas.ts");
const H = await import("../src/lib/contenido/horario.ts");
const E = await import("../src/lib/contenido/esquemas.ts");
const R = await import("../src/lib/contenido/respaldo.ts");
const Repo = await import("../src/lib/contenido/repositorio.ts");
const L = await import("../src/lib/contenido/lector.ts");
const D = await import("../src/lib/contenido/derivados.ts");
const P = await import("../src/lib/contenido/publico.ts");
const I = await import("../src/lib/contenido/imagenes.ts");
const Ref = await import("../src/lib/contenido/referencias.ts");
const Marc = await import("../src/lib/contenido/marcadores.ts");
const { HORARIO_BARRACA, LEGAL_INFO, HQ } = await import("@jurmaq/shared/seo");
const { buildJsonLdGraph } = await import("@jurmaq/shared/seo/jsonld");
const { FIN_AVISO_MS } = await import("../src/lib/aviso-promo.ts");
const W = await import("../src/lib/contenido/whatsapp.ts");
const AP = await import("../src/lib/aviso-promo.ts");
const { whatsappCtaBarracaCotizar, whatsappCtaBarracaCiudad } = await import("@jurmaq/shared/whatsapp");
const LR = await import("../src/lib/contenido/local-respaldo.ts");
const { TERMINOS_MD, PRIVACIDAD_MD } = await import("../src/lib/contenido/legal-embebido.ts");

const ANA = { id: "u-ana", email: "ana@example.com" };
const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const U = String.fromCharCode; // para caracteres Unicode sin escribirlos

// ───────── Saneamiento ─────────

test("saneamiento: HTML y scripts se descartan", () => {
  const ataques = [
    "<script>alert(1)</script>Hola",
    "<SCRIPT SRC=https://evil.example/x.js></SCRIPT>Hola",
    "<img src=x onerror=alert(1)>Hola",
    "<img src=x onerror=alert(1)",
    "<svg/onload=alert(1)>Hola",
    "<svg><script>alert(1)</script></svg>Hola",
    "<iframe src='javascript:alert(1)'></iframe>Hola",
    "<scr<script>ipt>alert(1)</scr</script>ipt>Hola",
    "<a href=\"javascript:alert(1)\">Hola</a>",
    "<!-- <script>alert(1)</script> -->Hola",
    "<style>body{display:none}</style>Hola",
    "<object data=x></object><embed src=x>Hola",
    "<body onload=alert(1)>Hola",
    "<math><mi//xlink:href=\"data:x,<script>alert(1)</script>\">Hola",
  ];
  for (const a of ataques) {
    const { texto } = M.sanearMarkdown(a);
    assert.doesNotMatch(texto, /<\s*\/?\s*(script|img|svg|iframe|a|style|object|embed|body|math|mi)\b/i, a);
    assert.doesNotMatch(texto, /onerror|onload|alert\(1\)|display:none/i, a);
    assert.equal(M.sanearMarkdown(texto).texto, texto, `idempotente: ${a}`);
  }
  assert.match(M.sanearMarkdown("<b>negrita</b> y **negrita**").texto, /^negrita y \*\*negrita\*\*$/);
});

test("saneamiento: enlaces solo https o rutas internas", () => {
  const malos = [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "&#106;avascript:alert(1)",
    "jav&#x61;script:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
    "http://example.com",
    "//evil.example/x",
    "/\\evil.example",
    "mailto:a@b.cl",
    "tel:+56912345678",
    "file:///etc/passwd",
    "https://user:pass@example.com/",
    "https://exa mple.com",
    "ftp://x.cl",
    "",
  ];
  for (const m of malos) {
    const r = M.sanearMarkdown(`[clic aquí](${m})`).texto;
    assert.equal(r, "clic aquí", `debe quedar solo el texto: ${m}`);
    assert.equal(M.enlaceSeguro(m), null, m);
  }
  assert.equal(M.sanearMarkdown("[Términos](/terminos#5-precios)").texto, "[Términos](/terminos#5-precios)");
  assert.equal(M.sanearMarkdown("[JURMAQ](https://barraca.jurmaq.cl/contacto)").texto, "[JURMAQ](https://barraca.jurmaq.cl/contacto)");
  assert.equal(M.sanearMarkdown("[ancla](#horario)").texto, "[ancla](#horario)");
  // Con título entre comillas se queda con la url.
  assert.equal(M.sanearMarkdown('[x](https://a.cl "titulo")').texto, "[x](https://a.cl)");
  // Autoenlace y definición de referencia.
  assert.doesNotMatch(M.sanearMarkdown("<javascript:alert(1)> y <https://a.cl>").texto, /[<>]/);
  assert.doesNotMatch(M.sanearMarkdown("[x]: javascript:alert(1)\n\n[x][x]").texto, /javascript:/);
});

test("saneamiento: imágenes markdown se descartan; caracteres de control y bidi se limpian; tope de tamaño", () => {
  assert.equal(M.sanearMarkdown("![logo](https://evil.example/x.png)").texto, "logo");
  const sucio = `a${U(0)}b${U(0x202e)}c${U(0x200b)}d${U(0xfeff)}e${U(7)}f`;
  assert.equal(M.sanearMarkdown(sucio).texto, "abcdef");
  const largo = M.sanearMarkdown("x".repeat(300_000));
  assert.equal(largo.truncado, true);
  assert.ok(largo.texto.length <= M.MAX_CHARS_DOCUMENTO);
  assert.equal(M.sanearTextoPlano("  <b>Hola</b>\n  mundo  ", 50), "Hola mundo");
  assert.equal(M.sanearTextoPlano("x".repeat(500), 20).length, 20);
});

test("saneamiento: los textos legales del respaldo pasan sin cambios", () => {
  for (const [n, md] of [["terminos", TERMINOS_MD], ["privacidad", PRIVACIDAD_MD]]) {
    const r = M.sanearMarkdown(md);
    assert.equal(r.truncado, false, n);
    assert.equal(r.texto, md.trim().replace(/[ \t]+$/gm, "").replace(/\n{4,}/g, "\n\n\n"), `${n} cambió al sanear`);
  }
});

test("imágenes de campos: solo nuestro dominio o el bucket", () => {
  const ok = [
    "/images/barraca/hero/local-fachada.webp",
    "/aviso-bodega-perfiles.webp",
    "https://barraca.jurmaq.cl/images/x.jpg",
    "https://wmoizhbdalvnveclenvf.supabase.co/storage/v1/object/public/barraca-redes/tienda/2026-11/abc.png",
  ];
  const mal = [
    "https://evil.example/x.png",
    "https://barraca.jurmaq.cl.evil.example/x.png",
    "http://barraca.jurmaq.cl/x.png",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "/images/x.svg",
    "/images/x.php",
    "//evil.example/x.png",
    "https://wmoizhbdalvnveclenvf.supabase.co/storage/v1/object/public/otro-bucket/tienda/x.png",
    "https://wmoizhbdalvnveclenvf.supabase.co/storage/v1/object/public/barraca-redes/fotos/x.png",
    "https://wmoizhbdalvnveclenvf.supabase.co/storage/v1/object/public/barraca-redes/tienda/../x.png",
    "https://otro.supabase.co/storage/v1/object/public/barraca-redes/tienda/x.png",
  ];
  for (const u of ok) assert.equal(M.esUrlImagenPermitida(u), true, u);
  for (const u of mal) assert.equal(M.esUrlImagenPermitida(u), false, u);
});

// ───────── Fechas y vigencias ─────────

test("fechas: hora de Chile con horario de verano e invierno", () => {
  // Verano (UTC-3): 02-12-2026 00:00 Chile = 03:00 UTC (igual que FIN_AVISO_MS del popup actual).
  assert.equal(F.parseFecha("2026-12-02T00:00"), Date.parse("2026-12-02T03:00:00Z"));
  assert.equal(F.parseFecha("2026-12-02T00:00"), FIN_AVISO_MS);
  assert.equal(F.parseFecha("2026-12-02 00:00"), FIN_AVISO_MS);
  // Invierno (UTC-4).
  assert.equal(F.parseFecha("2026-07-10T09:30"), Date.parse("2026-07-10T13:30:00Z"));
  // Solo fecha: medianoche de Chile.
  assert.equal(F.parseFecha("2026-12-24"), Date.parse("2026-12-24T03:00:00Z"));
  // Con zona explícita.
  assert.equal(F.parseFecha("2026-12-02T00:00:00-03:00"), FIN_AVISO_MS);
  assert.equal(F.parseFecha("2026-12-02T03:00:00Z"), FIN_AVISO_MS);
  for (const malo of ["", "mañana", "2026-13-01", "2026-02-30", "2026-12-02T25:00", "02-12-2026", 5, null]) {
    assert.equal(F.parseFecha(malo), null, String(malo));
  }
});

test("vigencias: desde inclusivo, hasta exclusivo, sin fechas siempre, fecha ilegible no se muestra", () => {
  const v = { desde: "2026-12-24T00:00", hasta: "2026-12-26T00:00" };
  const desde = F.parseFecha(v.desde);
  const hasta = F.parseFecha(v.hasta);
  assert.equal(F.vigenteEn(v, desde - 1), false);
  assert.equal(F.vigenteEn(v, desde), true);
  assert.equal(F.vigenteEn(v, hasta - 1), true);
  assert.equal(F.vigenteEn(v, hasta), false);
  assert.equal(F.vigenteEn({ desde: null, hasta: null }, T0), true);
  assert.equal(F.vigenteEn({ desde: null, hasta: "2026-01-01" }, T0), false);
  assert.equal(F.vigenteEn({ desde: "basura", hasta: null }, T0), false);
  assert.deepEqual(F.validarVigencia({ desde: "2026-12-26", hasta: "2026-12-24" }, "x").length, 1);
  assert.deepEqual(F.validarVigencia({ desde: null, hasta: null }, "x"), []);
});

test("avisos y cinta: filtrados por vigencia, lugar y severidad al momento de pedir", () => {
  const base = { activo: true, tipo: "cierre", severidad: "aviso", titulo: "t", texto: "", donde: ["tienda", "carrito", "checkout"] };
  const avisos = [
    { ...base, id: "feriado", desde: "2026-12-24T00:00", hasta: "2026-12-26T00:00", severidad: "alerta" },
    { ...base, id: "siempre", desde: null, hasta: null, severidad: "info" },
    { ...base, id: "apagado", activo: false, desde: null, hasta: null },
    { ...base, id: "solo-checkout", desde: null, hasta: null, donde: ["checkout"], severidad: "aviso" },
    { ...base, id: "vencido", desde: null, hasta: "2026-11-01T00:00" },
  ];
  const antes = Date.parse("2026-12-20T12:00:00Z");
  const durante = Date.parse("2026-12-24T15:00:00Z");
  assert.deepEqual(P.avisosVigentes(avisos, antes).map((a) => a.id), ["solo-checkout", "siempre"]);
  assert.deepEqual(P.avisosVigentes(avisos, durante).map((a) => a.id), ["feriado", "solo-checkout", "siempre"]);
  assert.deepEqual(P.avisosVigentes(avisos, durante, "tienda").map((a) => a.id), ["feriado", "siempre"]);
  assert.deepEqual(P.avisosVigentes(avisos, durante, "checkout").map((a) => a.id), ["feriado", "solo-checkout", "siempre"]);
  const cinta = { activa: true, texto: "Cerrado el 25", enlace: null, desde: "2026-12-24T00:00", hasta: "2026-12-26T00:00" };
  assert.equal(P.cintaVigente(cinta, antes), null);
  assert.equal(P.cintaVigente(cinta, durante)?.texto, "Cerrado el 25");
  assert.equal(P.cintaVigente({ ...cinta, activa: false }, durante), null);
  assert.equal(P.cintaVigente({ ...cinta, texto: "" }, durante), null);
});

test("láminas: solo activas y dentro de su vigencia", () => {
  const base = R.respaldoDe("slides")[0];
  const lista = [
    { ...base, id: "a" },
    { ...base, id: "apagada", activa: false },
    { ...base, id: "futura", desde: "2026-12-24T00:00" },
    { ...base, id: "vencida", hasta: "2026-11-01T00:00" },
    { ...base, id: "navidad", desde: "2026-12-24T00:00", hasta: "2026-12-26T00:00" },
  ];
  assert.deepEqual(P.slidesVigentes(lista, Date.parse("2026-11-25T12:00:00Z")).map((s) => s.id), ["a"]);
  assert.deepEqual(P.slidesVigentes(lista, Date.parse("2026-12-25T12:00:00Z")).map((s) => s.id), ["a", "futura", "navidad"]);
});

test("popup público: respaldo vigente hasta el 02-12-2026 00:00 de Chile, y no después", () => {
  const pop = R.respaldoDe("popup");
  const p = P.popupPublico(pop);
  assert.equal(p.hastaMs, FIN_AVISO_MS);
  assert.equal(P.popupVigente(p, FIN_AVISO_MS - 1), true);
  assert.equal(P.popupVigente(p, FIN_AVISO_MS), false);
  const pub = P.armarPublico({ popup: pop, cinta: R.respaldoDe("cinta"), avisos: [] }, FIN_AVISO_MS + 1);
  assert.equal(pub.popup, null);
  assert.equal(P.armarPublico({ popup: { ...pop, activo: false }, cinta: R.respaldoDe("cinta"), avisos: [] }, T0).popup, null);
});

// ───────── Horario y datos del local ─────────

test("horario: el respaldo reproduce EXACTO HORARIO_BARRACA (texto y schema.org)", () => {
  const h = H.armarHorario(R.respaldoDe("datos_local").horario);
  assert.equal(h.texto, HORARIO_BARRACA.texto);
  assert.equal(h.semana, HORARIO_BARRACA.semana);
  assert.equal(h.sabado, HORARIO_BARRACA.sabado);
  assert.equal(h.domingo, HORARIO_BARRACA.domingo);
  assert.deepEqual(h.openingHoursSpecification, HORARIO_BARRACA.openingHoursSpecification);
  assert.deepEqual(H.erroresHorario(R.respaldoDe("datos_local").horario), []);
});

test("horario: cambios generan texto y schema coherentes; errores de formato se detectan", () => {
  const d = R.respaldoDe("datos_local");
  const h = structuredClone(d.horario);
  h.viernes = [{ abre: "08:30", cierra: "13:00" }]; // viernes sin tarde
  h.domingo = [{ abre: "10:00", cierra: "13:00" }];
  const t = H.armarHorario(h);
  assert.equal(t.lineas[0], "Lunes a jueves 8:30–13:00 y 14:30–18:00");
  assert.equal(t.lineas[1], "Viernes 8:30–13:00");
  assert.equal(t.domingo, "Domingo 10:00–13:00");
  assert.equal(t.openingHoursSpecification.at(-1).dayOfWeek[0], "Sunday");
  const malo = structuredClone(d.horario);
  malo.lunes = [{ abre: "18:00", cierra: "08:00" }];
  malo.martes = [{ abre: "8:30", cierra: "13:00" }];
  malo.miercoles = [{ abre: "08:00", cierra: "12:00" }, { abre: "11:00", cierra: "13:00" }];
  assert.equal(H.erroresHorario(malo).length, 3);
});

test("datos del local: validan, y el respaldo coincide con las constantes compartidas", () => {
  const d = R.respaldoDe("datos_local");
  const b = LEGAL_INFO.brands.barraca;
  assert.equal(d.telefono, HQ.telefono);
  assert.equal(d.telefonoDisplay, b.telefonoDisplay);
  assert.equal(d.direccion, b.direccion);
  assert.equal(`https://wa.me/${d.whatsapp}`, HQ.whatsapp);
  assert.equal(E.validarContenido("datos_local", d).ok, true);
  for (const campo of [{ telefono: "976673577" }, { whatsapp: "abc" }, { email: "no-es-correo" }, { instagram: "https://evil.example/x" }, { rut: "123" }]) {
    assert.equal(E.validarContenido("datos_local", { ...d, ...campo }).ok, false, JSON.stringify(campo));
  }
  assert.equal(E.validarContenido("datos_local", { ...d, extra: 1 }).ok, false);
  const v = D.vistaLocal(d);
  assert.equal(v.whatsappUrl, HQ.whatsapp);
  assert.equal(v.telUrl, "tel:+56976673577");
  assert.equal(v.direccionCorta, "Av. Poniente 2157, Molina");
  assert.match(v.mapaUrl, /query=Av\.%20Poniente%202157%2C%20Molina%2C%20Chile$/);
});

test("schema.org: aplicar datos del local reemplaza teléfono, dirección, horario y geo; con el respaldo no cambia nada", () => {
  const grafo = buildJsonLdGraph("barraca", { areaServed: ["Molina"] });
  const igual = D.aplicarDatosAJsonLd(grafo, R.respaldoDe("datos_local"));
  assert.deepEqual(JSON.parse(JSON.stringify(igual)), JSON.parse(JSON.stringify(grafo)));
  const nuevo = { ...R.respaldoDe("datos_local"), telefono: "+56911112222", email: "otro@jurmaq.cl", comuna: "Curicó" };
  nuevo.horario = { ...nuevo.horario, sabado: [] };
  const g = D.aplicarDatosAJsonLd(grafo, nuevo);
  const lb = g["@graph"].find((n) => n["@type"] === "HardwareStore");
  assert.equal(lb.telephone, "+56911112222");
  assert.equal(lb.address.addressLocality, "Curicó");
  assert.ok(!lb.openingHoursSpecification.some((s) => s.dayOfWeek.includes("Saturday")));
  assert.equal(g["@graph"].find((n) => n["@type"] === "Organization").email, "otro@jurmaq.cl");
});

test("marcadores: se sustituyen con los datos del local; los desconocidos no pasan la validación", () => {
  const v = Marc.valoresDeMarcadores(R.respaldoDe("datos_local"), { lugaresDespacho: "A y B" });
  const md = Marc.sustituirMarcadores("RUT {{rut}} en {{direccion_corta}} a {{lugares_despacho}}\n{{tarifas}}", v);
  assert.equal(md, "RUT 77.722.788-2 en Av. Poniente 2157, Molina a A y B\n{{tarifas}}");
  assert.equal(E.validarContenido("nosotros", { texto: "x".repeat(150) + " {{inventado}}" }).ok, false);
  assert.equal(E.validarContenido("nosotros", R.respaldoDe("nosotros")).ok, true);
});

// ───────── Esquemas ─────────

test("todos los respaldos en código son válidos y estables al validar", () => {
  for (const clave of T.CLAVES_CONTENIDO) {
    const r = E.validarContenido(clave, R.respaldoDe(clave));
    assert.equal(r.ok, true, `${clave}: ${r.ok ? "" : r.errores.join(" | ")}`);
    assert.deepEqual(r.valor, R.respaldoDe(clave), `${clave} cambia al validar`);
  }
});

test("esquemas: popup, slides, cinta, avisos y portada rechazan datos peligrosos o incompletos", () => {
  const popup = R.respaldoDe("popup");
  assert.equal(E.validarContenido("popup", { ...popup, imagen: "https://evil.example/x.png" }).ok, false);
  assert.equal(E.validarContenido("popup", { ...popup, botonPrincipal: { texto: "Ir", enlace: "javascript:alert(1)" } }).ok, false);
  assert.equal(E.validarContenido("popup", { ...popup, cadaDias: 0 }).ok, false);
  assert.equal(E.validarContenido("popup", { ...popup, desde: "2026-12-10", hasta: "2026-12-01" }).ok, false);
  const limpio = E.validarContenido("popup", { ...popup, titular: "<b>Hola</b><script>x</script> mundo" });
  assert.equal(limpio.ok && limpio.valor.titular, "Hola mundo");

  const slides = R.respaldoDe("slides");
  assert.equal(E.validarContenido("slides", slides.map((s, i) => ({ ...s, id: "igual" }))).ok, false);
  assert.equal(E.validarContenido("slides", [{ ...slides[0], imagenMovil: "https://evil.example/m.png" }]).ok, false);
  assert.equal(E.validarContenido("slides", [{ ...slides[0], imagenMovil: "/images/barraca/hero/local-fachada-640.webp" }]).ok, true);
  assert.equal(E.validarContenido("slides", Array.from({ length: 13 }, (_, i) => ({ ...slides[0], id: `s${i}` }))).ok, false);

  assert.equal(E.validarContenido("cinta", { activa: true, texto: "", enlace: null, desde: null, hasta: null }).ok, false);
  assert.equal(E.validarContenido("cinta", { activa: false, texto: "", enlace: null, desde: null, hasta: null }).ok, true);

  const aviso = { id: "navidad", activo: true, tipo: "feriado", severidad: "alerta", titulo: "Cerrado", texto: "", desde: "2026-12-24T00:00", hasta: "2026-12-26T00:00", donde: ["tienda"] };
  assert.equal(E.validarContenido("avisos", [aviso]).ok, true);
  assert.equal(E.validarContenido("avisos", [{ ...aviso, severidad: "grave" }]).ok, false);
  assert.equal(E.validarContenido("avisos", [{ ...aviso, donde: [] }]).ok, false);
  assert.equal(E.validarContenido("avisos", [{ ...aviso, donde: ["pagina-secreta"] }]).ok, false);
  assert.equal(E.validarContenido("avisos", [aviso, aviso]).ok, false);

  const portada = R.respaldoDe("portada");
  assert.equal(E.validarContenido("portada", { ...portada, secciones: portada.secciones.slice(1) }).ok, false);
  assert.equal(E.validarContenido("portada", { ...portada, productosDestacados: ["<script>"] }).ok, false);
  assert.equal(E.validarContenido("portada", { ...portada, categoriasDestacadas: ["Con Espacios"] }).ok, false);
  const reordenada = [...portada.secciones].reverse();
  assert.equal(E.validarContenido("portada", { ...portada, secciones: reordenada }).ok, true);
});

test("portada: verifica que existan los productos y categorías destacados", async () => {
  const buscador = {
    codigosExistentes: async (c) => new Set(c.filter((x) => ["A1", "B2"].includes(x))),
    slugsExistentes: async (s) => new Set(s.filter((x) => x === "techumbre")),
  };
  const base = R.respaldoDe("portada");
  const ok = await Ref.verificarReferenciasPortada({ ...base, productosDestacados: ["A1", "B2"], categoriasDestacadas: ["techumbre"] }, buscador);
  assert.equal(ok.ok, true);
  const mal = await Ref.verificarReferenciasPortada({ ...base, productosDestacados: ["A1", "ZZ9"], categoriasDestacadas: ["techumbre", "fantasma"] }, buscador);
  assert.deepEqual(mal, { ok: false, productosFaltantes: ["ZZ9"], categoriasFaltantes: ["fantasma"] });
  assert.equal((await Ref.verificarReferenciasPortada(base, buscador)).ok, true);
});

// ───────── Versiones, restaurar, aprobación ─────────

const SLIDES_A = () => R.respaldoDe("slides").slice(0, 2);
const SLIDES_B = () => R.respaldoDe("slides").slice(0, 3);

test("migración 0003: crea las tablas de contenido", () => {
  const db = crearD1Simulada();
  const tablas = db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);
  assert.ok(tablas.includes("contenido") && tablas.includes("contenido_versiones"));
});

test("borrador → publicar → historial; el borrador no cambia la tienda hasta publicar", async () => {
  const db = crearD1Simulada();
  const g = await Repo.guardarBorrador(db, { clave: "slides", valor: SLIDES_A(), usuario: ANA, ahora: T0 });
  assert.equal(g.ok, true);
  let est = await Repo.obtenerEstado(db, "slides");
  assert.equal(est.origen, "codigo");
  assert.deepEqual(est.efectivo, R.respaldoDe("slides"));
  assert.equal(est.borrador.length, 2);
  assert.equal(est.borradorPor, "u-ana");

  const p1 = await Repo.publicar(db, { clave: "slides", usuario: ANA, nota: "Dos láminas", ahora: T0 + 1000 });
  assert.deepEqual({ ...p1 }, { ok: true, estado: "publicada", clave: "slides", version: 1 });
  est = await Repo.obtenerEstado(db, "slides");
  assert.equal(est.origen, "d1");
  assert.equal(est.efectivo.length, 2);
  assert.equal(est.versionPublicada, 1);
  assert.equal(est.borrador, null, "al publicar el borrador se limpia");

  // Sin cambios no crea versión.
  const igual = await Repo.publicar(db, { clave: "slides", usuario: ANA, valor: SLIDES_A(), ahora: T0 + 2000 });
  assert.deepEqual(igual, { ok: false, motivo: "sin_cambios" });

  const p2 = await Repo.publicar(db, { clave: "slides", usuario: ANA, valor: SLIDES_B(), nota: "Tres láminas <b>x</b>", ahora: T0 + 3000 });
  assert.equal(p2.version, 2);
  const hist = await Repo.listarVersiones(db, "slides");
  assert.deepEqual(hist.map((v) => [v.version, v.estado]), [[2, "publicada"], [1, "reemplazada"]]);
  assert.equal(hist[0].nota, "Tres láminas x");
  assert.equal(hist[1].creadoPor, "u-ana");
  assert.equal(hist[1].creadoEn, T0 + 1000);
});

test("publicar sin borrador o con datos inválidos no toca nada", async () => {
  const db = crearD1Simulada();
  assert.deepEqual(await Repo.publicar(db, { clave: "popup", usuario: ANA }), { ok: false, motivo: "sin_borrador" });
  const mal = await Repo.publicar(db, { clave: "popup", usuario: ANA, valor: { ...R.respaldoDe("popup"), imagen: "https://evil.example/x.png" } });
  assert.equal(mal.ok, false);
  assert.equal(mal.motivo, "invalido");
  assert.ok(mal.errores.length >= 1);
  assert.equal((await Repo.guardarBorrador(db, { clave: "popup", valor: { nada: 1 }, usuario: ANA })).ok, false);
  assert.equal((await Repo.listarVersiones(db, "popup")).length, 0);
  await assert.rejects(() => Repo.obtenerEstado(db, "clave-inventada"), /desconocido/);
});

test("restaurar: al borrador o publicando una versión NUEVA (el historial no se borra)", async () => {
  const db = crearD1Simulada();
  await Repo.publicar(db, { clave: "slides", usuario: ANA, valor: SLIDES_A(), ahora: T0 });
  await Repo.publicar(db, { clave: "slides", usuario: ANA, valor: SLIDES_B(), ahora: T0 + 1 });
  const aBorrador = await Repo.restaurarVersion(db, { clave: "slides", version: 1, usuario: ANA, destino: "borrador", ahora: T0 + 2 });
  assert.deepEqual(aBorrador, { ok: true, estado: "borrador", clave: "slides" });
  let est = await Repo.obtenerEstado(db, "slides");
  assert.equal(est.efectivo.length, 3, "restaurar al borrador no cambia lo publicado");
  assert.equal(est.borrador.length, 2);

  const viva = await Repo.restaurarVersion(db, { clave: "slides", version: 1, usuario: ANA, destino: "publicado", ahora: T0 + 3 });
  assert.equal(viva.ok && viva.version, 3);
  est = await Repo.obtenerEstado(db, "slides");
  assert.equal(est.efectivo.length, 2);
  const hist = await Repo.listarVersiones(db, "slides");
  assert.deepEqual(hist.map((v) => [v.version, v.estado, v.restauradaDe]), [[3, "publicada", 1], [2, "reemplazada", null], [1, "reemplazada", null]]);
  assert.equal((await Repo.obtenerVersion(db, "slides", 2)).valor.length, 3);
  assert.deepEqual(await Repo.restaurarVersion(db, { clave: "slides", version: 99, usuario: ANA, destino: "publicado" }), { ok: false, motivo: "no_existe" });
});

test("términos y privacidad: publicar queda PENDIENTE hasta aprobar; el borrador es libre", async () => {
  const db = crearD1Simulada();
  const nuevo = { texto: `${TERMINOS_MD}\n\nCláusula nueva de prueba.` };
  assert.equal(T.META_CONTENIDO.terminos.requiereAprobacion, true);
  assert.equal(T.META_CONTENIDO.privacidad.requiereAprobacion, true);
  assert.equal(T.META_CONTENIDO.nosotros.requiereAprobacion, false);
  assert.equal((await Repo.guardarBorrador(db, { clave: "terminos", valor: nuevo, usuario: ANA })).ok, true);

  const sol = await Repo.publicar(db, { clave: "terminos", usuario: ANA, nota: "Cláusula nueva", ahora: T0 });
  assert.deepEqual(sol, { ok: true, estado: "pendiente", clave: "terminos", version: 1 });
  let est = await Repo.obtenerEstado(db, "terminos");
  assert.equal(est.origen, "codigo", "pendiente NO se ve en la tienda");
  assert.equal(est.efectivo.texto, TERMINOS_MD.trim());
  assert.equal(est.pendiente.version, 1);
  assert.equal(est.borrador.texto, nuevo.texto, "el borrador sigue disponible");
  assert.equal((await Repo.listarPendientes(db)).length, 1);

  const ap = await Repo.aprobarPendiente(db, { clave: "terminos", version: 1, aprobadoPor: "jorge", referencia: "apr-1", ahora: T0 + 5 });
  assert.deepEqual(ap, { ok: true, clave: "terminos", version: 1 });
  est = await Repo.obtenerEstado(db, "terminos");
  assert.equal(est.origen, "d1");
  assert.equal(est.efectivo.texto, nuevo.texto);
  assert.equal(est.pendiente, null);
  const v = (await Repo.listarVersiones(db, "terminos"))[0];
  assert.deepEqual([v.estado, v.aprobadoPor, v.creadoPor, v.publicadoEn], ["publicada", "jorge", "u-ana", T0 + 5]);
  // Aprobar dos veces no hace nada.
  assert.deepEqual(await Repo.aprobarPendiente(db, { clave: "terminos", version: 1, aprobadoPor: "jorge" }), { ok: false, motivo: "no_pendiente" });
});

test("aprobación: nueva solicitud descarta la anterior; rechazar no publica; con aprobación dada se publica directo", async () => {
  const db = crearD1Simulada();
  const a = { texto: `${PRIVACIDAD_MD}\n\nA.` };
  const b = { texto: `${PRIVACIDAD_MD}\n\nB.` };
  await Repo.publicar(db, { clave: "privacidad", usuario: ANA, valor: a, ahora: T0 });
  await Repo.publicar(db, { clave: "privacidad", usuario: ANA, valor: b, ahora: T0 + 1 });
  assert.deepEqual((await Repo.listarVersiones(db, "privacidad")).map((v) => [v.version, v.estado]), [[2, "pendiente"], [1, "descartada"]]);
  assert.deepEqual(await Repo.aprobarPendiente(db, { clave: "privacidad", version: 1, aprobadoPor: "jorge" }), { ok: false, motivo: "no_pendiente" });
  assert.equal(await Repo.rechazarPendiente(db, { clave: "privacidad", version: 2, rechazadoPor: "jorge" }), true);
  assert.equal((await Repo.obtenerEstado(db, "privacidad")).origen, "codigo");
  assert.deepEqual(await Repo.restaurarVersion(db, { clave: "privacidad", version: 2, usuario: ANA, destino: "publicado" }), { ok: false, motivo: "no_restaurable" });
  // El servicio de aprobaciones ya tiene el OK: publica directo.
  const directa = await Repo.publicar(db, { clave: "privacidad", usuario: ANA, valor: b, aprobacion: { aprobadoPor: "jorge", referencia: "apr-9" }, ahora: T0 + 9 });
  assert.equal(directa.estado, "publicada");
  assert.equal((await Repo.obtenerEstado(db, "privacidad")).efectivo.texto, b.texto);
});

test("auditoría: cada acción queda con quién y cuándo", async () => {
  const db = crearD1Simulada();
  await Repo.guardarBorrador(db, { clave: "cinta", valor: { activa: true, texto: "Cerrado el lunes", enlace: null, desde: null, hasta: null }, usuario: ANA, ahora: T0 });
  await Repo.publicar(db, { clave: "cinta", usuario: ANA, ahora: T0 + 1 });
  const filas = db.sqlite.prepare("SELECT herramienta, usuario_id, usuario_email, entidad, entidad_id, creado_en FROM auditoria ORDER BY creado_en").all();
  assert.deepEqual(filas.map((f) => f.herramienta), ["contenido.guardar_borrador", "contenido.publicar"]);
  assert.ok(filas.every((f) => f.usuario_id === "u-ana" && f.usuario_email === "ana@example.com" && f.entidad === "contenido" && f.entidad_id === "cinta"));
  const lista = await Repo.listarContenidos(db);
  assert.equal(lista.length, T.CLAVES_CONTENIDO.length);
  assert.equal(lista.find((x) => x.clave === "cinta").origen, "d1");
  assert.equal(lista.find((x) => x.clave === "popup").origen, "codigo");
});

// ───────── Respaldo con D1 caída / vacía ─────────

function respaldoCompleto() {
  return Object.fromEntries(T.CLAVES_CONTENIDO.map((c) => [c, R.respaldoDe(c)]));
}
async function leerTodo(lector) {
  return Object.fromEntries(await Promise.all(T.CLAVES_CONTENIDO.map(async (c) => [c, await lector.leer(c)])));
}

test("D1 vacía: la tienda muestra EXACTAMENTE el respaldo en código", async () => {
  const db = crearD1Simulada();
  const lector = L.crearLector({ obtenerDb: async () => db });
  assert.deepEqual(await leerTodo(lector), respaldoCompleto());
  assert.equal((await lector.leerConOrigen("slides")).origen, "codigo");
});

test("D1 sin tablas (sin migrar), sin binding o que lanza: respaldo, sin lanzar", async () => {
  const sinTablas = crearD1Simulada({ migraciones: false });
  for (const obtenerDb of [async () => sinTablas, async () => null, async () => { throw new Error("D1 caída"); }, () => { throw new Error("sin contexto"); }]) {
    const fallos = [];
    const lector = L.crearLector({ obtenerDb, alFallar: (m) => fallos.push(m) });
    assert.deepEqual(await leerTodo(lector), respaldoCompleto());
  }
});

test("D1 lenta (timeout): responde con el respaldo sin esperar, y no reintenta de inmediato", async () => {
  let llamadas = 0;
  let reloj = 0;
  const lento = { prepare: () => ({ bind() { return this; }, all: () => new Promise(() => {}) }), batch: async () => [] };
  const fallos = [];
  const lector = L.crearLector({
    obtenerDb: async () => { llamadas++; return lento; },
    timeoutMs: 30,
    reintentoMs: 10_000,
    ahora: () => reloj,
    alFallar: (m) => fallos.push(m),
  });
  const t = Date.now();
  assert.deepEqual(await lector.leer("popup"), R.respaldoDe("popup"));
  assert.ok(Date.now() - t < 1000);
  assert.deepEqual(fallos, ["timeout"]);
  // Dentro de la ventana de reintento no se vuelve a consultar (no suma latencia).
  await lector.leer("popup");
  await lector.leer("slides");
  assert.equal(llamadas, 1);
  reloj += 10_001;
  await lector.leer("popup");
  assert.equal(llamadas, 2);
});

test("valor publicado dañado o inválido: esa clave usa el respaldo, el resto sigue", async () => {
  const db = crearD1Simulada();
  await Repo.publicar(db, { clave: "cinta", usuario: ANA, valor: { activa: true, texto: "Aviso bueno", enlace: null, desde: null, hasta: null } });
  db.sqlite.prepare("INSERT INTO contenido (clave, publicado, version_publicada) VALUES (?, ?, 1)").run("popup", '{"activo": true, "imagen": "https://evil.example/x.png"}');
  db.sqlite.prepare("INSERT INTO contenido (clave, publicado, version_publicada) VALUES (?, ?, 1)").run("slides", "esto no es json{");
  const lector = L.crearLector({ obtenerDb: async () => db });
  assert.equal((await lector.leer("cinta")).texto, "Aviso bueno");
  assert.deepEqual(await lector.leer("popup"), R.respaldoDe("popup"));
  assert.deepEqual(await lector.leer("slides"), R.respaldoDe("slides"));
});

test("caché: una lectura buena se reutiliza; si luego D1 cae sigue lo último bueno; invalidar refresca", async () => {
  const db = crearD1Simulada();
  let reloj = 0;
  let caida = false;
  let consultas = 0;
  const envuelta = new Proxy(db, {
    get(t, p) {
      if (p === "prepare") return (sql) => { if (/FROM contenido WHERE publicado/.test(sql)) consultas++; if (caida) throw new Error("D1 caída"); return t.prepare(sql); };
      return t[p];
    },
  });
  await Repo.publicar(db, { clave: "cinta", usuario: ANA, valor: { activa: true, texto: "Uno", enlace: null, desde: null, hasta: null } });
  const lector = L.crearLector({ obtenerDb: async () => envuelta, ttlMs: 1000, reintentoMs: 500, ahora: () => reloj });
  assert.equal((await lector.leer("cinta")).texto, "Uno");
  await lector.leer("popup");
  await lector.leer("slides");
  assert.equal(consultas, 1, "una sola consulta sirve a todas las claves");
  await Repo.publicar(db, { clave: "cinta", usuario: ANA, valor: { activa: true, texto: "Dos", enlace: null, desde: null, hasta: null } });
  assert.equal((await lector.leer("cinta")).texto, "Uno", "dentro del TTL");
  lector.invalidar();
  assert.equal((await lector.leer("cinta")).texto, "Dos");
  caida = true;
  reloj += 2000;
  assert.equal((await lector.leer("cinta")).texto, "Dos", "D1 caída: se muestra lo último bueno");
});

// ───────── Imágenes ─────────

const bytes = (...n) => Uint8Array.from(n);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10);
const GIF = new TextEncoder().encode("GIF89a\u0001\u0000");
const WEBP = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");
const aB64 = (u8) => Buffer.from(u8).toString("base64");

test("imágenes: el tipo sale de los magic bytes, no de lo que declare el archivo", () => {
  assert.equal(I.detectarTipoImagen(PNG).tipo, "png");
  assert.equal(I.detectarTipoImagen(JPG).tipo, "jpeg");
  assert.equal(I.detectarTipoImagen(GIF).tipo, "gif");
  assert.equal(I.detectarTipoImagen(WEBP).tipo, "webp");
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
  const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
  const pdf = new TextEncoder().encode("%PDF-1.4");
  const exe = bytes(0x4d, 0x5a, 0x90, 0);
  for (const x of [svg, html, pdf, exe, bytes(), bytes(0xff, 0xd8)]) assert.equal(I.detectarTipoImagen(x), null);
  // RIFF que no es WEBP (p. ej. WAV).
  assert.equal(I.detectarTipoImagen(new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WAVEfmt ")), null);
});

test("imágenes desde base64: acepta data URL, rechaza tipo falso, vacío, basura y exceso de tamaño", async () => {
  const subidas = [];
  const deps = { subir: async (ruta, b, mime) => { subidas.push({ ruta, mime, n: b.length }); return `https://wmoizhbdalvnveclenvf.supabase.co/storage/v1/object/public/barraca-redes/${ruta}`; }, ahora: () => new Date(Date.UTC(2026, 10, 25)), azar: () => "abc123" };
  const ok = await I.subirImagenDesdeBase64(`data:image/svg+xml;base64,${aB64(PNG)}`, deps);
  assert.equal(ok.ruta, "tienda/2026-11/abc123.png", "nombre generado por nosotros y tipo REAL (png) aunque diga svg");
  assert.equal(ok.mime, "image/png");
  assert.equal(M.esUrlImagenPermitida(ok.url), true);
  assert.equal(subidas.length, 1);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString("base64");
  await assert.rejects(() => I.subirImagenDesdeBase64(svg, deps), (e) => e.codigo === "tipo");
  await assert.rejects(() => I.subirImagenDesdeBase64(aB64(new TextEncoder().encode("<?php system($_GET[1]); ?>")), deps), (e) => e.codigo === "tipo");
  await assert.rejects(() => I.subirImagenDesdeBase64("***no es base64***", deps), (e) => e.codigo === "base64");
  await assert.rejects(() => I.subirImagenDesdeBase64("", deps), (e) => e.codigo === "base64");
  const grande = new Uint8Array(I.MAX_BYTES_IMAGEN + 1);
  grande.set(JPG);
  await assert.rejects(() => I.subirImagenDesdeBase64(aB64(grande), deps), (e) => e.codigo === "muy_grande");
  const justo = new Uint8Array(I.MAX_BYTES_IMAGEN);
  justo.set(JPG);
  assert.equal((await I.subirImagenDesdeBase64(aB64(justo), deps)).bytes, I.MAX_BYTES_IMAGEN);
  assert.equal(subidas.length, 2, "lo rechazado nunca se sube");
});

test("SSRF: IPs privadas, loopback, link-local, metadata y formas disfrazadas", () => {
  const privadas = [
    "127.0.0.1", "127.1.2.3", "0.0.0.0", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "100.100.100.200", "168.63.129.16", "224.0.0.1", "255.255.255.255", "192.0.2.1", "198.18.0.1",
    "::", "::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "::ffff:169.254.169.254", "fe80::1", "fc00::1",
    "fd00:ec2::254", "ff02::1", "2001:db8::1", "64:ff9b::7f00:1", "2002:7f00:1::1", "[::1]", "basura",
  ];
  for (const ip of privadas) assert.equal(I.esIpPrivada(ip), true, ip);
  for (const ip of ["8.8.8.8", "1.1.1.1", "104.16.0.1", "172.15.0.1", "172.32.0.1", "100.63.255.255", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(I.esIpPrivada(ip), false, ip);
  }
  const malas = [
    "http://example.com/a.png", "ftp://example.com/a.png", "file:///etc/passwd", "javascript:alert(1)", "data:image/png;base64,AAAA",
    "https://localhost/a.png", "https://localhost./a.png", "https://app.localhost/a.png", "https://servidor/a.png", "https://metadata.google.internal/x",
    "https://printer.local/x", "https://127.0.0.1/a.png", "https://2130706433/a.png", "https://0x7f.0.0.1/a.png", "https://0177.0.0.1/a.png",
    "https://127.1/a.png", "https://[::1]/a.png", "https://[::ffff:127.0.0.1]/a.png", "https://169.254.169.254/latest/meta-data/",
    "https://10.0.0.1/a.png", "https://example.com:8443/a.png", "https://example.com:22/a.png", "https://user:pw@example.com/a.png",
    "https://example.com/a b.png", "", "no es url",
  ];
  for (const u of malas) assert.throws(() => I.validarUrlRemota(u), I.ImagenError, u);
  assert.doesNotThrow(() => I.validarUrlRemota("https://images.example.com/fotos/a.png"));
  assert.doesNotThrow(() => I.validarUrlRemota("https://images.example.com:443/fotos/a.png"));
});

function respuesta(cuerpo, { status = 200, headers = {} } = {}) {
  return new Response(cuerpo, { status, headers });
}
const dnsPublico = async () => ["93.184.216.34"];

test("SSRF: un nombre que resuelve a una IP privada se rechaza (DNS rebinding / nip.io) y no se hace fetch", async () => {
  let fetches = 0;
  const deps = { fetch: async () => { fetches++; return respuesta(PNG); } };
  for (const ips of [["127.0.0.1"], ["10.1.2.3"], ["93.184.216.34", "169.254.169.254"], ["::1"], ["fd00:ec2::254"], []]) {
    await assert.rejects(() => I.descargarImagenRemota("https://rebind.example.com/a.png", { ...deps, resolver: async () => ips }), (e) => e instanceof I.ImagenError);
  }
  await assert.rejects(() => I.descargarImagenRemota("https://rebind.example.com/a.png", { ...deps, resolver: async () => { throw new Error("dns"); } }), (e) => e.codigo === "dns");
  assert.equal(fetches, 0);
});

test("SSRF: redirecciones se revalidan en cada salto, con tope", async () => {
  const salto = (a) => respuesta(null, { status: 302, headers: { location: a } });
  // Redirige a la metadata: se bloquea ANTES de hacer fetch al destino.
  const visitadas = [];
  const f1 = async (u) => { visitadas.push(u); return u.includes("origen") ? salto("https://169.254.169.254/latest/meta-data/") : respuesta(PNG); };
  await assert.rejects(() => I.descargarImagenRemota("https://origen.example.com/a.png", { fetch: f1, resolver: dnsPublico }), (e) => e.codigo === "ip_privada");
  assert.deepEqual(visitadas, ["https://origen.example.com/a.png"]);
  // Redirige a http.
  const f2 = async () => salto("http://example.com/a.png");
  await assert.rejects(() => I.descargarImagenRemota("https://origen.example.com/a.png", { fetch: f2, resolver: dnsPublico }), (e) => e.codigo === "solo_https");
  // Redirige a un nombre que resuelve a IP privada.
  const f3 = async () => salto("https://interno.example.com/a.png");
  const resolver = async (h) => (h === "interno.example.com" ? ["10.0.0.9"] : ["93.184.216.34"]);
  await assert.rejects(() => I.descargarImagenRemota("https://origen.example.com/a.png", { fetch: f3, resolver }), (e) => e.codigo === "ip_privada");
  // Bucle infinito de redirecciones.
  let n = 0;
  const f4 = async () => { n++; return salto(`https://origen.example.com/${n}.png`); };
  await assert.rejects(() => I.descargarImagenRemota("https://origen.example.com/0.png", { fetch: f4, resolver: dnsPublico }), (e) => e.codigo === "demasiadas_redirecciones");
  assert.equal(n, I.MAX_REDIRECCIONES + 1);
  // Redirección válida relativa.
  const f5 = async (u) => (u.endsWith("/a.png") ? salto("/b.png") : respuesta(PNG));
  assert.equal((await I.descargarImagenRemota("https://origen.example.com/a.png", { fetch: f5, resolver: dnsPublico })).length, PNG.length);
});

test("descarga: tope de tamaño (declarado y real), tiempo máximo, errores HTTP y sin credenciales", async () => {
  const ok = async () => respuesta(PNG, { headers: { "content-length": String(PNG.length) } });
  assert.equal((await I.descargarImagenRemota("https://img.example.com/a.png", { fetch: ok, resolver: dnsPublico })).length, PNG.length);
  const declara = async () => respuesta(PNG, { headers: { "content-length": String(10 * 1024 * 1024) } });
  await assert.rejects(() => I.descargarImagenRemota("https://img.example.com/a.png", { fetch: declara, resolver: dnsPublico }), (e) => e.codigo === "muy_grande");
  // Miente en content-length: se corta al leer.
  const flujo = async () => respuesta(new ReadableStream({ start(c) { for (let i = 0; i < 20; i++) c.enqueue(new Uint8Array(512)); c.close(); } }), { headers: { "content-length": "10" } });
  await assert.rejects(() => I.descargarImagenRemota("https://img.example.com/a.png", { fetch: flujo, resolver: dnsPublico, maxBytes: 4096 }), (e) => e.codigo === "muy_grande");
  const colgado = (_u, o) => new Promise((_, rechazar) => o.signal.addEventListener("abort", () => rechazar(new Error("abortado"))));
  await assert.rejects(() => I.descargarImagenRemota("https://img.example.com/a.png", { fetch: colgado, resolver: dnsPublico, timeoutMs: 30 }), (e) => e.codigo === "timeout");
  for (const status of [403, 404, 500]) {
    await assert.rejects(() => I.descargarImagenRemota("https://img.example.com/a.png", { fetch: async () => respuesta("x", { status }), resolver: dnsPublico }), (e) => e.codigo === "descarga");
  }
  let opciones;
  await I.descargarImagenRemota("https://img.example.com/a.png", { fetch: async (_u, o) => { opciones = o; return respuesta(PNG); }, resolver: dnsPublico });
  assert.equal(opciones.redirect, "manual");
  assert.equal(opciones.credentials, "omit");
  assert.equal(opciones.headers.cookie, undefined);
});

test("subir desde URL: el tipo real manda; un SVG o HTML servido como image/png se rechaza", async () => {
  const deps = (cuerpo, mime) => ({
    fetch: async () => respuesta(cuerpo, { headers: { "content-type": mime } }),
    resolver: dnsPublico,
    subir: async (ruta) => `https://wmoizhbdalvnveclenvf.supabase.co/storage/v1/object/public/barraca-redes/${ruta}`,
    azar: () => "zz",
    ahora: () => new Date(Date.UTC(2026, 11, 1)),
  });
  const r = await I.subirImagenDesdeUrl("https://img.example.com/foto", deps(JPG, "text/plain"));
  assert.equal(r.ruta, "tienda/2026-12/zz.jpg");
  await assert.rejects(() => I.subirImagenDesdeUrl("https://img.example.com/x.png", deps('<svg onload="alert(1)"/>', "image/png")), (e) => e.codigo === "tipo");
  await assert.rejects(() => I.subirImagenDesdeUrl("https://img.example.com/x.png", deps("<html></html>", "image/jpeg")), (e) => e.codigo === "tipo");
  await assert.rejects(() => I.subirImagenDesdeUrl("https://img.example.com/x.png", deps(new Uint8Array(0), "image/png")), (e) => e.codigo === "vacia");
});

// ───────── Generado ─────────

test("legal-embebido.ts calza con src/content/legal/*.md (si falla: node scripts/generar-legal.mjs)", () => {
  assert.doesNotThrow(() => execFileSync(process.execPath, ["scripts/generar-legal.mjs", "--check"], { cwd: new URL("..", import.meta.url), stdio: "pipe" }));
});

// ───────── Integración con la tienda (lógica pura) ─────────

test("WhatsApp: con el respaldo, los enlaces son idénticos a los de siempre; con otro número cambian", () => {
  const local = R.respaldoDe("datos_local");
  for (const origen of ["shell_fab", "footer"]) assert.equal(W.whatsappCotizar(local.whatsapp, origen), whatsappCtaBarracaCotizar(origen));
  assert.equal(
    W.whatsappConTexto(local.whatsapp, "Hola, vengo de la web y necesito cotizar materiales para una obra en Talca", { content: "barraca_ciudad_talca", campaign: "barraca_ciudad" }),
    whatsappCtaBarracaCiudad("talca", "Talca"),
  );
  assert.match(W.whatsappCotizar("56911112222", "footer"), /^https:\/\/wa\.me\/56911112222\?/);
});

test("el pie de la tienda y los textos de portada de respaldo coinciden", () => {
  assert.equal(R.respaldoDe("textos").pieDescripcion, LR.PIE_DESCRIPCION_RESPALDO);
});

test("popup: el cierre guardado usa la clave de siempre para el de código y otra para uno nuevo; respeta cada cuántos días", () => {
  const base = R.respaldoDe("popup");
  assert.equal(AP.claveCierreDe(base, base), AP.CLAVE_CIERRE);
  const nuevo = { ...base, titular: "Liquidación de fin de año" };
  assert.notEqual(AP.claveCierreDe(nuevo, base), AP.CLAVE_CIERRE);
  assert.match(AP.claveCierreDe(nuevo, base), new RegExp(`^${AP.CLAVE_CIERRE}:`));
  assert.equal(AP.claveCierreDe({ ...base, texto: "otro" }, base) === AP.claveCierreDe(nuevo, base), false);
  const dia = 86_400_000;
  const guardado = String(T0);
  assert.equal(AP.cierreVigente(guardado, T0 + 2 * dia, 3 * dia), true);
  assert.equal(AP.cierreVigente(guardado, T0 + 3 * dia, 3 * dia), false);
  assert.equal(AP.cierreVigente(guardado, T0 + 6 * dia), true, "por defecto 7 días, como antes");
  assert.equal(AP.cierreVigente(guardado, T0 + 7 * dia), false);
});
