import { registrarCambio } from "../gestion/auditoria.ts";
import type { D1Like, UsuarioGestion } from "../gestion/tipos.ts";
import { idUuid } from "../gestion/util.ts";
import { borrarReglas, guardarReglas, leerReglas, leerReglasDeVarios, validarReglas, type ReglasCupon, REGLAS_POR_DEFECTO } from "./reglas.ts";
import type { CuponRegistro } from "./servicio.ts";

/**
 * Crear, editar, activar y desactivar cupones con sus reglas. Funciones de
 * servidor reutilizables por el panel y por las herramientas MCP: validan,
 * escriben (cupón en Supabase, reglas en D1) y dejan auditoría en lib/gestion.
 *
 * Orden de escritura: las reglas van PRIMERO a la D1 y el cupón después, para que
 * un cupón nunca exista sin sus restricciones. Si el segundo paso falla, se revierte el primero.
 */

export interface RepoCuponesAdmin {
  listar(limite: number): Promise<CuponRegistro[]>;
  porId(id: string): Promise<CuponRegistro | null>;
  insertar(fila: Record<string, unknown>): Promise<{ ok: true; cupon: CuponRegistro } | { ok: false; codigoRepetido: boolean }>;
  actualizar(id: string, campos: Record<string, unknown>): Promise<boolean>;
  codigosPorIds(ids: string[]): Promise<Map<string, string>>;
}

export interface EntradaCupon {
  codigo: string;
  descripcion?: string | null;
  tipo: "porcentaje" | "monto_fijo";
  valor: number;
  montoMinimoCompra?: number;
  maxUsosTotal?: number | null;
  maxUsosPorUsuario?: number;
  validoDesde?: string | null;
  validoHasta?: string | null;
  activo?: boolean;
  reglas?: unknown;
}

/** Todo opcional; `null` en maxUsosTotal/validoHasta/descripcion los borra. El código no se edita (hay historial de usos). */
export type CambiosCupon = Partial<Omit<EntradaCupon, "codigo">>;

export type ResultadoAdmin<T> = { ok: true; valor: T } | { ok: false; error: string; codigo?: "no_encontrado" | "codigo_repetido" | "no_disponible" };

const CODIGO_RE = /^[A-Z0-9_-]{3,30}$/;

