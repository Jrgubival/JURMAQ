/**
 * Notas internas de pedidos (D1 de gestión, migrations-gestion/0007). Funciones
 * puras sobre la D1: en producción viene de `usarGestion`, en pruebas de la D1
 * simulada. Las notas son del equipo (no las ve el cliente).
 */
import type { D1Like } from '../gestion/tipos.ts';
import { idUuid } from '../gestion/util.ts';
import type { NotaInterna } from './vista-mcp.ts';

export const MAX_NOTA = 500;
export const MAX_NOTAS_POR_PEDIDO = 50;

export interface NotaGuardada extends NotaInterna {
  numero: string;
}

export type ResultadoNota = { ok: true; nota: NotaGuardada } | { ok: false; motivo: 'tope' | 'vacia' };

export function limpiarNota(texto: string): string {
  return texto
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export async function agregarNota(
  db: D1Like, numero: string, texto: string, autor: { id: string; email?: string | null }, ahora: number = Date.now(),
): Promise<ResultadoNota> {
  const t = limpiarNota(texto).slice(0, MAX_NOTA);
  if (!t) return { ok: false, motivo: 'vacia' };
  const n = await db.prepare('SELECT COUNT(*) AS n FROM pedido_notas WHERE numero = ? AND borrada_en IS NULL').bind(numero).first<{ n: number }>();
  if (Number(n?.n ?? 0) >= MAX_NOTAS_POR_PEDIDO) return { ok: false, motivo: 'tope' };
  const id = idUuid();
  await db
    .prepare('INSERT INTO pedido_notas (id, numero, texto, autor_id, autor_email, creada_en) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, numero, t, autor.id, autor.email ?? null, ahora)
    .run();
  return { ok: true, nota: { id, numero, texto: t, autor: autor.email ?? null, creadaEn: ahora } };
}

export async function notasDePedido(db: D1Like, numero: string, limite = 20): Promise<NotaInterna[]> {
  const { results } = await db
    .prepare('SELECT id, texto, autor_email, creada_en FROM pedido_notas WHERE numero = ? AND borrada_en IS NULL ORDER BY creada_en DESC LIMIT ?')
    .bind(numero, Math.min(Math.max(1, limite), 50))
    .all<{ id: string; texto: string; autor_email: string | null; creada_en: number }>();
  return results.map((r) => ({ id: r.id, texto: r.texto, autor: r.autor_email, creadaEn: Number(r.creada_en) }));
}

/** Borra (marca) una nota. Idempotente: false si ya estaba borrada o no existe. */
export async function borrarNota(db: D1Like, id: string, usuarioId: string, ahora: number = Date.now()): Promise<boolean> {
  const f = await db
    .prepare('UPDATE pedido_notas SET borrada_en = ?, borrada_por = ? WHERE id = ? AND borrada_en IS NULL RETURNING id')
    .bind(ahora, usuarioId, id)
    .first<{ id: string }>();
  return !!f;
}

/** Nota tal como la muestra el panel de Ventas (fecha en ISO; solo lectura). */
export interface NotaParaPanel {
  id: string;
  texto: string;
  autor: string | null;
  creadaEn: string;
}

/**
 * Notas para el detalle de venta del panel. NUNCA lanza: si la base de gestión no
 * está, no tiene tablas o falla, devuelve `disponibles: false` y el panel sigue
 * funcionando sin notas. `conDb` es `usarGestion` en producción.
 */
export async function notasParaPanel(
  conDb: <T>(fn: (db: D1Like) => Promise<T>) => Promise<T>, numero: string, plazoMs = 2000,
): Promise<{ notas: NotaParaPanel[]; disponibles: boolean }> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  try {
    // Plazo corto: una base lenta no debe colgar la página de la venta.
    const filas = await Promise.race([
      conDb((db) => notasDePedido(db, numero, MAX_NOTAS_POR_PEDIDO)),
      new Promise<never>((_, mal) => { reloj = setTimeout(() => mal(new Error('plazo')), plazoMs); }),
    ]);
    return {
      notas: filas.map((n) => ({ id: n.id, texto: n.texto, autor: n.autor, creadaEn: new Date(n.creadaEn).toISOString() })),
      disponibles: true,
    };
  } catch (error) {
    console.error('[admin-venta-notas]', error instanceof Error ? error.name : 'error');
    return { notas: [], disponibles: false };
  } finally {
    if (reloj) clearTimeout(reloj);
  }
}
