// Devolución de Webpay: el candado va ANTES de Transbank, una sola devolución aunque lleguen dos a la vez,
// y la falla ambigua (red, tiempo, 5xx) deja el estado «incierto» que bloquea todo reintento automático.
// Correr: node --test scripts/devolucion-webpay.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { ejecutarDevolucionWebpay, fallaGarantizaQueNoSeDevolvio } from "../src/lib/pedidos/devolucion-webpay.ts";

/** Doble de Supabase para el reembolso: misma condición que el store real (solo «sin reembolso» o «error»). */
function entorno({ reembolso = null, transbank } = {}) {
  const e = { reembolso, llamadasTransbank: [], guardados: [], falloGuardar: 0 };
  e.deps = {
    ahora: () => "2026-11-25T12:00:00.000Z",
    async tomarReembolso(_n, r) {
      await Promise.resolve(); // cede el turno: así el Promise.all compite de verdad
      if (e.reembolso && e.reembolso.estado !== "error") return false;
      e.reembolso = r;
      return true;
    },
    async guardarReembolso(_n, r) {
      if (e.falloGuardar > 0) { e.falloGuardar--; throw new Error("supabase caído"); }
      e.reembolso = r; e.guardados.push(r);
    },
    async reembolsar(token, monto) {
      e.llamadasTransbank.push({ token, monto });
      await Promise.resolve();
      return transbank(token, monto);
    },
  };
  return e;
}
const PEDIDO = { numero: "BJ-261120-AAAA", total: 15000, pasarela_referencia: "TOKEN-1" };
const TB_OK = async () => ({ ok: true, tipo: "REVERSED", autorizacion: "123" });

test("devuelve una vez, por el total y al token original; deja el estado «hecho»", async () => {
  const e = entorno({ transbank: TB_OK });
  const r = await ejecutarDevolucionWebpay(e.deps, PEDIDO);
  assert.equal(r.resultado, "hecho");
  assert.deepEqual(e.llamadasTransbank, [{ token: "TOKEN-1", monto: 15000 }]);
  assert.equal(e.reembolso.estado, "hecho");
  assert.equal(e.reembolso.medio, "webpay");
});

test("dos devoluciones SIMULTÁNEAS del mismo pedido (Promise.all) = una sola llamada a Transbank", async () => {
  const e = entorno({ transbank: TB_OK });
  const [a, b] = await Promise.all([ejecutarDevolucionWebpay(e.deps, PEDIDO), ejecutarDevolucionWebpay(e.deps, PEDIDO)]);
  assert.deepEqual([a.resultado, b.resultado].sort(), ["hecho", "ocupada"]);
  assert.equal(e.llamadasTransbank.length, 1);
});

test("ya hecha: no vuelve a llamar a Transbank", async () => {
  const e = entorno({ reembolso: { estado: "hecho", medio: "webpay", monto: 15000, fecha: "x" }, transbank: TB_OK });
  assert.equal((await ejecutarDevolucionWebpay(e.deps, PEDIDO)).resultado, "ocupada");
  assert.equal(e.llamadasTransbank.length, 0);
});

test("fallo de red o tiempo: queda «incierto», nadie reintenta y Transbank no se vuelve a llamar", async () => {
  for (const mensaje of ["AxiosError: timeout of 5000ms exceeded", "AxiosError: Network Error", "AxiosError: Request failed with status code 502", "AxiosError: Request failed with status code 500"]) {
    const e = entorno({ transbank: async () => { throw Object.assign(new Error(`${mensaje}\nUnexpected error\n`), { name: "TransbankError" }); } });
    const r = await ejecutarDevolucionWebpay(e.deps, PEDIDO);
    assert.equal(r.resultado, "incierta", mensaje);
    assert.equal(e.reembolso.estado, "incierto");
    // Reintento automático (o doble clic): el candado lo rechaza SIN llamar a Transbank.
    const otra = await ejecutarDevolucionWebpay(e.deps, PEDIDO);
    assert.equal(otra.resultado, "ocupada");
    assert.equal(e.llamadasTransbank.length, 1, "una sola llamada en total");
  }
});

test("rechazo claro de Transbank (4xx) o error antes de enviar: «error» y SÍ se puede reintentar", async () => {
  const e = entorno({ transbank: async () => { throw Object.assign(new Error("AxiosError: Request failed with status code 422\nTransaction not found\n"), { name: "TransbankError" }); } });
  assert.equal((await ejecutarDevolucionWebpay(e.deps, PEDIDO)).resultado, "rechazada");
  assert.equal(e.reembolso.estado, "error");
  e.deps.reembolsar = async () => ({ ok: true, tipo: "NULLIFIED", autorizacion: "9" });
  assert.equal((await ejecutarDevolucionWebpay(e.deps, PEDIDO)).resultado, "hecho");
  const f = entorno({ transbank: async () => { throw Object.assign(new Error("Webpay sin credenciales"), { sinEnviar: true }); } });
  assert.equal((await ejecutarDevolucionWebpay(f.deps, PEDIDO)).resultado, "rechazada");
});

test("Transbank responde pero sin devolver (NULLIFIED con código ≠ 0): «rechazada»; respuesta sin forma: «incierta»", async () => {
  const a = entorno({ transbank: async () => ({ ok: false, tipo: "NULLIFIED", autorizacion: null }) });
  assert.equal((await ejecutarDevolucionWebpay(a.deps, PEDIDO)).resultado, "rechazada");
  const b = entorno({ transbank: async () => ({ ok: false, tipo: null, autorizacion: null }) });
  assert.equal((await ejecutarDevolucionWebpay(b.deps, PEDIDO)).resultado, "incierta");
  assert.equal(b.reembolso.estado, "incierto");
});

test("si Webpay devolvió pero no se pudo guardar el resultado, el pedido sigue «en curso» (nada reintenta) y se avisa", async () => {
  const e = entorno({ transbank: TB_OK });
  e.falloGuardar = 2;
  const r = await ejecutarDevolucionWebpay(e.deps, PEDIDO);
  assert.equal(r.resultado, "hecho");
  assert.equal(r.sinRegistro, true);
  assert.equal(e.reembolso.estado, "en_curso");
  assert.equal((await ejecutarDevolucionWebpay(e.deps, PEDIDO)).resultado, "ocupada");
});

test("clasificación de fallas: solo el 4xx de Transbank o un error marcado antes de enviar garantizan que no se devolvió", () => {
  const tb = (m) => Object.assign(new Error(m), { name: "TransbankError" });
  assert.equal(fallaGarantizaQueNoSeDevolvio(tb("AxiosError: Request failed with status code 422\n")), true);
  assert.equal(fallaGarantizaQueNoSeDevolvio(tb("AxiosError: Request failed with status code 401\n")), true);
  assert.equal(fallaGarantizaQueNoSeDevolvio(tb("AxiosError: Request failed with status code 504\n")), false);
  assert.equal(fallaGarantizaQueNoSeDevolvio(tb("AxiosError: timeout of 10000ms exceeded\n")), false);
  assert.equal(fallaGarantizaQueNoSeDevolvio(tb("Error: socket hang up")), false);
  assert.equal(fallaGarantizaQueNoSeDevolvio(new Error("algo raro")), false);
  assert.equal(fallaGarantizaQueNoSeDevolvio(null), false);
  assert.equal(fallaGarantizaQueNoSeDevolvio(Object.assign(new Error("x"), { sinEnviar: true })), true);
});
