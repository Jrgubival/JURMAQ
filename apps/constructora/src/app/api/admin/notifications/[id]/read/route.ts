import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, unauthorizedResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  // CLAUDE.md exige requirePermission/requireRole en /api/admin/*;
  // `requireAuth` solo comprueba que haya sesión, no es ninguno de los dos.
  const session = await requirePermission('dashboard', 'read');
  if (!session) return unauthorizedResponse();
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return unauthorizedResponse();

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('admin_notifications_reads')
    .upsert(
      {
        notification_id: id,
        user_id: userId,
        read_at: new Date().toISOString(),
      },
      { onConflict: 'notification_id,user_id' },
    );

  if (error) {
    console.error('[admin-notif-read-fail]', error);
    return NextResponse.json({ error: 'Error marcando como leída' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
