/**
 * GET /api/admin/maquinarias/[id]/documentos/[docId]/download
 *
 *   Genera un signed URL con TTL más largo (5 min) y retorna 302 redirect
 *   directo al objeto del Storage. El browser descarga el archivo o lo
 *   muestra inline según el Content-Type.
 *
 *   Este es el endpoint "Descargar en 1 click" que pidió el dueño — un
 *   `<a href="/api/admin/maquinarias/1/documentos/42/download">Descargar</a>`
 *   en la UI es suficiente. La auth admin se verifica acá, no se filtra
 *   la signed URL al HTML.
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
    const session = await requirePermission('maquinarias', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id, docId } = await params;
    const maquinariaId = parseNumericId(id);
    const documentoId = parseNumericId(docId);
    if (!maquinariaId || !documentoId) {
      return NextResponse.json({ error: 'IDs invalidos' }, { status: 400 });
    }

    const ip = getClientIp(request);
    const { success } = rateLimit(`maq-docs-download:${ip}`, { maxAttempts: 60, windowSeconds: 60 });
    if (!success) return NextResponse.json({ error: 'Demasiadas descargas' }, { status: 429 });

    const { data: doc, error } = await supabaseAdmin
      .from('maquinaria_documentos')
      .select('id, archivo_path, maquinaria_id, archivo_mime, nombre')
      .eq('id', documentoId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST205') {
        return NextResponse.json({ error: 'Tabla no migrada' }, { status: 503 });
      }
      throw error;
    }
    if (!doc) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }
    if (doc.maquinaria_id !== maquinariaId) {
      return NextResponse.json({ error: 'Documento no pertenece a esta maquinaria' }, { status: 403 });
    }

    const signedUrl = await getSignedUrl(doc.archivo_path, DOWNLOAD_TTL_SECONDS);
    if (!signedUrl) {
      return NextResponse.json({ error: 'Error generando URL de descarga' }, { status: 500 });
    }

    // 302 redirect al signed URL. El browser sigue automáticamente.
    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    console.error('Error generando download URL:', error);
    return NextResponse.json({ error: 'Error al descargar documento' }, { status: 500 });
  }
}
