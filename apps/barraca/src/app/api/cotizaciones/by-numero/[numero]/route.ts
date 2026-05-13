import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
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
    const session = await auth();
    const isAdmin = !!session;
    const emailParam = request.nextUrl.searchParams.get('email')?.trim().toLowerCase() || null;
    const emailMatches = !!emailParam && !!data.email && emailParam === String(data.email).trim().toLowerCase();
    const fullAccess = isAdmin || emailMatches;

    // Fetch cotizacion items if they exist
    const { data: items } = await supabaseAdmin
      .from('barraca_cotizacion_items')
      .select('*')
      .eq('cotizacion_id', data.id)
      .order('id', { ascending: true });

    if (fullAccess) {
      return NextResponse.json({ ...data, items: items || [] });
    }

    // Public (limited) response: strip PII
    const {
      email: _e, telefono: _t, rut: _r, notas: _n,
      razon_social: _rs, giro: _g, direccion_factura: _df,
      nombre_competencia: _nc, cotizacion_competencia: _cc,
      ...safe
    } = data as any;

    return NextResponse.json({
      ...safe,
      // Mask nombre to first name only
      nombre: typeof data.nombre === 'string' ? data.nombre.split(' ')[0] : null,
      items: items || [],
      _limited: true,
    });
  } catch (error) {
    console.error('Error al buscar cotizacion:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
