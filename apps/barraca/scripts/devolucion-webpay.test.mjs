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

// ───────── 422 por «ya devuelta/anulada»: se verifica, nunca se toma por «no se hizo» ─────────
const tb422 = (m) => Object.assign(new Error(`AxiosError: Request failed with status code 422\n${m}\n`), { name: "TransbankError" });
const lanza422 = (m) => async () => { throw tb422(m); };

test("422 «ya anulada»: no es definitivo (no garantiza que no se devolvió); los otros 422 siguen siéndolo", () => {
  assert.equal(fallaGarantizaQueNoSeDevolvio(tb422("Transaction already nullified")), false);
  assert.equal(fallaGarantizaQueNoSeDevolvio(tb422("Transaction already reversed")), false);
  assert.equal(fallaGarantizaQueNoSeDevolvio(tb422("La transacción ya fue anulada")), false);
  assert.equal(fallaGarantizaQueNoSeDevolvio(tb422("Invalid value for parameter: amount")), true);
  assert.equal(fallaGarantizaQueNoSeDevolvio(tb422("Transaction is unfinished, it is not possible to refund it yet")), true);
  assert.equal(fallaGarantizaQueNoSeDevolvio(tb422("Refund period expired")), true);
});

test("422 «ya anulada» + Transbank confirma NULLIFIED por el monto: queda «hecho» (no «error»)", async () => {
  const e = entorno({ transbank: lanza422("Transaction already nullified") });
  e.deps.estadoTransaccion = async () => ({ estado: "NULLIFIED", monto: 15000, saldo: 0 });
  const r = await ejecutarDevolucionWebpay(e.deps, PEDIDO);
  assert.equal(r.resultado, "hecho");
  assert.equal(e.reembolso.estado, "hecho");
  assert.equal(e.reembolso.monto, 15000);
  assert.equal(e.reembolso.tipo, "NULLIFIED");
  assert.equal(e.llamadasTransbank.length, 1, "no se pide una segunda devolución");
});

test("422 «ya anulada» sin poder determinarlo (sin consulta, consulta falla, parcial, otro monto, sigue AUTHORIZED): «incierta»", async () => {
  const casos = [
    undefined,
    async () => { throw new Error("red caída"); },
    async () => ({ estado: "PARTIALLY_NULLIFIED", monto: 15000, saldo: 5000 }),
    async () => ({ estado: "NULLIFIED", monto: 9000, saldo: 0 }),
    async () => ({ estado: "AUTHORIZED", monto: 15000, saldo: 15000 }),
    async () => ({ estado: null, monto: null, saldo: null }),
  ];
  for (const [i, consulta] of casos.entries()) {
    const e = entorno({ transbank: lanza422("Transaction already nullified") });
    if (consulta) e.deps.estadoTransaccion = consulta;
    const r = await ejecutarDevolucionWebpay(e.deps, PEDIDO);
    assert.equal(r.resultado, "incierta", `caso ${i}`);
    assert.equal(e.reembolso.estado, "incierto", `caso ${i}`);
    assert.equal((await ejecutarDevolucionWebpay(e.deps, PEDIDO)).resultado, "ocupada", `no se reintenta sola, caso ${i}`);
  }
});

test("422 por monto inválido o fuera de plazo sigue siendo «error» y no consulta el estado", async () => {
  for (const m of ["Invalid value for parameter: amount", "Refund period expired"]) {
    const e = entorno({ transbank: lanza422(m) });
    let consultas = 0;
    e.deps.estadoTransaccion = async () => { consultas++; return { estado: "NULLIFIED", monto: 15000, saldo: 0 }; };
    assert.equal((await ejecutarDevolucionWebpay(e.deps, PEDIDO)).resultado, "rechazada", m);
    assert.equal(e.reembolso.estado, "error", m);
    assert.equal(consultas, 0, m);
  }
});
