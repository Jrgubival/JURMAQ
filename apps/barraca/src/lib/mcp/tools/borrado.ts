/**
 * Herramientas MCP de BORRADO (scope `tienda:dinero`, con aviso a Jorge por cada operación):
 *  - archivar_pedido (dos pasos en uno) / desarchivar_pedido: reversible; sale de listas y reportes (D1 `pedidos_archivados`).
 *  - borrar_pedido_definitivo (dos pasos en uno): SOLO un pedido cancelado que nunca se pagó, sin documento ni devolución.
 *  - borrar_datos_persona (dos pasos en uno): un cliente o un suscriptor, de a uno (ver lib/borrado/personas.ts).
 * "Dos pasos en uno": sin `id_vista_previa` muestra la vista previa; con el id (de un solo uso, 10 minutos, ligado al
 * usuario, con huella) aplica. Auditoría sin datos personales: número de pedido, estado, monto, quién y cuándo
 * (a las personas, solo una referencia corta).
 */
import { defineHerramienta, ErrorHerramienta, z, type Herramienta } from "./registro.ts";
import { huellaDeDatos } from "../../gestion/index.ts";
import { PATRON_NUMERO } from "../../pedidos/numero.ts";
import { ETIQUETA_ESTADO_MCP } from "../../pedidos/vista-mcp.ts";
import type { EstadoPedido, Reembolso } from "../../pedidos/index.ts";
import { archivarPedido, desarchivarPedido, estaArchivado } from "../../pedidos/archivados.ts";
import { ESTADOS_A_MEDIAS, TEXTO_ESTADO_DEVOLUCION, leerDevolucion } from "../../pedidos/devoluciones-d1.ts";
import { aplicarBorradoPersona, planificarPersona, datosParaHuella, normalizarCorreo, type PlanPersona, type PuertoPersonas } from "../../borrado/personas.ts";
import { auditarSeguro, cl, conAvisoDinero, exigirAvisoPosible, gastarVista, nuevaVista, type DepsAvisoDinero } from "./dinero-comun.ts";
import type { D1Like } from "../../gestion/tipos.ts";

export interface PedidoBorrable {
  numero: string;
  estado: EstadoPedido;
  total: number;
  items: unknown[];
  pagado_at: string | null;
  stock_descontado: boolean;
  reembolso?: Reembolso | null;
  documento_path?: string | null;
  documento_subido_at?: string | null;
  documento_enviado_at?: string | null;
  comprobante_path?: string | null;
  cancelacion_motivo?: string | null;
  pasarela_referencia?: string | null;
}

export interface PuertoBorrado {
  porNumero(numero: string): Promise<PedidoBorrable | null>;
  eventos(numero: string): Promise<unknown[]>;
  borrarPedidoNuncaPagado(numero: string): Promise<boolean>;
}

export interface DepsBorrado extends DepsAvisoDinero {
  puerto(): Promise<PuertoBorrado>;
  personas(db: D1Like): Promise<PuertoPersonas>;
  borrarComprobante(ruta: string): Promise<void>;
}

export const depsBorradoReales: DepsBorrado = {
  async puerto() {
    const m = await import("@/lib/pedidos");
    return m.pedidos() as unknown as PuertoBorrado;
  },
  async personas(db) {
    return (await import("../../borrado/personas-supabase.ts")).crearPuertoPersonasReal(db);
  },
  async borrarComprobante(ruta) { await (await import("@/lib/pedidos/comprobantes")).borrarComprobante(ruta); },
  aviso: async () => (await import("../aviso-servidor.ts")).depsAvisoReales(),
};

const zNumero = z.string().trim().toUpperCase().regex(PATRON_NUMERO, "Número de pedido inválido. Tiene la forma BJ-261026-7KQ4.");
const zNumeros = z.array(zNumero).min(1).max(20);
const zId = z.string().trim().min(8).max(16);
const T_ARCHIVAR = "borrado_archivar";
const T_BORRAR_PEDIDO = "borrado_pedido";
const T_PERSONA = "borrado_persona";
const NO_DESHACE = "NO SE PUEDE DESHACER.";

