/**
 * Reportes de SOLO LECTURA de la tienda para Claude: ventas por período, más
 * vendidos, estado del catálogo, carritos abandonados y uso de cupones.
 *
 * Todos con período y límites (nunca vuelcan miles de filas), sin datos
 * personales de clientes (los carritos salen sin correo, teléfono ni sesión),
 * y sin escribir nada. Los cálculos viven en lib/reportes/* (puros, probados);
 * las lecturas entran por `DepsReportes` para probarlas sin servidor y la
 * conexión real se carga recién al ejecutar.
 */
import { defineHerramienta, ErrorHerramienta, z, type Herramienta } from "./registro.ts";
import type { D1Like } from "../../gestion/index.ts";
import { diaValido, limitesPeriodo, resolverPeriodo, textoPeriodo, type Periodo } from "../../admin/ventas.ts";
import { masVendidos, resumenVentas, type PedidoReporte } from "../../reportes/ventas.ts";
import { reporteCatalogo, TIPOS_REPORTE_CATALOGO, type FilaProducto } from "../../reportes/catalogo.ts";
import { cargarArchivados, filtrarArchivados } from "../../pedidos/archivados.ts";
import { AVISO_DATO_DE_CLIENTE, datoDeCliente } from "./contenido-comun.ts";
import { resumenCarritos, type CarritoAbandonadoFila } from "../../reportes/carritos.ts";
import { usosDeCuponesConCodigo, type UsosCupon } from "../../cupones/reportes.ts";

/** Los reportes excluyen los pedidos ARCHIVADOS (una consulta acotada a D1). Sin la tabla o sin D1: no se excluye nada. */
async function sinArchivados<T extends { numero: string }>(db: D1Like, lista: T[]): Promise<T[]> {
  try {
    return filtrarArchivados(lista, await cargarArchivados(db), "excluir");
  } catch {
    return lista;
  }
}

/** Mismo tope de pedidos por período que el panel de Ventas. */
export const LIMITE_PERIODO = 3000;
export const MAX_PRODUCTOS_REPORTE = 10_000;
export const MAX_CARRITOS_REPORTE = 2_000;

export interface DepsReportes {
  pedidosRango(desdeISO: string, hastaISO: string, limite: number): Promise<PedidoReporte[]>;
  productosActivos(max: number): Promise<{ filas: FilaProducto[]; truncado: boolean }>;
  carritosAbandonados(desdeISO: string, hastaISO: string, max: number): Promise<{ filas: CarritoAbandonadoFila[]; truncado: boolean }>;
  usosDeCupones(db: D1Like, desdeMs: number, hastaMs: number): Promise<UsosCupon[]>;
}

export const depsReportesReales: DepsReportes = {
  async pedidosRango(desde, hasta, limite) {
    const m = await import("@/lib/pedidos");
    return (await m.pedidos().listarRango({ desde, hasta, limite })) as unknown as PedidoReporte[];
  },
  async productosActivos(max) {
    const { supabaseAdmin } = await import("@jurmaq/shared/supabase");
    const filas: FilaProducto[] = [];
    const PAGINA = 1000;
    for (let desde = 0; desde < max; desde += PAGINA) {
      const { data, error } = await supabaseAdmin
        .from("barraca_productos")
        .select("id, codigo, nombre, precio, costo, stock, imagen, solo_cotizar")
        .eq("activo", true)
        .order("id", { ascending: true })
        .range(desde, Math.min(desde + PAGINA, max) - 1);
      if (error) throw new Error("productos");
      const lote = (data ?? []) as unknown as FilaProducto[];
      filas.push(...lote);
      if (lote.length < PAGINA) return { filas, truncado: false };
    }
    return { filas, truncado: true };
  },
  async carritosAbandonados(desde, hasta, max) {
    const { supabaseAdmin } = await import("@jurmaq/shared/supabase");
    // SOLO items, total y fecha: jamás correo, teléfono ni sesión.
    const { data, error } = await supabaseAdmin
      .from("barraca_carrito_abandonado")
      .select("items, total, last_activity")
      .is("converted_at", null)
      .gte("last_activity", desde)
      .lt("last_activity", hasta)
      .order("last_activity", { ascending: false })
      .limit(max);
    if (error) throw new Error("carritos");
    const filas = (data ?? []) as unknown as CarritoAbandonadoFila[];
    return { filas, truncado: filas.length >= max };
  },
  async usosDeCupones(db, desde, hasta) {
    const { repoAdminSupabase } = await import("@/lib/cupones/repo-supabase");
    return usosDeCuponesConCodigo(db, repoAdminSupabase, { desde, hasta });
  },
};

