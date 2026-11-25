/**
 * Herramientas de CUPONES de descuento: listar, ver, crear, editar, activar,
 * desactivar, usos por período y el interruptor general del checkout.
 *
 * Seguridad (reglas de Jorge):
 *  - Los cupones existentes NO funcionan solos: el checkout solo los aplica con
 *    el interruptor `cupones_checkout` (D1, tabla ajustes) encendido.
 *  - Encender el interruptor exige la aprobación de Jorge. `solicitar_encender_cupones`
 *    SOLO crea la solicitud (correo con enlace de un solo uso); `aplicar_encendido_cupones`
 *    enciende únicamente si esa aprobación existe, no venció, no se usó y los
 *    cupones activos siguen siendo los mismos que él vio. Sin el secreto
 *    BARRACA_APROBADOR_EMAIL todo queda bloqueado. Ningún otro camino enciende.
 *  - Antes de encender hay que aplicar la migración de Supabase
 *    supabase/migrations/2026_11_26_barraca_cupones_pedidos.sql y actualizar los
 *    términos (hoy dicen que no hay cupones). Esto se avisa en cada respuesta.
 *  - Topes de la herramienta (una IA no debe poder regalar la tienda): porcentaje
 *    hasta 50 % y monto fijo hasta $200.000. Más que eso se crea desde el panel.
 *  - Un cupón que queda ACTIVO por esta vía (crear activo, editar uno activo o activar)
 *    queda pendiente de la aprobación de Jorge (motivo cupon_activo): se repite la misma
 *    llamada cuando él aprueba. Apagar es siempre libre.
 *  - Validación dura: todo cupón por MCP exige tope de usos (total o por cliente) y, si es
 *    de monto fijo, una compra mínima de al menos el valor + el piso cobrable ($1.000).
 *    Además el checkout nunca deja los productos bajo el piso cobrable (lib/cupones/totales.ts).
 *  - Solo cifras: nunca se entregan correos, RUT ni huellas de clientes.
 */
import type { D1Like } from "../../gestion/tipos.ts";
import { huellaDeDatos } from "../../gestion/util.ts";
import {
  activarCupon,
  crearCupon,
  desactivarCupon,
  editarCupon,
  listarCuponesAdmin,
  type CambiosCupon,
  type CuponListado,
  type RepoCuponesAdmin,
} from "../../cupones/admin.ts";
import { apagarInterruptorCupones, encenderInterruptorCupones, leerInterruptorCupones, type HookAprobacion } from "../../cupones/interruptor.ts";
import { leerReglas, type ReglasCupon } from "../../cupones/reglas.ts";
import { usosDeCuponesConCodigo, usosDeCuponesPorDia } from "../../cupones/reportes.ts";
import type { CuponRegistro } from "../../cupones/servicio.ts";
import {
  consumirAprobacion,
  crearAprobacionAutomatica,
  estadoAprobacion,
  requiereAprobacion,
  TEXTO_MOTIVO,
  type DatosSolicitud,
  type EstadoAprobacion,
  type ResultadoSolicitud,
} from "../aprobaciones.ts";
import { exigirAprobacion } from "../../gestion-precios/aprobacion.ts";
import { avisoPosible } from "../modo-avisar.ts";
import { PISO_COBRABLE_MINIMO } from "../../cupones/totales.ts";
import { defineHerramienta, ErrorHerramienta, z, type ContextoHerramienta, type Herramienta, type Revertidor, type SalidaHerramienta } from "./registro.ts";
import { aEnteroSeguro, fechaChileAMs, recortar, usuarioDe } from "./contenido-comun.ts";

export const MAX_PORCENTAJE_HERRAMIENTA = 50;
export const MAX_MONTO_FIJO_HERRAMIENTA = 200_000;
export const MIGRACION_PEDIDOS_CUPON = "supabase/migrations/2026_11_26_barraca_cupones_pedidos.sql";

export interface CategoriaTienda { id: number; nombre: string; slug: string; padre_id: number | null }

export interface DepsCupones {
  repo: RepoCuponesAdmin;
  /** ¿Ya está aplicada la migración de pedidos con cupón en Supabase? */
  esquemaPedidosConCupon(): Promise<boolean>;
  categorias(): Promise<CategoriaTienda[]>;
  solicitarAprobacion(db: D1Like, datos: DatosSolicitud): Promise<ResultadoSolicitud>;
}

export function depsCuponesReales(): DepsCupones {
  const repoReal = async () => (await import("../../cupones/repo-supabase.ts")).repoAdminSupabase;
  // El repositorio real se resuelve al usarlo (importa Supabase); estos envoltorios solo reenvían.
  const repo: RepoCuponesAdmin = {
    listar: async (l) => (await repoReal()).listar(l),
    porId: async (id) => (await repoReal()).porId(id),
    insertar: async (f) => (await repoReal()).insertar(f),
    actualizar: async (id, c) => (await repoReal()).actualizar(id, c),
    codigosPorIds: async (ids) => (await repoReal()).codigosPorIds(ids),
  };
  return {
    repo,
    esquemaPedidosConCupon: async () => (await import("../../cupones/repo-supabase.ts")).esquemaPedidosConCupon(),
    async categorias() {
      const { supabaseAdmin } = await import("@jurmaq/shared/supabase");
      const { data, error } = await (supabaseAdmin as unknown as { from: (t: string) => { select: (c: string) => Promise<{ data: unknown; error: unknown }> } })
        .from("barraca_categorias").select("id, nombre, slug, padre_id");
      if (error) throw new Error("categorias");
      return (data ?? []) as CategoriaTienda[];
    },
    async solicitarAprobacion(db, datos) {
      const m = await import("../aprobaciones-servidor.ts");
      return m.solicitarAprobacionReal(db, datos);
    },
  };
}

// ───────── Presentación ─────────

const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const fecha = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

