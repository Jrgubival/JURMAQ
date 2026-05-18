/**
 * GET /api/admin/usuarios/[id]/documentos/[docId]/download
 *   Genera signed URL (TTL 5min) y 302 redirect al objeto Storage.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { DOWNLOAD_TTL_SECONDS, getSignedUrl, parseNumericId } from '../../_helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await requirePermission('usuarios', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id, docId } = await params;
    const userId = parseNumericId(id);
    const documentoId = parseNumericId(docId);
    if (!userId || !documentoId) {
      return NextResponse.json({ error: 'IDs invalidos' }, { status: 400 });
    }

    const ip = getClientIp(request);
    const { success } = rateLimit(`users-docs-download:${ip}`, { maxAttempts: 60, windowSeconds: 60 });
    if (!success) return NextResponse.json({ error: 'Demasiadas descargas' }, { status: 429 });

    const { data: doc, error } = await supabaseAdmin
      .from('users_documentos')
      .select('id, archivo_path, user_id')
      .eq('id', documentoId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST205') {
        return NextResponse.json({ error: 'Tabla no migrada' }, { status: 503 });
      }
      throw error;
    }
    if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    if (doc.user_id !== userId) {
      return NextResponse.json({ error: 'Documento no pertenece a este usuario' }, { status: 403 });
    }

    const signedUrl = await getSignedUrl(doc.archivo_path, DOWNLOAD_TTL_SECONDS);
    if (!signedUrl) {
      return NextResponse.json({ error: 'Error generando URL de descarga' }, { status: 500 });
    }

    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    console.error('Error generando download URL:', error);
    return NextResponse.json({ error: 'Error al descargar documento' }, { status: 500 });
  }
}
