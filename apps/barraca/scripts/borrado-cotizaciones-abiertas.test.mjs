// Borrar datos de una persona NO toca cotizaciones aprobadas o aceptadas (cobro en curso).
// Correr: node --test scripts/borrado-cotizaciones-abiertas.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { montar, NUM, PIMIENTA } from "./pruebas/dinero-arnes.mjs";
import { planificarPersona, ESTADOS_COTIZACION_ABIERTA } from "../src/lib/borrado/personas.ts";

const CORREO = "juana.perez@correo.cl";
const datos = (cotizaciones) => ({
  suscriptores: [{ id: 1, email: CORREO }],
  carritos: [{ email: CORREO }],
  cotizaciones: cotizaciones.map((estado) => ({ email: CORREO, estado, nombre: "Juana", payment_url: "https://pago.example/x" })),
  pedidos: [], opiniones: [],
});

for (const abierta of ["aprobada", "aceptada"]) {
  test(`cotización ${abierta}: el borrado de la persona se niega y no se anonimiza nada`, async () => {
    const m = await montar({ datosPersonas: datos(["pendiente", abierta]) });
    const v = await m.llamar("borrar_datos_persona", { correo: CORREO, alcance: "cliente_completo" });
    await m.falla("borrar_datos_persona", { correo: CORREO, alcance: "cliente_completo", id_vista_previa: v.datos.idVistaPrevia }, /cotizaci[oó]n\(es\) abierta\(s\)[^]*No se hizo nada/);
    const d = m.personas.datos;
    assert.equal(d.suscriptores.length, 1, "no se borró nada");
    assert.equal(d.carritos.length, 1);
    for (const c of d.cotizaciones) assert.equal(c.nombre, "Juana", "ninguna cotización se anonimizó");
  });
}

test("planificarPersona niega con una cotización abierta (también al sumar un pedido abierto) y no con las demás", async () => {
  const puerto = (cot, pedidos = []) => ({
    contarSuscriptores: async () => 0, contarCarritos: async () => 0, cotizaciones: async () => cot, pedidos: async () => pedidos,
    contarOpiniones: async () => 0, usuariosAntiguos: async () => 0, contarNotasInternas: async () => 0,
  });
  const p1 = await planificarPersona(puerto({ total: 2, pagadas: 0, abiertas: 1 }), CORREO, "cliente_completo", PIMIENTA);
  assert.equal(p1.cotizacionesAbiertas, 1);
  assert.match(p1.negado ?? "", /cotizaci[oó]n\(es\) abierta/);
  const p2 = await planificarPersona(puerto({ total: 2, pagadas: 1, abiertas: 0 }), CORREO, "cliente_completo", PIMIENTA);
  assert.equal(p2.negado, null);
  const p3 = await planificarPersona(puerto({ total: 1, pagadas: 0, abiertas: 1 }, [{ numero: NUM("A"), estado: "pendiente_pago", pagado: false, comprobante_path: null }]), CORREO, "cliente_completo", PIMIENTA);
  assert.match(p3.negado ?? "", /pedido\(s\) abierto\(s\)[^]*cotizaci[oó]n/);
});

test("la conexión real excluye aprobada y aceptada al anonimizar y las cuenta como abiertas (revisión del código)", () => {
  assert.deepEqual(ESTADOS_COTIZACION_ABIERTA, ["aprobada", "aceptada"]);
  const src = readFileSync(new URL("../src/lib/borrado/personas-supabase.ts", import.meta.url), "utf8");
  assert.match(src, /\.not\("estado", "in", `\(pagada,\$\{ESTADOS_COTIZACION_ABIERTA\.join\(","\)\}\)`\)/);
  assert.match(src, /q\.in\("estado", ESTADOS_COTIZACION_ABIERTA\)/);
  assert.doesNotMatch(src, /\.neq\("estado", "pagada"\)/);
});

test("con cotizaciones solo pendientes el borrado sigue funcionando", async () => {
  const m = await montar({ datosPersonas: datos(["pendiente", "enviada"]) });
  const v = await m.llamar("borrar_datos_persona", { correo: CORREO, alcance: "cliente_completo" });
  await m.llamar("borrar_datos_persona", { correo: CORREO, alcance: "cliente_completo", id_vista_previa: v.datos.idVistaPrevia });
  assert.ok(m.personas.datos.cotizaciones.every((c) => c.nombre === "Anonimizado"));
});