function textoReglas(r: ReglasCupon, nombres: Map<number, string>): string {
  const partes: string[] = [];
  if (r.categoriasModo !== "todas") partes.push(`${r.categoriasModo === "incluir" ? "solo en" : "excepto en"} categorías: ${r.categoriasIds.map((i) => nombres.get(i) ?? `#${i}`).join(", ") || "(ninguna)"}`);
  if (r.unUsoPorCliente) partes.push("un uso por cliente (correo y RUT)");
  if (r.noAcumulable) partes.push("no se suma a productos con oferta, combo o promoción");
  return partes.length ? partes.join("; ") : "sin restricciones";
}

function lineaCupon(c: CuponListado, nombres: Map<number, string>): string {
  const desc = c.tipo === "porcentaje" ? `${Number(c.valor)} %` : clp(Number(c.valor));
  return `- ${c.codigo} · ${desc} · compra mínima ${clp(Number(c.monto_minimo_compra))} · ${fecha(c.valido_desde)} a ${fecha(c.valido_hasta)} · ${c.activo ? "ACTIVO" : "apagado"} · usos en pedidos ${c.usosPedidos}${c.reservasVigentes ? ` (+${c.reservasVigentes} reservados)` : ""} · ${textoReglas(c.reglas, nombres)}${c.descripcion ? ` · «${recortar(c.descripcion, 80)}»` : ""}`;
}

const AVISO_ENCENDIDO =
  `Recuerda: los cupones solo funcionan en el checkout con el interruptor encendido (se enciende con la aprobación de Jorge). Antes hay que aplicar en Supabase la migración ${MIGRACION_PEDIDOS_CUPON} y actualizar los términos, que hoy dicen que no hay cupones.`;

const TERMINOS_SIN_CUPONES = /no tiene cupones de descuento/i;

async function terminosDicenSinCupones(db: D1Like): Promise<boolean> {
  try {
    const { obtenerEstado } = await import("../../contenido/repositorio.ts");
    const e = await obtenerEstado(db, "terminos");
    return TERMINOS_SIN_CUPONES.test(String((e.efectivo as { texto: string }).texto));
  } catch {
    return true; // ante la duda, se advierte
  }
}

// ───────── Entradas ─────────

const codigoSchema = z.string().trim().min(3).max(30).describe("Código del cupón (listar_cupones).");
const fechaCupon = z.string().trim().max(40).nullable().optional().describe("AAAA-MM-DD (hora de Chile; «hasta» vale hasta fin de ese día) o ISO. null = sin límite.");

const camposCupon = {
  descripcion: z.string().max(200).nullable().optional(),
  tipo: z.enum(["porcentaje", "monto_fijo"]).optional().describe("porcentaje (valor 1 a 50) o monto_fijo (pesos, hasta 200000)."),
  valor: z.number().positive().max(MAX_MONTO_FIJO_HERRAMIENTA).optional(),
  compra_minima: z.number().int().min(0).max(100_000_000).optional().describe("Pesos, sobre lo que califica."),
  max_usos_total: z.number().int().positive().max(1_000_000).nullable().optional().describe("Tope total; no va con un_uso_por_cliente."),
  max_usos_por_cliente: z.number().int().min(0).max(1000).optional(),
  valido_desde: fechaCupon,
  valido_hasta: fechaCupon,
  categorias_modo: z.enum(["todas", "incluir", "excluir"]).optional().describe("todas, incluir (solo esas) o excluir (todas menos esas). Heredan las subcategorías."),
  categorias_ids: z.array(z.number().int().positive()).max(100).optional(),
  categorias_slugs: z.array(z.string().trim().min(1).max(120)).max(100).optional().describe("Alternativa a categorias_ids (categorias_para_cupones)."),
  un_uso_por_cliente: z.boolean().optional().describe("Una vez por cliente (correo y RUT)."),
  no_acumulable: z.boolean().optional().describe("No se suma a ofertas, combos ni promociones."),
};

type EntradaCampos = { [K in keyof typeof camposCupon]?: z.infer<(typeof camposCupon)[K]> };

function fechaParaLib(v: string | null | undefined, esDesde: boolean): string | null | undefined {
  if (v === undefined || v === null) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    fechaChileAMs(v); // valida que exista
    return esDesde ? `${v}T00:00:00-03:00` : v;
  }
  return v;
}

function aCambiosLib(i: EntradaCampos): CambiosCupon {
  const c: CambiosCupon = {};
  if (i.descripcion !== undefined) c.descripcion = i.descripcion;
  if (i.tipo !== undefined) c.tipo = i.tipo;
  if (i.valor !== undefined) c.valor = i.valor;
  if (i.compra_minima !== undefined) c.montoMinimoCompra = i.compra_minima;
  if (i.max_usos_total !== undefined) c.maxUsosTotal = i.max_usos_total;
  if (i.max_usos_por_cliente !== undefined) c.maxUsosPorUsuario = i.max_usos_por_cliente;
  if (i.valido_desde !== undefined) c.validoDesde = fechaParaLib(i.valido_desde, true);
  if (i.valido_hasta !== undefined) c.validoHasta = fechaParaLib(i.valido_hasta, false);
  return c;
}

function tocaReglas(i: EntradaCampos) {
  return i.categorias_modo !== undefined || i.categorias_ids !== undefined || i.categorias_slugs !== undefined || i.un_uso_por_cliente !== undefined || i.no_acumulable !== undefined;
}

function topes(tipo: string | undefined, valor: number | undefined) {
  if (valor === undefined) return;
  if (tipo === "porcentaje" && valor > MAX_PORCENTAJE_HERRAMIENTA) {
    throw new ErrorHerramienta(`Por seguridad, desde aquí no se crean cupones de más de ${MAX_PORCENTAJE_HERRAMIENTA} %. Si de verdad hace falta, que Jorge lo cree desde el panel.`);
  }
  if (tipo === "monto_fijo" && valor > MAX_MONTO_FIJO_HERRAMIENTA) {
    throw new ErrorHerramienta(`Por seguridad, desde aquí no se crean cupones de más de ${clp(MAX_MONTO_FIJO_HERRAMIENTA)}. Si de verdad hace falta, que Jorge lo cree desde el panel.`);
  }
}

/**
 * Reglas duras de un cupón armado por la IA (valen aunque Jorge apruebe, para que
 * un error de cálculo no regale la tienda): hace falta un tope de usos y el monto
 * fijo no puede igualar o superar lo que se compra.
 */
