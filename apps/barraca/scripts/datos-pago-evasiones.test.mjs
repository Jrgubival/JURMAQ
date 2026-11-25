// Datos de pago: cuentas cortas, cuentas partidas, dígitos Unicode, evasiones (titular en minúscula, RUT plano, banco sin la
// palabra «banco», pasarelas sueltas) y falsos positivos de prosa legítima (banco de trabajo, a nombre de…).
// Correr: node --test scripts/datos-pago-evasiones.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { agregaDatosDePago, contieneDatosDePago, errorDatosDePagoEnTextos } from "../src/lib/contenido/datos-pago.ts";

const terminos = readFileSync(new URL("../src/content/legal/terminos.md", import.meta.url), "utf8");
const privacidad = readFileSync(new URL("../src/content/legal/privacidad.md", import.meta.url), "utf8");
const agrega = (extra, base = terminos) => agregaDatosDePago(base, `${base}\n\n${extra}`);
const json = (t) => JSON.stringify({ texto: t });

test("los textos legales actuales (con su cuenta) siguen pasando sin cambios", () => {
  for (const t of [terminos, privacidad]) {
    assert.equal(agregaDatosDePago(t, t), false);
    assert.equal(agregaDatosDePago(json(t), json(t)), false);
  }
});

test("cuenta de 6 a 9 dígitos con «Cuenta:», «Transfiere a la cuenta», «Cta. Cte.»", () => {
  for (const x of ["Cuenta: 99887766", "Transfiere a la cuenta 99887766 de otra persona", "Cta. Cte. 99887766", "cta cte 998877", "Cuenta RUT 99887766", "Depósito en cuenta vista 123456789", "Banco Security, 4455667"]) {
    assert.equal(agrega(x), true, x);
    assert.equal(agregaDatosDePago(json(terminos), json(`${terminos}\n\n${x}`)), true, `${x} (JSON)`);
  }
});

test("cuenta partida por salto de línea, por espacios o por guiones", () => {
  for (const x of ["cuenta corriente 98765\n43210", "N° de cuenta 9876 5432\n1098", "Cuenta 99-88-77-66", "cuenta: 9988\n7766", "cuenta corriente 98765\r\n43210"]) assert.equal(agrega(x), true, JSON.stringify(x));
});

test("dígitos árabes, devanagari y de ancho completo se leen como números", () => {
  for (const x of ["cuenta corriente ٩٩٨٨٧٧٦٦٥٥٤٤", "Cuenta: ९९८८७७६६", "Cuenta: ９９８８７７６６", "cuenta ۹۹۸۸۷۷۶۶"]) assert.equal(agrega(x), true, x);
});

test("cadena larga de 9 o más dígitos sin contexto: se rechaza al comparar textos; teléfonos, fechas, EAN y precios, no", () => {
  assert.equal(agrega("99887766554"), true);
  assert.equal(agrega("187766554"), true);
  assert.equal(agrega("998877665"), false, "9 dígitos que empiezan en 2-9 son un teléfono chileno");
  for (const x of ["Llámanos al +56 9 7667 3577.", "Llámanos al 976673577.", "Desde el 25-11-2026 a las 15:00.", "Código de barras 7801234567890", "Sobre $150.000 despacho gratis por transferencia.", "Despacho gratis sobre 150000 pesos", "Pedido BJ-261120-AAAA y SKU12345678", "La tienda cuenta con 250000 unidades de stock", "Plazo de 10 días hábiles, 3 cuotas, 48 horas"]) assert.equal(agrega(x), false, x);
});

test("la prosa con precios y «transferencia» sigue pasando", () => {
  assert.equal(agrega("Pagando por transferencia tienes 2% de descuento sobre compras desde $100.000."), false);
  assert.equal(contieneDatosDePago("Transferencia: despacho a $15.000"), false);
});

test("falsos positivos: banco de trabajo, de herramientas, de datos, de pruebas", () => {
  for (const x of ["Los productos se entregan sobre banco de trabajo.", "Se guardan en el banco de herramientas.", "No usamos un banco de datos externo.", "Hecho en banco de pruebas.", "Mesa banco de madera para el taller.", "Los bancos de Chile pueden demorar.", "Sirve para un Banco de Trabajo robusto."]) {
    assert.equal(agrega(x), false, x);
    assert.equal(contieneDatosDePago(x), false, x);
    assert.equal(errorDatosDePagoEnTextos(x), null, x);
  }
});