const zDia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa la fecha AAAA-MM-DD.");
const PRESETS = ["hoy", "7d", "mes", "mes_pasado"] as const;

const ESQUEMA_PERIODO = {
  periodo: z.enum(PRESETS).optional().describe("hoy, 7d, mes (por defecto) o mes_pasado."),
  desde: zDia.optional().describe("AAAA-MM-DD; con «hasta», reemplaza a «periodo»."),
  hasta: zDia.optional().describe("AAAA-MM-DD, incluido; máx. 400 días."),
};

function periodoDe(a: { periodo?: (typeof PRESETS)[number]; desde?: string; hasta?: string }, ahora: number): Periodo {
  if ((a.desde && !a.hasta) || (!a.desde && a.hasta)) throw new ErrorHerramienta("Para un rango, indica «desde» y «hasta» juntos.");
  if (a.desde && a.hasta) {
    if (!diaValido(a.desde) || !diaValido(a.hasta) || a.desde > a.hasta) throw new ErrorHerramienta("Las fechas no son válidas: usa AAAA-MM-DD y que «desde» no sea después de «hasta».");
    const p = resolverPeriodo("rango", a.desde, a.hasta, new Date(ahora));
    if (p.preset !== "rango") throw new ErrorHerramienta("El período es demasiado largo (máximo 400 días).");
    return p;
  }
  return resolverPeriodo(a.periodo ?? "mes", null, null, new Date(ahora));
}

const cl = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const ANOTACION_LECTURA = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;

