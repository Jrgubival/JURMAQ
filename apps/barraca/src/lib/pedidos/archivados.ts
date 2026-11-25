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
import { ESTADOS_VENTA } from "../admin/ventas.ts";

export const LIMITE_ARCHIVADOS = 5000;

export interface ConjuntoArchivados {
  numeros: Set<string>;
  /** Había más de LIMITE_ARCHIVADOS: los más antiguos no se excluyen. */
  truncado: boolean;
  /** No se pudo leer la lista (sin base, sin migración, red): el filtro NO se aplicó y hay que decirlo. */
  noDisponible?: boolean;
}

export const SIN_ARCHIVADOS: ConjuntoArchivados = { numeros: new Set(), truncado: false };
export const ARCHIVADOS_NO_DISPONIBLES: ConjuntoArchivados = { numeros: new Set(), truncado: false, noDisponible: true };

/** Lo que quedó fuera de una lista o un total por estar archivado. */
export interface ResumenExcluidos {
  /** Pedidos archivados que quedaron fuera. */
  pedidos: number;
  /** De ellos, los que cuentan como VENTA pagada (pagado, en preparación, listo, despachado, entregado). */
  ventasPagadas: number;
  /** Suma del total de esas ventas pagadas, en pesos. */
  montoVentas: number;
}

export interface ResultadoArchivados<T> {
  lista: T[];
  excluidos: ResumenExcluidos;
  /** false = no se pudo leer la lista de archivados: `lista` viene completa, sin filtrar. */
  filtroAplicado: boolean;
  truncado: boolean;
}

/**
 * Como `filtrarArchivados` pero INFORMANDO: cuántos pedidos archivados (y cuánta venta pagada) quedaron fuera, y si el filtro no
 * pudo aplicarse. Así los reportes y totales no ocultan ventas en silencio.
 */
export function filtrarArchivadosInformando<T extends { numero: string; estado: string; total: number }>(
  lista: readonly T[], archivados: ConjuntoArchivados, modo: ModoArchivados = "excluir",
): ResultadoArchivados<T> {
  const filtrada = filtrarArchivados(lista, archivados, modo);
  const fuera = modo === "excluir" && !archivados.noDisponible ? lista.filter((p) => archivados.numeros.has(p.numero)) : [];
  const ventas = fuera.filter((p) => (ESTADOS_VENTA as string[]).includes(p.estado));
  return {
    lista: filtrada,
    excluidos: { pedidos: fuera.length, ventasPagadas: ventas.length, montoVentas: ventas.reduce((a, p) => a + (Number.isFinite(p.total) ? p.total : 0), 0) },
    filtroAplicado: !archivados.noDisponible,
    truncado: archivados.truncado,
  };
}

const pesosCl = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

/** Frases para reportes y pantallas: qué quedó fuera por archivado y avisos. Vacía si no hay nada que decir. */
export function textoArchivados(r: Pick<ResultadoArchivados<unknown>, "excluidos" | "filtroAplicado" | "truncado">): string[] {
  const out: string[] = [];
  if (!r.filtroAplicado) out.push("ATENCIÓN: no pude leer la lista de pedidos archivados, así que el filtro de archivados NO se aplicó: estas cifras pueden incluir pedidos archivados.");
  if (r.excluidos.pedidos > 0) {
    const n = r.excluidos.pedidos;
    const v = r.excluidos.ventasPagadas;
    out.push(
      `Quedaron fuera ${n} pedido${n === 1 ? "" : "s"} archivado${n === 1 ? "" : "s"}` +
      (v > 0 ? `, entre ellos ${v} venta${v === 1 ? "" : "s"} pagada${v === 1 ? "" : "s"} por ${pesosCl(r.excluidos.montoVentas)} que NO están en estas cifras` : "") +
      ". Se ven con el filtro de archivados.",
    );
  }
  if (r.truncado) out.push(`Aviso: hay más de ${LIMITE_ARCHIVADOS} pedidos archivados y los más antiguos no se pudieron excluir.`);
  return out;
}

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
 * Para el panel y los reportes: los archivados de HOY desde la D1 real. Fallo (sin binding, sin migración, red) = lista
 * completa (no se rompe nada) pero marcada `noDisponible`, para que la pantalla o el reporte lo diga.
 */
export async function archivadosDeServidor(): Promise<ConjuntoArchivados> {
  try {
    const { usarGestion } = await import("../gestion/d1.ts");
    return await usarGestion((db) => cargarArchivados(db));
  } catch {
    return ARCHIVADOS_NO_DISPONIBLES;
  }
}

/** Igual que `cargarArchivados` pero nunca lanza: si falla, devuelve el conjunto marcado `noDisponible`. */
export async function cargarArchivadosSeguro(db: D1Like): Promise<ConjuntoArchivados> {
  try {
    return await cargarArchivados(db);
  } catch {
    return ARCHIVADOS_NO_DISPONIBLES;
  }
}

/** Texto de la lectura del parámetro `archivados` de una URL del panel: `solo`, `incluir` o (defecto) `excluir`. */
export function modoArchivadosDe(valor: string | null | undefined): ModoArchivados {
  return valor === "solo" || valor === "incluir" ? valor : "excluir";
}
