import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeString, isValidEmail, isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: suscriptores, error } = await supabaseAdmin
      .from('barraca_suscriptores')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(suscriptores);
  } catch (error) {
    console.error('Error al obtener suscriptores:', error);
    return NextResponse.json(
      { error: 'Error al obtener suscriptores' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    // Rate limit: 3 subscriptions per 15 minutes per IP
    const ip = getClientIp(request);
    const limiter = rateLimit(`subscribe:${ip}`, { maxAttempts: 3, windowSeconds: 900 });
    if (!limiter.success) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Intente nuevamente en un momento.' },
        { status: 429 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
    }
    const email = sanitizeString(body.email);
    const nombre = sanitizeString(body.nombre);

    if (!email) {
      return NextResponse.json({ error: 'El email es requerido' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Formato de email invalido' }, { status: 400 });
    }

    // Upsert: insert if not exists (ignore conflict on unique email)
    const { error } = await supabaseAdmin
      .from('barraca_suscriptores')
      .upsert(
        { email, nombre, activo: true },
        { onConflict: 'email', ignoreDuplicates: true }
      );

    if (error) throw error;

    return NextResponse.json({ mensaje: 'Suscripcion exitosa' }, { status: 201 });
  } catch (error) {
    console.error('Error al suscribir:', error);
    return NextResponse.json(
      { error: 'Error al procesar suscripcion' },
      { status: 500 }
    );
  }
}