test("falsos positivos: «a nombre de…» y «Titular:» fuera de contexto de pago", () => {
  for (const x of ["Si pagas a nombre de Pedro Rojas se emite la boleta.", "La factura se emite a nombre de la empresa.", "Titular: Persona que compra", "Titular: texto", "Boleta a nombre de Juan Soto por tu compra."]) assert.equal(agrega(x), false, x);
});

test("titular en minúscula o «a nombre de» junto a cuenta o transferencia se rechaza", () => {
  assert.equal(agrega("Transfiere a la cuenta, titular: pedro rojas"), true);
  assert.equal(agrega("Banco\ntitular: pedro rojas gonzalez"), true);
  assert.equal(agrega("Haz la transferencia a nombre de pedro rojas"), true);
  assert.equal(agregaDatosDePago("Cuenta a nombre de ana soto", "Cuenta a nombre de luis perez"), true);
});

test("cambiar el titular o el banco existentes en los Términos se rechaza; dejarlos no", () => {
  assert.equal(agregaDatosDePago(terminos, terminos.replace("- Titular: BARRACA DE FIERROS JURMAQ SPA", "- Titular: pedro rojas")), true);
  assert.equal(agregaDatosDePago(terminos, terminos.replace("BancoEstado", "Security")), true);
  assert.equal(agregaDatosDePago(terminos, terminos.replace("Debes pagar dentro de **48 horas**", "Debes pagar dentro de **72 horas**")), false);
});

test("RUT sin guion ni puntos junto a cuenta o banco", () => {
  assert.equal(agrega("Transferir a la cuenta de RUT 123456785"), true);
  assert.equal(agrega("Titular RUT 12345678K, banco"), true);
  assert.equal(agrega("Banco de Chile, RUT 12.345.678-5"), true);
  assert.equal(agrega("El RUT de la empresa es 12345678-5."), false);
});

test("banco sin la palabra «banco»", () => {
  for (const x of ["Transferir a Santander, cuenta del titular", "Paga en BCI por transferencia", "Cuenta vista Security, titular", "Depósito en cuenta Estado", "Transferencia a Scotiabank", "Cuenta en Falabella, depósito", "Cuenta corriente en Bco. Falabella", "Banco Security", "Banco: Itaú"]) assert.equal(agrega(x), true, x);
  for (const x of ["Revisa el estado de tu pedido por transferencia.", "Estado del pedido: pagado por transferencia.", "Cada compra cuenta con garantía de seguridad."]) assert.equal(agrega(x), false, x);
});

test("pasarelas y enlaces de cobro sueltos, acortadores y subdominios de pasarela", () => {
  for (const x of ["https://zonapago.cl/abc", "zonapago.cl/x", "https://sumup.link/abc", "sumup.link/abc", "mpago.la/1a2b", "https://mpago.la/1a2b", "https://link.mercadopago.cl/x", "flow.cl/btn.php?token=1", "https://www.flow.cl/app/web/pagarBtn.php?token=1", "webpay.cl/pagar", "https://khipu.com/payment/x", "transbank.cl/cobro", "https://www.mercadopago.cl/checkout/v1/x", "paypal.me/pedro", "https://www.paypal.com/donate", "tinyurl.com/x", "https://bit.ly/3abc", "mpago.li/1x", "https://pagos.ejemplo.cl/x"]) assert.equal(agrega(x), true, x);
  for (const x of ["Mira https://jurmaq.cl/productos y tienda.jurmaq.cl", "Sigue a la Barraca en https://instagram.com/jurmaq", "Escríbenos a contacto@jurmaq.cl", "Pago contado.Pago al retirar.", "Visita www.sernac.cl para tus derechos"]) assert.equal(agrega(x), false, x);
});

test("quitar o repetir sin cambiar sigue la regla: quitar es libre, agregar una copia se rechaza", () => {
  const con = `${terminos}\n\nCuenta: 99887766`;
  assert.equal(agregaDatosDePago(con, con), false);
  assert.equal(agregaDatosDePago(con, terminos), false);
  assert.equal(agregaDatosDePago(con, `${con}\nCuenta: 99887766`), true);
});

test("el mensaje de rechazo dice dónde se cambian los datos de pago", () => {
  assert.match(errorDatosDePagoEnTextos("Cuenta: 99887766"), /panel de la tienda/);
  assert.match(errorDatosDePagoEnTextos("Cuenta: 99887766"), /datos bancarios o un enlace de pago/);
});
