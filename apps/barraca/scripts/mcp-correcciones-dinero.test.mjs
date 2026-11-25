// Correcciones de la auditoría de la Parte B (dinero y borrado), 25-11-2026: topes de volumen, tiempo mínimo entre vista
// previa y confirmación, datos de pago endurecidos, devolución con reintento seguro, borrado más estricto, pago tardío,
// archivados en reportes, referencia de persona con pimienta y clasificación de errores de Transbank.
// Todo con dobles y D1 simulada. NUNCA toca pedidos reales.
// Correr: node --test scripts/mcp-correcciones-dinero.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { crearCtx, crearTienda, ficha } from "./pruebas/tienda-falsa.mjs";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";

const DP = await import("../src/lib/contenido/datos-pago.ts");
const Prod = await import("../src/lib/gestion-precios/productos-servicio.ts");
const { ejecutarDevolucionWebpay, fallaGarantizaQueNoSeDevolvio } = await import("../src/lib/pedidos/devolucion-webpay.ts");

const T0 = Date.UTC(2026, 10, 25, 15, 0, 0);
const JORGE = { id: "1", email: "contacto@jurmaq.cl" };

// ───────── 2. datos de pago endurecidos ─────────
test("datos de pago: números largos sin la palabra cuenta, ancho completo, acortadores, WhatsApp y rutas de pago", () => {
  const malos = [
    "Deposita en 12345678901234 por favor",
    "Transfiere al 1234 5678 9012",
    "Cuenta ０１２３４５６７８９０",
    "ｗｅｂｐａｙ.cl/x",
    "Cuenta vista 00-123-45678-9 a nombre de Juan",
    "RUT 12.345.678-5 cuenta rut banco estado",
    "Mira bit.ly/3abcde",
    "tinyurl.com/yabc",
    "https://t.co/zzz",
    "Escríbeme a wa.me/56999999999",
    "https://api.whatsapp.com/send?phone=56999999999",
    "https://ejemplo.cl/pagar?id=5",
    "https://ejemplo.cl/%70agar",
    "ejemplo.cl/checkout/ab",
    "https://pagos.ejemplo.cl/ahora",
    "https://ofertas.example/cobro",
    "CL12345678901234567890",
  ];
  for (const t of malos) assert.equal(DP.contieneDatosDePago(t), true, t);
  const buenos = [
    "Llámanos al +56 9 6123 4567 o al 22 345 6789",
    "Horario: 25-11-2026 15:00 a 18:00",
    "Fierro 10 mm x 6 m, $12.990 el kilo; 1.500.000 unidades al año",
    "Código de barras 7801234567890",
    "SKU 1234567890123",
    "Ver https://jurmaq.cl/contacto y https://barraca.jurmaq.cl/pago/error",
    "Aceptamos Webpay o transferencia bancaria; el banco de carpintero pesa 40 kg",
    "RUT de la empresa 76.111.222-3",
    "https://ejemplo.cl/catalogo/fierros",
  ];
  for (const t of buenos) assert.equal(DP.contieneDatosDePago(t), false, t);
  // lo que ya estaba (línea base) se puede dejar; agregarlo no
  const antes = "Escríbenos: https://wa.me/56988887777 o llama.";
  assert.equal(DP.agregaDatosDePago(antes, `${antes} Gracias.`), false);
  assert.equal(DP.agregaDatosDePago(antes, "Escríbenos: https://wa.me/56911112222"), true);
});

