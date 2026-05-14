import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { transporter } from '@jurmaq/shared/mail/email';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission('solicitudes', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const { data: result, error } = await supabaseAdmin
      .from('solicitudes')
      .select('*')
      .eq('id', parseInt(id))
      .single();

    if (error || !result) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching solicitud:', error);
    return NextResponse.json(
      { error: 'Error al obtener solicitud' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await requirePermission('solicitudes', 'update');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const body = await request.json();

    const { data: existing } = await supabaseAdmin
      .from('solicitudes')
      .select('id')
      .eq('id', parseInt(id))
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.clienteNombre !== undefined) updateData.cliente_nombre = body.clienteNombre;
    if (body.cliente_nombre !== undefined) updateData.cliente_nombre = body.cliente_nombre;
    if (body.clienteEmpresa !== undefined) updateData.cliente_empresa = body.clienteEmpresa;
    if (body.cliente_empresa !== undefined) updateData.cliente_empresa = body.cliente_empresa;
    if (body.clienteEmail !== undefined) updateData.cliente_email = body.clienteEmail;
    if (body.cliente_email !== undefined) updateData.cliente_email = body.cliente_email;
    if (body.clienteTelefono !== undefined) updateData.cliente_telefono = body.clienteTelefono;
    if (body.cliente_telefono !== undefined) updateData.cliente_telefono = body.cliente_telefono;
    if (body.maquinariaId !== undefined) updateData.maquinaria_id = body.maquinariaId;
    if (body.maquinaria_id !== undefined) updateData.maquinaria_id = body.maquinaria_id;
    if (body.maquinariaNombre !== undefined) updateData.maquinaria_nombre = body.maquinariaNombre;
    if (body.maquinaria_nombre !== undefined) updateData.maquinaria_nombre = body.maquinaria_nombre;
    if (body.fechaInicio !== undefined) updateData.fecha_inicio = body.fechaInicio;
    if (body.fecha_inicio !== undefined) updateData.fecha_inicio = body.fecha_inicio;
    if (body.fechaFin !== undefined) updateData.fecha_fin = body.fechaFin;
    if (body.fecha_fin !== undefined) updateData.fecha_fin = body.fecha_fin;
    if (body.estado !== undefined) {
      const ALLOWED_ESTADO = new Set(['pendiente', 'aprobada', 'rechazada']);
      if (!ALLOWED_ESTADO.has(body.estado)) {
        return NextResponse.json({ error: 'Estado invalido' }, { status: 400 });
      }
      updateData.estado = body.estado;
    }
    if (body.servicio !== undefined) updateData.servicio = body.servicio;
    if (body.mensaje !== undefined) updateData.mensaje = body.mensaje;
    if (body.notas !== undefined) updateData.notas = body.notas;

    // Capture previous state to detect transitions for email notifications.
    const { data: previous } = await supabaseAdmin
      .from('solicitudes')
      .select('estado, cliente_email, cliente_nombre, servicio, maquinaria_nombre')
      .eq('id', parseInt(id))
      .single();

    const { data: result, error } = await supabaseAdmin
      .from('solicitudes')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) throw error;

    // Notify customer when admin moves the solicitud forward.
    const newEstado = String(updateData.estado || '');
    const oldEstado = previous?.estado || '';
    const cEmail = result?.cliente_email || previous?.cliente_email;
    const cNombre = result?.cliente_nombre || previous?.cliente_nombre || 'cliente';
    const servicio = result?.servicio || previous?.servicio || 'tu solicitud';
    const maquinaria = result?.maquinaria_nombre || previous?.maquinaria_nombre;

    if (
      cEmail &&
      newEstado &&
      newEstado !== oldEstado &&
      ['aprobada', 'rechazada', 'en_progreso', 'completada'].includes(newEstado)
    ) {
      try {
        // Escape chars meaningful in HTML attribute *or* text contexts.
        // See solicitudes/route.ts:109 for the full rationale.
        const escape = (s: string) =>
          String(s).replace(/[<>&"'`=/]/g, (c) => (
            { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;', '/': '&#47;' }[c] || c
          ));
        let subject = '';
        let title = '';
        let msg = '';
        let highlight = '#0c1d3a';
        if (newEstado === 'aprobada') {
          subject = 'Solicitud aprobada - JURMAQ';
          title = 'Tu solicitud fue aprobada';
          msg = `Hola <strong>${escape(cNombre)}</strong>, hemos aprobado tu solicitud de <strong>${escape(servicio)}</strong>${maquinaria ? ` (${escape(maquinaria)})` : ''}. Te contactaremos pronto para coordinar.`;
          highlight = '#16a34a';
        } else if (newEstado === 'rechazada') {
          subject = 'Estado de tu solicitud - JURMAQ';
          title = 'Estado de tu solicitud';
          msg = `Hola <strong>${escape(cNombre)}</strong>, no podemos avanzar con tu solicitud de <strong>${escape(servicio)}</strong> en este momento. Si quieres conversarlo, escríbenos por WhatsApp.`;
          highlight = '#dc2626';
        } else if (newEstado === 'en_progreso') {
          subject = 'Tu solicitud está en proceso - JURMAQ';
          title = 'Tu solicitud está en proceso';
          msg = `Hola <strong>${escape(cNombre)}</strong>, ya estamos trabajando en tu solicitud de <strong>${escape(servicio)}</strong>. Cualquier consulta, escríbenos por WhatsApp.`;
          highlight = '#2563eb';
        } else if (newEstado === 'completada') {
          subject = 'Solicitud completada - JURMAQ';
          title = '¡Solicitud completada!';
          msg = `Hola <strong>${escape(cNombre)}</strong>, completamos tu solicitud de <strong>${escape(servicio)}</strong>. Gracias por confiar en nosotros.`;
          highlight = '#16a34a';
        }

        const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="600" cellpadding="0" cellspacing="0" align="center" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;">
    <tr><td style="background:#0c1d3a;padding:24px;text-align:center;color:#fff;">
      <h1 style="margin:0;font-size:24px;font-weight:800;">JURMAQ</h1>
      <p style="margin:4px 0 0;color:#e6b422;font-size:13px;font-weight:600;letter-spacing:2px;">.cl</p>
    </td></tr>
    <tr><td style="padding:32px 28px;">
      <div style="display:inline-block;padding:6px 12px;background:${highlight};color:#fff;font-size:12px;font-weight:700;border-radius:6px;text-transform:uppercase;letter-spacing:1px;">${escape(newEstado)}</div>
      <h2 style="color:#0c1d3a;margin:16px 0 12px;font-size:22px;">${title}</h2>
      <p style="color:#374151;font-size:15px;line-height:1.6;">${msg}</p>
      <div style="margin-top:24px;text-align:center;">
        <a href="https://wa.me/56976673577" style="display:inline-block;background:#25D366;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Escribir por WhatsApp</a>
      </div>
    </td></tr>
    <tr><td style="background:#f9fafb;padding:14px;text-align:center;color:#9ca3af;font-size:11px;">JURMAQ - Constructora &amp; Arriendo de Maquinaria - Curicó, Maule</td></tr>
  </table>
</body></html>`.trim();

        await transporter.sendMail({ to: cEmail, subject, html });
      } catch (mailErr) {
        console.error('[solicitud-state-email-fail]', mailErr);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating solicitud:', error);
    return NextResponse.json(
      { error: 'Error al actualizar solicitud' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await requirePermission('solicitudes', 'delete');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;

    const { data: existing } = await supabaseAdmin
      .from('solicitudes')
      .select('id')
      .eq('id', parseInt(id))
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from('solicitudes')
      .delete()
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({ message: 'Solicitud eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting solicitud:', error);
    return NextResponse.json(
      { error: 'Error al eliminar solicitud' },
      { status: 500 }
    );
  }
}
