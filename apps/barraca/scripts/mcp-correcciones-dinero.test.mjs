// Correcciones de la auditoría de la Parte B (dinero y borrado), 25-11-2026: topes de volumen, tiempo mínimo entre vista
// previa y confirmación, datos de pago endurecidos, devolución con reintento seguro, borrado más estricto, pago tardío,
// archivados en reportes, referencia de persona con pimienta y clasificación de errores de Transbank.
// Todo con dobles y D1 simulada. NUNCA toca pedidos reales.
// Correr: node --test scripts/mcp-correcciones-dinero.test.mjs
import "./pruebas/cargar-alias.mjs";
import "./pruebas/cargar-shared.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { crearCtx, crearTienda, ficha } from "./pruebas/tienda-falsa.mjs";
import { crearD1Simulada } from "./pruebas/d1-simulada.mjs";

const DP = await import("../src/lib/contenido/datos-pago.ts");
const Prod = await import("../src/lib/gestion-precios/productos-servicio.ts");

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
