import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { parseBody } from '@jurmaq/shared/validation';
import { logSafeError } from '@jurmaq/shared/logging';
import { usarGestion } from '@/lib/gestion';
import { editarCupon, desactivarCupon } from '@/lib/cupones/admin';
import { repoAdminSupabase } from '@/lib/cupones/repo-supabase';
import { editarSchema, respuestaGestionNoDisponible, esNoDisponible } from '@/lib/cupones/servidor-admin';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function usuarioDe(session: { user?: { id?: string | null; email?: string | null } | null }) {
  return { id: String(session.user?.id ?? ''), email: session.user?.email ?? null };
}

/** Edita un cupón ya creado (campos y reglas). El código no se cambia: hay historial de usos. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  const session = await requirePermission('barraca_promociones', 'update');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Cupón no encontrado' }, { status: 404 });
  const parsed = parseBody(editarSchema, await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: 'Revisa los datos del cupón.' }, { status: 400 });

  try {
    const r = await usarGestion((db) => editarCupon(db, repoAdminSupabase, usuarioDe(session), id, parsed.data));
    if (!r.ok) {
      const status = r.codigo === 'no_encontrado' ? 404 : r.codigo === 'no_disponible' ? 503 : 400;
      return NextResponse.json({ error: r.error }, { status });
    }
    return NextResponse.json({ ok: true, cupon: r.valor.cupon, reglas: r.valor.reglas });
  } catch (error) {
    if (esNoDisponible(error)) return respuestaGestionNoDisponible();
    logSafeError('admin-cupones-edit', { error: String(error) });
    return NextResponse.json({ error: 'Error actualizando' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  const session = await requirePermission('barraca_promociones', 'delete');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Cupón no encontrado' }, { status: 404 });
  try {
    // Soft-delete: se desactiva y se conserva el historial de usos.
    const r = await usarGestion((db) => desactivarCupon(db, repoAdminSupabase, usuarioDe(session), id));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.codigo === 'no_encontrado' ? 404 : 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (esNoDisponible(error)) {
      // Apagar un cupón nunca debe depender de la base de gestión: se desactiva directo (sin auditoría).
      const ok = await repoAdminSupabase.actualizar(id, { activo: false }).catch(() => false);
      return ok ? NextResponse.json({ ok: true, auditado: false }) : respuestaGestionNoDisponible();
    }
    logSafeError('admin-cupones-delete', { error: String(error) });
    return NextResponse.json({ error: 'Error desactivando' }, { status: 500 });
  }
}