test("datos de pago: nombre y descripción de producto y categoría, crear y editar, los rechazan", async () => {
  const db = crearD1Simulada();
  const Tn = crearTienda([ficha({ id: 1, codigo: "A", precio: 5000, costo: 1000 })]);
  const ctx = (h) => crearCtx(db, JORGE, T0, h);
  const MALO = /datos bancarios o un enlace de pago/;
  await assert.rejects(Prod.editarProducto(Tn.deps, ctx("editar_producto"), { codigo: "A", nombre: "Fierro, paga a la cuenta 12345678901" }), MALO);
  await assert.rejects(Prod.editarProducto(Tn.deps, ctx("editar_producto"), { codigo: "A", descripcion: "Compra aquí: bit.ly/xyz" }), MALO);
  await assert.rejects(Prod.crearProducto(Tn.deps, ctx("crear_producto"), { codigo: "N-1", nombre: "Pago directo en wa.me/56999999999", precio_web: 5000 }), MALO);
  await assert.rejects(Prod.crearProducto(Tn.deps, ctx("crear_producto"), { codigo: "N-2", nombre: "Ok", descripcion: "Transfiere a 98765432109876", precio_web: 5000 }), MALO);
  await assert.rejects(Prod.crearCategoria(Tn.deps, ctx("crear_categoria"), { nombre: "Cat pagos.ejemplo.cl" }), MALO);
  await assert.rejects(Prod.crearCategoria(Tn.deps, ctx("crear_categoria"), { nombre: "Cat", descripcion: "tinyurl.com/abc" }), MALO);
  assert.equal(Tn.filas.length, 1, "no se creó nada");
  // lo normal sigue funcionando
  const ok = await Prod.editarProducto(Tn.deps, ctx("editar_producto"), { codigo: "A", nombre: "Fierro estriado 10 mm", descripcion: "Barra de 6 m. Llama al +56 9 6123 4567." });
  assert.equal(ok.datos.aplicado !== false, true);
});

// ───────── BAJO: clasificación 4xx de Transbank + 5. pago tardío ─────────
const tb = (m) => Object.assign(new Error(m), { name: "TransbankError" });
test("Transbank: solo 400, 401, 403, 404 y 422 garantizan que no se devolvió; 408, 409, 429 y 5xx son inciertos", () => {
  for (const c of [400, 401, 403, 404, 422]) assert.equal(fallaGarantizaQueNoSeDevolvio(tb(`AxiosError: Request failed with status code ${c}\n`)), true, String(c));
  for (const c of [402, 405, 408, 409, 410, 418, 429, 500, 502, 503, 504]) assert.equal(fallaGarantizaQueNoSeDevolvio(tb(`AxiosError: Request failed with status code ${c}\n`)), false, String(c));
  assert.equal(fallaGarantizaQueNoSeDevolvio(Object.assign(new Error("x"), { sinEnviar: true })), true);
  assert.equal(fallaGarantizaQueNoSeDevolvio(new Error("timeout")), false);
});

test("pago tardío (retorno de Webpay con el pedido ya cerrado): la devolución usa la misma función, y un tiempo agotado o 5xx queda incierto sin reintentar", async () => {
  const fuente = readFileSync(new URL("../src/app/api/pagos/webpay/retorno/route.ts", import.meta.url), "utf8");
  assert.match(fuente, /ejecutarDevolucionWebpay\(/, "el retorno usa la función común");
  assert.ok(!/reembolsarWebpay\(tokenWs/.test(fuente), "el retorno ya no llama a Transbank por su cuenta");
  for (const falla of [new Error("AxiosError: timeout of 5000ms exceeded"), tb("AxiosError: Request failed with status code 503\n")]) {
    let reembolso = null; let llamadas = 0;
    const deps = {
      tomarReembolso: async (_n, r) => { if (reembolso && reembolso.estado !== "error") return false; reembolso = r; return true; },
      guardarReembolso: async (_n, r) => { reembolso = r; },
      reembolsar: async () => { llamadas++; throw falla; },
    };
    const r = await ejecutarDevolucionWebpay(deps, { numero: "BJ-261120-AAAA", total: 15000, pasarela_referencia: "T" });
    assert.equal(r.resultado, "incierta");
    assert.equal(reembolso.estado, "incierto");
    assert.equal((await ejecutarDevolucionWebpay(deps, { numero: "BJ-261120-AAAA", total: 15000, pasarela_referencia: "T" })).resultado, "ocupada", "no se reintenta sola");
    assert.equal(llamadas, 1);
  }
});
