import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/init-db';
import { requireAuth, unauthorizedResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

// Use POST not GET — GET can be triggered via <img> tags etc. Keeping the
// idempotent seed fully authenticated + same-origin prevents CSRF.
export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  try {
    const session = await requireAuth();
    if (!session) return unauthorizedResponse();
    if ((session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Requiere rol admin' }, { status: 403 });
    }

    await initializeDatabase();
    return NextResponse.json({ success: true, message: 'Base de datos inicializada' });
  } catch (error) {
    // SECURITY (audit jun-2026): no exponer el error interno al cliente.
    console.error('[seed] error:', error);
    return NextResponse.json({ success: false, error: 'Error al inicializar la base de datos' }, { status: 500 });
  }
}
