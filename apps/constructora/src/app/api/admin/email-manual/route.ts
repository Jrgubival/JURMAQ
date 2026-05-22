import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import {
  sendAdminManualEmail,
  previewAdminManualEmail,
  type AdminManualEmailKind,
  type AdminManualEmailVars,
} from '@jurmaq/shared/mail/templates/admin-manual-arriendo';

/**
 * POST /api/admin/email-manual
 *
 * Envía un email predefinido desde admin arriendo a un cliente. Usado para
 * follow-up, recordatorios, pedidos de info, coordinación entrega/retiro,
 * agradecimiento post-arriendo, o mensaje custom.
 *
 * Body:
 *   {
 *     to: 'cliente@ejemplo.cl',
 *     kind: 'follow_up' | 'need_info' | ...,
 *     vars: { nombre, numero_cotizacion?, maquinaria?, fecha?, ubicacion?, monto_reserva? },
 *     customMessage?: string,
 *     cotizacion_arriendo_id?: number,
 *     solicitud_id?: number,
 *     preview?: true   // si true, NO envía, retorna { asunto, html } para preview
 *   }
 *
 * Tracking: cada envío exitoso queda en admin_emails_log (quién, cuándo, a quién, qué kind).
 *
 * Permiso: cotizaciones.update (mismo que cambia estado).
 */

export const runtime = 'nodejs';

const VALID_KINDS: AdminManualEmailKind[] = [
  'follow_up',
  'need_info',
  'quote_reminder',
  'reservation_pending',
  'delivery_schedule',
  'return_schedule',
  'thank_you',
  'custom',
];

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('cotizaciones', 'update');
  if (!session) return forbiddenResponse('No tienes permiso para enviar emails');

  // Anti-spam: 30 envíos por hora por user.
  const userId = (session.user as { id?: string })?.id || '';
  const ip = getClientIp(request);
  const rl = rateLimit(`admin-email-manual:${userId}:${ip}`, {
    maxAttempts: 30,
    windowSeconds: 3600,
  });
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiados envíos. Esperá una hora.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const to = sanitizeString(body?.to)?.trim().toLowerCase() || '';
  const kind = String(body?.kind || '') as AdminManualEmailKind;
  const previewOnly = body?.preview === true;

  if (!to || !isValidEmail(to)) {
    return NextResponse.json({ error: 'Email destinatario inválido' }, { status: 400 });
  }
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Tipo de email inválido' }, { status: 400 });
  }

  const rawVars = (body?.vars && typeof body.vars === 'object' ? body.vars : {}) as Record<string, unknown>;
  const vars: AdminManualEmailVars = {
    nombre: sanitizeString(rawVars.nombre)?.trim() || 'Cliente',
    numero_cotizacion: sanitizeString(rawVars.numero_cotizacion)?.trim() || undefined,
    maquinaria: sanitizeString(rawVars.maquinaria)?.trim() || undefined,
    fecha: sanitizeString(rawVars.fecha)?.trim() || undefined,
    ubicacion: sanitizeString(rawVars.ubicacion)?.trim() || undefined,
    monto_reserva: typeof rawVars.monto_reserva === 'number' ? rawVars.monto_reserva : undefined,
  };

  const customMessage = sanitizeString(body?.customMessage)?.trim() || undefined;
  if (kind === 'custom' && !customMessage) {
    return NextResponse.json(
      { error: 'El mensaje personalizado es obligatorio para tipo "custom"' },
      { status: 400 },
    );
  }

  const sentByName =
    sanitizeString((session.user as { name?: string })?.name)?.trim() || undefined;
  const sentByEmail = String((session.user as { email?: string })?.email || '');

  // Preview mode: no envía, solo retorna el render.
  if (previewOnly) {
    const rendered = previewAdminManualEmail({
      to,
      kind,
      vars,
      customMessage,
      sentByName,
    });
    return NextResponse.json({ ok: true, preview: rendered });
  }

  // Envía.
  const result = await sendAdminManualEmail({
    to,
    kind,
    vars,
    customMessage,
    sentByName,
  });

  if (!result.ok) {
    console.error('[admin-email-manual-fail]', {
      kind,
      error: result.error,
      cotizacion_arriendo_id: body?.cotizacion_arriendo_id,
    });
    // Log el intento fallido también (auditoría).
    void supabaseAdmin.from('admin_emails_log').insert({
      kind,
      to_email: to,
      to_nombre: vars.nombre,
      asunto: result.asunto,
      custom_message: customMessage,
      cotizacion_arriendo_id: body?.cotizacion_arriendo_id || null,
      solicitud_id: body?.solicitud_id || null,
      contrato_id: body?.contrato_id || null,
      sent_by_user_id: userId,
      sent_by_email: sentByEmail,
      email_status: 'failed',
    });
    return NextResponse.json(
      { error: 'No se pudo enviar el email', details: result.error },
      { status: 500 },
    );
  }

  // Log envío OK.
  const { error: logErr } = await supabaseAdmin.from('admin_emails_log').insert({
    kind,
    to_email: to,
    to_nombre: vars.nombre,
    asunto: result.asunto,
    custom_message: customMessage,
    cotizacion_arriendo_id: body?.cotizacion_arriendo_id || null,
    solicitud_id: body?.solicitud_id || null,
    contrato_id: body?.contrato_id || null,
    sent_by_user_id: userId,
    sent_by_email: sentByEmail,
    email_provider_id: result.provider_id,
    email_status: 'sent',
  });
  if (logErr) {
    // No es fatal — el email se envió. Solo logueamos el fail del log.
    console.error('[admin-email-manual-log-fail]', logErr);
  }

  return NextResponse.json({ ok: true, asunto: result.asunto });
}

/**
 * GET /api/admin/email-manual?cotizacion_arriendo_id=N
 *
 * Devuelve el histórico de emails manuales enviados a este cliente desde
 * este origen. Permite al admin ver "ah, ya le mandé el follow-up hace 3 días".
 */
export async function GET(request: NextRequest) {
  const session = await requirePermission('cotizaciones', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { searchParams } = new URL(request.url);
  const cotId = searchParams.get('cotizacion_arriendo_id');
  const to = searchParams.get('to');

  let query = supabaseAdmin
    .from('admin_emails_log')
    .select('id, kind, to_email, to_nombre, asunto, custom_message, sent_by_email, sent_at, email_status')
    .order('sent_at', { ascending: false })
    .limit(50);

  if (cotId) query = query.eq('cotizacion_arriendo_id', Number(cotId));
  else if (to) query = query.eq('to_email', String(to).toLowerCase());
  else return NextResponse.json({ error: 'cotizacion_arriendo_id o to requerido' }, { status: 400 });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Error' }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