export function validarCuponMcp(c: { tipo: string; valor: number; compraMinima: number; maxUsosTotal: number | null; maxUsosPorCliente: number; unUsoPorCliente: boolean }): void {
  if (!(c.maxUsosTotal && c.maxUsosTotal > 0) && !c.unUsoPorCliente && !(c.maxUsosPorCliente > 0)) {
    throw new ErrorHerramienta("Todo cupón creado desde aquí necesita un tope de usos: indica max_usos_total o un_uso_por_cliente (o max_usos_por_cliente). Sin tope, un solo cliente podría usarlo sin límite.");
  }
  if (c.unUsoPorCliente && c.maxUsosTotal) {
    // El checkout ignora el tope total cuando es «un uso por cliente»: se avisa para no dejar un falso tope.
    throw new ErrorHerramienta("«un_uso_por_cliente» y «max_usos_total» no van juntos: con un uso por cliente el tope total no se aplica. Elige uno.");
  }
  if (c.tipo === "monto_fijo" && c.compraMinima < c.valor + PISO_COBRABLE_MINIMO) {
    throw new ErrorHerramienta(`Un cupón de monto fijo de ${clp(c.valor)} necesita una compra mínima de al menos ${clp(c.valor + PISO_COBRABLE_MINIMO)} (el descuento más ${clp(PISO_COBRABLE_MINIMO)} que siempre se cobran). Indica compra_minima.`);
  }
}

const CAMPOS_SNAKE = {
  descripcion: "descripcion", tipo: "tipo", valor: "valor", montoMinimoCompra: "monto_minimo_compra", maxUsosTotal: "max_usos_total",
  maxUsosPorUsuario: "max_usos_por_usuario", validoDesde: "valido_desde", validoHasta: "valido_hasta",
} as const;

const SNAKE_A_CAMEL: Record<string, keyof typeof CAMPOS_SNAKE> = Object.fromEntries(Object.entries(CAMPOS_SNAKE).map(([c, s]) => [s, c])) as never;

const pick = (o: Record<string, unknown>, claves: string[]) => Object.fromEntries(claves.map((k) => [k, o[k] ?? null]));
const mismoNumero = (a: unknown, b: unknown) => (typeof a === "number" || typeof b === "number" ? Number(a) === Number(b) : (a ?? null) === (b ?? null));
const mismoFecha = (a: unknown, b: unknown) => (a == null || b == null ? (a ?? null) === (b ?? null) : Date.parse(String(a)) === Date.parse(String(b)));

function cuponIgual(actual: Record<string, unknown>, esperado: Record<string, unknown>): boolean {
  return Object.entries(esperado).every(([k, v]) => {
    if (k === "valido_desde" || k === "valido_hasta") return mismoFecha(actual[k], v);
    if (k === "activo") return Boolean(actual[k]) === Boolean(v);
    return mismoNumero(actual[k], v);
  });
}

// ───────── Revertidor de cupones ─────────

function crearRevertidorCupones(deps: () => DepsCupones): Revertidor {
  return async ({ db, usuario, ahora, entradas }) => {
    const repo = deps().repo;
    const mensajes: string[] = [];
    for (const e of entradas) {
      const id = e.entidadId;
      const antes = e.antes as { cupon?: Record<string, unknown>; reglas?: ReglasCupon } | null;
      const despues = (e.despues ?? {}) as { cupon?: Record<string, unknown>; reglas?: ReglasCupon };
      const actual = await repo.porId(id);
      if (!actual) return { ok: false, mensaje: "Ese cupón ya no existe." };
      const act = actual as unknown as Record<string, unknown>;
      if (despues.cupon && !cuponIgual(act, despues.cupon)) return { ok: false, mensaje: `El cupón ${actual.codigo} cambió después; no lo piso. Revísalo antes de deshacer.` };
      if (despues.reglas) {
        const r = await leerReglas(db, id);
        if (JSON.stringify(r) !== JSON.stringify(despues.reglas)) return { ok: false, mensaje: `Las reglas del cupón ${actual.codigo} cambiaron después; no las piso.` };
      }
      if (antes === null) {
        // Deshacer una creación: un cupón con historial no se borra, se apaga.
        const r = await desactivarCupon(db, repo, usuario, id, ahora);
        if (!r.ok) return { ok: false, mensaje: r.error };
        mensajes.push(`El cupón ${actual.codigo} quedó apagado (no se borra porque podría tener historial).`);
        continue;
      }
      // Deshacer no es una puerta trasera: si el cupón quedaría ACTIVO con esos valores, pasa por el mismo OK de Jorge.
      const quedaActivo = antes.cupon?.activo === undefined ? Boolean(actual.activo) : Boolean(antes.cupon.activo);
      if (quedaActivo) {
        const huella = await huellaDeDatos({ v: 1, h: "deshacer_cupon", id, antes, actual: pick(act, ["tipo", "valor", "monto_minimo_compra", "max_usos_total", "max_usos_por_usuario", "valido_hasta", "activo"]) });
        const r = await exigirAprobacion(db, { solicitar: (d, x) => deps().solicitarAprobacion(d, x) }, {
          usuario, herramienta: "deshacer_cupon", motivos: ["cupon_activo"], huella,
          resumen: `Deshacer un cambio del cupón ${actual.codigo}: queda ACTIVO con los valores de antes.`, detalle: { codigo: actual.codigo, restaurar: antes },
        }, ahora);
        if (r.tipo !== "aprobada") return { ok: false, mensaje: `Deshacer deja el cupón ${actual.codigo} activo, así que queda pendiente de Jorge: ${r.mensaje} Nada se restauró. Cuando apruebe, vuelve a previsualizar y a deshacer.` };
        if (!(await r.gastar())) return { ok: false, mensaje: "La aprobación de Jorge ya se había usado. Nada se restauró." };
      }
      const cambios: CambiosCupon = {};
      for (const [k, v] of Object.entries(antes.cupon ?? {})) {
        const camel = k === "activo" ? "activo" : SNAKE_A_CAMEL[k];
        if (!camel) continue;
        (cambios as Record<string, unknown>)[camel] = v;
      }
      if (antes.reglas) cambios.reglas = antes.reglas;
      if (cambios.validoDesde === null) delete cambios.validoDesde; // la fecha de inicio no se puede borrar
      const r = await editarCupon(db, repo, usuario, id, cambios, ahora, "cupones.deshacer");
      if (!r.ok) return { ok: false, mensaje: r.error };
      mensajes.push(`Cupón ${actual.codigo} vuelto a como estaba.`);
    }
    return { ok: true, mensaje: mensajes.join(" ") };
  };
}

// ───────── Huella de lo que Jorge aprueba al encender ─────────

async function instantaneaActivos(db: D1Like, repo: RepoCuponesAdmin, ahora: number) {
  const { items } = await listarCuponesAdmin(db, repo, ahora);
  const activos = items.filter((c) => c.activo);
  return {
    activos,
    huella: await huellaDeDatos({
      accion: "encender_interruptor_cupones",
      cupones: activos.map((c) => ({ id: c.id, codigo: c.codigo, tipo: c.tipo, valor: Number(c.valor), min: Number(c.monto_minimo_compra), hasta: c.valido_hasta, reglas: c.reglas, maxTotal: c.max_usos_total })).sort((a, b) => a.codigo.localeCompare(b.codigo)),
    }),
  };
}

