import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';

/**
 * GET /api/admin/clientes/[id]
 *
 * Customer 360 — toda la información agregada de un cliente barraca:
 *   - datos personales (de barraca_usuarios)
 *   - historial completo de cotizaciones (con items)
 *   - KPIs: LTV, AOV, total compras, días desde última, etc.
 *   - Top 5 productos comprados (por cantidad agregada)
 *   - Reviews que dejó
 *   - Wishlist actual
 *   - Carrito activo (si existe)
 *   - Si vino vía maestro referido
 *
 * Tier 4 D4.
 */

export const runtime = 'nodejs';

interface CotItem {
  producto_id?: number;
  id?: number;
  nombre?: string;
  cantidad?: number;
  precio?: number;
}

function parseItems(raw: unknown): CotItem[] {
  if (Array.isArray(raw)) return raw as CotItem[];
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requirePermission('barraca_clientes', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  // 1. Datos del cliente.
  const { data: cliente } = await supabaseAdmin
    .from('barraca_usuarios')
    .select('id, nombre, email, telefono, empresa, rut, rol, activo, created_at')
    .eq('id', id)
    .maybeSingle();

  if (!cliente) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
  }

  const emailLower = String(cliente.email || '').toLowerCase();

  // 2. Historial cotizaciones (por user_id OR email para captar legacy).
  const { data: cotsRaw } = await supabaseAdmin
    .from('barraca_cotizaciones')
    .select(
      'id, numero, estado, total, items, codigo_maestro, maestro_id, created_at, pagada_at',
    )
    .or(`usuario_id.eq.${id},email.eq.${emailLower}`)
    .order('created_at', { ascending: false })
    .limit(200);

  const cots = cotsRaw ?? [];

  // 3. Agregados por producto.
  const productoStats = new Map<
    number,
    { producto_id: number; nombre: string; cantidad_total: number; ultima_compra: string }
  >();

  for (const c of cots) {
    if (c.estado !== 'pagada') continue;
    const items = parseItems(c.items);
    for (const it of items) {
      const pid = Number(it.producto_id ?? it.id);
      if (!Number.isFinite(pid) || pid <= 0) continue;
      const prev = productoStats.get(pid);
      if (prev) {
        prev.cantidad_total += Number(it.cantidad || 0);
        if (c.created_at > prev.ultima_compra) prev.ultima_compra = c.created_at;
      } else {
        productoStats.set(pid, {
          producto_id: pid,
          nombre: String(it.nombre || ''),
          cantidad_total: Number(it.cantidad || 0),
          ultima_compra: c.created_at,
        });
      }
    }
  }

  const topProductos = Array.from(productoStats.values())
    .sort((a, b) => b.cantidad_total - a.cantidad_total)
    .slice(0, 5);

  // 4. Resolver nombres reales/slug si los nombres en items son ambiguos.
  if (topProductos.length > 0) {
    const ids = topProductos.map((p) => p.producto_id);
    const { data: prods } = await supabaseAdmin
      .from('barraca_productos')
      .select('id, nombre, slug')
      .in('id', ids);
    const byId = new Map((prods ?? []).map((p) => [Number(p.id), p]));
    for (const tp of topProductos) {
      const real = byId.get(tp.producto_id);
      if (real) {
        (tp as { nombre: string; slug?: string }).nombre = String(real.nombre);
        (tp as { nombre: string; slug?: string }).slug = String(real.slug);
      }
    }
  }

  // 5. Reviews que dejó.
  const { data: reviews } = await supabaseAdmin
    .from('barraca_reviews')
    .select('id, producto_id, rating, titulo, comentario, estado, created_at, barraca_productos:producto_id(nombre, slug)')
    .eq('usuario_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  // 6. Wishlist actual.
  const { data: wishlist } = await supabaseAdmin
    .from('barraca_wishlist')
    .select('id, producto_id, created_at, barraca_productos:producto_id(id, nombre, slug, precio, imagen, stock)')
    .eq('usuario_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  // 7. Carrito actual (mira por email — el carrito usa session_id pero
  //    si el cliente está logueado, el flow ya guarda email en abandono).
  const { data: carritoAbandonado } = await supabaseAdmin
    .from('barraca_carritos_abandonados')
    .select('id, items, total, last_activity, recovery_count, converted_at')
    .eq('email', emailLower)
    .order('last_activity', { ascending: false })
    .limit(1);

  // 8. Maestros que refirieron a este cliente (distinct).
  const maestrosUsados = new Set<string>();
  for (const c of cots) {
    if (c.codigo_maestro) maestrosUsados.add(String(c.codigo_maestro));
  }

  // 9. KPIs agregados.
  const cotsPagadas = cots.filter((c) => c.estado === 'pagada');
  const ltv = cotsPagadas.reduce((s, c) => s + Number(c.total || 0), 0);
  const aov = cotsPagadas.length > 0 ? Math.round(ltv / cotsPagadas.length) : 0;
  const ultimaCompra = cotsPagadas.length > 0
    ? cotsPagadas
        .map((c) => new Date(c.pagada_at || c.created_at).getTime())
        .reduce((a, b) => (b > a ? b : a), 0)
    : 0;
  const diasSinComprar = ultimaCompra > 0
    ? Math.floor((Date.now() - ultimaCompra) / (24 * 3600 * 1000))
    : null;

  const stats = {
    ltv,
    aov,
    total_cotizaciones: cots.length,
    total_pagadas: cotsPagadas.length,
    total_canceladas: cots.filter((c) => ['anulada', 'cancelada', 'rechazada'].includes(c.estado)).length,
    ultima_compra_at: ultimaCompra > 0 ? new Date(ultimaCompra).toISOString() : null,
    dias_sin_comprar: diasSinComprar,
    reviews_publicadas: (reviews ?? []).filter((r) => r.estado === 'aprobada').length,
    wishlist_count: wishlist?.length ?? 0,
    referidos_por_maestros: Array.from(maestrosUsados),
  };

  return NextResponse.json({
    cliente,
    stats,
    cotizaciones: cots,
    top_productos: topProductos,
    reviews: reviews ?? [],
    wishlist: wishlist ?? [],
    carrito_abandonado: carritoAbandonado?.[0] ?? null,
  });
}