const unicos = (xs: string[]) => [...new Set(xs)].sort();

/** ¿Se puede archivar? (cualquier estado salvo una devolución en curso, incierta o a medias). */
export function motivoNoArchivable(p: PedidoBorrable, devolucionD1: string | null): string | null {
  if (p.reembolso?.estado === "en_curso" || p.reembolso?.estado === "incierto") return "tiene una devolución en curso o incierta: resuélvela primero en el panel";
  if (devolucionD1 && (ESTADOS_A_MEDIAS as readonly string[]).includes(devolucionD1)) return "tiene una devolución a medias: resuélvela primero en el panel";
  return null;
}

/** Reglas del borrado definitivo de un pedido (puras). */
export function motivoNoBorrable(p: PedidoBorrable, devolucionD1: string | null): string | null {
  if (p.pagado_at) return "ya fue PAGADO: los pedidos pagados no se borran nunca (son respaldo tributario). Se archivan o se cancelan con devolución";
  if (p.estado !== "cancelado") return `está «${ETIQUETA_ESTADO_MCP[p.estado]}»: solo se borra un pedido cancelado o vencido`;
  if (p.documento_path || p.documento_subido_at || p.documento_enviado_at) return "tiene boleta o factura subida (respaldo tributario)";
  if (p.reembolso || devolucionD1) return "tiene una devolución registrada";
  if (p.stock_descontado) return "su stock sigue descontado (revísalo en el panel antes)";
  return null;
}

async function usosDeCupon(db: D1Like, numero: string): Promise<{ total: number; noLiberados: number }> {
  const f = await db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN estado <> 'liberada' THEN 1 ELSE 0 END) AS no FROM cupon_usos WHERE pedido_numero = ?").bind(numero).first<{ total: number; no: number | null }>().catch(() => null);
  return { total: f?.total ?? 0, noLiberados: f?.no ?? 0 };
}

