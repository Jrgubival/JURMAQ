import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { parseBody } from '@jurmaq/shared/validation';
import { logSafeError } from '@jurmaq/shared/logging';
import { obtenerGestionDb, usarGestion } from '@/lib/gestion';
import { listarCuponesAdmin, crearCupon } from '@/lib/cupones/admin';
import { leerInterruptorCupones } from '@/lib/cupones/interruptor';
import { repoAdminSupabase } from '@/lib/cupones/repo-supabase';
import { crearSchema, respuestaGestionNoDisponible, esNoDisponible } from '@/lib/cupones/servidor-admin';

/**
 * GET  /api/admin/cupones — lista con reglas, usos, estado del interruptor y categorías
 * POST /api/admin/cupones — crea un cupón con sus reglas (auditado)
 *
 * El interruptor de cupones NO se enciende desde acá: requiere la aprobación de
 * Jorge (lib/cupones/interruptor.ts, encenderInterruptorCupones).
 */

export const runtime = 'nodejs';

export async function GET() {
  const session = await requirePermission('barraca_promociones', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');
  try {
    const db = await obtenerGestionDb();
    const { items, gestionDisponible } = await listarCuponesAdmin(db, repoAdminSupabase);
    let interruptor = false;
    if (db) interruptor = await leerInterruptorCupones(db).catch(() => false);
    const { data: cats } = await supabaseAdmin.from('barraca_categorias').select('id, nombre, padre_id, activa').order('nombre');
    return NextResponse.json({ items, gestionDisponible, interruptor, categorias: cats ?? [] });
  } catch (error) {
    logSafeError('admin-cupones-list', { error: String(error) });
    return NextResponse.json({ error: 'Error listando cupones' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  const session = await requirePermission('barraca_promociones', 'create');
  if (!session) return forbiddenResponse('No tienes permiso');

  const parsed = parseBody(crearSchema, await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: 'Revisa los datos del cupón.' }, { status: 400 });

  try {
    const r = await usarGestion((db) =>
      crearCupon(db, repoAdminSupabase, { id: String(session.user?.id ?? ''), email: session.user?.email ?? null }, parsed.data),
    );
    if (!r.ok) {
      const status = r.codigo === 'codigo_repetido' ? 409 : r.codigo === 'no_disponible' ? 503 : 400;
      return NextResponse.json({ error: r.error }, { status });
    }
    return NextResponse.json({ ok: true, cupon: r.valor.cupon, reglas: r.valor.reglas });
  } catch (error) {
    if (esNoDisponible(error)) return respuestaGestionNoDisponible();
    logSafeError('admin-cupones-create', { error: String(error) });
    return NextResponse.json({ error: 'Error creando cupón' }, { status: 500 });
  }
}
