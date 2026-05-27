import { auth } from '@jurmaq/shared/auth';
import { NextRequest, NextResponse } from 'next/server';
import { sendFollowUpEmail, sendAbandonedCartEmail, sendMonthlyOffersEmail } from '@/lib/email-sequences';
import { isValidEmail, isValidOrigin } from '@jurmaq/shared/sanitize';
import { logSafeError } from '@jurmaq/shared/logging';

export async function POST(request: NextRequest) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Admin only
    if ((session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores pueden enviar correos de marketing' }, { status: 403 });
    }

    const body = await request.json();
    const { action, data } = body;

    if (!action || !data) {
      return NextResponse.json({ error: 'Faltan campos requeridos: action, data' }, { status: 400 });
    }

    switch (action) {
      case 'follow_up': {
        const { to, cotizacion } = data;

        if (!to || !isValidEmail(to)) {
          return NextResponse.json({ error: 'Email del destinatario invalido' }, { status: 400 });
        }
        if (!cotizacion?.numero || !cotizacion?.nombre || !cotizacion?.items || !cotizacion?.total) {
          return NextResponse.json({ error: 'Datos de cotización incompletos (numero, nombre, items, total)' }, { status: 400 });
        }

        await sendFollowUpEmail(to, cotizacion);
        return NextResponse.json({ success: true, message: `Email de seguimiento enviado a ${to}` });
      }

      case 'abandoned_cart': {
        const { to, items } = data;

        if (!to || !isValidEmail(to)) {
          return NextResponse.json({ error: 'Email del destinatario invalido' }, { status: 400 });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
          return NextResponse.json({ error: 'Se requiere al menos un producto en items' }, { status: 400 });
        }

        await sendAbandonedCartEmail(to, items);
        return NextResponse.json({ success: true, message: `Email de carrito abandonado enviado a ${to}` });
      }

      case 'monthly_offers': {
        const { to, offers, mesAno } = data;

        if (!to || !isValidEmail(to)) {
          return NextResponse.json({ error: 'Email del destinatario invalido' }, { status: 400 });
        }
        if (!offers || !Array.isArray(offers) || offers.length === 0) {
          return NextResponse.json({ error: 'Se requiere al menos una oferta en offers' }, { status: 400 });
        }

        await sendMonthlyOffersEmail(to, offers, mesAno);
        return NextResponse.json({ success: true, message: `Email de ofertas mensuales enviado a ${to}` });
      }

      default:
        return NextResponse.json(
          { error: `Accion no reconocida: ${action}. Usa: follow_up, abandoned_cart, monthly_offers` },
          { status: 400 }
        );
    }
  } catch (error) {
    logSafeError('email-sequence-error', { error: String(error) });
    return NextResponse.json(
      { error: 'Error interno al enviar el correo' },
      { status: 500 }
    );
  }
}
