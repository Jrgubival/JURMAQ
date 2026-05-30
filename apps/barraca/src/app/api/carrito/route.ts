import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeString, isPositiveInt, isValidOrigin } from '@jurmaq/shared/sanitize';
import { getCartPrice, resolveCartItemPrice } from '@/lib/pricing';
import { getActiveCategoryDiscountMap } from '@/lib/promotions';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { env } from '@jurmaq/shared/env';
import type { Database } from '@jurmaq/shared/db-types';

type BarracaProductoRow = Database['public']['Tables']['barraca_productos']['Row'];

// `barraca_productos!inner(...)` garantiza producto no-null en runtime,
// pero el resto de los campos nullables del row deben respetar el schema.
type CarritoItemConProducto = {
  id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number | null;
  created_at: string;
  barraca_productos: Pick<
    BarracaProductoRow,
    'nombre' | 'precio' | 'precio_original' | 'en_oferta' | 'imagen' | 'slug' | 'medida' | 'unidad' | 'stock' | 'categoria_id'
  >;
};

function getSessionId(request: NextRequest): string | null {
  // Audit A5: PRIORIZAR cookie httpOnly sobre header. Las requests viejas
  // del cliente (localStorage → header) siguen funcionando, pero apenas el
  // server emita la cookie (helper attachSessionCookie), las siguientes
  // requests usan la cookie httpOnly que XSS no puede leer.
  const cookieSessionId = request.cookies.get('barraca_session')?.value;
  if (cookieSessionId) return sanitizeString(cookieSessionId);

  const headerSessionId = request.headers.get('X-Session-Id');
  if (headerSessionId) return sanitizeString(headerSessionId);

  return null;
}

/**
 * Emite cookie httpOnly cuando el cliente envia sessionId por header
 * (request legacy desde localStorage). En futuras requests la cookie
 * pisa al header y el localStorage se vuelve irrelevante (eventualmente
 * el cliente puede dejar de setearlo).
 *
 * - HttpOnly: XSS no puede robar la sesion del carrito
 * - SameSite=Lax: la cookie viaja en navegacion top-level y POSTs
 *   same-origin pero NO en cross-site (defensa CSRF complementaria)
 * - Secure en prod (NEXT_PUBLIC_SITE_URL https). En dev se omite para
 *   que funcione en localhost.
 * - 30 dias de retencion (igual que el localStorage default).
 */
function attachSessionCookie(response: NextResponse, sessionId: string, request: NextRequest) {
  // Solo emitimos si llego por header (cliente legacy) y NO existe cookie.
  if (request.cookies.get('barraca_session')?.value) return;
  if (!request.headers.get('X-Session-Id')) return;
  const isHttps = (env.NEXT_PUBLIC_SITE_URL || '').startsWith('https://')
    || request.headers.get('x-forwarded-proto') === 'https';
  response.cookies.set('barraca_session', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });
}

