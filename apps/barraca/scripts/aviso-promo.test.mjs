// Pruebas de la lógica pura del aviso de ventas online.
// Correr: node --test scripts/aviso-promo.test.mjs   (Node 22.6+ lee .ts directo)
import test from "node:test";
import assert from "node:assert/strict";
import {
  FIN_AVISO_MS,
  DURACION_CIERRE_MS,
  avisoVigente,
  cierreVigente,
  cookiesPendientes,
  rutaSinAviso,
} from "../src/lib/aviso-promo.ts";

test("ventana de fechas: corta a las 00:00 de Chile del 02-12-2026", () => {
  assert.equal(FIN_AVISO_MS, Date.UTC(2026, 11, 2, 3, 0, 0));
  assert.equal(avisoVigente(Date.UTC(2026, 11, 2, 2, 59, 59)), true); // 01-12 23:59:59 en Chile
  assert.equal(avisoVigente(Date.UTC(2026, 11, 2, 3, 0, 0)), false);
  assert.equal(avisoVigente(Date.UTC(2026, 10, 7)), true);
});

test("rutas excluidas", () => {
  for (const r of ["/carrito", "/checkout", "/pago/exito", "/pago/webpay/123", "/pedido/AB1", "/admin", "/admin/ventas/9", "/login", "/login/credenciales", "/cuenta", "/opinar/1/t", "/cotizacion/COT-1", "/cotizar", "/baja/x", "/api/carrito"]) {
    assert.equal(rutaSinAviso(r), true, r);
  }
  for (const r of ["/", "/categorias", "/categorias/fierros", "/producto/x", "/buscar", "/contacto", "/terminos", "/guias/a", "/en/curico", "/pagos-info", "/carritos"]) {
    assert.equal(rutaSinAviso(r), false, r);
  }
  assert.equal(rutaSinAviso(null), true);
});

test("cierre guardado dura 7 días", () => {
  const ahora = Date.UTC(2026, 10, 10);
  assert.equal(cierreVigente(null, ahora), false);
  assert.equal(cierreVigente("basura", ahora), false);
  assert.equal(cierreVigente(String(ahora - DURACION_CIERRE_MS + 1), ahora), true);
  assert.equal(cierreVigente(String(ahora - DURACION_CIERRE_MS), ahora), false);
  assert.equal(cierreVigente(String(ahora + 5000), ahora), false);
});

test("aviso de cookies pendiente", () => {
  assert.equal(cookiesPendientes(null), true);
  assert.equal(cookiesPendientes("{no json"), true);
  assert.equal(cookiesPendientes(JSON.stringify({ v: 1, accepted: false, ts: 1 })), false);
  assert.equal(cookiesPendientes(JSON.stringify({ v: 1, accepted: true, ts: 1 })), false);
  assert.equal(cookiesPendientes(JSON.stringify({ v: 2 })), true);
});
