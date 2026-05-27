import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { escapeLikePattern, isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { transporter } from '@jurmaq/shared/mail/email';
import { logSafeError } from '@jurmaq/shared/logging';
import { env } from '@jurmaq/shared/env';

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission('solicitudes', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');
    const servicio = searchParams.get('servicio');
    const search = searchParams.get('search');

    let query = supabaseAdmin.from('solicitudes').select('*');

    if (estado) {
      query = query.eq('estado', estado);
    } else if (servicio) {
      query = query.eq('servicio', servicio);
    } else if (search) {
      const safeSearch = escapeLikePattern(search.trim());
      query = query.or(
        `cliente_nombre.ilike.%${safeSearch}%,cliente_empresa.ilike.%${safeSearch}%,cliente_email.ilike.%${safeSearch}%,maquinaria_nombre.ilike.%${safeSearch}%,mensaje.ilike.%${safeSearch}%`
      );
    }

    const { data: results, error } = await query;

    if (error) throw error;

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching solicitudes:', error);
    return NextResponse.json(
      { error: 'Error al obtener solicitudes' },
      { status: 500 }
    );
  }
}

// POST is public (contact form) - no auth required
export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  // Rate limit: 3 contact form submissions per 15 minutes per IP
  const ip = getClientIp(request);
  const limiter = rateLimit(`solicitud:${ip}`, { maxAttempts: 3, windowSeconds: 900 });
  if (!limiter.success) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Intente nuevamente en un momento.' },
      { status: 429 }
    );
  }

  try {
    let body: Record<string, any>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
    }

    // Input validation for public contact form
    if (!body.clienteNombre || typeof body.clienteNombre !== 'string' || body.clienteNombre.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }
    if (!body.clienteTelefono || typeof body.clienteTelefono !== 'string' || body.clienteTelefono.trim().length === 0) {
      return NextResponse.json({ error: 'El telefono es requerido' }, { status: 400 });
    }
    // Sanitize string inputs - strip HTML tags
    const sanitize = (str: string | undefined | null): string | null => {
      if (!str || typeof str !== 'string') return null;
      return str.replace(/<[^>]*>/g, '').trim();
    };

    const { data: result, error } = await supabaseAdmin
      .from('solicitudes')
      .insert({
        cliente_nombre: sanitize(body.clienteNombre)!,
        cliente_empresa: sanitize(body.clienteEmpresa),
        cliente_email: sanitize(body.clienteEmail),
        cliente_telefono: sanitize(body.clienteTelefono)!,
        maquinaria_id: body.maquinariaId ? parseInt(body.maquinariaId) || null : null,
        maquinaria_nombre: sanitize(body.maquinariaNombre),
        fecha_inicio: body.fechaInicio || null,
        fecha_fin: body.fechaFin || null,
        estado: 'pendiente',
        servicio: sanitize(body.servicio),
        mensaje: sanitize(body.mensaje),
        notas: null,
      })
      .select()
      .single();

    if (error) throw error;

    // Notify admin (and BCC constructora) via email — non-blocking.
    // The contact form on jurmaq.cl was previously a black hole: leads
    // landed in the DB but no one was notified, so emails would only get
    // seen if someone manually opened the admin panel.
    try {
      const adminEmail = env.ADMIN_EMAIL || 'contacto@jurmaq.cl';
      // Escape chars that have meaning in HTML attribute *or* text contexts.
      // Without escaping single quotes/backticks/equals/slash, a value injected
      // inside an attribute (e.g. <a href="?q=${val}">) can break out and
      // inject JS via something like:  " onclick=alert(1) data-x="
      const escape = (str: string | null | undefined) =>
        String(str || '-').replace(/[<>&"'`=/]/g, (c) => (
          { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;', '/': '&#47;' }[c] || c
        ));
      const servicioLabel = sanitize(body.servicio) || 'No especificado';
      const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="600" cellpadding="0" cellspacing="0" align="center" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;">
    <tr><td style="background:#0c1d3a;padding:20px;color:#fff;text-align:center;">
      <h1 style="margin:0;font-size:18px;">Nueva solicitud de contacto - jurmaq.cl</h1>
    </td></tr>
    <tr><td style="padding:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px;">Nombre:</td><td style="padding:6px 0;color:#1f2937;font-size:14px;font-weight:600;">${escape(sanitize(body.clienteNombre))}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Telefono:</td><td style="padding:6px 0;color:#1f2937;font-size:14px;"><a href="tel:${escape(sanitize(body.clienteTelefono))}" style="color:#0c1d3a;">${escape(sanitize(body.clienteTelefono))}</a></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Email:</td><td style="padding:6px 0;color:#1f2937;font-size:14px;"><a href="mailto:${escape(sanitize(body.clienteEmail))}" style="color:#0c1d3a;">${escape(sanitize(body.clienteEmail)) || '(no proporcionado)'}</a></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Empresa:</td><td style="padding:6px 0;color:#1f2937;font-size:14px;">${escape(sanitize(body.clienteEmpresa)) || '-'}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Servicio:</td><td style="padding:6px 0;color:#1f2937;font-size:14px;font-weight:600;">${escape(servicioLabel)}</td></tr>
        ${sanitize(body.maquinariaNombre) ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Maquinaria:</td><td style="padding:6px 0;color:#1f2937;font-size:14px;">${escape(sanitize(body.maquinariaNombre))}</td></tr>` : ''}
      </table>
      ${sanitize(body.mensaje) ? `
      <div style="margin-top:20px;padding:16px;background:#f9fafb;border-left:4px solid #e6b422;border-radius:0 8px 8px 0;">
        <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Mensaje del cliente</div>
        <div style="color:#1f2937;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escape(sanitize(body.mensaje))}</div>
      </div>` : ''}
      <div style="margin-top:24px;text-align:center;">
        <a href="${env.NEXTAUTH_URL || 'https://jurmaq.cl'}/admin/solicitudes" style="display:inline-block;background:#0c1d3a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Ver en panel admin</a>
      </div>
    </td></tr>
    <tr><td style="background:#f9fafb;padding:14px;text-align:center;color:#9ca3af;font-size:11px;">JURMAQ - Notificacion automatica - ${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</td></tr>
  </table>
</body></html>`.trim();

      await transporter.sendMail({
        to: adminEmail,
        subject: `[jurmaq.cl] Solicitud ${servicioLabel} - ${sanitize(body.clienteNombre)}`,
        html,
      });
    } catch (mailErr) {
      logSafeError('solicitud-email-fail', { error: String(mailErr) });
      // Don't fail the request — the solicitud was saved, the email is best-effort.
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating solicitud:', error);
    return NextResponse.json(
      { error: 'Error al crear solicitud' },
      { status: 500 }
    );
  }
}
