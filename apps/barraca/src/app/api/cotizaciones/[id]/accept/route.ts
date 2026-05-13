import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { transporter, formatCLP } from '@jurmaq/shared/mail/email';
import { auth } from '@jurmaq/shared/auth';
import { can } from '@jurmaq/shared/roles';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

async function sendAcceptRejectAdminEmail(
  cotizacion: { numero: string; nombre: string; email: string; total: number; contraoferta_total?: number },
  action: 'accept' | 'reject'
) {
  const isAccepted = action === 'accept';
  const adminEmail = process.env.ADMIN_EMAIL || 'contacto@jurmaq.cl';
  const adminUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin/barraca/cotizaciones`;
  const total = cotizacion.contraoferta_total || cotizacion.total;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="background-color: ${isAccepted ? '#065f46' : '#991b1b'}; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px;">
                ${isAccepted ? '&#9989; Contraoferta Aceptada' : '&#10060; Contraoferta Rechazada'}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 32px;">
              <div style="background-color: ${isAccepted ? '#d1fae5' : '#fee2e2'}; border-radius: 8px; padding: 16px; margin-bottom: 20px; text-align: center;">
                <p style="margin: 0; color: ${isAccepted ? '#065f46' : '#991b1b'}; font-size: 16px; font-weight: 700;">
                  El cliente ${isAccepted ? 'ACEPTO' : 'RECHAZO'} la contraoferta
                </p>
              </div>

              <div style="background-color: #fff7ed; border-radius: 8px; padding: 16px; margin-bottom: 20px; text-align: center;">
                <p style="margin: 0; color: #ea580c; font-size: 22px; font-weight: 700;">#${cotizacion.numero}</p>
              </div>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Cliente:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${cotizacion.nombre}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-size: 14px;"><a href="mailto:${cotizacion.email}" style="color: #ea580c;">${cotizacion.email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Total:</td>
                  <td style="padding: 8px 0; color: #ea580c; font-size: 18px; font-weight: 700;">${formatCLP(total)}</td>
                </tr>
              </table>

              ${isAccepted ? `
              <div style="background-color: #d1fae5; border-left: 4px solid #065f46; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
                <p style="margin: 0; color: #065f46; font-size: 14px; line-height: 1.5;">
                  <strong>Accion requerida:</strong> Coordinar pago y entrega con el cliente.
                </p>
              </div>` : ''}

              <div style="text-align: center;">
                <a href="${adminUrl}" style="display: inline-block; background-color: #ea580c; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                  Ver en Panel Admin
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0c1d3a; padding: 16px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #6b7280; font-size: 11px;">JURMAQ Sistema - Notificacion automatica</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    to: adminEmail,
    subject: `${isAccepted ? '[ACEPTADA]' : '[RECHAZADA]'} Contraoferta ${cotizacion.numero} - ${cotizacion.nombre}`,
    html: htmlContent,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, email, token } = body;

    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Accion invalida. Usa "accept" o "reject".' },
        { status: 400 }
      );
    }

    // Rate-limit by (IP, cotizacion id). 3 attempts / 15 min.
    const ip = getClientIp(request);
    const limiter = rateLimit(`cot-accept:${ip}:${id}`, { maxAttempts: 3, windowSeconds: 900 });
    if (!limiter.success) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Intente nuevamente mas tarde.' },
        { status: 429 }
      );
    }

    // Get current cotizacion
    const { data: cotizacion, error: fetchError } = await supabaseAdmin
      .from('barraca_cotizaciones')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !cotizacion) {
      return NextResponse.json({ error: 'Cotizacion no encontrada' }, { status: 404 });
    }

    // SECURITY: tres caminos de autorizacion en orden de preferencia:
    //   1) Admin con permiso (panel admin) — siempre valido.
    //   2) accept_token unico generado al enviar contraoferta — el cliente
    //      lo recibio por email y nadie mas lo conoce. Token de un solo uso.
    //   3) Fallback legacy: email match. Riesgoso (cualquier BCC puede aceptar)
    //      pero se mantiene por compatibilidad con contraofertas previas a la
    //      migracion accept_token. Una vez todas las contraofertas tengan
    //      token, este fallback se debe eliminar.
    const session = await auth();
    const bodyEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const bodyToken = typeof token === 'string' ? token.trim() : '';
    const emailMatches = !!bodyEmail && !!cotizacion.email && bodyEmail === String(cotizacion.email).trim().toLowerCase();

    let authorizedVia: 'admin' | 'token' | 'email' | null = null;
    if (session) {
      const role = (session.user as { role?: string } | undefined)?.role;
      if (!can(role, 'barraca_cotizaciones', 'update')) {
        return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 });
      }
      authorizedVia = 'admin';
    } else if (bodyToken && cotizacion.accept_token) {
      // Validacion estricta: token coincide, no usado, mismo formato UUID.
      if (cotizacion.accept_token_used_at) {
        return NextResponse.json({ error: 'Este enlace ya fue usado' }, { status: 410 });
      }
      // timing-safe comparison para no leakear el token via tiempo de respuesta.
      try {
        const a = Buffer.from(bodyToken);
        const b = Buffer.from(String(cotizacion.accept_token));
        if (a.length === b.length && (await import('node:crypto')).timingSafeEqual(a, b)) {
          authorizedVia = 'token';
        }
      } catch { /* fall through */ }
      if (!authorizedVia) {
        return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
      }
    } else if (emailMatches && !cotizacion.accept_token) {
      // Solo permitir email-match si NO hay token (cotizacion legacy).
      authorizedVia = 'email';
    } else {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Only allow action on contraoferta estado
    if (cotizacion.estado !== 'contraoferta') {
      return NextResponse.json(
        { error: 'Esta cotizacion no tiene una contraoferta pendiente' },
        { status: 400 }
      );
    }

    const nuevoEstado = action === 'accept' ? 'aceptada' : 'rechazada';

    // Marca token como usado en el mismo UPDATE para evitar replay y
    // race conditions. Si ya estaba usado entre la check anterior y aqui
    // (poco probable pero posible), el WHERE lo bloquea.
    const updatePayload: Record<string, unknown> = { estado: nuevoEstado };
    if (authorizedVia === 'token') {
      updatePayload.accept_token_used_at = new Date().toISOString();
    }
    let updateQuery = supabaseAdmin
      .from('barraca_cotizaciones')
      .update(updatePayload)
      .eq('id', id);
    if (authorizedVia === 'token') {
      updateQuery = updateQuery.is('accept_token_used_at', null);
    }
    const { data: updated, error: updateError } = await updateQuery.select().single();

    if (updateError) throw updateError;
    if (!updated) {
      return NextResponse.json({ error: 'Este enlace ya fue usado' }, { status: 410 });
    }

    // Send notification email to admin
    try {
      await sendAcceptRejectAdminEmail(
        {
          numero: cotizacion.numero,
          nombre: cotizacion.nombre || 'Cliente',
          email: cotizacion.email || '',
          total: cotizacion.total || 0,
          contraoferta_total: cotizacion.contraoferta_total,
        },
        action
      );
    } catch (emailError) {
      // Log but don't fail the request - the status was already updated
      console.error('Error al enviar email de notificacion al admin:', emailError);
    }

    return NextResponse.json({
      success: true,
      estado: nuevoEstado,
      message: action === 'accept'
        ? 'Contraoferta aceptada. Te contactaremos para coordinar el pago.'
        : 'Contraoferta rechazada.',
    });
  } catch (error) {
    console.error('Error al procesar accion:', error);
    return NextResponse.json(
      { error: 'Error al procesar la accion' },
      { status: 500 }
    );
  }
}
