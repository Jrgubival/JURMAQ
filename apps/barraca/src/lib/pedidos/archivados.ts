/**
 * Pedidos ARCHIVADOS (herramientas de dinero y borrado del MCP). Archivar es reversible: el pedido sigue intacto en
 * Supabase; solo se anota en la D1 de gestión (tabla `pedidos_archivados`, migración 0011) y las listas y reportes lo
 * excluyen por defecto.
 *
 * Costo (decisión): UNA consulta a D1 por solicitud de lista, con tope de 5.000 ids (`LIMITE_ARCHIVADOS`), y el filtro se
 * aplica en memoria sobre lo que ya se leyó de Supabase. No hay consultas cruzadas ni una consulta por pedido (sin N+1).
 * Si hubiera más de 5.000 archivados, `truncado` avisa y quedan sin excluir los más antiguos.
 *
 * Puro respecto de Next: recibe la D1 por parámetro; `archivadosDeServidor()` (más abajo, con import dinámico) es el
 * cableado que usan el panel y los reportes. Sin la base o sin la migración, devuelve «ninguno»: el panel no se rompe.
 */
import type { D1Like } from "../gestion/tipos.ts";

export const LIMITE_ARCHIVADOS = 5000;

export interface ConjuntoArchivados {
  numeros: Set<string>;
  /** Había más de LIMITE_ARCHIVADOS: los más antiguos no se excluyen. */
  truncado: boolean;
}

export const SIN_ARCHIVADOS: ConjuntoArchivados = { numeros: new Set(), truncado: false };

/** Una consulta, acotada: los números archivados (los más recientes primero). */
export async function cargarArchivados(db: D1Like): Promise<ConjuntoArchivados> {
  const r = await db.prepare("SELECT numero FROM pedidos_archivados ORDER BY archivado_en DESC LIMIT ?").bind(LIMITE_ARCHIVADOS + 1).all<{ numero: string }>();
  const filas = r.results ?? [];
  return { numeros: new Set(filas.slice(0, LIMITE_ARCHIVADOS).map((f) => f.numero)), truncado: filas.length > LIMITE_ARCHIVADOS };
}

export type ModoArchivados = "excluir" | "incluir" | "solo";

/** Aplica el modo a una lista de pedidos (en memoria). `excluir` es el defecto de TODAS las listas. */
export function filtrarArchivados<T extends { numero: string }>(lista: readonly T[], archivados: ConjuntoArchivados, modo: ModoArchivados = "excluir"): T[] {
  if (modo === "incluir") return [...lista];
  return lista.filter((p) => archivados.numeros.has(p.numero) === (modo === "solo"));
}

export async function estaArchivado(db: D1Like, numero: string): Promise<boolean> {
  return !!(await db.prepare("SELECT 1 AS x FROM pedidos_archivados WHERE numero = ?").bind(numero).first());
}

/** Archiva (idempotente: si ya estaba, no cambia nada y devuelve false). */
export async function archivarPedido(db: D1Like, d: { numero: string; estado: string; usuarioId: string; ahora: number }): Promise<boolean> {
  const r = await db
    .prepare("INSERT OR IGNORE INTO pedidos_archivados (numero, estado_al_archivar, archivado_en, archivado_por) VALUES (?, ?, ?, ?)")
    .bind(d.numero, d.estado, d.ahora, d.usuarioId)
    .run();
  return (r.meta?.changes ?? 0) > 0;
}

/** Desarchiva; false si no estaba archivado. */
export async function desarchivarPedido(db: D1Like, numero: string): Promise<boolean> {
  const r = await db.prepare("DELETE FROM pedidos_archivados WHERE numero = ?").bind(numero).run();
  return (r.meta?.changes ?? 0) > 0;
}

export async function contarArchivados(db: D1Like): Promise<number> {
  const f = await db.prepare("SELECT COUNT(*) AS n FROM pedidos_archivados").first<{ n: number }>();
  return f?.n ?? 0;
}

/**
 * Para el panel y los reportes: los archivados de HOY desde la D1 real. Fallo (sin binding, sin migración, red) =
 * «ninguno» (la lista se ve completa en vez de romperse).
 */
export async function archivadosDeServidor(): Promise<ConjuntoArchivados> {
  try {
    const { usarGestion } = await import("../gestion/d1.ts");
    return await usarGestion((db) => cargarArchivados(db));
  } catch {
    return SIN_ARCHIVADOS;
  }
}

/** Texto de la lectura del parámetro `archivados` de una URL del panel: `solo`, `incluir` o (defecto) `excluir`. */
export function modoArchivadosDe(valor: string | null | undefined): ModoArchivados {
  return valor === "solo" || valor === "incluir" ? valor : "excluir";
}