export function crearHerramientasReportes(deps: DepsReportes = depsReportesReales): Herramienta[] {
  const ventas = defineHerramienta({
    nombre: "reporte_ventas",
    titulo: "Reporte de ventas por período",
    descripcion:
    "Ventas de un período: total, pedidos, ticket medio y desglose por forma de pago. Cuenta pedidos pagados según el panel (pagado, en preparación, listo para retiro, despachado o entregado) por fecha del pedido, hora de Chile. Por defecto, el mes en curso.",
    esquema: z.object(ESQUEMA_PERIODO),
    anotaciones: ANOTACION_LECTURA,
    async ejecutar(a, ctx) {
      const periodo = periodoDe(a, ctx.ahora);
      const lim = limitesPeriodo(periodo);
      const todos = await deps.pedidosRango(lim.desde, lim.hasta, LIMITE_PERIODO);
      const lista = await sinArchivados(ctx.db, todos);
      const r = resumenVentas(lista);
      const truncado = todos.length >= LIMITE_PERIODO;
      const texto = [
        `Ventas ${textoPeriodo(periodo)}: ${cl(r.total)} en ${r.pedidos} pedido${r.pedidos === 1 ? "" : "s"}, ticket medio ${cl(r.ticketMedio)}.`,
        r.porFormaDePago.length ? `Por forma de pago: ${r.porFormaDePago.map((f) => `${f.formaPago} ${cl(f.total)} (${f.pedidos})`).join(" · ")}.` : "No hubo ventas en el período.",
        `Despachos cobrados dentro de esas ventas: ${cl(r.despachos)}.`,
        ...(truncado ? [`Aviso: el período tiene ${LIMITE_PERIODO} pedidos o más y puede estar incompleto; acorta las fechas.`] : []),
      ].join("\n");
      return { texto, datos: { desde: periodo.desde, hasta: periodo.hasta, ...r, truncado } };
    },
  });

  const vendidos = defineHerramienta({
    nombre: "reporte_mas_vendidos",
    titulo: "Productos más vendidos",
    descripcion:
    "Productos más vendidos de un período (por código): unidades, ingresos y pedidos. Mismo criterio que reporte_ventas. Máximo 50; por defecto 10 por unidades.",
    esquema: z.object({
      ...ESQUEMA_PERIODO,
      limite: z.number().int().min(1).max(50).optional().describe("Cuántos productos mostrar (máximo 50, por defecto 10)."),
      orden: z.enum(["unidades", "ingresos"]).optional().describe("Ordenar por unidades vendidas (por defecto) o por ingresos."),
    }),
    anotaciones: ANOTACION_LECTURA,
    async ejecutar(a, ctx) {
      const periodo = periodoDe(a, ctx.ahora);
      const lim = limitesPeriodo(periodo);
      const todos = await deps.pedidosRango(lim.desde, lim.hasta, LIMITE_PERIODO);
      const lista = await sinArchivados(ctx.db, todos);
      const top = masVendidos(lista, a.limite ?? 10, a.orden ?? "unidades");
      const truncado = todos.length >= LIMITE_PERIODO;
      const lineas = top.map((p, i) => `${i + 1}. ${p.nombre}${p.codigo ? ` [${p.codigo}]` : ""}: ${p.unidades} un. · ${cl(p.ingresos)} · ${p.pedidos} pedido${p.pedidos === 1 ? "" : "s"}`);
      return {
        texto: `Más vendidos ${textoPeriodo(periodo)}:\n${lineas.length ? lineas.join("\n") : "No hubo ventas en el período."}${truncado ? "\nAviso: período muy grande, puede estar incompleto." : ""}`,
        datos: { desde: periodo.desde, hasta: periodo.hasta, productos: top, truncado },
      };
    },
  });

  const catalogo = defineHerramienta({
    nombre: "reporte_catalogo",
    titulo: "Reporte de estado del catálogo",
    descripcion:
    "Lista productos activos con un problema: sin_foto, sin_stock (los «solo cotizar» no cuentan), bajo_costo o margen_menor_15. Agrupa por código. Paginado, máximo 50 por página.",
    esquema: z.object({
      tipo: z.enum(TIPOS_REPORTE_CATALOGO).describe("Qué problema buscar."),
      pagina: z.number().int().min(1).max(500).optional().describe("Página, desde 1."),
      por_pagina: z.number().int().min(1).max(50).optional().describe("Productos por página (máximo 50, por defecto 25)."),
    }),
    anotaciones: ANOTACION_LECTURA,
    async ejecutar(a) {
      const { filas, truncado } = await deps.productosActivos(MAX_PRODUCTOS_REPORTE);
      const r = reporteCatalogo(filas, a.tipo, a.pagina ?? 1, a.por_pagina ?? 25);
      const titulos = { sin_foto: "sin foto", sin_stock: "sin stock", bajo_costo: "con precio bajo el costo", margen_menor_15: "con menos de 15 % sobre el costo" } as const;
      const lineas = r.items.map((i) => {
        const extra = a.tipo === "bajo_costo" || a.tipo === "margen_menor_15"
          ? ` · precio ${i.precio === null ? "?" : cl(i.precio)} · costo ${i.costo === null ? "?" : cl(i.costo)} · utilidad ${i.margenPct === null ? "?" : `${i.margenPct}%`}`
          : a.tipo === "sin_stock" ? ` · stock ${i.stock ?? "vacío"}` : "";
        return `- ${i.nombre}${i.codigo ? ` [${i.codigo}]` : ""}${i.fichas > 1 ? ` (${i.fichas} fichas)` : ""}${extra}`;
      });
      return {
        texto: `Productos ${titulos[a.tipo]}: ${r.total}. Página ${r.pagina} de ${r.paginas}.\n${lineas.length ? lineas.join("\n") : "Ninguno."}${truncado ? `\nAviso: el catálogo pasa de ${MAX_PRODUCTOS_REPORTE} fichas y se revisaron solo las primeras.` : ""}`,
        datos: { ...r, truncado },
      };
    },
  });

  const carritos = defineHerramienta({
    nombre: "reporte_carritos_abandonados",
    titulo: "Reporte de carritos abandonados",
    descripcion:
    "Carritos abandonados de un período: cantidad, monto total y promedio, y los productos más dejados. Sin datos personales. Por defecto, el mes en curso.",
    esquema: z.object({
      ...ESQUEMA_PERIODO,
      limite_productos: z.number().int().min(1).max(30).optional().describe("Cuántos productos mostrar (máximo 30, por defecto 10)."),
    }),
    anotaciones: ANOTACION_LECTURA,
    async ejecutar(a, ctx) {
      const periodo = periodoDe(a, ctx.ahora);
      const lim = limitesPeriodo(periodo);
      const { filas, truncado } = await deps.carritosAbandonados(lim.desde, lim.hasta, MAX_CARRITOS_REPORTE);
      const r = resumenCarritos(filas, a.limite_productos ?? 10);
      // Los nombres vienen de una tabla que escribe el público (aunque hoy se sanea al guardar): se entregan como dato.
      const lineas = r.productosMasDejados.map((p) => `- ${datoDeCliente(p.nombre, 120).replace(/\n/g, " ")}: en ${p.carritos} carrito${p.carritos === 1 ? "" : "s"} (${p.unidades} un.)`);
      return {
        texto: `Carritos abandonados ${textoPeriodo(periodo)}: ${r.carritos}, por ${cl(r.montoTotal)} en total (promedio ${cl(r.montoPromedio)}).\n${lineas.length ? `Productos que más se dejaron:\n${lineas.join("\n")}` : "Sin productos para mostrar."}${truncado ? `\nAviso: hay ${MAX_CARRITOS_REPORTE} carritos o más y se contaron solo los más nuevos.` : ""}\n${AVISO_DATO_DE_CLIENTE}`,
        datos: { desde: periodo.desde, hasta: periodo.hasta, ...r, productosMasDejados: r.productosMasDejados.map((p) => ({ ...p, nombre: datoDeCliente(p.nombre, 120) })), truncado },
      };
    },
  });

  const cupones = defineHerramienta({
    nombre: "reporte_cupones",
    titulo: "Reporte de uso de cupones",
    descripcion:
    "Cuántas veces se usó cada cupón en un período (confirmados, reservados, liberados), descuento entregado y monto de compra. Sin datos personales. Con el interruptor apagado no habrá usos.",
    esquema: z.object(ESQUEMA_PERIODO),
    anotaciones: ANOTACION_LECTURA,
    async ejecutar(a, ctx) {
      const periodo = periodoDe(a, ctx.ahora);
      const lim = limitesPeriodo(periodo);
      const usos = (await deps.usosDeCupones(ctx.db, Date.parse(lim.desde), Date.parse(lim.hasta))).slice(0, 50);
      const lineas = usos.map((u) => `- ${u.codigo ?? u.cuponId}: ${u.confirmados} usos confirmados · ${u.reservadosVigentes} reservados · ${u.liberados} liberados · descuento ${cl(u.descuentoTotal)} sobre compras por ${cl(u.montoCompraTotal)}`);
      return {
        texto: `Cupones ${textoPeriodo(periodo)}:\n${lineas.length ? lineas.join("\n") : "No hubo usos de cupones en el período."}`,
        datos: { desde: periodo.desde, hasta: periodo.hasta, cupones: usos },
      };
    },
  });

  return [ventas, vendidos, catalogo, carritos, cupones] as Herramienta[];
}

export const herramientasReportes: Herramienta[] = crearHerramientasReportes();
