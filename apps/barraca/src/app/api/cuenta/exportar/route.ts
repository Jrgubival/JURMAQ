import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

/**
 * POST /api/barraca/cuenta/exportar
 * Auth: Bearer token (mismo formato que /api/barraca/cuenta/eliminar)
 *
 * Implementa el "derecho de portabilidad / acceso" de Ley N° 21.719 (Chile,
 * vigente diciembre 2026). El usuario puede solicitar una copia de TODOS los
 * datos personales que tenemos sobre el. Devolvemos JSON estructurado con
 * todas las tablas que contienen referencias al user_id o email.
 *
 * Rate-limited por IP (el archivo puede ser pesado y el zip es CPU-bound).
 */

function parseToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) return null;
    const idStr = decoded.substring(0, colonIdx);
    const random = decoded.substring(colonIdx + 1);
    if (random.length < 32) return null;
    const id = parseInt(idStr, 10);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const ip = getClientIp(request);
    const limiter = rateLimit(`export:${ip}`, { maxAttempts: 3, windowSeconds: 3600 });
    if (!limiter.success) {
      return NextResponse.json(
        { error: 'Demasiadas exportaciones. Intenta nuevamente en una hora.' },
        { status: 429 }
      );
    }

    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
    }
    const userId = parseToken(token);
    if (!userId) {
      return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
    }

    const { data: user, error: userErr } = await supabaseAdmin
      .from('barraca_usuarios')
      .select('id, nombre, email, telefono, empresa, rut, activo, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (userErr || !user) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }
    if (!user.activo) {
      return NextResponse.json({ error: 'Cuenta inactiva' }, { status: 410 });
    }

    // Recolecta cotizaciones (asociadas por user_id Y por email para legacy
    // guest-checkouts que el usuario despues registro).
    const [cotByUserRes, cotByEmailRes] = await Promise.all([
      supabaseAdmin
        .from('barraca_cotizaciones')
        .select('id, numero, items, total, estado, created_at, metodo_pago, payment_url')
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('barraca_cotizaciones')
        .select('id, numero, items, total, estado, created_at, metodo_pago, payment_url')
        .eq('email', user.email)
        .is('usuario_id', null)
        .order('created_at', { ascending: false }),
    ]);
    const cotizaciones = [
      ...(cotByUserRes.data ?? []),
      ...(cotByEmailRes.data ?? []),
    ];

    // Carrito actual (por session_id no es accesible aqui sin contexto;
    // recolectamos solo lo asociado al user_id si existe esa columna).
    const { data: carrito } = await supabaseAdmin
      .from('barraca_carrito')
      .select('producto_id, cantidad, precio_unitario, created_at')
      .eq('usuario_id', userId);

    // Suscripcion al newsletter. Columnas reales: email, nombre, activo,
    // created_at (default). No existen "fecha_suscripcion" ni "fuente" — el
    // INSERT en /api/barraca/suscriptores solo escribe email/nombre/activo.
    const { data: suscripcion } = await supabaseAdmin
      .from('barraca_suscriptores')
      .select('email, nombre, activo, created_at')
      .eq('email', user.email)
      .maybeSingle();

    // Construye el dump.
    const exportPayload = {
      generated_at: new Date().toISOString(),
      ley_aplicable: 'Ley N° 21.719 (Chile) — derecho de acceso y portabilidad',
      cuenta: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        telefono: user.telefono,
        empresa: user.empresa,
        rut: user.rut,
        creada_el: user.created_at,
      },
      cotizaciones,
      carrito_actual: carrito ?? [],
      suscripcion_newsletter: suscripcion ?? null,
      notas: [
        'Los contratos firmados se conservan por 6 anos (Codigo Tributario art. 17). Para solicitar acceso a contratos antiguos contactar al DPO: contacto@jurmaq.cl',
        'Los pagos procesados via MercadoPago no estan incluidos: solicita esos datos directamente a MercadoPago como controlador independiente.',
      ],
    };

    // Devuelve como JSON descargable.
    const filename = `jurmaq-mis-datos-${user.id}-${Date.now()}.json`;
    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error al exportar datos:', error);
    return NextResponse.json(
      { error: 'Error al generar la exportacion' },
      { status: 500 }
    );
  }
}
