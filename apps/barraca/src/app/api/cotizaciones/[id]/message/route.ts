import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { transporter } from '@jurmaq/shared/mail/email';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { NextRequest, NextResponse } from 'next/server';
import { formatCLP } from "@jurmaq/shared/format";

type MessageTipo = 'aprobada' | 'rechazada' | 'info' | 'pago' | 'custom';

function getSubject(
  tipo: MessageTipo,
  numero: string,
  customAsunto?: string
): string {
  switch (tipo) {
    case 'aprobada':
      return `Cotizacion ${numero} Aprobada - JURMAQ Barraca`;
    case 'rechazada':
      return `Informacion sobre tu Cotizacion ${numero} - JURMAQ Barraca`;
    case 'pago':
      return `Link de Pago - Cotizacion ${numero} - JURMAQ Barraca`;
    case 'info':
      return `Informacion Cotizacion ${numero} - JURMAQ Barraca`;
    case 'custom':
      return customAsunto || `Cotizacion ${numero} - JURMAQ Barraca`;
  }
}

function getIcon(tipo: MessageTipo): string {
  switch (tipo) {
    case 'aprobada':
      return '&#9989;';
    case 'rechazada':
      return '&#10060;';
    case 'pago':
      return '&#128179;';
    case 'info':
      return '&#9432;';
    case 'custom':
      return '&#9993;';
  }
}

function getTitle(tipo: MessageTipo): string {
  switch (tipo) {
    case 'aprobada':
      return 'Tu Cotizacion ha sido Aprobada';
    case 'rechazada':
      return 'Informacion sobre tu Cotizacion';
    case 'pago':
      return 'Link de Pago para tu Cotizacion';
    case 'info':
      return 'Informacion sobre tu Cotizacion';
    case 'custom':
      return 'Mensaje de JURMAQ Barraca';
  }
}

