import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { createMercadoPagoPreference } from '@/lib/payments';
import { sendPaymentLinkEmail } from '@jurmaq/shared/mail/email';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

interface PaymentItem {
  nombre: string;
  cantidad: number;
  precio: number;
  subtotal?: number;
}

interface CotizacionPago {
  id: number;
  numero: string;
  nombre: string;
  email: string;
  total: number;
  items: string | PaymentItem[];
}

export async function POST(request: NextRequest) {
  // Endpoint admin-only: solo el panel /admin/barraca/cotizaciones lo invoca
  // cuando un admin/vendedor aprueba una cotizacion y genera link de pago.
  // Antes era public + sin auth — cualquiera podia enumerar cotizaciones y
  // disparar links de pago / cambios de estado.
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_cotizaciones', 'update');
  if (!session) return forbiddenResponse('No tienes permiso para generar pagos');

  const ip = getClientIp(request);
  const rl = rateLimit(`barraca-pagos:${ip}`, { maxAttempts: 20, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Reintenta en un minuto.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { cotizacionId, method } = body;

    if (!cotizacionId) {
      return NextResponse.json(
        { error: 'cotizacionId es requerido' },
        { status: 400 }
      );
    }

    if (!method || !['mercadopago', 'efectivo'].includes(method)) {
      return NextResponse.json(
        { error: 'method debe ser "mercadopago" o "efectivo"' },
        { status: 400 }
      );
    }

    // Fetch cotizacion — look up by integer id if numeric, otherwise by numero.
    // Splicing the raw string into a PostgREST .or() clause is injectable
    // (commas/parentheses escape the expression); use separate queries.
    const asInt = Number(cotizacionId);
    let cotizacion: CotizacionPago | null = null;
    let error: { message?: string } | null = null;
    if (Number.isFinite(asInt) && Number.isInteger(asInt) && asInt > 0) {
      const r = await supabaseAdmin
        .from('barraca_cotizaciones')
        .select('*')
        .eq('id', asInt)
        .maybeSingle();
      cotizacion = r.data as CotizacionPago | null;
      error = r.error;
    }
    if (!cotizacion) {
      const num = String(cotizacionId).trim();
      if (!/^[A-Za-z0-9-]{1,40}$/.test(num)) {
        return NextResponse.json({ error: 'cotizacionId invalido' }, { status: 400 });
      }
      const r = await supabaseAdmin
        .from('barraca_cotizaciones')
        .select('*')
        .eq('numero', num)
        .maybeSingle();
      cotizacion = r.data as CotizacionPago | null;
      error = r.error;
    }

    if (error || !cotizacion) {
      return NextResponse.json(
        { error: 'Cotizacion no encontrada' },
        { status: 404 }
      );
    }

    // Parse items
    let items: PaymentItem[] = [];
    try {
      items = typeof cotizacion.items === 'string'
        ? JSON.parse(cotizacion.items) as PaymentItem[]
        : cotizacion.items;
    } catch {
      return NextResponse.json(
        { error: 'Error al procesar los items de la cotizacion' },
        { status: 500 }
      );
    }

    let paymentUrl = '';

    if (method === 'mercadopago') {
      // Create MercadoPago preference
      const mpUrl = await createMercadoPagoPreference({
        numero: cotizacion.numero,
        items,
        total: cotizacion.total,
        email: cotizacion.email,
      });

      if (!mpUrl) {
        return NextResponse.json(
          { error: 'No se pudo crear la preferencia de pago. Verifica la configuracion de MercadoPago.' },
          { status: 503 }
        );
      }

      paymentUrl = mpUrl;
    }

    // Update cotizacion estado to aprobada and payment method
    await supabaseAdmin
      .from('barraca_cotizaciones')
      .update({
        estado: 'aprobada',
        metodo_pago: method,
        payment_url: method === 'mercadopago' ? paymentUrl : null,
      })
      .eq('id', cotizacion.id);

    // Send email to customer with payment info
    try {
      await sendPaymentLinkEmail(
        cotizacion.email,
        {
          numero: cotizacion.numero,
          nombre: cotizacion.nombre,
          items: items.map(i => ({
            nombre: i.nombre,
            cantidad: i.cantidad,
            precio: i.precio,
            subtotal: i.subtotal || i.precio * i.cantidad,
          })),
          total: cotizacion.total,
        },
        paymentUrl,
        method
      );
    } catch (emailError) {
      console.error('Error al enviar email de pago:', emailError);
      // Continue even if email fails
    }

    return NextResponse.json({
      paymentUrl: paymentUrl || null,
      method,
      mensaje: method === 'mercadopago'
        ? 'Link de pago generado y enviado al cliente'
        : 'Datos de transferencia enviados al cliente',
    });
  } catch (error) {
    console.error('Error al procesar pago:', error);
    return NextResponse.json(
      { error: 'Error al procesar el pago' },
      { status: 500 }
    );
  }
}
