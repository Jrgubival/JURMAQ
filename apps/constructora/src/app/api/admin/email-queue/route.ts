import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

/**
 * Panel admin de la cola de retry de emails (audit M3).
 *
 * GET ?status=pending|sent|failed&limit=50&offset=0
 *   → lista emails encolados/enviados/fallidos para diagnostico.
 *
 * POST { id, action: 'retry_now' | 'drop' }
 *   → 'retry_now' resetea next_attempt_at a NOW para que el cron lo procese
 *      en el siguiente run.
 *   → 'drop' marca el email como descartado (no se reintenta).
 *
 * Solo accesible por admins con permiso `dashboard:read`.
 */

export async function GET(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('dashboard', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 200);
  const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);

  try {
    let query = supabaseAdmin
      .from('email_queue')
      .select('id, to_email, subject, template_kind, context, attempts, max_attempts, last_error, next_attempt_at, status, created_at, sent_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter && ['pending', 'sent', 'failed', 'dropped'].includes(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    const { data, error, count } = await query;
    if (error) {
      const code = (error as { code?: string }).code;
      const msg = (error as { message?: string }).message || '';
      if (code === 'PGRST205' || /email_queue/.test(msg)) {
        return NextResponse.json(
          { error: 'Falta migrate-email-queue.sql en Supabase' },
          { status: 503 }
        );
      }
      throw error;
    }

    // Conteo por status para mostrar tabs en UI.
    const { data: counts } = await supabaseAdmin
      .from('email_queue')
      .select('status')
      .limit(1000);
    const statusCounts: Record<string, number> = { pending: 0, sent: 0, failed: 0, dropped: 0 };
    if (counts) {
      for (const r of counts as Array<{ status: string }>) {
        statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
      }
    }

    return NextResponse.json({
      items: data ?? [],
      total: count ?? 0,
      counts: statusCounts,
    });
  } catch (err) {
    console.error('[email-queue admin GET]:', err);
    return NextResponse.json({ error: 'Error al listar cola' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('dashboard', 'update');
  if (!session) return forbiddenResponse('No tienes permiso');

  try {
    const body = await request.json();
    const id = Number(body.id);
    const action = String(body.action || '');
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'id invalido' }, { status: 400 });
    }
    if (action === 'retry_now') {
      const { error } = await supabaseAdmin
        .from('email_queue')
        .update({
          status: 'pending',
          next_attempt_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true, action: 'retry_now' });
    }
    if (action === 'drop') {
      const { error } = await supabaseAdmin
        .from('email_queue')
        .update({ status: 'dropped' })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true, action: 'drop' });
    }
    return NextResponse.json({ error: 'action debe ser retry_now o drop' }, { status: 400 });
  } catch (err) {
    console.error('[email-queue admin POST]:', err);
    return NextResponse.json({ error: 'Error al ejecutar accion' }, { status: 500 });
  }
}