export function crearHerramientasBorrado(deps: DepsBorrado = depsBorradoReales): Herramienta[] {
  const destructiva = { readOnlyHint: false, destructiveHint: true, idempotentHint: false };

  // ───────── archivar ─────────
  async function estadoArchivado(db: D1Like, puerto: PuertoBorrado, numeros: string[]) {
    const filas: Array<{ numero: string; estado?: EstadoPedido; motivo: string | null }> = [];
    for (const numero of numeros) {
      const p = await puerto.porNumero(numero);
      if (!p) { filas.push({ numero, motivo: "no existe" }); continue; }
      if (await estaArchivado(db, numero)) { filas.push({ numero, estado: p.estado, motivo: "ya está archivado" }); continue; }
      const d = await leerDevolucion(db, numero);
      filas.push({ numero, estado: p.estado, motivo: motivoNoArchivable(p, d?.estado ?? null) });
    }
    return filas;
  }

  const archivar = defineHerramienta({
    nombre: "archivar_pedido",
    titulo: "Archivar pedidos",
    descripcion: "DINERO/BORRADO, dos pasos en uno: sin id_vista_previa muestra qué se archiva; con el id lo aplica. Archivar es REVERSIBLE (desarchivar_pedido): salen de listas y reportes, nada se borra. Hasta 20 pedidos por vez.",
    esquema: z.object({ numeros: zNumeros.describe("Números de pedido."), id_vista_previa: zId.optional().describe("Solo para aplicar: id de la vista previa.") }),
    scope: "tienda:dinero",
    anotaciones: { ...destructiva, destructiveHint: true, idempotentHint: true },
    async ejecutar({ numeros: crudos, id_vista_previa }, ctx) {
      const numeros = unicos(crudos);
      const puerto = await deps.puerto();
      const filas = await estadoArchivado(ctx.db, puerto, numeros);
      const ok = filas.filter((f) => !f.motivo);
      const huella = await huellaDeDatos({ ok: ok.map((f) => [f.numero, f.estado]), n: numeros });
      if (!id_vista_previa) {
        if (!ok.length) throw new ErrorHerramienta(`No hay nada que archivar: ${filas.map((f) => `${f.numero} ${f.motivo}`).join("; ")}.`);
        const vp = await nuevaVista(ctx, T_ARCHIVAR, { numeros }, huella);
        const texto = [
          `Vista previa: ARCHIVAR ${ok.length} pedido(s): ${ok.map((f) => `${f.numero} («${ETIQUETA_ESTADO_MCP[f.estado!]}»)`).join(", ")}.`,
          ...filas.filter((f) => f.motivo).map((f) => `No se archiva ${f.numero}: ${f.motivo}.`),
          "Es REVERSIBLE: nada se borra ni cambia de estado. Dejan de verse en las listas, los reportes de ventas y las cuentas de «por atender» (si está pagado y sin despachar, no se te olvide atenderlo). Se recuperan con desarchivar_pedido.",
          `Para aplicar: archivar_pedido con los mismos numeros e id_vista_previa ${vp.id} (10 minutos, una vez).`,
        ].join("\n");
        return { texto, datos: { idVistaPrevia: vp.id, expiraEn: vp.expiraEn, archivables: ok.map((f) => f.numero), omitidos: filas.filter((f) => f.motivo), reversible: true } };
      }
      if (!ok.length) throw new ErrorHerramienta("Ninguno de esos pedidos se puede archivar ahora. Previsualiza de nuevo.");
      const avisoDeps = await exigirAvisoPosible(deps);
      await gastarVista(ctx, id_vista_previa, T_ARCHIVAR, huella);
      const { resultado, lineaAviso } = await conAvisoDinero(
        ctx, avisoDeps,
        { herramienta: "archivar_pedido", operacion: "Archivar pedidos", pedidoNumero: ok.length === 1 ? ok[0].numero : null, resumen: `Se archivaron ${ok.length} pedido(s): ${ok.map((f) => f.numero).join(", ")}.` },
        async () => {
          const hechos: Array<{ numero: string; estado: string }> = [];
          for (const f of ok) if (await archivarPedido(ctx.db, { numero: f.numero, estado: f.estado!, usuarioId: ctx.usuario.id, ahora: ctx.ahora })) hechos.push({ numero: f.numero, estado: f.estado! });
          return hechos;
        },
      );
      const nota = await auditarSeguro(ctx, resultado.map((h) => ({ entidad: "pedido_archivado", entidadId: h.numero, antes: { archivado: false, estado: h.estado }, despues: { archivado: true } })));
      return { texto: `Listo: ${resultado.length} pedido(s) archivado(s). Se recuperan con desarchivar_pedido.${nota}\n${lineaAviso}`, datos: { archivados: resultado.map((h) => h.numero), loteId: ctx.loteId, reversible: true } };
    },
  });

  const desarchivar = defineHerramienta({
    nombre: "desarchivar_pedido",
    titulo: "Desarchivar pedidos",
    descripcion: "BORRADO: vuelve a mostrar pedidos archivados en las listas y reportes. Directo (es reversible y no borra nada). Hasta 20 por vez; avisa a Jorge.",
    esquema: z.object({ numeros: zNumeros.describe("Números de pedido archivados.") }),
    scope: "tienda:dinero",
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ejecutar({ numeros: crudos }, ctx) {
      const numeros = unicos(crudos);
      const avisoDeps = await exigirAvisoPosible(deps);
      const { resultado, lineaAviso } = await conAvisoDinero(
        ctx, avisoDeps,
        { herramienta: "desarchivar_pedido", operacion: "Desarchivar pedidos", pedidoNumero: numeros.length === 1 ? numeros[0] : null, resumen: `Se desarchivaron pedidos: ${numeros.join(", ")}.` },
        async () => {
          const hechos: string[] = [];
          for (const n of numeros) if (await desarchivarPedido(ctx.db, n)) hechos.push(n);
          return hechos;
        },
      );
      const nota = await auditarSeguro(ctx, resultado.map((n) => ({ entidad: "pedido_archivado", entidadId: n, antes: { archivado: true }, despues: { archivado: false } })));
      const sin = numeros.filter((n) => !resultado.includes(n));
      return { texto: `${resultado.length ? `Listo: ${resultado.length} pedido(s) vuelven a verse.` : "Ninguno estaba archivado."}${sin.length && resultado.length ? ` No estaban archivados: ${sin.join(", ")}.` : ""}${nota}\n${lineaAviso}`, datos: { desarchivados: resultado, loteId: ctx.loteId } };
    },
  });

  // ───────── borrar pedido definitivo ─────────
  async function planPedido(ctx: { db: D1Like }, numero: string) {
    const puerto = await deps.puerto();
    const p = await puerto.porNumero(numero);
    if (!p) throw new ErrorHerramienta("No encontré ese pedido.");
    const d = await leerDevolucion(ctx.db, numero);
    const motivo = motivoNoBorrable(p, d?.estado ?? null);
    if (motivo) throw new ErrorHerramienta(`No se puede borrar el pedido ${numero}: ${motivo}.${d ? ` (${TEXTO_ESTADO_DEVOLUCION[d.estado]})` : ""}`);
    const usos = await usosDeCupon(ctx.db, numero);
    if (usos.noLiberados > 0) throw new ErrorHerramienta(`No se puede borrar el pedido ${numero}: un cupón sigue reservado o usado en él.`);
    const nEventos = (await puerto.eventos(numero)).length;
    const notas = (await ctx.db.prepare("SELECT COUNT(*) AS n FROM pedido_notas WHERE numero = ?").bind(numero).first<{ n: number }>().catch(() => null))?.n ?? 0;
    const archivado = await estaArchivado(ctx.db, numero);
    const resumen = { numero, estado: p.estado, total: p.total, items: p.items.length, eventos: nEventos, notas, usosCupon: usos.total, comprobante: !!p.comprobante_path, archivado };
    return { puerto, p, resumen, huella: await huellaDeDatos(resumen) };
  }

  const borrarPedido = defineHerramienta({
    nombre: "borrar_pedido_definitivo",
    titulo: "Borrar un pedido para siempre",
    descripcion: "BORRADO IRREVERSIBLE, dos pasos en uno: sin id_vista_previa muestra qué se borra; con el id y el mismo número lo borra. SOLO pedidos cancelados/vencidos que nunca se pagaron, sin boleta/factura ni devolución. Los pagados NO se borran.",
    esquema: z.object({ numero: zNumero.describe("Número del pedido."), id_vista_previa: zId.optional().describe("Solo para borrar: id de la vista previa.") }),
    scope: "tienda:dinero",
    anotaciones: destructiva,
    async ejecutar({ numero, id_vista_previa }, ctx) {
      const { puerto, p, resumen, huella } = await planPedido(ctx, numero);
      if (!id_vista_previa) {
        const vp = await nuevaVista(ctx, T_BORRAR_PEDIDO, { numero }, huella);
        const texto = [
          `Vista previa: BORRAR PARA SIEMPRE el pedido ${numero} («${ETIQUETA_ESTADO_MCP[p.estado]}», ${cl(p.total)}, nunca pagado).`,
          `Se borra: el pedido, sus ${resumen.items} producto(s), ${resumen.eventos} registro(s) de historial${resumen.comprobante ? ", el comprobante subido por el cliente" : ""}, ${resumen.notas} nota(s) interna(s) y ${resumen.usosCupon} uso(s) de cupón ya liberados.${resumen.archivado ? " También deja de estar archivado." : ""}`,
          "No se toca: el stock (ya se devolvió al cancelar), los productos ni los cupones.",
          `${NO_DESHACE} Quedará solo una línea en el historial con número, estado y monto (sin datos personales).`,
          `Para borrar: borrar_pedido_definitivo con numero ${numero} e id_vista_previa ${vp.id} (10 minutos, una vez).`,
        ].join("\n");
        return { texto, datos: { idVistaPrevia: vp.id, expiraEn: vp.expiraEn, numero, seBorra: resumen, irreversible: true } };
      }
      const avisoDeps = await exigirAvisoPosible(deps);
      await gastarVista(ctx, id_vista_previa, T_BORRAR_PEDIDO, huella);
      const { resultado, lineaAviso } = await conAvisoDinero(
        ctx, avisoDeps,
        { herramienta: "borrar_pedido_definitivo", operacion: "Borrar pedido para siempre", pedidoNumero: numero, monto: p.total, resumen: "Pedido cancelado que nunca se pagó, borrado definitivamente." },
        async () => {
          // El delete es condicional en la base: si el pedido cambió (se pagó, subieron un documento...), no borra nada.
          if (!(await puerto.borrarPedidoNuncaPagado(numero))) return { ok: false as const };
          const limpieza: string[] = [];
          const intentar = async (nombre: string, f: () => Promise<unknown>) => { try { await f(); } catch { limpieza.push(nombre); } };
          await intentar("notas internas", () => ctx.db.prepare("DELETE FROM pedido_notas WHERE numero = ?").bind(numero).run());
          await intentar("usos de cupón", () => ctx.db.prepare("DELETE FROM cupon_usos WHERE pedido_numero = ? AND estado = 'liberada'").bind(numero).run());
          await intentar("archivado", () => desarchivarPedido(ctx.db, numero));
          if (p.comprobante_path) await intentar("comprobante", () => deps.borrarComprobante(p.comprobante_path!));
          return { ok: true as const, limpieza };
        },
        (x) => x.ok,
      );
      if (!resultado.ok) throw new ErrorHerramienta("El pedido cambió justo ahora (por ejemplo se pagó o tiene un documento) y NO se borró nada. Míralo con ver_pedido.");
      const nota = await auditarSeguro(ctx, [{ entidad: "pedido_borrado", entidadId: numero, antes: { estado: p.estado, monto: p.total, items: resumen.items }, despues: null }]);
      const pend = resultado.limpieza.length ? ` Quedaron sin limpiar (hazlo a mano): ${resultado.limpieza.join(", ")}.` : "";
      return { texto: `Listo: el pedido ${numero} se borró para siempre. ${NO_DESHACE}${pend}${nota}\n${lineaAviso}`, datos: { numero, borrado: true, loteId: ctx.loteId, irreversible: true, limpiezaPendiente: resultado.limpieza } };
    },
  });

  // ───────── borrar datos de una persona ─────────
  const lineasPlan = (pl: PlanPersona) => {
    const n = (v: number | null, t: string) => (v === null ? `${t}: la tabla no existe` : `${t}: ${v}`);
    if (pl.alcance === "suscriptor") return [n(pl.suscriptores, "Suscripciones a borrar")];
    return [
      n(pl.suscriptores, "Suscripciones a borrar"), n(pl.carritos, "Carritos abandonados a borrar"),
      `Pedidos nunca pagados y cerrados a anonimizar: ${pl.pedidosAnonimizar.length}${pl.comprobantes ? ` (con ${pl.comprobantes} comprobante(s) que se borran)` : ""}, con ${pl.notasInternas} nota(s) interna(s) a borrar`,
      `Pedidos PAGADOS que se CONSERVAN completos (respaldo tributario: el SII exige guardarlos 6 años): ${pl.pedidosConservarPagados}`,
      n(pl.cotizacionesAnonimizar, "Cotizaciones no pagadas a anonimizar") + (pl.cotizacionesConservar ? ` · pagadas que se conservan: ${pl.cotizacionesConservar}` : ""),
      n(pl.opiniones, "Opiniones cuyo autor se anonimiza (el texto se conserva)"), n(pl.cuentasAntiguas, "Cuentas antiguas a anonimizar"),
      "Se conservan a propósito las huellas de bajas de correo y de uso de cupones (no son un correo): borrarlas volvería a suscribir a quien pidió la baja.",
    ];
  };

  const borrarPersona = defineHerramienta({
    nombre: "borrar_datos_persona",
    titulo: "Borrar datos de un cliente o suscriptor",
    descripcion: "BORRADO IRREVERSIBLE, de A UNO y dos pasos en uno: sin id_vista_previa muestra qué tablas y cuántos registros; con el id y el MISMO correo, lo aplica. alcance: suscriptor (solo la lista de correos) o cliente_completo (borra o anonimiza; los pedidos pagados se conservan). No devuelve correos.",
    esquema: z.object({
      correo: z.string().trim().toLowerCase().email().max(120).describe("Correo de la persona, escrito por quien opera (no se muestra ni se lista)."),
      alcance: z.enum(["suscriptor", "cliente_completo"]).describe("suscriptor: solo la suscripción. cliente_completo: todo lo no tributario."),
      id_vista_previa: zId.optional().describe("Solo para aplicar: id de la vista previa."),
    }),
    scope: "tienda:dinero",
    anotaciones: destructiva,
    async ejecutar({ correo, alcance, id_vista_previa }, ctx) {
      const puerto = await deps.personas(ctx.db);
      const plan = await planificarPersona(puerto, correo, alcance);
      if (plan.pedidosAbiertos.length) {
        throw new ErrorHerramienta(`Hay ${plan.pedidosAbiertos.length} pedido(s) abierto(s) de esta persona (${plan.pedidosAbiertos.join(", ")}): una compra en curso. Cancélalos o espera a que cierren y vuelve a intentar. No se hizo nada.`);
      }
      if (plan.vacio) throw new ErrorHerramienta(`No encontré datos de esa persona para ${alcance === "suscriptor" ? "borrar de la lista de suscriptores" : "borrar o anonimizar"} (referencia ${plan.ref}). No se hizo nada.`);
      const huella = await huellaDeDatos(datosParaHuella(plan));
      if (!id_vista_previa) {
        const vp = await nuevaVista(ctx, T_PERSONA, { ref: plan.ref, alcance }, huella);
        const texto = [
          `Vista previa: ${alcance === "suscriptor" ? "BORRAR SUSCRIPTOR" : "BORRAR DATOS DE CLIENTE"} (referencia ${plan.ref}; el correo no se muestra).`,
          ...lineasPlan(plan).map((l) => `- ${l}`),
          `${NO_DESHACE} Se hace de a una persona.`,
          `Para aplicar: borrar_datos_persona con el MISMO correo, el mismo alcance e id_vista_previa ${vp.id} (10 minutos, una vez).`,
        ].join("\n");
        return { texto, datos: { idVistaPrevia: vp.id, expiraEn: vp.expiraEn, referencia: plan.ref, alcance, plan: { ...plan, pedidosAnonimizar: plan.pedidosAnonimizar.length }, irreversible: true } };
      }
      const avisoDeps = await exigirAvisoPosible(deps);
      await gastarVista(ctx, id_vista_previa, T_PERSONA, huella);
      let r;
      try {
        const o = await conAvisoDinero(
          ctx, avisoDeps,
          { herramienta: "borrar_datos_persona", operacion: alcance === "suscriptor" ? "Borrar suscriptor" : "Borrar datos de cliente", resumen: `Referencia ${plan.ref}, alcance ${alcance}.` },
          () => aplicarBorradoPersona(puerto, normalizarCorreo(correo), plan),
        );
        r = o;
      } catch (e) {
        if (e instanceof Error && e.message === "borrado_parcial") {
          throw new ErrorHerramienta(`El borrado se cortó a medias (referencia ${plan.ref}). Es seguro volver a intentarlo: previsualiza de nuevo.`);
        }
        throw e;
      }
      const x = r.resultado;
      const nota = await auditarSeguro(ctx, [{ entidad: "persona", entidadId: `ref:${plan.ref}`, antes: { alcance }, despues: { ...x } }]);
      return {
        texto: `Listo (referencia ${plan.ref}): suscripciones borradas ${x.suscriptoresBorrados}, carritos ${x.carritosBorrados}, pedidos anonimizados ${x.pedidosAnonimizados}, cotizaciones ${x.cotizacionesAnonimizadas}, opiniones ${x.opinionesAnonimizadas}, cuentas antiguas ${x.cuentasAnonimizadas}. Los pedidos pagados se conservaron. ${NO_DESHACE}${nota}\n${r.lineaAviso}`,
        datos: { referencia: plan.ref, resultado: x, loteId: ctx.loteId, irreversible: true },
      };
    },
  });

  return [archivar, desarchivar, borrarPedido, borrarPersona] as Herramienta[];
}

export const herramientasBorrado: Herramienta[] = crearHerramientasBorrado();
