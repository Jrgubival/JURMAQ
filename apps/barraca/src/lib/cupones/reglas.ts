import type { D1Like } from "../gestion/tipos.ts";

/** Reglas nuevas de un cupón (tabla cupon_reglas de la D1 de gestión). */
export interface ReglasCupon {
  /** todas = sin restricción; incluir = solo esas categorías; excluir = todas menos esas. Las subcategorías heredan. */
  categoriasModo: "todas" | "incluir" | "excluir";
  categoriasIds: number[];
  /** Un uso por cliente (correo y RUT normalizados) en vez de tope total. */
  unUsoPorCliente: boolean;
  /** No se suma a productos con oferta / precio web rebajado / promoción de categoría / combo. */
  noAcumulable: boolean;
}

export const REGLAS_POR_DEFECTO: ReglasCupon = {
  categoriasModo: "todas",
  categoriasIds: [],
  unUsoPorCliente: false,
  noAcumulable: false,
};

export const MAX_CATEGORIAS_REGLA = 100;

export function validarReglas(x: unknown): { ok: true; reglas: ReglasCupon } | { ok: false; error: string } {
  if (x === undefined || x === null) return { ok: true, reglas: { ...REGLAS_POR_DEFECTO } };
  if (typeof x !== "object" || Array.isArray(x)) return { ok: false, error: "Las reglas no son válidas." };
  const r = x as Record<string, unknown>;
  const modo = r.categoriasModo ?? "todas";
  if (modo !== "todas" && modo !== "incluir" && modo !== "excluir") return { ok: false, error: "Modo de categorías no válido." };
  const idsCrudos = r.categoriasIds ?? [];
  if (!Array.isArray(idsCrudos) || idsCrudos.length > MAX_CATEGORIAS_REGLA) return { ok: false, error: "Lista de categorías no válida." };
  const ids = [...new Set(idsCrudos.map((n) => Number(n)))];
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) return { ok: false, error: "Hay categorías no válidas." };
  if (modo !== "todas" && ids.length === 0) return { ok: false, error: "Elige al menos una categoría." };
  for (const k of ["unUsoPorCliente", "noAcumulable"]) {
    if (r[k] !== undefined && typeof r[k] !== "boolean") return { ok: false, error: "Regla no válida." };
  }
  return {
    ok: true,
    reglas: {
      categoriasModo: modo,
      categoriasIds: modo === "todas" ? [] : ids,
      unUsoPorCliente: r.unUsoPorCliente === true,
      noAcumulable: r.noAcumulable === true,
    },
  };
}

interface FilaReglas {
  cupon_id: string;
  categorias_modo: string;
  categorias_ids: string;
  un_uso_por_cliente: number;
  no_acumulable: number;
}

function deFila(f: FilaReglas): ReglasCupon {
  let ids: number[] = [];
  try {
    const j = JSON.parse(f.categorias_ids);
    if (Array.isArray(j)) ids = j.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  } catch {
    // JSON dañado: se trata como lista vacía
  }
  const modo = f.categorias_modo === "incluir" || f.categorias_modo === "excluir" ? f.categorias_modo : "todas";
  // Fail-closed: un modo restrictivo sin categorías legibles no debe convertirse en "todas".
  return {
    categoriasModo: modo === "todas" || ids.length > 0 ? modo : "incluir",
    categoriasIds: ids,
    unUsoPorCliente: f.un_uso_por_cliente === 1,
    noAcumulable: f.no_acumulable === 1,
  };
}

export async function leerReglas(db: D1Like, cuponId: string): Promise<ReglasCupon> {
  const f = await db
    .prepare("SELECT cupon_id, categorias_modo, categorias_ids, un_uso_por_cliente, no_acumulable FROM cupon_reglas WHERE cupon_id = ?")
    .bind(cuponId)
    .first<FilaReglas>();
  return f ? deFila(f) : { ...REGLAS_POR_DEFECTO };
}

export async function leerReglasDeVarios(db: D1Like, ids: string[]): Promise<Map<string, ReglasCupon>> {
  const out = new Map<string, ReglasCupon>();
  if (ids.length === 0) return out;
  for (let i = 0; i < ids.length; i += 80) {
    const tanda = ids.slice(i, i + 80);
    const { results } = await db
      .prepare(`SELECT cupon_id, categorias_modo, categorias_ids, un_uso_por_cliente, no_acumulable FROM cupon_reglas WHERE cupon_id IN (${tanda.map(() => "?").join(",")})`)
      .bind(...tanda)
      .all<FilaReglas>();
    for (const f of results) out.set(f.cupon_id, deFila(f));
  }
  return out;
}

export function sentenciaGuardarReglas(db: D1Like, cuponId: string, r: ReglasCupon, usuarioId: string | null, ahora: number) {
  return db
    .prepare(
      `INSERT INTO cupon_reglas (cupon_id, categorias_modo, categorias_ids, un_uso_por_cliente, no_acumulable, actualizado_en, actualizado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cupon_id) DO UPDATE SET categorias_modo = excluded.categorias_modo, categorias_ids = excluded.categorias_ids,
         un_uso_por_cliente = excluded.un_uso_por_cliente, no_acumulable = excluded.no_acumulable,
         actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por`,
    )
    .bind(cuponId, r.categoriasModo, JSON.stringify(r.categoriasIds), r.unUsoPorCliente ? 1 : 0, r.noAcumulable ? 1 : 0, ahora, usuarioId);
}

export async function guardarReglas(db: D1Like, cuponId: string, r: ReglasCupon, usuarioId: string | null, ahora = Date.now()): Promise<void> {
  await sentenciaGuardarReglas(db, cuponId, r, usuarioId, ahora).run();
}

export async function borrarReglas(db: D1Like, cuponId: string): Promise<void> {
  await db.prepare("DELETE FROM cupon_reglas WHERE cupon_id = ?").bind(cuponId).run();
}
