import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { sendCotizacionEmail, sendCotizacionAdminEmail } from '@jurmaq/shared/mail/email';
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeString, isValidEmail, escapeLikePattern, isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission('barraca_cotizaciones', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');
    const buscar = searchParams.get('buscar');

    let query = supabaseAdmin
      .from('barraca_cotizaciones')
      .select('id, numero, usuario_id, nombre, empresa, email, telefono, rut, items, total, estado, notas, created_at, cotizacion_competencia, nombre_competencia, contraoferta_items, contraoferta_total, contraoferta_mensaje, metodo_pago')
      .order('created_at', { ascending: false });

    if (estado) {
      query = query.eq('estado', estado);
    }

    if (buscar) {
      const safeBuscar = escapeLikePattern(buscar.trim());
      query = query.or(
        `nombre.ilike.%${safeBuscar}%,empresa.ilike.%${safeBuscar}%,email.ilike.%${safeBuscar}%,numero.ilike.%${safeBuscar}%`
      );
    }

    const { data: cotizaciones, error } = await query;

    if (error) throw error;

    return NextResponse.json(cotizaciones);
  } catch (error) {
    logSafeError('cotizaciones-get-error', { error: String(error) });
    return NextResponse.json(
      { error: 'Error al obtener cotizaciones' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    // Rate limit: 5 barraca quotes per 15 minutes per IP
    const ip = getClientIp(request);
    const limiter = rateLimit(`barraca-cotizacion:${ip}`, { maxAttempts: 5, windowSeconds: 900 });
    if (!limiter.success) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Intente nuevamente en un momento.' },
        { status: 429 }
      );
    }

    const body = await request.json();

    const nombre = sanitizeString(body.nombre);
    const email = sanitizeString(body.email);
    const items = body.items;

    if (!nombre || !email || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'nombre, email e items (array no vacio) son requeridos' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Formato de email invalido' }, { status: 400 });
    }

    if (items.length > 100) {
      return NextResponse.json({ error: 'Maximo 100 items por cotizacion' }, { status: 400 });
    }

    const telefono = sanitizeString(body.telefono);
    const empresa = sanitizeString(body.empresa);
    const rut = sanitizeString(body.rut);
    const sessionId = sanitizeString(body.sessionId);

    // --- Recalculo y validacion server-side de items y total ---
    // Antes confiabamos en `body.total` y `item.precio` enviados por el cliente.
    // Cualquiera podia enviar `total: 1` o `precio: 1` y, si admin aprobaba sin
    // revisar, el flujo de pago generaba un link MercadoPago por monto fraudulento.
    //
    // Politica:
    //  - Si la cotizacion viene de un carrito (sessionId presente con filas en
    //    barraca_carrito), reconstruir items y total desde DB usando getCartPrice.
    //  - Si no hay carrito, recalcular total = sum(precio * cantidad) y aplicar
    //    caps duros (precio item <= 50_000_000 CLP, cantidad <= 99_999).
    const PRECIO_ITEM_MAX = 50_000_000;
    const CANTIDAD_ITEM_MAX = 99_999;

    // Sanitiza cada item enviado
    type ClientItem = { nombre?: string; cantidad?: number; precio?: number; medida?: string };
    const sanitizedItems = (items as ClientItem[]).map((it) => {
      const precio = Math.max(0, Math.min(Math.round(Number(it.precio) || 0), PRECIO_ITEM_MAX));
      const cantidad = Math.max(0, Math.min(Math.round(Number(it.cantidad) || 0), CANTIDAD_ITEM_MAX));
      return {
        nombre: sanitizeString(it.nombre) || '',
        cantidad,
        precio,
        medida: sanitizeString(it.medida) || null,
      };
    });

    // Si hay sessionId con carrito, reemplazar items por los reales de DB.
    // Esto es la unica manera de impedir que el cliente envie precio=1 para
    // un item del catalogo. Si la sesion no tiene carrito, aceptamos lo enviado
    // (caso "cotizacion manual" desde formulario libre) — esos los valida el admin.
    let trustedItems = sanitizedItems;
    let totalRecalculado = sanitizedItems.reduce((s, i) => s + i.precio * i.cantidad, 0);
    if (sessionId) {
      try {
        const { data: cartRows } = await supabaseAdmin
          .from('barraca_carrito')
          .select('cantidad, precio_unitario, barraca_productos!inner(nombre, precio, precio_original, en_oferta, medida)')
          .eq('session_id', sessionId);
        type CartRow = {
          cantidad: number;
          precio_unitario: number | null;
          barraca_productos: { nombre: string; precio: number; medida: string | null };
        };
        const rows = (cartRows ?? []) as unknown as CartRow[];
        if (rows.length > 0) {
          trustedItems = rows.map((r) => {
            const cantidad = Math.max(0, Math.min(Math.round(Number(r.cantidad) || 0), CANTIDAD_ITEM_MAX));
            // Usa precio_unitario congelado del carrito (que ya paso por validacion
            // de promo en el endpoint de carrito), o cae al precio actual del producto.
            const precio = Math.max(
              0,
              Math.min(
                Math.round(Number(r.precio_unitario ?? r.barraca_productos.precio) || 0),
                PRECIO_ITEM_MAX
              )
            );
            return {
              nombre: r.barraca_productos.nombre,
              cantidad,
              precio,
              medida: r.barraca_productos.medida ?? null,
            };
          });
          totalRecalculado = trustedItems.reduce((s, i) => s + i.precio * i.cantidad, 0);
        }
      } catch (cartErr) {
        logSafeError('cotizaciones-cart-rebuild-fail', { sessionId });
      }
    }

    const total = totalRecalculado;
    // Only trust body.usuario_id if accompanied by a valid Bearer token for
    // that user. Otherwise anyone could poison another user's "Mis Cotizaciones".
    let usuarioId: number | null = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ') && typeof body.usuario_id === 'number') {
      try {
        const token = authHeader.slice(7);
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        const colonIdx = decoded.indexOf(':');
        if (colonIdx !== -1) {
          const idStr = decoded.substring(0, colonIdx);
          const random = decoded.substring(colonIdx + 1);
          const id = parseInt(idStr, 10);
          if (!isNaN(id) && random.length >= 32 && id === body.usuario_id) {
            // Verify the user actually exists and is active.
            const { data: u } = await supabaseAdmin
              .from('barraca_usuarios')
              .select('id')
              .eq('id', id)
              .eq('activo', true)
              .maybeSingle();
            if (u) usuarioId = id;
          }
        }
      } catch {
        // invalid token → leave usuarioId as null
      }
    }

    // Competitor quote fields
    const cotizacionCompetencia = sanitizeString(body.cotizacion_competencia);
    const nombreCompetencia = sanitizeString(body.nombre_competencia);
    const notasCompetencia = sanitizeString(body.notas_competencia);

    // Generate cotizacion number atomicamente via sequence Postgres.
    // Antes usabamos COUNT(*)+1 por dia, race-prone: dos POSTs concurrentes
    // generaban el mismo numero -> UNIQUE violation o duplicados (sin UNIQUE).
    // Requiere migrate-cotizaciones-seq.sql ejecutado en Supabase.
    let numero: string;
    {
      const { data: numeroRpc, error: numeroErr } = await supabaseAdmin.rpc('next_barraca_cotizacion_numero');
      if (numeroErr || !numeroRpc) {
        // Fallback solo si la migracion no esta ejecutada — log y usar count.
        if (numeroErr?.code === 'PGRST202' || /next_barraca_cotizacion_numero/.test(numeroErr?.message || '')) {
          console.warn('[cotizaciones POST] Falta migrate-cotizaciones-seq.sql; usando fallback con count(*)');
          const fechaFb = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const { count: countToday } = await supabaseAdmin
            .from('barraca_cotizaciones')
            .select('*', { count: 'exact', head: true })
            .ilike('numero', `COT-${fechaFb}-%`);
          numero = `COT-${fechaFb}-${String((countToday || 0) + 1).padStart(4, '0')}`;
        } else {
          throw numeroErr;
        }
      } else {
        numero = String(numeroRpc);
      }
    }

    const insertData: Record<string, unknown> = {
      numero,
      usuario_id: usuarioId,
      nombre,
      empresa,
      email,
      telefono,
      rut,
      items: JSON.stringify(trustedItems),
      total,
      estado: 'pendiente',
      notas: notasCompetencia || null,
    };

    // Add competitor fields if provided
    if (cotizacionCompetencia) insertData.cotizacion_competencia = cotizacionCompetencia;
    if (nombreCompetencia) insertData.nombre_competencia = nombreCompetencia;

    const { data: cotizacion, error } = await supabaseAdmin
      .from('barraca_cotizaciones')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Clear cart for sessionId
    if (sessionId) {
      await supabaseAdmin
        .from('barraca_carrito')
        .delete()
        .eq('session_id', sessionId);
    }

    // Send confirmation emails (non-blocking, but log each step).
    // Importante: usar `trustedItems` (los recalculados desde DB) en vez de
    // los items del body, asi el cliente ve un email donde la suma de
    // precio*cantidad cuadra con el total mostrado.
    const emailItems = trustedItems.map((item) => ({
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio: item.precio,
      subtotal: item.precio * item.cantidad,
    }));

    // Emails cliente + admin en paralelo (rule async-parallel). Antes
    // se enviaban secuencialmente y dado que cada uno toma 200-500ms via
    // Resend, paralelizar ahorra ~half del tiempo de respuesta. Usamos
    // allSettled porque cada email es independiente: si falla el del
    // admin no debe bloquear el del cliente y viceversa.
    const [clientResult, adminResult] = await Promise.allSettled([
      sendCotizacionEmail(email, { numero, nombre, items: emailItems, total }),
      sendCotizacionAdminEmail({
        numero,
        nombre,
        email,
        telefono: telefono || '',
        total,
        itemCount: trustedItems.length,
      }),
    ]);
    if (clientResult.status === 'fulfilled') {
      logSafe('email-client-ok', { numero });
    } else {
      const msg = clientResult.reason instanceof Error ? clientResult.reason.message : String(clientResult.reason);
      logSafeError('email-client-fail', { numero, msg });
    }
    if (adminResult.status === 'fulfilled') {
      logSafe('email-admin-ok', { numero });
    } else {
      const msg = adminResult.reason instanceof Error ? adminResult.reason.message : String(adminResult.reason);
      logSafeError('email-admin-fail', { numero, msg });
    }

    return NextResponse.json(cotizacion, { status: 201 });
  } catch (error) {
    logSafeError('cotizaciones-create-error', { error: String(error) });
    return NextResponse.json(
      { error: 'Error al crear cotizacion' },
      { status: 500 }
    );
  }
}