export async function GET(request: NextRequest) {
  try {
    // Rate limit: 60 reads/min per IP (cart reads happen on every page nav)
    const ip = getClientIp(request);
    const limiter = rateLimit(`cart-get:${ip}`, { maxAttempts: 60, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }

    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ items: [], total: 0, cantidad: 0 });
    }

    const { data: rawItems, error } = await supabaseAdmin
      .from('barraca_carrito')
      .select('id, producto_id, cantidad, precio_unitario, created_at, barraca_productos!inner(nombre, precio, precio_original, en_oferta, imagen, slug, medida, unidad, stock, categoria_id)')
      .eq('session_id', sessionId)
      .eq('barraca_productos.activo', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Re-evaluate prices against the CURRENT active promo state. If the
    // customer added a Zincalum at $6.550 yesterday and today the Techumbre
    // category went on sale -15%, the cart should reflect $5.568. Conversely,
    // if a promo expires, the customer pays the new price. The stored
    // precio_unitario is honored only when it's *better* (lower) than what
    // the live state would produce.
    const promoMap = await getActiveCategoryDiscountMap();

    const items = ((rawItems || []) as unknown as CarritoItemConProducto[]).map((item) => {
      const p = item.barraca_productos;
      const stored = item.precio_unitario || 0;

      // 1. Sticky offer (en_oferta in DB) wins always.
      // 2. Otherwise apply current daily promo if the product's category has one.
      // 3. Fall back to current base price.
      // Precio efectivo: el menor entre el congelado (stored) y el estado vivo
      // (oferta real > promo del día > precio base). Lógica compartida con
      // POST /api/cotizaciones vía resolveCartItemPrice (audit 2.8).
      const precioReal = resolveCartItemPrice({
        stored,
        precio: p.precio,
        precio_original: p.precio_original,
        en_oferta: p.en_oferta,
        promoDescuento: p.categoria_id != null ? promoMap.get(p.categoria_id) : undefined,
      });

      return {
        id: item.id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        created_at: item.created_at,
        nombre: p.nombre,
        precio: precioReal,
        imagen: p.imagen,
        slug: p.slug,
        medida: p.medida,
        unidad: p.unidad,
        stock: p.stock,
      };
    });

    const total = items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const cantidad = items.reduce((sum, item) => sum + item.cantidad, 0);

    {
      const res = NextResponse.json({ items, total, cantidad });
      const sid = getSessionId(request);
      if (sid) attachSessionCookie(res, sid, request);
      return res;
    }
  } catch (error) {
    console.error('Error al obtener carrito:', error);
    return NextResponse.json(
      { error: 'Error al obtener carrito' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }
    // Rate limit: 30 writes/min per IP. Generous for legit "add to cart" flows
    // (multi-product add), tight enough to prevent table-flooding abuse.
    const ip = getClientIp(request);
    const limiter = rateLimit(`cart-post:${ip}`, { maxAttempts: 30, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }
    const body = await request.json();
    const productoId = typeof body.productoId === 'number' ? body.productoId : parseInt(body.productoId);
    const cantidad = typeof body.cantidad === 'number' ? body.cantidad : parseInt(body.cantidad);
    // Audit bug-fix: priorizar cookie/header sobre body.sessionId. Si la cookie
    // httpOnly ya existe (set en POSTs previos), POST y GET deben usar la MISMA
    // session_id, si no el cliente escribe en una y lee desde otra.
    const sessionId = getSessionId(request) || sanitizeString(body.sessionId);

    if (!isPositiveInt(productoId) || !isPositiveInt(cantidad) || !sessionId) {
      return NextResponse.json(
        { error: 'productoId (entero positivo), cantidad (entero positivo) y sessionId son requeridos' },
        { status: 400 }
      );
    }

    if (cantidad > 9999) {
      return NextResponse.json({ error: 'Cantidad maxima excedida' }, { status: 400 });
    }

    // Verify product exists and get price info
    const { data: producto } = await supabaseAdmin
      .from('barraca_productos')
      .select('id, stock, precio, precio_original, en_oferta, categoria_id')
      .eq('id', productoId)
      .eq('activo', true)
      .single();

    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // Audit M7: chequeo de stock. Politica del negocio: stock=0 NO bloquea
    // (se cotiza disponibilidad), pero no permitimos pasar de stock+50% como
    // amortiguador y para prevenir abuso (alguien pidiendo 9999 unidades de
    // un producto que se importa). Si quieren mas, deben pedir cotizacion
    // formal por canal admin.
    if (producto.stock != null && producto.stock > 0) {
      const cap = Math.max(producto.stock + Math.ceil(producto.stock * 0.5), producto.stock + 5);
      if (cantidad > cap) {
        return NextResponse.json(
          {
            error: `Cantidad solicitada (${cantidad}) excede stock disponible (${producto.stock}). Para pedidos mayores, contactanos via WhatsApp.`,
            stock_disponible: producto.stock,
          },
          { status: 422 }
        );
      }
    }

    // Validate precioOverride against active promotions (prevent client manipulation)
    let validatedOverride: number | null = null;
    if (body.precioOverride && !isNaN(Number(body.precioOverride))) {
      const clientOverride = Math.round(Number(body.precioOverride));
      // Check if product's category has an active promotion
      const { data: promos } = await supabaseAdmin
        .from('barraca_promociones')
        .select('descuento_porcentaje')
        .eq('categoria_id', producto.categoria_id)
        .eq('activa', true)
        .limit(5);
      if (promos && promos.length > 0) {
        // Accept if override matches ANY active promo discount for this category
        for (const promo of promos) {
          const expected = Math.round(producto.precio * (1 - promo.descuento_porcentaje / 100));
          if (Math.abs(clientOverride - expected) <= 1) {
            validatedOverride = expected;
            break;
          }
        }
      }
    }

    // Even if the client didn't send precioOverride (or sent one that didn't
    // validate against an active promo), apply the active category promo
    // automatically. This is defense-in-depth: if some new code path adds to
    // cart without passing the override, the customer still gets the price
    // they saw on the listing.
    let autoPromoPrice: number | null = null;
    if (!validatedOverride && producto.categoria_id != null) {
      const promoMap = await getActiveCategoryDiscountMap();
      const discountPct = promoMap.get(producto.categoria_id);
      if (discountPct && discountPct > 0 && producto.precio > 0) {
        autoPromoPrice = Math.round(producto.precio * (1 - discountPct / 100));
      }
    }

    const precioReal = getCartPrice(
      {
        precio: producto.precio,
        precio_original: producto.precio_original,
        en_oferta: producto.en_oferta,
      },
      validatedOverride ?? autoPromoPrice,
    );

    // Check if already in cart
    const { data: existing } = await supabaseAdmin
      .from('barraca_carrito')
      .select('id, cantidad')
      .eq('session_id', sessionId)
      .eq('producto_id', productoId)
      .single();

    if (existing) {
      const nuevaCantidad = existing.cantidad + cantidad;
      await supabaseAdmin
        .from('barraca_carrito')
        .update({ cantidad: nuevaCantidad, precio_unitario: precioReal })
        .eq('id', existing.id);
    } else {
      await supabaseAdmin
        .from('barraca_carrito')
        .insert({
          session_id: sessionId,
          usuario_id: null,
          producto_id: productoId,
          cantidad,
          precio_unitario: precioReal,
        });
    }

    {
      const res = NextResponse.json({ mensaje: 'Producto agregado al carrito' }, { status: 201 });
      const sid = getSessionId(request);
      if (sid) attachSessionCookie(res, sid, request);
      return res;
    }
  } catch (error) {
    console.error('Error al agregar al carrito:', error);
    return NextResponse.json(
      { error: 'Error al agregar al carrito' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }
    // Rate limit: 30 updates/min per IP. Same envelope as POST.
    const ip = getClientIp(request);
    const limiter = rateLimit(`cart-put:${ip}`, { maxAttempts: 30, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }
    // Require the caller's session to be the cart owner. Without this any
    // visitor could iterate integer `itemId`s and mutate strangers' carts.
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: 'Session requerida' }, { status: 400 });
    }
    const body = await request.json();
    const itemId = typeof body.itemId === 'number' ? body.itemId : parseInt(body.itemId);
    const cantidad = typeof body.cantidad === 'number' ? body.cantidad : parseInt(body.cantidad);

    if (!isPositiveInt(itemId) || typeof cantidad !== 'number' || !Number.isInteger(cantidad)) {
      return NextResponse.json(
        { error: 'itemId (entero positivo) y cantidad (entero) son requeridos' },
        { status: 400 }
      );
    }

    if (cantidad <= 0) {
      await supabaseAdmin.from('barraca_carrito').delete().eq('id', itemId).eq('session_id', sessionId);
      return NextResponse.json({ mensaje: 'Item eliminado del carrito' });
    }

    if (cantidad > 9999) {
      return NextResponse.json({ error: 'Cantidad maxima excedida' }, { status: 400 });
    }

    await supabaseAdmin
      .from('barraca_carrito')
      .update({ cantidad })
      .eq('id', itemId)
      .eq('session_id', sessionId);

    return NextResponse.json({ mensaje: 'Cantidad actualizada' });
  } catch (error) {
    console.error('Error al actualizar carrito:', error);
    return NextResponse.json(
      { error: 'Error al actualizar carrito' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }
    // Rate limit: 30 deletes/min per IP.
    const ip = getClientIp(request);
    const limiter = rateLimit(`cart-delete:${ip}`, { maxAttempts: 30, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: 'Session requerida' }, { status: 400 });
    }
    const body = await request.json();
    const itemId = typeof body.itemId === 'number' ? body.itemId : parseInt(body.itemId);

    if (!isPositiveInt(itemId)) {
      return NextResponse.json({ error: 'itemId (entero positivo) es requerido' }, { status: 400 });
    }

    // Scoped delete prevents IDOR: anonymous user can only drop their own rows.
    await supabaseAdmin
      .from('barraca_carrito')
      .delete()
      .eq('id', itemId)
      .eq('session_id', sessionId);

    return NextResponse.json({ mensaje: 'Item eliminado del carrito' });
  } catch (error) {
    console.error('Error al eliminar del carrito:', error);
    return NextResponse.json(
      { error: 'Error al eliminar del carrito' },
      { status: 500 }
    );
  }
}
