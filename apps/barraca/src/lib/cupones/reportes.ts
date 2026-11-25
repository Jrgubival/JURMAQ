import type { D1Like } from "../gestion/tipos.ts";
import type { RepoCuponesAdmin } from "./admin.ts";

/**
 * Lecturas para reportes: usos de cupones por período. SIN datos personales
 * (la tabla solo guarda huellas y aquí ni siquiera se leen).
 */

export interface OpcionesUsosPeriodo {
  /** Milisegundos desde epoch, incluido. */
  desde: number;
  /** Milisegundos desde epoch, excluido. */
  hasta: number;
  cuponId?: string;
  ahora?: number;
}

export interface UsosCupon {
  cuponId: string;
  codigo?: string | null;
  confirmados: number;
  reservadosVigentes: number;
  liberados: number;
  descuentoTotal: number;
  montoCompraTotal: number;
}

export async function usosDeCuponesPorPeriodo(db: D1Like, o: OpcionesUsosPeriodo): Promise<UsosCupon[]> {
  const ahora = o.ahora ?? Date.now();
  const filtro = o.cuponId ? "AND cupon_id = ?" : "";
  const { results } = await db
    .prepare(
      `SELECT cupon_id,
              SUM(CASE WHEN estado = 'confirmada' THEN 1 ELSE 0 END) AS confirmados,
              SUM(CASE WHEN estado = 'reservada' AND expira_en > ? THEN 1 ELSE 0 END) AS reservados,
              SUM(CASE WHEN estado = 'liberada' OR (estado = 'reservada' AND expira_en <= ?) THEN 1 ELSE 0 END) AS liberados,
              SUM(CASE WHEN estado = 'confirmada' THEN descuento ELSE 0 END) AS descuento_total,
              SUM(CASE WHEN estado = 'confirmada' THEN monto_compra ELSE 0 END) AS monto_total
       FROM cupon_usos
       WHERE creado_en >= ? AND creado_en < ? ${filtro}
       GROUP BY cupon_id ORDER BY confirmados DESC, cupon_id`,
    )
    .bind(...[ahora, ahora, o.desde, o.hasta, ...(o.cuponId ? [o.cuponId] : [])])
    .all<{ cupon_id: string; confirmados: number; reservados: number; liberados: number; descuento_total: number; monto_total: number }>();
  return results.map((f) => ({
    cuponId: f.cupon_id,
    confirmados: Number(f.confirmados),
    reservadosVigentes: Number(f.reservados),
    liberados: Number(f.liberados),
    descuentoTotal: Number(f.descuento_total),
    montoCompraTotal: Number(f.monto_total),
  }));
}

/** Igual, pero con el código del cupón (leído de Supabase). */
export async function usosDeCuponesConCodigo(db: D1Like, repo: RepoCuponesAdmin, o: OpcionesUsosPeriodo): Promise<UsosCupon[]> {
  const filas = await usosDeCuponesPorPeriodo(db, o);
  const codigos = await repo.codigosPorIds(filas.map((f) => f.cuponId)).catch(() => new Map<string, string>());
  return filas.map((f) => ({ ...f, codigo: codigos.get(f.cuponId) ?? null }));
}

export interface UsosPorDia {
  dia: string;
  confirmados: number;
  descuentoTotal: number;
}

/** Usos confirmados por día (hora de Chile aproximada: UTC-3). */
export async function usosDeCuponesPorDia(db: D1Like, o: OpcionesUsosPeriodo & { desfaseMs?: number }): Promise<UsosPorDia[]> {
  const desfase = o.desfaseMs ?? -3 * 3600_000;
  const filtro = o.cuponId ? "AND cupon_id = ?" : "";
  const { results } = await db
    .prepare(
      `SELECT date((creado_en + ?) / 1000, 'unixepoch') AS dia, COUNT(*) AS n, SUM(descuento) AS d
       FROM cupon_usos
       WHERE estado = 'confirmada' AND creado_en >= ? AND creado_en < ? ${filtro}
       GROUP BY dia ORDER BY dia`,
    )
    .bind(...[desfase, o.desde, o.hasta, ...(o.cuponId ? [o.cuponId] : [])])
    .all<{ dia: string; n: number; d: number }>();
  return results.map((f) => ({ dia: f.dia, confirmados: Number(f.n), descuentoTotal: Number(f.d) }));
}