function entero(n: unknown, min: number, max: number): number | null {
  const v = typeof n === "string" && n.trim() !== "" ? Number(n) : n;
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

function fechaIso(v: unknown): string | null | undefined {
  if (v === null || v === "") return null;
  if (typeof v !== "string") return undefined;
  const t = Date.parse(v.length === 10 ? `${v}T23:59:59-03:00` : v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

function limpiarTexto(t: unknown, max: number): string | null | undefined {
  if (t === null || t === "") return null;
  if (typeof t !== "string") return undefined;
  // Texto plano: nada de etiquetas ni caracteres de control.
  const l = t.replace(/[<>]/g, "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return l.slice(0, max);
}

interface CamposValidados {
  campos: Record<string, unknown>;
  reglas?: ReglasCupon;
}

function validarCampos(c: CambiosCupon, completo: boolean): { ok: true; v: CamposValidados } | { ok: false; error: string } {
  const campos: Record<string, unknown> = {};
  if (completo || c.tipo !== undefined) {
    if (c.tipo !== "porcentaje" && c.tipo !== "monto_fijo") return { ok: false, error: "El tipo debe ser porcentaje o monto fijo." };
    campos.tipo = c.tipo;
  }
  if (completo || c.valor !== undefined) {
    const v = Number(c.valor);
    if (!Number.isFinite(v) || v <= 0) return { ok: false, error: "El valor debe ser mayor que 0." };
    campos.valor = v;
  }
  if (c.montoMinimoCompra !== undefined) {
    const m = entero(c.montoMinimoCompra, 0, 1_000_000_000);
    if (m === null) return { ok: false, error: "La compra mínima no es válida." };
    campos.monto_minimo_compra = m;
  }
  if (c.maxUsosTotal !== undefined) {
    if (c.maxUsosTotal === null) campos.max_usos_total = null;
    else {
      const m = entero(c.maxUsosTotal, 1, 10_000_000);
      if (m === null) return { ok: false, error: "El tope de usos no es válido." };
      campos.max_usos_total = m;
    }
  }
  if (c.maxUsosPorUsuario !== undefined) {
    const m = entero(c.maxUsosPorUsuario, 0, 1000);
    if (m === null) return { ok: false, error: "El máximo por cliente no es válido." };
    campos.max_usos_por_usuario = m;
  }
  if (c.descripcion !== undefined) {
    const d = limpiarTexto(c.descripcion, 200);
    if (d === undefined) return { ok: false, error: "La descripción no es válida." };
    campos.descripcion = d;
  }
  if (c.validoDesde !== undefined) {
    const f = fechaIso(c.validoDesde);
    if (f === undefined) return { ok: false, error: "La fecha de inicio no es válida." };
    if (f !== null) campos.valido_desde = f;
  }
  if (c.validoHasta !== undefined) {
    const f = fechaIso(c.validoHasta);
    if (f === undefined) return { ok: false, error: "La fecha de término no es válida." };
    campos.valido_hasta = f;
  }
  if (c.activo !== undefined) {
    if (typeof c.activo !== "boolean") return { ok: false, error: "El estado no es válido." };
    campos.activo = c.activo;
  }
  const tipoFinal = campos.tipo ?? undefined;
  if (tipoFinal === "porcentaje" && Number(campos.valor) > 100) return { ok: false, error: "El porcentaje no puede pasar de 100." };
  let reglas: ReglasCupon | undefined;
  if (c.reglas !== undefined) {
    const r = validarReglas(c.reglas);
    if (!r.ok) return { ok: false, error: r.error };
    reglas = r.reglas;
  }
  return { ok: true, v: { campos, reglas } };
}

const comparable = (c: CuponRegistro | null, campos: string[]) =>
  Object.fromEntries(campos.map((k) => [k, c ? (c as unknown as Record<string, unknown>)[k] ?? null : null]));

export async function crearCupon(
  db: D1Like,
  repo: RepoCuponesAdmin,
  usuario: UsuarioGestion,
  entrada: EntradaCupon,
  ahora = Date.now(),
): Promise<ResultadoAdmin<{ cupon: CuponRegistro; reglas: ReglasCupon }>> {
  const codigo = String(entrada.codigo ?? "").trim().toUpperCase();
  if (!CODIGO_RE.test(codigo)) return { ok: false, error: "El código debe tener de 3 a 30 caracteres: letras A-Z, números, guion o guion bajo." };
  const val = validarCampos(entrada, true);
  if (!val.ok) return { ok: false, error: val.error };
  const { campos } = val.v;
  const reglas = val.v.reglas ?? { ...REGLAS_POR_DEFECTO };
  if (reglas.unUsoPorCliente && campos.max_usos_total) {
    return { ok: false, error: "Con «un uso por cliente» no se usa el tope total: déjalo vacío." };
  }
  const desde = (campos.valido_desde as string | undefined) ?? new Date(ahora).toISOString();
  if (campos.valido_hasta && Date.parse(campos.valido_hasta as string) <= Date.parse(desde)) {
    return { ok: false, error: "El cupón debe terminar después de empezar." };
  }
  const id = idUuid();
  try {
    await guardarReglas(db, id, reglas, usuario.id, ahora);
  } catch {
    return { ok: false, error: "No pudimos guardar las reglas del cupón. Intenta de nuevo.", codigo: "no_disponible" };
  }
  const fila = {
    id, codigo, valido_desde: desde, activo: entrada.activo !== false,
    max_usos_por_usuario: 1, monto_minimo_compra: 0, descripcion: null, max_usos_total: null, valido_hasta: null,
    ...campos,
  };
  let ins: Awaited<ReturnType<RepoCuponesAdmin["insertar"]>>;
  try {
    ins = await repo.insertar(fila);
  } catch {
    ins = { ok: false, codigoRepetido: false };
  }
  if (!ins.ok) {
    await borrarReglas(db, id).catch(() => undefined);
    return ins.codigoRepetido
      ? { ok: false, error: "Ya existe un cupón con ese código.", codigo: "codigo_repetido" }
      : { ok: false, error: "No pudimos crear el cupón. Intenta de nuevo." };
  }
  await registrarCambio(db, usuario, { herramienta: "cupones.crear", entidad: "cupon", entidadId: id, antes: null, despues: { cupon: fila, reglas } }, { ahora }).catch(() => undefined);
  return { ok: true, valor: { cupon: ins.cupon, reglas } };
}

export async function editarCupon(
  db: D1Like,
  repo: RepoCuponesAdmin,
  usuario: UsuarioGestion,
  id: string,
  cambios: CambiosCupon,
  ahora = Date.now(),
  herramienta = "cupones.editar",
): Promise<ResultadoAdmin<{ cupon: CuponRegistro; reglas: ReglasCupon }>> {
  const actual = await repo.porId(id);
  if (!actual) return { ok: false, error: "Ese cupón no existe.", codigo: "no_encontrado" };
  const val = validarCampos(cambios, false);
  if (!val.ok) return { ok: false, error: val.error };
  const { campos } = val.v;
  const reglasAntes = await leerReglas(db, id).catch(() => null);
  if (reglasAntes === null) return { ok: false, error: "No pudimos leer las reglas del cupón. Intenta de nuevo.", codigo: "no_disponible" };
  const reglasNuevas = val.v.reglas ?? reglasAntes;

  // Consistencias con lo que ya tenía
  const tipo = (campos.tipo as string | undefined) ?? actual.tipo;
  const valor = campos.valor !== undefined ? Number(campos.valor) : Number(actual.valor);
  if (tipo === "porcentaje" && valor > 100) return { ok: false, error: "El porcentaje no puede pasar de 100." };
  const maxTotal = campos.max_usos_total !== undefined ? (campos.max_usos_total as number | null) : actual.max_usos_total;
  if (reglasNuevas.unUsoPorCliente && maxTotal) return { ok: false, error: "Con «un uso por cliente» no se usa el tope total: déjalo vacío." };
  const desde = (campos.valido_desde as string | undefined) ?? actual.valido_desde;
  const hasta = campos.valido_hasta !== undefined ? (campos.valido_hasta as string | null) : actual.valido_hasta;
  if (desde && hasta && Date.parse(hasta) <= Date.parse(desde)) return { ok: false, error: "El cupón debe terminar después de empezar." };

  const hayCamposSupabase = Object.keys(campos).length > 0;
  const hayReglas = val.v.reglas !== undefined;
  if (!hayCamposSupabase && !hayReglas) return { ok: false, error: "No hay cambios que guardar." };

  if (hayReglas) {
    try {
      await guardarReglas(db, id, reglasNuevas, usuario.id, ahora);
    } catch {
      return { ok: false, error: "No pudimos guardar las reglas del cupón. Intenta de nuevo.", codigo: "no_disponible" };
    }
  }
  if (hayCamposSupabase) {
    let ok = false;
    try {
      ok = await repo.actualizar(id, campos);
    } catch {
      ok = false;
    }
    if (!ok) {
      if (hayReglas) await guardarReglas(db, id, reglasAntes, usuario.id, ahora).catch(() => undefined);
      return { ok: false, error: "No pudimos guardar los cambios del cupón. Intenta de nuevo." };
    }
  }
  const despues = (await repo.porId(id)) ?? { ...actual, ...(campos as object) };
  await registrarCambio(
    db,
    usuario,
    {
      herramienta,
      entidad: "cupon",
      entidadId: id,
      antes: { cupon: comparable(actual, Object.keys(campos)), reglas: hayReglas ? reglasAntes : undefined },
      despues: { cupon: comparable(despues as CuponRegistro, Object.keys(campos)), reglas: hayReglas ? reglasNuevas : undefined },
    },
    { ahora },
  ).catch(() => undefined);
  return { ok: true, valor: { cupon: despues as CuponRegistro, reglas: reglasNuevas } };
}

export const activarCupon = (db: D1Like, repo: RepoCuponesAdmin, u: UsuarioGestion, id: string, ahora = Date.now()) =>
  editarCupon(db, repo, u, id, { activo: true }, ahora, "cupones.activar");
export const desactivarCupon = (db: D1Like, repo: RepoCuponesAdmin, u: UsuarioGestion, id: string, ahora = Date.now()) =>
  editarCupon(db, repo, u, id, { activo: false }, ahora, "cupones.desactivar");

export interface CuponListado extends CuponRegistro {
  reglas: ReglasCupon;
  /** Usos en pedidos de la tienda (confirmados) y reservas vigentes. */
  usosPedidos: number;
  reservasVigentes: number;
}

/** Lista para el panel. Si la D1 no responde, `gestionDisponible` es false y las reglas vienen vacías (hay que avisarlo). */
export async function listarCuponesAdmin(
  db: D1Like | null,
  repo: RepoCuponesAdmin,
  ahora = Date.now(),
): Promise<{ items: CuponListado[]; gestionDisponible: boolean }> {
  const cupones = await repo.listar(200);
  let reglas = new Map<string, ReglasCupon>();
  const usos = new Map<string, { c: number; r: number }>();
  let disponible = false;
  if (db) {
    try {
      reglas = await leerReglasDeVarios(db, cupones.map((c) => c.id));
      const { results } = await db
        .prepare(
          `SELECT cupon_id,
                  SUM(CASE WHEN estado = 'confirmada' THEN 1 ELSE 0 END) AS c,
                  SUM(CASE WHEN estado = 'reservada' AND expira_en > ? THEN 1 ELSE 0 END) AS r
           FROM cupon_usos GROUP BY cupon_id`,
        )
        .bind(ahora)
        .all<{ cupon_id: string; c: number; r: number }>();
      for (const f of results) usos.set(f.cupon_id, { c: Number(f.c), r: Number(f.r) });
      disponible = true;
    } catch {
      disponible = false;
    }
  }
  return {
    gestionDisponible: disponible,
    items: cupones.map((c) => ({
      ...c,
      reglas: reglas.get(c.id) ?? { ...REGLAS_POR_DEFECTO },
      usosPedidos: usos.get(c.id)?.c ?? 0,
      reservasVigentes: usos.get(c.id)?.r ?? 0,
    })),
  };
}
