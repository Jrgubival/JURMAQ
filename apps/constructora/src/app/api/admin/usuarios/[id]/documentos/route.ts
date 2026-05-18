/**
 * GET    /api/admin/usuarios/[id]/documentos
 *   Lista docs de un usuario con signed URL preview.
 *
 * POST   /api/admin/usuarios/[id]/documentos
 *   Multipart upload (file + tipo + nombre + descripcion? + fechas?).
 *   Mismo contrato que /api/admin/maquinarias/[id]/documentos.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import {
  USERS_DOCS_BUCKET,
  ALLOWED_TIPOS,
  MAX_FILE_SIZE,
  PREVIEW_TTL_SECONDS,
  detectFileFormat,
  formatToContentType,
  buildStoragePath,
  getSignedUrl,
  parseNumericId,
  validateDate,
  type TipoDocumento,
} from './_helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission('usuarios', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const userId = parseNumericId(id);
    if (!userId) return NextResponse.json({ error: 'ID de usuario invalido' }, { status: 400 });

    const ip = getClientIp(request);
    const { success } = rateLimit(`users-docs-list:${ip}`, { maxAttempts: 30, windowSeconds: 60 });
    if (!success) return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });

    const { data: docs, error } = await supabaseAdmin
      .from('users_documentos')
      .select('id, user_id, tipo, nombre, descripcion, archivo_path, archivo_mime, archivo_size_bytes, fecha_emision, fecha_vencimiento, created_by, created_at, updated_at')
      .eq('user_id', userId)
      .order('tipo', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205' || /users_documentos/.test(error.message || '')) {
        return NextResponse.json(
          {
            error: 'Falta migracion. Ejecuta apps/constructora/scripts/migrate-users-documentos.sql en Supabase Dashboard.',
            documentos: [],
          },
          { status: 503 }
        );
      }
      throw error;
    }

    const docsConUrl = await Promise.all(
      (docs || []).map(async (d) => ({
        ...d,
        preview_url: await getSignedUrl(d.archivo_path, PREVIEW_TTL_SECONDS),
      }))
    );

    return NextResponse.json({ documentos: docsConUrl });
  } catch (error) {
    console.error('Error listando documentos de usuario:', error);
    return NextResponse.json({ error: 'Error al listar documentos' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const session = await requirePermission('usuarios', 'update');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const userId = parseNumericId(id);
    if (!userId) return NextResponse.json({ error: 'ID de usuario invalido' }, { status: 400 });

    const ip = getClientIp(request);
    const { success } = rateLimit(`users-docs-upload:${ip}`, { maxAttempts: 20, windowSeconds: 60 });
    if (!success) return NextResponse.json({ error: 'Demasiadas subidas' }, { status: 429 });

    // FK también atrapa esto, pero queremos 404 explícito.
    const { data: usuario } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Archivo excede 10MB' }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 });
    }

    const tipo = sanitizeString(formData.get('tipo') as string | null) as TipoDocumento | null;
    if (!tipo || !ALLOWED_TIPOS.has(tipo)) {
      return NextResponse.json(
        { error: `Tipo invalido. Permitidos: ${Array.from(ALLOWED_TIPOS).join(', ')}` },
        { status: 400 }
      );
    }

    const nombre = sanitizeString(formData.get('nombre') as string | null);
    if (!nombre || nombre.length < 1 || nombre.length > 200) {
      return NextResponse.json({ error: 'Nombre requerido (1-200 caracteres)' }, { status: 400 });
    }

    const descripcion = sanitizeString(formData.get('descripcion') as string | null);
    const fechaEmision = validateDate(formData.get('fecha_emision') as string | null);
    const fechaVencimiento = validateDate(formData.get('fecha_vencimiento') as string | null);

    if (fechaEmision && fechaVencimiento && fechaVencimiento < fechaEmision) {
      return NextResponse.json({ error: 'Vencimiento no puede ser anterior a emisión' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fmt = detectFileFormat(buffer);
    if (!fmt) {
      return NextResponse.json(
        { error: 'Formato no soportado. Solo PDF, JPG, PNG o WEBP reales.' },
        { status: 400 }
      );
    }

    const path = buildStoragePath(userId, tipo, fmt);
    const contentType = formatToContentType(fmt);

    const { data: uploaded, error: uploadError } = await supabaseAdmin.storage
      .from(USERS_DOCS_BUCKET)
      .upload(path, buffer, { contentType, upsert: false });

    if (uploadError || !uploaded) {
      console.error('Error subiendo doc usuario a Storage:', uploadError);
      return NextResponse.json(
        { error: uploadError?.message || 'Error subiendo archivo' },
        { status: 500 }
      );
    }

    const session_user_id = (session.user as { id?: string | number })?.id;
    const createdBy = typeof session_user_id === 'string' ? parseInt(session_user_id, 10) : (session_user_id ?? null);

    const { data: row, error: insertError } = await supabaseAdmin
      .from('users_documentos')
      .insert({
        user_id: userId,
        tipo,
        nombre,
        descripcion: descripcion || null,
        archivo_path: uploaded.path,
        archivo_mime: contentType,
        archivo_size_bytes: file.size,
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento,
        created_by: Number.isFinite(createdBy) ? createdBy : null,
      })
      .select()
      .single();

    if (insertError) {
      await supabaseAdmin.storage.from(USERS_DOCS_BUCKET).remove([uploaded.path]).catch(() => null);
      if (insertError.code === 'PGRST205' || /users_documentos/.test(insertError.message || '')) {
        return NextResponse.json(
          { error: 'Falta migracion. Ejecuta apps/constructora/scripts/migrate-users-documentos.sql en Supabase Dashboard.' },
          { status: 503 }
        );
      }
      console.error('Error insertando row users-doc:', insertError);
      return NextResponse.json(
        { error: insertError.message || 'Error registrando documento' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documento: {
        ...row,
        preview_url: await getSignedUrl(row.archivo_path, PREVIEW_TTL_SECONDS),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error subiendo documento de usuario:', error);
    return NextResponse.json({ error: 'Error al subir documento' }, { status: 500 });
  }
}