function textoEstadoAprobacion(e: EstadoAprobacion): string {
  switch (e) {
    case "pendiente": return "Jorge todavía no aprueba. Dile que revise su correo (el enlace vale 4 horas). No cambié nada.";
    case "rechazada": return "Jorge rechazó el encendido. Los cupones siguen apagados.";
    case "vencida": return "La aprobación venció. Hay que pedirla de nuevo con solicitar_encender_cupones.";
    case "usada": return "Esa aprobación ya se usó.";
    case "datos_cambiaron": return "Los cupones activos cambiaron desde que Jorge aprobó (o el id es de otro cambio). No se encendió nada: pídele la aprobación de nuevo.";
    case "no_existe": return "No encontré esa aprobación (o no es tuya).";
    default: return "Estado de aprobación desconocido; no se encendió nada.";
  }
}

// ───────── Fábrica ─────────

export function crearHerramientasCupones(depsInyectadas?: Partial<DepsCupones>): Herramienta[] {
  const deps = (): DepsCupones => ({ ...depsCuponesReales(), ...depsInyectadas });
  const revertir = crearRevertidorCupones(deps);

  async function nombresCategorias(): Promise<Map<number, string>> {
    try { return new Map((await deps().categorias()).map((c) => [c.id, c.nombre])); } catch { return new Map(); }
  }

  async function idsDeCategorias(i: EntradaCampos): Promise<number[] | undefined> {
    if (i.categorias_ids === undefined && i.categorias_slugs === undefined) return undefined;
    const ids = new Set<number>(i.categorias_ids ?? []);
    if (i.categorias_slugs?.length) {
      const todas = await deps().categorias();
      const faltan: string[] = [];
      for (const s of i.categorias_slugs) {
        const c = todas.find((x) => x.slug === s.trim().toLowerCase());
        if (c) ids.add(c.id); else faltan.push(s);
      }
      if (faltan.length) throw new ErrorHerramienta(`No existe una categoría con el slug: ${faltan.join(", ")}. Mira categorias_para_cupones.`);
    }
    return [...ids];
  }

  async function reglasDeEntrada(i: EntradaCampos, base: ReglasCupon | null): Promise<ReglasCupon | undefined> {
    if (!tocaReglas(i)) return undefined;
    const ids = await idsDeCategorias(i);
    const b: ReglasCupon = base ?? { categoriasModo: "todas", categoriasIds: [], unUsoPorCliente: false, noAcumulable: false };
    const modo = i.categorias_modo ?? (ids && ids.length && b.categoriasModo === "todas" ? "incluir" : b.categoriasModo);
    return {
      categoriasModo: modo,
      categoriasIds: modo === "todas" ? [] : (ids ?? b.categoriasIds),
      unUsoPorCliente: i.un_uso_por_cliente ?? b.unUsoPorCliente,
      noAcumulable: i.no_acumulable ?? b.noAcumulable,
    };
  }

  /** Aprobación ya gastada de un cambio que se está aplicando: si el cambio falla, se devuelve. */
  interface OkCupon { devolver(): Promise<void> }

  /**
   * Un cupón que queda activo necesita el OK de Jorge. Devuelve `{ pendiente }` (respuesta «pendiente / bloqueada»; no se
   * cambia nada) o `{ ok }` cuando ya hay una aprobación vigente, que se gasta aquí. Si el cambio después falla, quien llama
   * debe usar `aplicarConOk` para devolver la aprobación (Jorge no tiene que aprobar dos veces por un error nuestro).
   */
  async function pedirOkCupon(ctx: ContextoHerramienta, herramienta: string, codigo: string, resumen: string, datos: unknown): Promise<{ pendiente: SalidaHerramienta } | { ok: OkCupon }> {
    const huella = await huellaDeDatos({ v: 1, h: herramienta, codigo, datos });
    const r = await exigirAprobacion(
      ctx.db, { solicitar: (db, d) => deps().solicitarAprobacion(db, d) },
      { usuario: usuarioDe(ctx), herramienta, motivos: ["cupon_activo"], resumen, detalle: { codigo, datos }, huella },
      ctx.ahora,
    );
    if (r.tipo !== "aprobada") return { pendiente: { texto: r.mensaje, datos: { aplicado: false, estado: r.tipo, codigo } } };
    if (!(await r.gastar())) throw new ErrorHerramienta("La aprobación de Jorge ya se había usado. No se cambió nada; vuelve a pedirlo.");
    return { ok: { devolver: async () => { await r.devolver().catch(() => false); } } };
  }

  /** Ejecuta el cambio; si falla (error o resultado no ok) devuelve la aprobación que se había gastado. */
  async function aplicarConOk<R extends { ok: boolean }>(ok: OkCupon | null, aplicar: () => Promise<R>): Promise<R> {
    try {
      const r = await aplicar();
      if (!r.ok) await ok?.devolver();
      return r;
    } catch (e) {
      await ok?.devolver();
      throw e;
    }
  }

  async function buscarPorCodigo(codigoCrudo: string): Promise<CuponRegistro> {
    const codigo = codigoCrudo.trim().toUpperCase();
    const lista = await deps().repo.listar(500);
    const c = lista.find((x) => x.codigo === codigo);
    if (!c) throw new ErrorHerramienta(`No existe un cupón con el código ${codigo}. Mira listar_cupones.`);
    return c;
  }

  const categorias_para_cupones = defineHerramienta({
    nombre: "categorias_para_cupones",
    titulo: "Categorías de la tienda (para reglas de cupones)",
    descripcion:
    "Lista las categorías con id y slug para armar las reglas de incluir o excluir de un cupón. Las subcategorías heredan la regla del padre.",
    esquema: z.object({}),
    anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ejecutar() {
      const cats = (await deps().categorias()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      const nombre = new Map(cats.map((c) => [c.id, c.nombre]));
      const lineas = cats.slice(0, 200).map((c) => `- id ${c.id} · slug ${c.slug} · ${c.nombre}${c.padre_id ? ` (dentro de ${nombre.get(c.padre_id) ?? `#${c.padre_id}`})` : ""}`);
      return { texto: lineas.join("\n") || "No hay categorías.", datos: { total: cats.length } };
    },
  });

  const listar_cupones = defineHerramienta({
    nombre: "listar_cupones",
    titulo: "Listar cupones",
    descripcion:
    "Lista los cupones con descuento, compra mínima, vigencia, estado, reglas y usos en pedidos. Dice si el interruptor del checkout está encendido: apagado, ningún cupón funciona.",
    esquema: z.object({ solo_activos: z.boolean().optional(), limite: z.number().int().min(1).max(100).optional() }),
    anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ejecutar({ solo_activos, limite }, ctx) {
      const [{ items, gestionDisponible }, encendido, nombres] = await Promise.all([listarCuponesAdmin(ctx.db, deps().repo, ctx.ahora), leerInterruptorCupones(ctx.db), nombresCategorias()]);
      const filtrados = items.filter((c) => !solo_activos || c.activo).slice(0, aEnteroSeguro(limite, 50, 1, 100));
      const cab = `Interruptor de cupones en el checkout: ${encendido ? "ENCENDIDO" : "APAGADO (ningún cupón se aplica a los clientes)"}.${gestionDisponible ? "" : " Ojo: no pude leer reglas y usos."}`;
      return { texto: `${cab}\n${filtrados.map((c) => lineaCupon(c, nombres)).join("\n") || "No hay cupones."}\nTotal: ${items.length}.`, datos: { interruptorEncendido: encendido, total: items.length, mostrados: filtrados.length } };
    },
  });

  const ver_cupon = defineHerramienta({
    nombre: "ver_cupon",
    titulo: "Ver un cupón",
    descripcion: "Muestra un cupón completo por su código: descuento, compra mínima, topes, vigencia, reglas y usos.",
    esquema: z.object({ codigo: codigoSchema }),
    anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ejecutar({ codigo }, ctx) {
      const c = await buscarPorCodigo(codigo);
      const [{ items }, nombres] = await Promise.all([listarCuponesAdmin(ctx.db, deps().repo, ctx.ahora), nombresCategorias()]);
      const full = items.find((x) => x.id === c.id);
      if (!full) throw new ErrorHerramienta("No pude leer ese cupón.");
      const extra = [
        `Tope total de usos: ${full.max_usos_total ?? "sin tope"} · máximo por cliente (flujo antiguo): ${full.max_usos_por_usuario}`,
        `Usos antiguos (cotizaciones): ${full.usos_actuales}`,
      ];
      return { texto: `${lineaCupon(full, nombres)}\n${extra.join("\n")}`, datos: { codigo: full.codigo, activo: full.activo } };
    },
  });

  const crear_cupon = defineHerramienta({
    nombre: "crear_cupon",
    titulo: "Crear un cupón",
    descripcion: `Crea un cupón: codigo (3 a 30: letras, números, guion), tipo y valor (tope: ${MAX_PORCENTAJE_HERRAMIENTA} % o ${clp(MAX_MONTO_FIJO_HERRAMIENTA)}). Opcional: categorías incluidas o excluidas, un uso por cliente (no va con tope total) y no acumulable. Crearlo no lo activa en la tienda: depende del interruptor general que aprueba Jorge. Muestra el resumen y pide el OK del usuario antes de crear.`,
    esquema: z.object({ codigo: codigoSchema, activo: z.boolean().optional().describe("Por defecto true."), ...camposCupon, tipo: z.enum(["porcentaje", "monto_fijo"]), valor: z.number().positive().max(MAX_MONTO_FIJO_HERRAMIENTA) }),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ejecutar(a, ctx) {
      topes(a.tipo, a.valor);
      const reglas = await reglasDeEntrada(a, null);
      validarCuponMcp({
        tipo: a.tipo, valor: a.valor, compraMinima: a.compra_minima ?? 0, maxUsosTotal: a.max_usos_total ?? null,
        maxUsosPorCliente: a.max_usos_por_cliente ?? 0, unUsoPorCliente: reglas?.unUsoPorCliente ?? false,
      });
      let ok: OkCupon | null = null;
      if (a.activo !== false) {
        const res = await pedirOkCupon(ctx, "crear_cupon", a.codigo.trim().toUpperCase(), `Crear el cupón ${a.codigo.trim().toUpperCase()} ACTIVO: ${a.tipo === "porcentaje" ? `${a.valor} %` : clp(a.valor)}, compra mínima ${clp(a.compra_minima ?? 0)}.`, { entrada: { ...a }, reglas });
        if ("pendiente" in res) return res.pendiente;
        ok = res.ok;
      }
      const r = await aplicarConOk(ok, () => crearCupon(ctx.db, deps().repo, usuarioDe(ctx), {
        codigo: a.codigo, activo: a.activo, tipo: a.tipo, valor: a.valor, ...aCambiosLib(a), reglas,
      } as never, ctx.ahora));
      if (!r.ok) throw new ErrorHerramienta(r.error);
      const c = r.valor.cupon as unknown as Record<string, unknown>;
      await ctx.auditar([{
        entidad: "cupon", entidadId: r.valor.cupon.id, antes: null,
        despues: { cupon: pick(c, ["tipo", "valor", "monto_minimo_compra", "max_usos_total", "valido_hasta", "activo"]), reglas: r.valor.reglas },
      }]);
      const nombres = await nombresCategorias();
      return { texto: `Cupón ${r.valor.cupon.codigo} creado (${r.valor.cupon.activo ? "activo" : "apagado"}). Reglas: ${textoReglas(r.valor.reglas, nombres)}.\n${AVISO_ENCENDIDO}\nSe puede deshacer (queda apagado).`, datos: { codigo: r.valor.cupon.codigo } };
    },
    revertidor: revertir,
  });

  const editar_cupon = defineHerramienta({
    nombre: "editar_cupon",
    titulo: "Editar un cupón",
    descripcion: `Cambia solo lo que indiques de un cupón (descuento, compra mínima, topes, vigencia, reglas); el código no se cambia. Mismos topes que crear_cupon (${MAX_PORCENTAJE_HERRAMIENTA} % o ${clp(MAX_MONTO_FIJO_HERRAMIENTA)}). Para encender o apagar: activar_cupon o desactivar_cupon.`,
    esquema: z.object({ codigo: codigoSchema, ...camposCupon }),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ejecutar(a, ctx) {
      const cupon = await buscarPorCodigo(a.codigo);
      const cambios = aCambiosLib(a);
      topes(a.tipo ?? cupon.tipo, a.valor);
      if (a.tipo === "porcentaje" && a.valor === undefined) topes("porcentaje", Number(cupon.valor));
      const reglasAntes = await leerReglas(ctx.db, cupon.id);
      const reglas = await reglasDeEntrada(a, reglasAntes);
      if (reglas) cambios.reglas = reglas;
      if (Object.keys(cambios).length === 0) throw new ErrorHerramienta("No indicaste nada que cambiar.");
      const regFinal = reglas ?? reglasAntes;
      validarCuponMcp({
        tipo: a.tipo ?? cupon.tipo, valor: a.valor ?? Number(cupon.valor), compraMinima: a.compra_minima ?? (Number(cupon.monto_minimo_compra) || 0),
        maxUsosTotal: a.max_usos_total !== undefined ? a.max_usos_total : (cupon.max_usos_total ?? null),
        maxUsosPorCliente: a.max_usos_por_cliente ?? (Number(cupon.max_usos_por_usuario) || 0), unUsoPorCliente: regFinal.unUsoPorCliente,
      });
      let ok: OkCupon | null = null;
      if (cupon.activo) {
        const res = await pedirOkCupon(ctx, "editar_cupon", cupon.codigo, `Cambiar el cupón ACTIVO ${cupon.codigo}: ${Object.keys(a).filter((k) => k !== "codigo").join(", ")}.`, {
          cambios: { ...a, codigo: undefined }, reglasNuevas: reglas ?? null,
          actual: { tipo: cupon.tipo, valor: Number(cupon.valor), min: Number(cupon.monto_minimo_compra), maxTotal: cupon.max_usos_total ?? null, porCliente: cupon.max_usos_por_usuario, desde: cupon.valido_desde, hasta: cupon.valido_hasta, reglas: reglasAntes },
        });
        if ("pendiente" in res) return res.pendiente;
        ok = res.ok;
      }
      const snake = Object.keys(cambios).filter((k) => k !== "reglas").map((k) => CAMPOS_SNAKE[k as keyof typeof CAMPOS_SNAKE]).filter(Boolean) as string[];
      const antesC = pick(cupon as unknown as Record<string, unknown>, snake);
      const r = await aplicarConOk(ok, () => editarCupon(ctx.db, deps().repo, usuarioDe(ctx), cupon.id, cambios, ctx.ahora));
      if (!r.ok) throw new ErrorHerramienta(r.error);
      await ctx.auditar([{
        entidad: "cupon", entidadId: cupon.id,
        antes: { cupon: antesC, ...(reglas ? { reglas: reglasAntes } : {}) },
        despues: { cupon: pick(r.valor.cupon as unknown as Record<string, unknown>, snake), ...(reglas ? { reglas: r.valor.reglas } : {}) },
      }]);
      return { texto: `Cupón ${cupon.codigo} actualizado. Se puede deshacer.\n${AVISO_ENCENDIDO}`, datos: { codigo: cupon.codigo } };
    },
    revertidor: revertir,
  });

  const cambiarEstado = (nombre: string, titulo: string, descripcion: string, activo: boolean) =>
    defineHerramienta({
      nombre, titulo, descripcion,
      esquema: z.object({ codigo: codigoSchema }),
      anotaciones: { readOnlyHint: false, destructiveHint: !activo, idempotentHint: true },
      async ejecutar({ codigo }, ctx) {
        const cupon = await buscarPorCodigo(codigo);
        if (Boolean(cupon.activo) === activo) return `El cupón ${cupon.codigo} ya estaba ${activo ? "activo" : "apagado"}.`;
        let ok: OkCupon | null = null;
        if (activo) {
          const reglas = await leerReglas(ctx.db, cupon.id);
          validarCuponMcp({
            tipo: cupon.tipo, valor: Number(cupon.valor), compraMinima: Number(cupon.monto_minimo_compra) || 0, maxUsosTotal: cupon.max_usos_total ?? null,
            maxUsosPorCliente: Number(cupon.max_usos_por_usuario) || 0, unUsoPorCliente: reglas.unUsoPorCliente,
          });
          const res = await pedirOkCupon(ctx, "activar_cupon", cupon.codigo, `Activar el cupón ${cupon.codigo}: ${cupon.tipo === "porcentaje" ? `${Number(cupon.valor)} %` : clp(Number(cupon.valor))}, compra mínima ${clp(Number(cupon.monto_minimo_compra) || 0)}.`, {
            tipo: cupon.tipo, valor: Number(cupon.valor), min: Number(cupon.monto_minimo_compra), maxTotal: cupon.max_usos_total ?? null, porCliente: cupon.max_usos_por_usuario, desde: cupon.valido_desde, hasta: cupon.valido_hasta, reglas,
          });
          if ("pendiente" in res) return res.pendiente;
          ok = res.ok;
        }
        const r = await aplicarConOk(ok, () => (activo ? activarCupon : desactivarCupon)(ctx.db, deps().repo, usuarioDe(ctx), cupon.id, ctx.ahora));
        if (!r.ok) throw new ErrorHerramienta(r.error);
        await ctx.auditar([{ entidad: "cupon", entidadId: cupon.id, antes: { cupon: { activo: !activo } }, despues: { cupon: { activo } } }]);
        const encendido = await leerInterruptorCupones(ctx.db);
        return `Cupón ${cupon.codigo} ${activo ? "activado" : "apagado"}. ${encendido ? "" : "Ojo: el interruptor general de cupones está apagado, así que los clientes aún no pueden usar ninguno."} Se puede deshacer.`;
      },
      revertidor: revertir,
    });

  const activar_cupon = cambiarEstado("activar_cupon", "Activar un cupón", "Deja un cupón activo. Para que los clientes lo usen, el interruptor general de cupones debe estar encendido (lo aprueba Jorge).", true);
  const desactivar_cupon = cambiarEstado("desactivar_cupon", "Apagar un cupón", "Apaga un cupón: deja de aplicarse a nuevos pedidos (no se borra; los pedidos hechos no cambian).", false);

  const ver_usos_cupones = defineHerramienta({
    nombre: "ver_usos_cupones",
    titulo: "Ver usos de cupones por período",
    descripcion:
    "Cuántas veces se usó cada cupón entre dos fechas (confirmados, reservados, liberados), cuánto descontó y cuánto compraron. Solo cifras, sin datos de clientes. «por_dia» agrega el detalle diario. AAAA-MM-DD (hora de Chile), máximo 366 días.",
    esquema: z.object({
      desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Incluida."),
      codigo: codigoSchema.optional(), por_dia: z.boolean().optional(),
    }),
    anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ejecutar({ desde, hasta, codigo, por_dia }, ctx) {
      const d = fechaChileAMs(desde);
      const h = fechaChileAMs(hasta, true);
      if (h <= d) throw new ErrorHerramienta("«hasta» debe ser igual o posterior a «desde».");
      if (h - d > 366 * 86_400_000) throw new ErrorHerramienta("El período máximo es de 366 días.");
      const cupon = codigo ? await buscarPorCodigo(codigo) : null;
      const opciones = { desde: d, hasta: h, cuponId: cupon?.id, ahora: ctx.ahora };
      const filas = await usosDeCuponesConCodigo(ctx.db, deps().repo, opciones);
      const lineas = filas.map((f) => `- ${f.codigo ?? f.cuponId}: ${f.confirmados} usos confirmados · ${f.reservadosVigentes} reservados · ${f.liberados} liberados · descontó ${clp(f.descuentoTotal)} sobre compras de ${clp(f.montoCompraTotal)}`);
      let dias = "";
      if (por_dia) {
        const x = await usosDeCuponesPorDia(ctx.db, opciones);
        dias = `\nPor día:\n${x.map((f) => `  ${f.dia}: ${f.confirmados} usos, ${clp(f.descuentoTotal)}`).join("\n") || "  (sin usos)"}`;
      }
      return { texto: `Usos de cupones del ${desde} al ${hasta}${codigo ? ` (solo ${codigo.toUpperCase()})` : ""}:\n${lineas.join("\n") || "Sin usos en el período."}${dias}`, datos: { filas } };
    },
  });

  const estado_cupones = defineHerramienta({
    nombre: "estado_cupones",
    titulo: "Estado del interruptor de cupones",
    descripcion: "Dice si los cupones están encendidos en el checkout, si ya está aplicada la migración de pedidos en Supabase y si los términos todavía dicen que no hay cupones. Úsala antes de pedir encenderlos.",
    esquema: z.object({}),
    anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ejecutar(_a, ctx) {
      const [encendido, esquema, sinCupones, { items }] = await Promise.all([leerInterruptorCupones(ctx.db), deps().esquemaPedidosConCupon(), terminosDicenSinCupones(ctx.db), listarCuponesAdmin(ctx.db, deps().repo, ctx.ahora)]);
      const lineas = [
        `Interruptor: ${encendido ? "ENCENDIDO" : "APAGADO"}.`,
        `Migración de pedidos con cupón en Supabase (${MIGRACION_PEDIDOS_CUPON}): ${esquema ? "aplicada" : "NO aplicada (sin ella no se puede encender)"}.`,
        `Términos: ${sinCupones ? "todavía dicen que no hay cupones (hay que actualizarlos antes de encender)" : "no dicen que no hay cupones"}.`,
        `Cupones activos: ${items.filter((c) => c.activo).length} de ${items.length}.`,
      ];
      return { texto: lineas.join("\n"), datos: { encendido, esquemaAplicado: esquema, terminosDicenSinCupones: sinCupones } };
    },
  });

  const solicitar_encender_cupones = defineHerramienta({
    nombre: "solicitar_encender_cupones",
    titulo: "Pedir a Jorge que encienda los cupones",
    descripcion:
    "SOLO crea la solicitud: le llega a Jorge un correo con un enlace de un solo uso (4 horas) y no enciende nada. Antes hay que aplicar en Supabase la migración supabase/migrations/2026_11_26_barraca_cupones_pedidos.sql y actualizar los términos (hoy dicen que no hay cupones); si falta la migración, no se pide. Cuando apruebe, usa aplicar_encendido_cupones. Si cambian los cupones activos, la aprobación deja de servir.",
    esquema: z.object({}),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ejecutar(_a, ctx) {
      if (await leerInterruptorCupones(ctx.db)) return "Los cupones ya están encendidos. No hace falta pedir nada.";
      if (!(await deps().esquemaPedidosConCupon())) {
        return { texto: `Todavía no se puede. Antes hay que aplicar en Supabase la migración ${MIGRACION_PEDIDOS_CUPON} (sin ella, los pedidos con cupón fallarían) y actualizar los términos, que hoy dicen que no hay cupones. No pedí la aprobación. Avísale a Jorge.`, datos: { solicitada: false, motivo: "esquema_incompleto" } };
      }
      const { activos, huella } = await instantaneaActivos(ctx.db, deps().repo, ctx.ahora);
      if (activos.length === 0) throw new ErrorHerramienta("No hay ningún cupón activo: encenderlos no serviría de nada. Crea o activa uno primero.");
      const sinCupones = await terminosDicenSinCupones(ctx.db);
      const nombres = await nombresCategorias();
      const decision = requiereAprobacion({ banderas: ["cupones_interruptor"] });
      const datosSolicitud: DatosSolicitud = {
        usuario: usuarioDe(ctx), herramienta: "solicitar_encender_cupones", motivos: decision.motivos,
        resumen: `Encender los cupones en el checkout. Cupones activos que empezarían a aplicarse: ${activos.map((c) => c.codigo).join(", ")}.${sinCupones ? " OJO: los términos todavía dicen que no hay cupones." : ""}`,
        detalle: { cupones: activos.map((c) => ({ codigo: c.codigo, tipo: c.tipo, valor: Number(c.valor), compraMinima: Number(c.monto_minimo_compra), hasta: c.valido_hasta, reglas: textoReglas(c.reglas, nombres) })), terminosDicenSinCupones: sinCupones },
        huella,
      };
      // Modo `avisar` (mcp/modo-aprobacion.ts): en vez del correo con enlace, queda lista una aprobación automática que
      // `aplicar_encendido_cupones` gasta (y ahí se le avisa a Jorge). Sin correo de Jorge válido: flujo normal.
      if (avisoPosible(datosSolicitud.usuario.email, decision.motivos)) {
        const auto = await crearAprobacionAutomatica(ctx.db, datosSolicitud, ctx.ahora);
        if (auto) {
          await ctx.auditar([{ entidad: "ajuste", entidadId: "cupones_checkout", antes: { encendido: false }, despues: { solicitud: auto.id, estado: "modo_avisar" } }]);
          return {
            texto: `Modo AVISAR: no hace falta esperar a Jorge. Para encender los cupones llama a aplicar_encendido_cupones con aprobacion_id ${auto.id}; al aplicarse, a Jorge le llega un correo de aviso. Nada se encendió todavía. Cupones activos que empezarían a aplicarse: ${activos.map((c) => c.codigo).join(", ")}.${sinCupones ? " Ojo: los términos todavía dicen que no hay cupones; hay que actualizarlos antes de que se vea." : ""}\n${AVISO_ENCENDIDO}`,
            datos: { solicitada: true, aprobacionId: auto.id, venceEn: auto.venceEn, modo: "avisar" },
          };
        }
      }
      const sol = await deps().solicitarAprobacion(ctx.db, datosSolicitud);
      if (!sol.ok) {
        const porque = sol.motivo === "mismo_usuario" ? "el correo del aprobador es el mismo del usuario que pide (nadie puede aprobar; hay que configurar otro correo en BARRACA_APROBADOR_EMAIL)" : sol.motivo === "usuario_sin_correo" ? "tu usuario no tiene correo registrado y no se puede comprobar que quien pide sea otra persona que quien aprueba" : sol.motivo === "sin_aprobador" ? "el correo de aprobación de Jorge no está configurado" : sol.motivo === "limite" ? "se pidieron demasiadas aprobaciones en la última hora" : "no pude enviar el correo a Jorge";
        return { texto: `BLOQUEADO: ${porque}. Los cupones siguen apagados. Avísale a Jorge.`, datos: { solicitada: false, estado: "bloqueada", motivo: sol.motivo } };
      }
      await ctx.auditar([{ entidad: "ajuste", entidadId: "cupones_checkout", antes: { encendido: false }, despues: { solicitud: sol.id, estado: "pendiente" } }]);
      return {
        texto: `Le mandé un correo a Jorge para aprobar el encendido de los cupones (${decision.motivos.map((m) => TEXTO_MOTIVO[m]).join("; ")}). No se encendió nada. Cuando apruebe, llama a aplicar_encendido_cupones con aprobacion_id ${sol.id}.${sinCupones ? " Ojo: los términos todavía dicen que no hay cupones; hay que actualizarlos antes de que se vea." : ""}\n${AVISO_ENCENDIDO}`,
        datos: { solicitada: true, aprobacionId: sol.id, venceEn: sol.venceEn },
      };
    },
    // Sin revertidor: no cambia datos de la tienda (solo crea una solicitud).
  });

  const aplicar_encendido_cupones = defineHerramienta({
    nombre: "aplicar_encendido_cupones",
    titulo: "Encender los cupones (solo con aprobación de Jorge)",
    descripcion:
    "Enciende el interruptor de cupones SOLO si Jorge aprobó la solicitud de solicitar_encender_cupones, no venció ni se usó, los cupones activos siguen siendo los que vio y la migración está aplicada. Si no, no cambia nada. Sirve una sola vez.",
    esquema: z.object({ aprobacion_id: z.string().min(8).max(64) }),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ejecutar({ aprobacion_id }, ctx) {
      if (await leerInterruptorCupones(ctx.db)) return "Los cupones ya estaban encendidos.";
      const { huella } = await instantaneaActivos(ctx.db, deps().repo, ctx.ahora);
      let estadoVisto: EstadoAprobacion = "no_existe";
      const aprobar: HookAprobacion = async () => {
        estadoVisto = await estadoAprobacion(ctx.db, aprobacion_id, { usuarioId: ctx.usuario.id, huellaActual: huella }, ctx.ahora);
        if (estadoVisto !== "aprobada") return false;
        const gasto = await consumirAprobacion(ctx.db, aprobacion_id, { usuarioId: ctx.usuario.id, huellaActual: huella }, ctx.ahora);
        if (!gasto) { estadoVisto = "usada"; return false; }
        return { aprobada: true, aprobacionId: aprobacion_id };
      };
      const r = await encenderInterruptorCupones(ctx.db, { usuario: usuarioDe(ctx), aprobar, verificarEsquema: () => deps().esquemaPedidosConCupon(), ahora: ctx.ahora });
      if (!r.ok) {
        if (r.motivo === "esquema_incompleto") {
          return { texto: `No se encendió: falta aplicar en Supabase la migración ${MIGRACION_PEDIDOS_CUPON}. La aprobación sigue vigente (4 horas).`, datos: { encendido: false, motivo: "esquema_incompleto" } };
        }
        return { texto: textoEstadoAprobacion(estadoVisto), datos: { encendido: false, estado: estadoVisto } };
      }
      await ctx.auditar([{ entidad: "ajuste", entidadId: "cupones_checkout", antes: { encendido: false }, despues: { encendido: true, aprobacionId: aprobacion_id } }]);
      return { texto: `Cupones ENCENDIDOS con la aprobación de Jorge. Desde ahora el checkout acepta los cupones activos. Para apagarlos: apagar_cupones.`, datos: { encendido: true } };
    },
    revertidor: async ({ db, usuario, ahora, entradas }) => {
      // Deshacer un encendido es apagar: siempre es seguro.
      if (!entradas.length) return { ok: true };
      await apagarInterruptorCupones(db, usuario, ahora);
      return { ok: true, mensaje: "Cupones apagados." };
    },
  });

  const apagar_cupones = defineHerramienta({
    nombre: "apagar_cupones",
    titulo: "Apagar los cupones del checkout",
    descripcion: "Apaga el interruptor general: ningún cupón se aplica a nuevos pedidos hasta que Jorge apruebe volver a encenderlos. No pide aprobación porque es la dirección segura. Los pedidos ya hechos no cambian.",
    esquema: z.object({}),
    anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    async ejecutar(_a, ctx) {
      if (!(await leerInterruptorCupones(ctx.db))) return "Los cupones ya estaban apagados.";
      await apagarInterruptorCupones(ctx.db, usuarioDe(ctx), ctx.ahora);
      await ctx.auditar([{ entidad: "ajuste", entidadId: "cupones_checkout", antes: { encendido: true }, despues: { encendido: false } }]);
      return "Cupones apagados. Volver a encenderlos necesita la aprobación de Jorge (solicitar_encender_cupones).";
    },
    // Sin revertidor: deshacer un apagado sería encender, y eso solo con aprobación.
  });

  return [
    categorias_para_cupones, listar_cupones, ver_cupon, crear_cupon, editar_cupon, activar_cupon, desactivar_cupon,
    ver_usos_cupones, estado_cupones, solicitar_encender_cupones, aplicar_encendido_cupones, apagar_cupones,
  ] as unknown as Herramienta[];
}
