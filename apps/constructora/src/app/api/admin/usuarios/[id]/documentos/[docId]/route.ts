/**
 * DELETE /api/admin/usuarios/[id]/documentos/[docId]
 *   Borra storage object + row. Verifica pertenencia (no permitir borrar
 *   docs de otro usuario aunque se conozca el docId).
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { USERS_DOCS_BUCKET, parseNumericId } from '../_helpers';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const session = await requirePermission('usuarios', 'update');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id, docId } = await params;
    const userId = parseNumericId(id);
    const documentoId = parseNumericId(docId);
    if (!userId || !documentoId) {
      return NextResponse.json({ error: 'IDs invalidos' }, { status: 400 });
    }

    const ip = getClientIp(request);
    const { success } = rateLimit(`users-docs-delete:${ip}`, { maxAttempts: 20, windowSeconds: 60 });
    if (!success) return NextResponse.json({ error: 'Demasiadas eliminaciones' }, { status: 429 });

    const { data: doc, error: fetchError } = await supabaseAdmin
      .from('users_documentos')
      .select('id, archivo_path, user_id')
      .eq('id', documentoId)
      .maybeSingle();

    if (fetchError) {
      if (fetchError.code === 'PGRST205') {
        return NextResponse.json({ error: 'Tabla no migrada' }, { status: 503 });
      }
      throw fetchError;
    }
    if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    if (doc.user_id !== userId) {
      return NextResponse.json({ error: 'Documento no pertenece a este usuario' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('users_documentos')
      .delete()
      .eq('id', documentoId);

    if (deleteError) {
      console.error('Error borrando row users-doc:', deleteError);
      return NextResponse.json({ error: 'Error eliminando registro' }, { status: 500 });
    }

    const { error: storageError } = await supabaseAdmin.storage
      .from(USERS_DOCS_BUCKET)
      .remove([doc.archivo_path]);

    if (storageError) {
      console.warn('Row eliminada pero Storage falló (huérfano):', doc.archivo_path, storageError);
      return NextResponse.json({ ok: true, warning: 'Registro eliminado, archivo huérfano en Storage' });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error eliminando documento de usuario:', error);
    return NextResponse.json({ error: 'Error al eliminar documento' }, { status: 500 });
  }
}
