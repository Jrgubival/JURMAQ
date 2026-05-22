import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requireAuth, unauthorizedResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requireAuth();
  if (!session) return unauthorizedResponse();
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return unauthorizedResponse();

  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const { data: notifsRaw } = await supabaseAdmin
    .from('admin_notifications')
    .select('id')
    .gte('created_at', cutoff)
    .limit(500);

  const notifIds = (notifsRaw ?? []).map((n) => n.id as string);
  if (notifIds.length === 0) {
    return NextResponse.json({ ok: true, marked: 0 });
  }

  const { data: existingReads } = await supabaseAdmin
    .from('admin_notifications_reads')
    .select('notification_id')
    .eq('user_id', userId)
    .in('notification_id', notifIds);

  const readSet = new Set((existingReads ?? []).map((r) => r.notification_id as string));
  const toInsert = notifIds
    .filter((id) => !readSet.has(id))
    .map((id) => ({
      notification_id: id,
      user_id: userId,
      read_at: new Date().toISOString(),
    }));

  if (toInsert.length === 0) {
    return NextResponse.json({ ok: true, marked: 0 });
  }

  const { error } = await supabaseAdmin
    .from('admin_notifications_reads')
    .insert(toInsert);

  if (error) {
    console.error('[admin-notif-read-all-fail]', error);
    return NextResponse.json({ error: 'Error marcando todas' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, marked: toInsert.length });
}
