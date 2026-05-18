/**
 * DELETE /api/admin/maquinarias/[id]/documentos/[docId]
 *   Borra el archivo del Storage + la row de `maquinaria_documentos`.
 *
 *   Verifica:
 *   - El doc pertenece a la máquina del :id (no permitir borrar docs de otra
 *     máquina aunque se acierte el docId).
 *   - Auth: requirePermission('maquinarias', 'update').
 *
 *   Si el delete de Storage falla pero la row se borra, retorna 200 con
 *   warning — el archivo huérfano se puede limpiar con un cron job futuro.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { MAQ_DOCS_BUCKET, parseNumericId } from '../_helpers';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const session = await requirePermission('maquinarias', 'update');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id, docId } = await params;
    const maquinariaId = parseNumericId(id);
    const documentoId = parseNumericId(docId);
    if (!maquinariaId || !documentoId) {
      return NextResponse.json({ error: 'IDs invalidos' }, { status: 400 });
    }

    const ip = getClientIp(request);
    const { success } = rateLimit(`maq-docs-delete:${ip}`, { maxAttempts: 20, windowSeconds: 60 });
    if (!success) return NextResponse.json({ error: 'Demasiadas eliminaciones' }, { status: 429 });

    // Verificar que el doc pertenece a la máquina (defensa contra borrar docs
    // de otra máquina aunque sepan el docId).
    const { data: doc, error: fetchError } = await supabaseAdmin
      .from('maquinaria_documentos')
      .select('id, archivo_path, maquinaria_id')
      .eq('id', documentoId)
      .maybeSingle();

    if (fetchError) {
      if (fetchError.code === 'PGRST205') {
        return NextResponse.json({ error: 'Tabla no migrada' }, { status: 503 });
      }
      throw fetchError;
    }
    if (!doc) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }
    if (doc.maquinaria_id !== maquinariaId) {
      return NextResponse.json({ error: 'Documento no pertenece a esta maquinaria' }, { status: 403 });
    }

    // Borrar row primero (rápido, atómico). Si falla, no tocamos Storage.
    const { error: deleteError } = await supabaseAdmin
      .from('maquinaria_documentos')
      .delete()
      .eq('id', documentoId);

    if (deleteError) {
      console.error('Error borrando row maq-doc:', deleteError);
      return NextResponse.json({ error: 'Error eliminando registro' }, { status: 500 });
    }

    // Storage cleanup — si falla, se logea pero la respuesta es 200 porque la
    // DB ya está consistente. Un cron job futuro puede barrer huérfanos
    // comparando paths en Storage vs paths en `maquinaria_documentos`.
    const { error: storageError } = await supabaseAdmin.storage
      .from(MAQ_DOCS_BUCKET)
      .remove([doc.archivo_path]);

    if (storageError) {
      console.warn('Doc-row eliminada pero Storage falló (archivo huérfano):', doc.archivo_path, storageError);
      return NextResponse.json({ ok: true, warning: 'Registro eliminado, archivo huérfano en Storage' });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error eliminando documento de maquinaria:', error);
    return NextResponse.json({ error: 'Error al eliminar documento' }, { status: 500 });
  }
}
