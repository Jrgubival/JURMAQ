import 'server-only';
import fs from 'fs';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { env } from '@jurmaq/shared/env';
import { esProduccion } from '@/lib/pedidos';

/**
 * Opiniones de productos que deja el comprador con el enlace del correo
 * (/opinar/<numero>/<token>). Sin cuentas: la opinión se ata al pedido y al
 * producto, y hay una sola por (pedido, producto) — índice único en la base
 * (supabase/migrations/2026_10_31_barraca_sin_cuentas.sql).
 *
 * En desarrollo con PEDIDOS_STORE=archivo se guardan en `.opiniones-dev.json`
 * para no escribir en la base de producción.
 */

export interface NuevaOpinion {
  pedidoNumero: string;
  productoId: number;
  rating: number;
  titulo: string | null;
  comentario: string | null;
  /** Nombre que se publica: nombre + inicial del apellido ("Juan P."). */
  autorPublico: string;
}

const ARCHIVO = path.join(process.cwd(), '.opiniones-dev.json');

// Columnas nuevas todavía no están en db-types (migración sin aplicar).
const db = supabaseAdmin as unknown as SupabaseClient;

function usarArchivo(): boolean {
  if (env.PEDIDOS_STORE !== 'archivo') return false;
  if (esProduccion()) throw new Error('Opiniones en archivo no permitidas en producción');
  return true;
}

type FilaArchivo = NuevaOpinion & { created_at: string };

function leerArchivo(): FilaArchivo[] {
  try {
    return JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')) as FilaArchivo[];
  } catch {
    return [];
  }
}

/** "juan pablo pérez soto" → "Juan P." (nunca el apellido completo). */
export function autorPublico(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const cap = (t: string) => t.charAt(0).toLocaleUpperCase('es-CL') + t.slice(1).toLocaleLowerCase('es-CL');
  if (partes.length === 0) return 'Cliente';
  const primero = cap(partes[0]).slice(0, 30);
  // "Nombre Apellido [Apellido2]" → inicial de la 2ª palabra; con 4 o más
  // ("Nombre Nombre2 Apellido Apellido2") → la del primer apellido.
  const apellido = partes.length >= 4 ? partes[partes.length - 2] : partes.length >= 2 ? partes[1] : '';
  return apellido ? `${primero} ${apellido.charAt(0).toLocaleUpperCase('es-CL')}.` : primero;
}

/** Productos de este pedido que ya tienen opinión. */
export async function productosOpinados(pedidoNumero: string): Promise<Set<number>> {
  if (usarArchivo()) {
    return new Set(leerArchivo().filter((o) => o.pedidoNumero === pedidoNumero).map((o) => o.productoId));
  }
  const { data, error } = await db
    .from('barraca_reviews')
    .select('producto_id')
    .eq('pedido_numero', pedidoNumero);
  if (error) throw error;
  return new Set((data ?? []).map((r: { producto_id: number }) => Number(r.producto_id)));
}

/**
 * Guarda la opinión. 'duplicada' si ya había una para ese pedido y producto
 * (lo garantiza el índice único, no sólo la consulta previa).
 *
 * Regla de publicación (la misma de antes): compra verificada → aprobada al
 * tiro. Acá siempre es compra verificada, porque el enlace sale de un pedido
 * entregado. El panel de reseñas puede ocultarla después.
 */
export async function crearOpinion(o: NuevaOpinion): Promise<'ok' | 'duplicada'> {
  if (usarArchivo()) {
    const lista = leerArchivo();
    if (lista.some((x) => x.pedidoNumero === o.pedidoNumero && x.productoId === o.productoId)) return 'duplicada';
    lista.push({ ...o, created_at: new Date().toISOString() });
    fs.writeFileSync(ARCHIVO, JSON.stringify(lista, null, 2));
    return 'ok';
  }
  const ahora = new Date().toISOString();
  const { error } = await db.from('barraca_reviews').insert({
    usuario_id: null,
    pedido_numero: o.pedidoNumero,
    producto_id: o.productoId,
    rating: o.rating,
    titulo: o.titulo,
    comentario: o.comentario,
    usuario_nombre: o.autorPublico,
    autor_publico: o.autorPublico,
    compra_verificada: true,
    estado: 'aprobada',
    moderado_at: ahora,
  });
  if (error) {
    if (error.code === '23505') return 'duplicada';
    throw error;
  }
  return 'ok';
}
