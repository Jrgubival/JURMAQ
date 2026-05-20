import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';

/**
 * GET /api/admin/dashboard?periodo=hoy|7d|30d|mes
 *
 * KPIs comparables vs período anterior:
 *   - Ventas totales (cotizaciones pagadas)
 *   - Cotizaciones nuevas
 *   - AOV (average order value)
 *   - Tasa de conversión (pagadas / total)
 *   - Top 5 productos por venta
 *   - Carritos abandonados sin recuperar
 *   - Cupones más usados
 */

export const runtime = 'nodejs';

type Periodo = 'hoy' | '7d' | '30d' | 'mes';

function ventana(p: Periodo): { desdeISO: string; hastaISO: string; previaDesdeISO: string; previaHastaISO: string } {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let dias = 7;
  if (p === 'hoy') dias = 1;
  if (p === '30d') dias = 30;
  if (p === 'mes') {
    // mes actual
    const start = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const startPrev = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    return {
      desdeISO: start.toISOString(),
      hastaISO: hoy.toISOString(),
      previaDesdeISO: startPrev.toISOString(),
      previaHastaISO: start.toISOString(),
    };
  }
  const desde = new Date(hoy.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);
  const previaDesde = new Date(hoy.getTime() - 2 * dias * 24 * 60 * 60 * 1000);
  const previaHasta = desde;
  return {
    desdeISO: desde.toISOString(),
    hastaISO: hoy.toISOString(),
    previaDesdeISO: previaDesde.toISOString(),
    previaHastaISO: previaHasta.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const session = await requirePermission('dashboard', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { searchParams } = new URL(request.url);
  const periodo = (searchParams.get('periodo') as Periodo) || '7d';
  const v = ventana(periodo);

  // Cotizaciones del período actual.
  const { data: cots } = await supabaseAdmin
    .from('barraca_cotizaciones')
    .select('id, estado, total, created_at, items, cupon_codigo, cupon_descuento')
    .gte('created_at', v.desdeISO)
    .lte('created_at', v.hastaISO);

  const { data: cotsPrev } = await supabaseAdmin
    .from('barraca_cotizaciones')
    .select('id, estado, total')
    .gte('created_at', v.previaDesdeISO)
    .lt('created_at', v.previaHastaISO);

  const totales = (cots ?? []).reduce(
    (acc, c) => {
      acc.cotizaciones++;
      if (c.estado === 'pagada') {
        acc.pagadas++;
        acc.ventas += Number(c.total) || 0;
      }
      return acc;
    },
    { cotizaciones: 0, pagadas: 0, ventas: 0 },
  );

  const prev = (cotsPrev ?? []).reduce(
    (acc, c) => {
      acc.cotizaciones++;
      if (c.estado === 'pagada') {
        acc.pagadas++;
        acc.ventas += Number(c.total) || 0;
      }
      return acc;
    },
    { cotizaciones: 0, pagadas: 0, ventas: 0 },
  );

  const pct = (curr: number, prev: number) => (prev === 0 ? null : Math.round(((curr - prev) / prev) * 100));
  const aov = totales.pagadas > 0 ? Math.round(totales.ventas / totales.pagadas) : 0;
  const conversion =
    totales.cotizaciones > 0 ? Math.round((totales.pagadas / totales.cotizaciones) * 100) : 0;

  // Top productos por cantidad vendida.
  const topProductos = new Map<string, { nombre: string; cantidad: number; revenue: number }>();
  for (const c of (cots ?? []).filter((x) => x.estado === 'pagada')) {
    const items = Array.isArray(c.items) ? (c.items as Array<Record<string, unknown>>) : [];
    for (const it of items) {
      const nombre = String(it.nombre ?? '');
      if (!nombre) continue;
      const cur = topProductos.get(nombre) ?? { nombre, cantidad: 0, revenue: 0 };
      cur.cantidad += Number(it.cantidad) || 0;
      cur.revenue += (Number(it.cantidad) || 0) * (Number(it.precio) || 0);
      topProductos.set(nombre, cur);
    }
  }
  const top5 = Array.from(topProductos.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Carritos abandonados sin convertir.
  const { count: abandonados } = await supabaseAdmin
    .from('barraca_carrito_abandonado')
    .select('*', { count: 'exact', head: true })
    .is('converted_at', null)
    .gte('last_activity', v.desdeISO);

  // Top cupones usados.
  const cuponesUsados = new Map<string, number>();
  for (const c of cots ?? []) {
    if (c.cupon_codigo && c.estado === 'pagada') {
      cuponesUsados.set(String(c.cupon_codigo), (cuponesUsados.get(String(c.cupon_codigo)) ?? 0) + 1);
    }
  }
  const topCupones = Array.from(cuponesUsados.entries())
    .map(([codigo, usos]) => ({ codigo, usos }))
    .sort((a, b) => b.usos - a.usos)
    .slice(0, 5);

  return NextResponse.json({
    periodo,
    ventana: { desde: v.desdeISO, hasta: v.hastaISO },
    kpis: {
      ventas: { actual: totales.ventas, anterior: prev.ventas, delta_pct: pct(totales.ventas, prev.ventas) },
      cotizaciones: {
        actual: totales.cotizaciones,
        anterior: prev.cotizaciones,
        delta_pct: pct(totales.cotizaciones, prev.cotizaciones),
      },
      pedidos_pagados: {
        actual: totales.pagadas,
        anterior: prev.pagadas,
        delta_pct: pct(totales.pagadas, prev.pagadas),
      },
      aov,
      conversion_pct: conversion,
      carritos_abandonados: abandonados ?? 0,
    },
    top_productos: top5,
    top_cupones: topCupones,
    generated_at: new Date().toISOString(),
  });
}
