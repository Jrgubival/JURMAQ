import { NextRequest, NextResponse } from 'next/server';
import { env } from '@jurmaq/shared/env';
import { safeSecretEquals } from '@jurmaq/shared/crypto/secret';
import { obtenerGestionDb } from '@/lib/gestion';
import { ejecutarMantenimiento } from '@/lib/gestion-precios/mantenimiento';
import { depsReales } from '@/lib/gestion-precios/deps-reales';

/**
 * POST /api/cron/mantenimiento-gestion (cada 30 min, desde custom-worker.ts)
 *
 * Tareas programadas de la gestión por MCP:
 *   1. Ofertas con fecha: empieza las que ya les toca y termina las vencidas
 *      (devuelve el precio anterior sin pisar lo que alguien haya cambiado).
 *   2. Reintento de los avisos a Jorge que no salieron (modo avisar y operaciones de dinero o borrado).
 *   3. Limpieza (una vez por hora): OAuth, límites de uso, aprobaciones,
 *      vistas previas vencidas y ofertas viejas.
 * Idempotente: dos corridas a la vez o repetidas no duplican nada. Si la base
 * de gestión todavía no existe, responde ok sin hacer nada. No toca el aviso
 * de carritos (/api/cron/avisos-carritos), que corre aparte.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false; // fail-closed
  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  return safeSecretEquals(provided, secret);
}

export const GET = (request: NextRequest) => POST(request);

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const db = await obtenerGestionDb();
    if (!db) return NextResponse.json({ ok: true, gestion: false });
    const { depsAvisoReales } = await import('@/lib/mcp/aviso-servidor');
    const r = await ejecutarMantenimiento(db, depsReales(), Date.now(), depsAvisoReales());
    return NextResponse.json({ ok: true, gestion: true, ofertas: r.ofertas, avisos: r.avisos, limpieza: r.limpieza });
  } catch (e) {
    // Sin mensaje ni detalles: podrían traer datos internos.
    console.error('[mantenimiento-gestion-fallo]', { tipo: e instanceof Error ? e.name : typeof e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
