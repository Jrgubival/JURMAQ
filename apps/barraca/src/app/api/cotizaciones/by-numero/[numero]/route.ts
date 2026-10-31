import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission } from '@jurmaq/shared/auth/guard';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  try {
    // Audit M1: COT numbers (`COT-YYYYMMDD-NNN`) son enumerables.
    // Rate limit 15/min/IP impide harvesting masivo.
    const ip = getClientIp(request);
    const limiter = rateLimit(`cot-by-num:${ip}`, { maxAttempts: 15, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }

    const { numero: rawNumero } = await params;

    if (!rawNumero) {
      return NextResponse.json({ error: 'Numero requerido' }, { status: 400 });
    }

    // Decode URL parameter in case it was percent-encoded
    const numero = decodeURIComponent(rawNumero).trim();

    // Use maybeSingle() instead of single() to avoid PGRST116 error on zero rows
    const { data, error } = await supabaseAdmin
      .from('barraca_cotizaciones')
      .select('*')
      .eq('numero', numero)
      .maybeSingle();

    if (error) {
      console.error('Error querying cotizacion by numero:', numero, error);
      return NextResponse.json({ error: 'Error al buscar cotizacion' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Cotizacion no encontrada' }, { status: 404 });
    }

    // SECURITY: Quote numbers are predictable (COT-YYYYMMDD-NNN).
    // Grant full access (with PII) only to admin OR when email query matches.
    // For anonymous lookups (public share link), return a PII-stripped version
    // so the customer can still see items and estado/total without leaking phone/RUT/notas.
    // El correo NO es credencial (cualquiera puede saberlo): el detalle
    // completo es sólo para el panel. El público ve una lista blanca.
    const session = await requirePermission('barraca_cotizaciones', 'read');
    const fullAccess = !!session;

    // items vive como TEXT (JSON) en barraca_cotizaciones; la pagina llama
    // parseItems() para deserializar. No hay tabla separada de items.
    if (fullAccess) {
      return NextResponse.json(data);
    }

    // Respuesta pública: lista blanca (nunca accept_token, usuario_id ni datos personales).
    const d = data as Record<string, unknown>;
    const safe = Object.fromEntries(
      ['id', 'numero', 'estado', 'items', 'total', 'created_at', 'empresa', 'payment_url',
        'contraoferta_total', 'contraoferta_mensaje', 'contraoferta_items'].map((k) => [k, d[k] ?? null]),
    );

    return NextResponse.json({
      ...safe,
      // Mask nombre to first name only
      nombre: typeof data.nombre === 'string' ? data.nombre.split(' ')[0] : null,
      _limited: true,
    });
  } catch (error) {
    console.error('Error al buscar cotizacion:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
