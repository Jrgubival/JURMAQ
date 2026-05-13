import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { transporter } from '@jurmaq/shared/mail/email';
import { formatCLP } from "@jurmaq/shared/format";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission('cotizaciones', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const { data: result, error } = await supabaseAdmin
      .from('cotizaciones')
      .select('*')
      .eq('id', parseInt(id))
      .single();

    if (error || !result) {
      return NextResponse.json(
        { error: 'Cotizacion no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching cotizacion:', error);
    return NextResponse.json(
      { error: 'Error al obtener cotizacion' },
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
    const session = await requirePermission('cotizaciones', 'update');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const body = await request.json();

    const { data: existing } = await supabaseAdmin
      .from('cotizaciones')
      .select('id')
      .eq('id', parseInt(id))
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Cotizacion no encontrada' },
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
    if (body.servicio !== undefined) updateData.servicio = body.servicio;
    if (body.items !== undefined)
      updateData.items = typeof body.items === 'string' ? body.items : JSON.stringify(body.items);
    if (body.montoTotal !== undefined) updateData.monto_total = body.montoTotal;
    if (body.monto_total !== undefined) updateData.monto_total = body.monto_total;
    if (body.estado !== undefined) updateData.estado = body.estado;
    if (body.notas !== undefined) updateData.notas = body.notas;

    // Capture previous state to know if estado just changed.
    const { data: previous } = await supabaseAdmin
      .from('cotizaciones')
      .select('estado, cliente_email, cliente_nombre, servicio, monto_total')
      .eq('id', parseInt(id))
      .single();

    const { data: result, error } = await supabaseAdmin
      .from('cotizaciones')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) throw error;

    // If state transitioned to aceptada/rechazada/enviada and we have an email,
    // notify the customer. Best-effort — never blocks the API response.
    const newEstado = String(updateData.estado || '');
    const oldEstado = previous?.estado || '';
    const clienteEmail = result?.cliente_email || previous?.cliente_email;
    const clienteNombre = result?.cliente_nombre || previous?.cliente_nombre || 'cliente';
    const servicio = result?.servicio || previous?.servicio || 'tu solicitud';
    const monto = Number(result?.monto_total || previous?.monto_total || 0);

    if (
      clienteEmail &&
      newEstado &&
      newEstado !== oldEstado &&
      ['aceptada', 'rechazada', 'enviada'].includes(newEstado)
    ) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || 'https://jurmaq.cl';
        // Escape HTML attribute *and* text contexts. See solicitudes/route.ts:109.
        const escape = (s: string) => String(s).replace(/[<>&"'`=/]/g, (c) => (
          { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;', '/': '&#47;' }[c] || c
        ));
        const fmt = (n: number) => formatCLP(Math.round(n));

        let subject = '';
        let title = '';
        let bodyMsg = '';
        let highlight = '#0c1d3a';
        if (newEstado === 'aceptada') {
          subject = `Cotizacion aceptada - JURMAQ`;
          title = 'Tu cotización fue aceptada';
          bodyMsg = `Hola <strong>${escape(clienteNombre)}</strong>, hemos aceptado tu cotización de <strong>${escape(servicio)}</strong>${monto > 0 ? ` por <strong>${fmt(monto)}</strong>` : ''}. En breve nos pondremos en contacto para coordinar los siguientes pasos.`;
          highlight = '#16a34a';
        } else if (newEstado === 'rechazada') {
          subject = `Actualizacion de tu cotizacion - JURMAQ`;
          title = 'Estado de tu cotización';
          bodyMsg = `Hola <strong>${escape(clienteNombre)}</strong>, lamentablemente no podemos avanzar con tu solicitud de <strong>${escape(servicio)}</strong> en este momento. Si quieres conversarlo o tienes consultas, escribenos por WhatsApp.`;
          highlight = '#dc2626';
        } else if (newEstado === 'enviada') {
          subject = `Tu cotizacion esta lista - JURMAQ`;
          title = 'Tu cotización está lista';
          bodyMsg = `Hola <strong>${escape(clienteNombre)}</strong>, ya tenemos tu cotización de <strong>${escape(servicio)}</strong>${monto > 0 ? ` por <strong>${fmt(monto)}</strong>` : ''} preparada. Cualquier duda, contestanos por WhatsApp.`;
          highlight = '#2563eb';
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
      <div style="display:inline-block;padding:6px 12px;background:${highlight};color:#fff;font-size:12px;font-weight:700;border-radius:6px;text-transform:uppercase;letter-spacing:1px;">
        ${escape(newEstado)}
      </div>
      <h2 style="color:#0c1d3a;margin:16px 0 12px;font-size:22px;">${title}</h2>
      <p style="color:#374151;font-size:15px;line-height:1.6;">${bodyMsg}</p>
      <div style="margin-top:24px;text-align:center;">
        <a href="https://wa.me/56976673577?text=${encodeURIComponent('Hola, consulto por mi cotizacion ' + (result?.id || ''))}" style="display:inline-block;background:#25D366;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-right:8px;">Escribir por WhatsApp</a>
        <a href="${baseUrl}/contacto" style="display:inline-block;background:#fff;color:#0c1d3a;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;border:2px solid #0c1d3a;">Llamar</a>
      </div>
    </td></tr>
    <tr><td style="background:#f9fafb;padding:14px;text-align:center;color:#9ca3af;font-size:11px;">JURMAQ - Constructora &amp; Arriendo de Maquinaria - Curicó, Maule</td></tr>
  </table>
</body></html>`.trim();

        await transporter.sendMail({ to: clienteEmail, subject, html });
      } catch (mailErr) {
        console.error('[cotizacion-state-email-fail]', mailErr);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating cotizacion:', error);
    return NextResponse.json(
      { error: 'Error al actualizar cotizacion' },
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
    const session = await requirePermission('cotizaciones', 'delete');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;

    const { data: existing } = await supabaseAdmin
      .from('cotizaciones')
      .select('id')
      .eq('id', parseInt(id))
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Cotizacion no encontrada' },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from('cotizaciones')
      .delete()
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({ message: 'Cotizacion eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting cotizacion:', error);
    return NextResponse.json(
      { error: 'Error al eliminar cotizacion' },
      { status: 500 }
    );
  }
}
