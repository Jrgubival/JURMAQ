// agregaDatosDePago compara TODAS las coincidencias (multiconjuntos), no solo la primera.
// Correr: node --test scripts/datos-pago-multiconjunto.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { agregaDatosDePago } from "../src/lib/contenido/datos-pago.ts";

const terminos = readFileSync(new URL("../src/content/legal/terminos.md", import.meta.url), "utf8");
const privacidad = readFileSync(new URL("../src/content/legal/privacidad.md", import.meta.url), "utf8");
const cambia = (de, a) => agregaDatosDePago(terminos, terminos.replace(de, a));

test("los textos legales actuales, sin tocar los datos, pasan (también como JSON del repositorio)", () => {
  assert.equal(agregaDatosDePago(terminos, terminos), false);
  assert.equal(agregaDatosDePago(privacidad, privacidad), false);
  assert.equal(agregaDatosDePago(JSON.stringify({ cuerpo: terminos }), JSON.stringify({ cuerpo: terminos })), false);
});

test("cambiar solo otro párrafo pasa (también como JSON y con un %20 suelto)", () => {
  const otro = terminos.replace("Debes pagar dentro de **48 horas**", "Debes pagar dentro de **72 horas**");
  assert.notEqual(otro, terminos);
  assert.equal(agregaDatosDePago(terminos, otro), false);
  assert.equal(agregaDatosDePago(JSON.stringify({ c: terminos }), JSON.stringify({ c: otro })), false);
  assert.equal(agregaDatosDePago(terminos, `${terminos}\n\nVer https://jurmaq.cl/a%20b y horario 09:00 a 18:00.`), false);
});

test("una segunda cuenta de 8 dígitos más abajo en los Términos se rechaza", () => {
  assert.equal(agregaDatosDePago(terminos, `${terminos}\n\nTambién: cuenta corriente 12345678`), true);
  assert.equal(agregaDatosDePago(terminos, `${terminos}\n\nCuenta vista N° 87654321`), true);
});

test("cambiar el número de la cuenta existente se rechaza; repetir la misma cuenta (otra copia) también", () => {
  assert.equal(cambia("42500240045", "42500240046"), true);
  assert.equal(agregaDatosDePago(terminos, `${terminos}\n\nNúmero de cuenta: 42500240045`), true);
});

test("cambiar el banco (por otro, o agregar uno) se rechaza", () => {
  assert.equal(cambia("- Banco: BancoEstado (Banco del Estado de Chile)", "- Banco: Banco Santander"), true);
  assert.equal(cambia("- Banco: BancoEstado (Banco del Estado de Chile)", "- Banco: Scotiabank"), true);
  assert.equal(agregaDatosDePago(terminos, `${terminos}\n\nTambién puedes pagar en el Banco de Chile.`), true);
  assert.equal(agregaDatosDePago("Banco: BancoEstado", "Banco: Tenpo"), true);
  // la prosa «el banco o emisor» no es un banco
  assert.equal(agregaDatosDePago("Pago con tarjeta.", "Pago con tarjeta, según el banco o emisor que corresponda."), false);
});

test("cambiar el titular se rechaza (etiqueta y «a nombre de»)", () => {
  assert.equal(cambia("- Titular: BARRACA DE FIERROS JURMAQ SPA", "- Titular: JUAN PEREZ GONZALEZ"), true);
  assert.equal(cambia("solo transfiere a una cuenta a nombre de BARRACA DE FIERROS JURMAQ SPA, RUT", "solo transfiere a una cuenta a nombre de PEDRO SOTO, RUT"), true);
});

test("cambiar el RUT del titular o el correo del comprobante se rechaza", () => {
  assert.equal(cambia("RUT 77.722.788-2", "RUT 12.345.678-5"), true);
  assert.equal(cambia("- Correo para el comprobante: contacto@jurmaq.cl", "- Correo para el comprobante: cobros@gmail.com"), true);
  assert.equal(agregaDatosDePago(terminos, `${terminos}\n\nEnvía el comprobante de transferencia a pagos@otrodominio.com`), true);
  // un correo ajeno sin contexto de pago es texto normal
  assert.equal(agregaDatosDePago("Hola.", "Escríbele a ana@ejemplo.com por tus dudas del despacho."), false);
});

test("agregar un IBAN, un enlace de pago o una cuenta con separadores se rechaza", () => {
  assert.equal(agregaDatosDePago(terminos, `${terminos}\nIBAN: CL12ABCD123456789012`), true);
  assert.equal(agregaDatosDePago(terminos, `${terminos}\nIBAN: DE89370400440532013000`), true);
  assert.equal(agregaDatosDePago(terminos, `${terminos}\nCuenta 1234 - 5678 - 9012`), true);
  assert.equal(agregaDatosDePago(terminos, `${terminos}\nCuenta: 1.234.567.890`), true);
  assert.equal(agregaDatosDePago(terminos, `${terminos}\nPaga en https://www.paypal.com/donate`), true);
  // un segundo enlace de pago ajeno, aunque ya hubiera uno
  const con = `${terminos}\nhttps://pago.ejemplo.cl/a`;
  assert.equal(agregaDatosDePago(con, `${con}\nhttps://otro.example.com/pay/9`), true);
  assert.equal(agregaDatosDePago(con, `${con}\nhttps://pago.ejemplo.cl/a`), true);
});

test("quitar datos es libre", () => {
  assert.equal(agregaDatosDePago(terminos, terminos.replace("- Titular: BARRACA DE FIERROS JURMAQ SPA\n", "")), false);
  assert.equal(agregaDatosDePago("Cuenta corriente 12345678 y cuenta vista 87654321", "Cuenta corriente 12345678"), false);
});
