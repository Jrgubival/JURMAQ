import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { sendPurchaseThankYouEmail } from '@jurmaq/shared/mail/templates/purchase-thank-you';
import { createAdminNotification } from '@jurmaq/shared/notifications/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Reject non-numeric IDs upfront — IDs are integers in the database; any
    // other shape is either an attack probe or a malformed link.
    const idNum = Number(id);
    if (!Number.isFinite(idNum) || !Number.isInteger(idNum) || idNum <= 0) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const { data: cotizacion, error } = await supabaseAdmin
      .from('barraca_cotizaciones')
      .select('*')
      .eq('id', idNum)
      .single();

    if (error || !cotizacion) {
      return NextResponse.json({ error: 'Cotizacion no encontrada' }, { status: 404 });
    }

    // Verify access: admin (NextAuth session) or owner-by-email + rate-limit.
    // The email check is intentionally rate-limited because it's the
    // unauthenticated path used by customers clicking a link from their email
    // — without the limit, an attacker who knows one customer email could try
    // sequential IDs to harvest cotizaciones. 5 attempts per 10 min per IP
    // makes brute-force enumeration infeasible while preserving the legit
    // customer experience.
    const session = await auth();
    if (!session) {
      const ip = getClientIp(request);
      const limiter = rateLimit(`cot:${ip}:${idNum}`, { maxAttempts: 5, windowSeconds: 600 });
      if (!limiter.success) {
        return NextResponse.json({ error: 'Demasiados intentos' }, { status: 429 });
      }
      const { searchParams } = new URL(request.url);
      const email = (searchParams.get('email') || '').trim().toLowerCase();
      const stored = String(cotizacion.email || '').trim().toLowerCase();
      if (!email || !stored || email !== stored) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
    }

    // Parse items JSON if string
    if (cotizacion.items && typeof cotizacion.items === 'string') {
      try {
        cotizacion.items = JSON.parse(cotizacion.items);
      } catch {
        // keep as string if not valid JSON
      }
    }

    return NextResponse.json(cotizacion);
  } catch (error) {
    console.error('Error al obtener cotizacion:', error);
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
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    const { data: existing } = await supabaseAdmin
      .from('barraca_cotizaciones')
      .select('id, estado, email, nombre, numero, total, purchase_thanks_sent_at, codigo_maestro, maestro_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Cotizacion no encontrada' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    let transicionAPagada = false;
    if (body.estado !== undefined) {
      const ALLOWED_ESTADO = new Set(['pendiente', 'enviada', 'aprobada', 'rechazada', 'contraoferta', 'pagada']);
      if (!ALLOWED_ESTADO.has(body.estado)) {
        return NextResponse.json({ error: 'Estado invalido' }, { status: 400 });
      }
      updateData.estado = body.estado;
      // Tier 4 D6: registrar timestamp + flag para enviar thank-you email.
      if (body.estado === 'pagada' && existing.estado !== 'pagada') {
        updateData.pagada_at = new Date().toISOString();
        transicionAPagada = true;
      }
    }
    if (body.notas !== undefined) updateData.notas = body.notas;
    if (body.contraoferta_items !== undefined) updateData.contraoferta_items = typeof body.contraoferta_items === 'string' ? body.contraoferta_items : JSON.stringify(body.contraoferta_items);
    if (body.contraoferta_total !== undefined) updateData.contraoferta_total = body.contraoferta_total;
    if (body.contraoferta_mensaje !== undefined) updateData.contraoferta_mensaje = body.contraoferta_mensaje;
    if (body.metodo_pago !== undefined) updateData.metodo_pago = body.metodo_pago;
    if (body.payment_url !== undefined) updateData.payment_url = body.payment_url;

    if (body.items !== undefined) {
      const itemsArr = Array.isArray(body.items) ? body.items : (() => { try { return JSON.parse(body.items); } catch { return null; } })();
      if (!Array.isArray(itemsArr) || itemsArr.length === 0) {
        return NextResponse.json({ error: 'Items debe ser un array no vacio' }, { status: 400 });
      }
      if (itemsArr.length > 100) {
        return NextResponse.json({ error: 'Maximo 100 items' }, { status: 400 });
      }
      for (const item of itemsArr) {
        if (!item.nombre || typeof item.precio !== 'number') {
          return NextResponse.json({ error: 'Cada item debe tener nombre y precio numerico' }, { status: 400 });
        }
      }
      updateData.items = JSON.stringify(itemsArr);
    }
    if (body.total !== undefined && typeof body.total === 'number') {
      updateData.total = Math.max(0, Math.round(body.total));
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron campos para actualizar' }, { status: 400 });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('barraca_cotizaciones')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Tier 4 D6: enviar email de gracias inmediatamente al pasar a 'pagada'.
    // Idempotente: si purchase_thanks_sent_at ya está set, no reenvía.
    if (transicionAPagada && !existing.purchase_thanks_sent_at && existing.email) {
      void sendPurchaseThankYouEmail({
        to: String(existing.email),
        nombre: String(existing.nombre || 'Cliente'),
        numero: String(existing.numero || `#${id}`),
        total: Number(existing.total || 0),
      })
        .then(() =>
          supabaseAdmin
            .from('barraca_cotizaciones')
            .update({ purchase_thanks_sent_at: new Date().toISOString() })
            .eq('id', id),
        )
        .catch((err) => console.error('[thank-you-email-fail]', err));
    }

    // Tier 6 F4: notif admin si transición a pagada generó comisión a maestro
    // (el trigger devengar_comision_barraca ya creó la comisión en DB).
    if (transicionAPagada && existing.codigo_maestro) {
      void createAdminNotification({
        kind: 'comision_devengada',
        title: `Comisión devengada (${existing.codigo_maestro})`,
        body: `Cotización ${existing.numero || `#${id}`} pagada · ${existing.nombre || 'Cliente'}. La comisión del maestro está pendiente de pago.`,
        link: '/admin/comisiones?estado=devengada',
        severity: 'success',
        ref_type: 'cotizacion',
        ref_id: String(id),
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error al actualizar cotizacion:', error);
    return NextResponse.json(
      { error: 'Error al actualizar cotizacion' },
      { status: 500 }
    );
  }
}
