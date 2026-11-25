// Fuente única del local: con la D1 vacía (respaldo en código) los textos de correos, despacho,
// checkout y cotizaciones son EXACTAMENTE los que estaban escritos a mano; y si el local cambia, cambian.
// Correr: node --test scripts/local-equivalencia.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { datosLocalRespaldo } = await import("../src/lib/contenido/local-respaldo.ts");
const { vistaLocal } = await import("../src/lib/contenido/derivados.ts");
const { textosLocal, formatoWhatsapp } = await import("../src/lib/pedidos/textos-local.ts");
const { HORARIO_BARRACA, HQ } = await import("@jurmaq/shared/seo");
const { buildWhatsappUrl, SALUDO_WEB_BARRACA } = await import("@jurmaq/shared/whatsapp");
const { whatsappConTexto } = await import("../src/lib/contenido/whatsapp.ts");

const respaldo = () => vistaLocal(datosLocalRespaldo());
const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");

test("textos de correos con el respaldo = los textos que había escritos a mano", () => {
  const t = textosLocal(respaldo());
  assert.equal(t.direccionCorta, "Av. Poniente 2157, Molina");
  assert.equal(t.horarioSemana, HORARIO_BARRACA.semana);
  assert.equal(t.horarioSemana, "Lunes a viernes 8:30–13:00 y 14:30–18:00");
  assert.equal(t.horarioSabado, HORARIO_BARRACA.sabado);
  assert.equal(t.horarioSabado, "Sábado 9:00–13:00");
  assert.equal(t.horarioTexto, HORARIO_BARRACA.texto);
  assert.equal(t.whatsappDisplay, "+56 9 7667 3577");
  assert.equal(t.whatsappDisplay, HQ.telefonoDisplay);
  assert.equal(t.email, "contacto@jurmaq.cl");
});

test("el retiro del correo (HTML) sale idéntico al de antes", () => {
  const t = textosLocal(respaldo());
  const antes = `<strong>Retiro en la barraca</strong>: Av. Poniente 2157, Molina.</p>\n<p style="margin:0;color:#6b7280;font-size:13px;">${HORARIO_BARRACA.semana}. ${HORARIO_BARRACA.sabado}. Te avisamos`;
  const ahora = `<strong>Retiro en la barraca</strong>: ${t.direccionCorta}.</p>\n<p style="margin:0;color:#6b7280;font-size:13px;">${t.horarioSemana}. ${t.horarioSabado}. Te avisamos`;
  assert.equal(ahora, antes);
});

test("detalle del retiro en el checkout con el respaldo = el de antes", () => {
  const v = respaldo();
  assert.equal(`${v.direccionCorta}. ${v.h.semana}.`, `Av. Poniente 2157, Molina. ${HORARIO_BARRACA.semana}.`);
});

test("enlaces de WhatsApp de despacho y checkout con el respaldo = los de antes (mismo número, texto y UTM)", () => {
  const v = respaldo();
  const textoDespacho = `${SALUDO_WEB_BARRACA} y quiero cotizar el despacho a Curicó de: 2 x Fierro`;
  const antes = buildWhatsappUrl({ text: textoDespacho, utm_content: "barraca_checkout_despacho", utm_campaign: "barraca_despacho" });
  const ahora = buildWhatsappUrl({ text: textoDespacho, utm_content: "barraca_checkout_despacho", utm_campaign: "barraca_despacho", phone: v.whatsapp });
  assert.equal(ahora, antes);
  const antes2 = buildWhatsappUrl({ text: `${SALUDO_WEB_BARRACA} y quiero cotizar un despacho a mi comuna`, utm_content: "barraca_checkout_otra_comuna", utm_campaign: "barraca_despacho" });
  const ahora2 = buildWhatsappUrl({ text: `${SALUDO_WEB_BARRACA} y quiero cotizar un despacho a mi comuna`, utm_content: "barraca_checkout_otra_comuna", utm_campaign: "barraca_despacho", phone: v.whatsapp });
  assert.equal(ahora2, antes2);
});

test("PDF y correo de cotización con el respaldo = lo de antes (región sin tilde incluida)", () => {
  const v = respaldo();
  const regionSinTilde = v.region.normalize("NFD").replace(/\p{M}/gu, "");
  assert.equal(`${v.direccionCorta}`, "Av. Poniente 2157, Molina");
  assert.equal(`${regionSinTilde}, Chile`, "Region del Maule, Chile");
  assert.equal(`${v.direccion}, Chile`, "Av. Poniente 2157, Molina, Maule, Chile");
  assert.equal(v.telefonoDisplay, "+56 9 7667 3577");
});

test("si el local cambia en la fuente única, cambian los correos, el despacho y el WhatsApp", () => {
  const d = { ...datosLocalRespaldo(), calle: "Calle Nueva 100", comuna: "Curicó", whatsapp: "56911112222", email: "ventas@barraca.cl" };
  const t = textosLocal(vistaLocal(d));
  assert.equal(t.direccionCorta, "Calle Nueva 100, Curicó");
  assert.equal(t.whatsappDisplay, "+56 9 1111 2222");
  assert.equal(t.email, "ventas@barraca.cl");
  assert.match(whatsappConTexto(d.whatsapp, "hola"), /^https:\/\/wa\.me\/56911112222\?/);
});

test("formatoWhatsapp: formato chileno y números raros", () => {
  assert.equal(formatoWhatsapp("56976673577"), "+56 9 7667 3577");
  assert.equal(formatoWhatsapp("+56 9 7667 3577"), "+56 9 7667 3577");
  assert.equal(formatoWhatsapp("5491155551234"), "+5491155551234");
  assert.equal(formatoWhatsapp(""), "");
});

test("ya no quedan dirección, teléfono, correo ni horario escritos a mano en correos, despacho ni cotizaciones", () => {
  const archivos = [
    "src/lib/pedidos/correos.ts",
    "src/lib/despacho/index.ts",
    "src/app/checkout/CheckoutClient.tsx",
    "src/app/api/cotizaciones/[id]/message/route.ts",
    "src/app/api/cotizaciones/[id]/pdf/route.ts",
    "src/app/api/cron/carrito-recovery/route.ts",
  ];
  for (const a of archivos) {
    const s = leer(a);
    assert.doesNotMatch(s, /Poniente 2157/, `${a}: dirección escrita a mano`);
    assert.doesNotMatch(s, /7667 3577/, `${a}: teléfono escrito a mano`);
    assert.doesNotMatch(s, /HORARIO_BARRACA/, `${a}: horario de código`);
  }
  // Los correos de pedido no repiten el correo de contacto (el de la cuenta bancaria es otro dato, de BANK_EMAIL).
  const correos = leer("src/lib/pedidos/correos.ts").replace(/BANK_EMAIL\?\.trim\(\) \|\| 'contacto@jurmaq\.cl'/, "");
  assert.doesNotMatch(correos, /contacto@jurmaq\.cl/);
});