function buildEmailHtml(params: {
  tipo: MessageTipo;
  numero: string;
  nombre: string;
  mensaje: string;
  linkPago?: string;
  total?: number;
}): string {
  const { tipo, numero, nombre, mensaje, linkPago, total } = params;

  const paymentButton =
    linkPago
      ? `
              <div style="text-align: center; margin: 24px 0;">
                <a href="${linkPago}" style="display: inline-block; background-color: #ea580c; color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px;">
                  Ir a Pagar${total ? ` - ${formatCLP(total)}` : ''}
                </a>
              </div>`
      : '';

  const approvedBanner =
    tipo === 'aprobada'
      ? `
              <div style="background-color: #d1fae5; border-radius: 8px; padding: 16px; margin-bottom: 20px; text-align: center;">
                <p style="margin: 0; color: #065f46; font-size: 15px; font-weight: 600;">
                  &#9989; Tu cotizacion ha sido aprobada. Te contactaremos para coordinar el pago y la entrega.
                </p>
              </div>`
      : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="background-color: #0c1d3a; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">JURMAQ</h1>
              <p style="margin: 4px 0 0; color: #ea580c; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">Barraca</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px;">
              <!-- Title -->
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; background-color: #fff7ed; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center; margin-bottom: 12px;">
                  <span style="font-size: 24px;">${getIcon(tipo)}</span>
                </div>
                <h2 style="margin: 0; color: #0c1d3a; font-size: 22px; font-weight: 700;">${getTitle(tipo)}</h2>
                <p style="margin: 8px 0 0; color: #ea580c; font-size: 16px; font-weight: 600;">#${numero}</p>
              </div>

              ${approvedBanner}

              <!-- Greeting -->
              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                Hola <strong>${nombre}</strong>,
              </p>

              <!-- Custom message from admin -->
              <div style="background-color: #f9fafb; border-left: 4px solid #ea580c; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.7; white-space: pre-line;">${mensaje}</p>
              </div>

              ${paymentButton}

              <!-- WhatsApp CTA -->
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="https://wa.me/56976673577?text=Hola%2C%20consulto%20por%20mi%20cotizacion%20%23${numero}" style="display: inline-block; background-color: #25D366; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                  Escribenos por WhatsApp
                </a>
              </div>

              <!-- Contact -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; text-align: center;">
                <p style="margin: 0 0 8px; color: #0c1d3a; font-size: 14px; font-weight: 600;">Contacto</p>
                <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.8;">
                  Tel: +56 9 7667 3577<br>
                  Email: contacto@jurmaq.cl<br>
                  Av. Poniente 2157, Molina, Maule, Chile
                </p>
              </div>

              <!-- Trust badge -->
              <div style="text-align: center; margin-top: 20px; padding: 12px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #6b7280; font-size: 12px; font-style: italic;">
                  Mas de 25 anos atendiendo en la Region del Maule
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0c1d3a; padding: 20px 32px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                &copy; ${new Date().getFullYear()} JURMAQ Barraca. Todos los derechos reservados.
              </p>
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 11px;">
                Este correo fue enviado desde el sistema de JURMAQ Barraca.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await requirePermission('barraca_cotizaciones', 'update');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const body = await request.json();
    const { tipo, mensaje, linkPago, asunto } = body as {
      tipo?: MessageTipo;
      mensaje?: string;
      linkPago?: string;
      asunto?: string;
    };

    if (!tipo || !['aprobada', 'rechazada', 'info', 'pago', 'custom'].includes(tipo)) {
      return NextResponse.json(
        { error: 'Tipo de mensaje invalido. Usa: aprobada, rechazada, info, pago, custom.' },
        { status: 400 }
      );
    }

    if (!mensaje || typeof mensaje !== 'string' || mensaje.trim().length === 0) {
      return NextResponse.json(
        { error: 'El mensaje es requerido.' },
        { status: 400 }
      );
    }

    if (tipo === 'pago' && (!linkPago || typeof linkPago !== 'string')) {
      return NextResponse.json(
        { error: 'El link de pago es requerido para mensajes de tipo "pago".' },
        { status: 400 }
      );
    }

    // Fetch cotizacion
    const { data: cotizacion, error: fetchError } = await supabaseAdmin
      .from('barraca_cotizaciones')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !cotizacion) {
      return NextResponse.json({ error: 'Cotizacion no encontrada' }, { status: 404 });
    }

    if (!cotizacion.email) {
      return NextResponse.json(
        { error: 'La cotizacion no tiene email de cliente asociado.' },
        { status: 400 }
      );
    }

    // Build and send email
    const subject = getSubject(tipo, cotizacion.numero, asunto);
    const htmlContent = buildEmailHtml({
      tipo,
      numero: cotizacion.numero,
      nombre: cotizacion.nombre || 'Cliente',
      mensaje: mensaje.trim(),
      linkPago,
      total: cotizacion.contraoferta_total || cotizacion.total,
    });

    await transporter.sendMail({
      to: cotizacion.email,
      subject,
      html: htmlContent,
    });

    // Update cotizacion estado if aprobada or rechazada
    const updateData: Record<string, unknown> = {};

    if (tipo === 'aprobada') {
      updateData.estado = 'aprobada';
    } else if (tipo === 'rechazada') {
      updateData.estado = 'rechazada';
    }

    // Append message to notas
    const timestamp = new Date().toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
    });
    const notaEntry = `[${timestamp}] (${tipo}) ${mensaje.trim()}`;
    const existingNotas = cotizacion.notas || '';
    updateData.notas = existingNotas
      ? `${existingNotas}\n${notaEntry}`
      : notaEntry;

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('barraca_cotizaciones')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('Error al actualizar cotizacion:', updateError);
        // Don't fail the request; the email was already sent
      }
    }

    return NextResponse.json({
      success: true,
      message: `Mensaje de tipo "${tipo}" enviado a ${cotizacion.email}`,
    });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    return NextResponse.json(
      { error: 'Error al enviar el mensaje' },
      { status: 500 }
    );
  }
}
