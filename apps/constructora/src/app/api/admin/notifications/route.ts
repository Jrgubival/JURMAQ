import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, unauthorizedResponse } from '@jurmaq/shared/auth/guard';

/**
 * GET /api/admin/notifications?limit=20&onlyUnread=false
 *
 * Lista las notificaciones admin globales con flag de leída/no-leída por
 * el usuario actual. Devuelve también el conteo de unread (para badge).
 *
 * Tier 6 F4 — espejo de la implementación barraca.
 */

export const runtime = 'nodejs';

interface NotifRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: 'info' | 'success' | 'warning' | 'error';
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
  read_at?: string | null;
}

interface ReadRow {
  notification_id: string;
  read_at: string;
}

export async function GET(request: NextRequest) {
  // CLAUDE.md exige requirePermission/requireRole en /api/admin/*;
  // `requireAuth` solo comprueba que haya sesión, no es ninguno de los dos.
  const session = await requirePermission('dashboard', 'read');
  if (!session) return unauthorizedResponse();
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit')) || 20));
  const onlyUnread = searchParams.get('onlyUnread') === 'true';

  const { data: notifsRaw, error: notifErr } = await supabaseAdmin
    .from('admin_notifications')
    .select('id, kind, title, body, link, severity, ref_type, ref_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit * 2);

  if (notifErr) {
    console.error('[admin-notif-list-fail]', notifErr);
    return NextResponse.json({ error: 'Error cargando notificaciones' }, { status: 500 });
  }
  const notifs = (notifsRaw ?? []) as NotifRow[];

  const notifIds = notifs.map((n) => n.id);
  let reads: ReadRow[] = [];
  if (notifIds.length > 0) {
    const { data: readsRaw } = await supabaseAdmin
      .from('admin_notifications_reads')
      .select('notification_id, read_at')
      .eq('user_id', userId)
      .in('notification_id', notifIds);
    reads = (readsRaw ?? []) as ReadRow[];
  }

  const readsMap = new Map(reads.map((r) => [r.notification_id, r.read_at]));

  const items = notifs
    .map((n) => ({ ...n, read_at: readsMap.get(n.id) ?? null }))
    .filter((n) => (onlyUnread ? !n.read_at : true))
    .slice(0, limit);

  const { count: totalRecientes } = await supabaseAdmin
    .from('admin_notifications')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());

  const { count: readsUsuario } = await supabaseAdmin
    .from('admin_notifications_reads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const unreadCount = Math.max(0, (totalRecientes ?? 0) - (readsUsuario ?? 0));

  return NextResponse.json({ items, unread_count: unreadCount });
}
