import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';

/**
 * GET /api/admin/reportes/rentabilidad?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 *
 * Tier 5 E4: Reporte de rentabilidad por máquina.
 *
 * Para cada máquina activa, calcula en el período:
 *   - Ingresos brutos: SUM(total) de cotizaciones_arriendo con estado='pagada'
 *     o vinculadas a contratos vigentes/finalizados
 *   - Costos:
 *       mantenciones: SUM(costo) de maquinaria_mantenciones en período
 *       reserva mantenimiento: SUM(reserva_mantencion) — % implícito
 *         del precio en cotizaciones (lo cobramos al cliente)
 *   - Utilidad: ingresos - costos
 *   - ROI: utilidad / (sumar ingresos × meses del período) — un proxy
 *   - Total cotizaciones, aceptadas, conversión
 *   - Unidades totales arrendadas (horas o días según unidad_tarifa)
 *
 * Permiso: requiere ver maquinarias + cotizaciones (admin/gerente típicos).
 *
 * Output: JSON con array `maquinas` ordenado por utilidad desc + resumen
 *   global.
 */

export const runtime = 'nodejs';

interface MaqRow {
  id: number;
  nombre: string;
  tipo: string;
  tarifa_neta: number | null;
  unidad_tarifa: 'hora' | 'dia' | null;
  estado: string;
}

interface CotRow {
  maquinaria_id: number;
  estado: string;
  total: number;
  subtotal_neto: number | null;
  reserva_mantencion: number | null;
  utilidad_real: number | null;
  unidades_solicitadas: number | null;
  unidad: string | null;
  created_at: string;
}

interface MantencionRow {
  maquinaria_id: number;
  costo: number;
  fecha: string;
}

function parseDate(s: string | null): string | null {
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export async function GET(request: NextRequest) {
  const session = await requirePermission('maquinarias', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');
  // Verifica también que tenga acceso a cotizaciones (vendedor las maneja).
  const session2 = await requirePermission('cotizaciones', 'read');
  if (!session2) return forbiddenResponse('No tienes permiso para reportes');

  const { searchParams } = new URL(request.url);
  const desde = parseDate(searchParams.get('desde'));
  const hasta = parseDate(searchParams.get('hasta'));

  // Default: último año.
  const fechaDesde = desde || new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const fechaHasta = hasta || new Date().toISOString().slice(0, 10);

  if (fechaDesde > fechaHasta) {
    return NextResponse.json({ error: 'desde debe ser ≤ hasta' }, { status: 400 });
  }

  // 1. Trae todas las máquinas.
  const { data: maqsRaw } = await supabaseAdmin
    .from('maquinarias')
    .select('id, nombre, tipo, tarifa_neta, unidad_tarifa, estado')
    .order('nombre');
  const maquinas = (maqsRaw ?? []) as MaqRow[];

  if (maquinas.length === 0) {
    return NextResponse.json({
      periodo: { desde: fechaDesde, hasta: fechaHasta },
      maquinas: [],
      resumen: { ingresos: 0, costos: 0, utilidad: 0 },
    });
  }

  // 2. Trae todas las cotizaciones del período.
  const { data: cotsRaw } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .select(
      'maquinaria_id, estado, total, subtotal_neto, reserva_mantencion, utilidad_real, unidades_solicitadas, unidad, created_at',
    )
    .gte('created_at', `${fechaDesde}T00:00:00`)
    .lte('created_at', `${fechaHasta}T23:59:59`);
  const cots = (cotsRaw ?? []) as CotRow[];

  // 3. Trae todas las mantenciones del período.
  const { data: mansRaw } = await supabaseAdmin
    .from('maquinaria_mantenciones')
    .select('maquinaria_id, costo, fecha')
    .gte('fecha', fechaDesde)
    .lte('fecha', fechaHasta);
  const mans = (mansRaw ?? []) as MantencionRow[];

  // 4. Estados que cuentan como "ingreso confirmado".
  const ESTADOS_INGRESO = new Set([
    'aceptada',
    'contrato_creado',
    'finalizada',
    'pagada',
  ]);

  // 5. Agregar por máquina.
  const reportes = maquinas.map((m) => {
    const cotsMaq = cots.filter((c) => c.maquinaria_id === m.id);
    const cotsPagadas = cotsMaq.filter((c) => ESTADOS_INGRESO.has(c.estado));
    const cotsCanceladas = cotsMaq.filter((c) =>
      ['rechazada', 'cancelada'].includes(c.estado),
    );

    const ingresos = cotsPagadas.reduce((s, c) => s + Number(c.total || 0), 0);
    const ingresosNeto = cotsPagadas.reduce(
      (s, c) => s + Number(c.subtotal_neto || c.total || 0),
      0,
    );
    const reservaCobrada = cotsPagadas.reduce(
      (s, c) => s + Number(c.reserva_mantencion || 0),
      0,
    );
    const utilidadEstimada = cotsPagadas.reduce(
      (s, c) => s + Number(c.utilidad_real || 0),
      0,
    );

    const mantenMaq = mans.filter((mm) => mm.maquinaria_id === m.id);
    const costoMantencion = mantenMaq.reduce((s, mm) => s + Number(mm.costo || 0), 0);

    const utilidadReal = ingresosNeto - costoMantencion;

    // Unidades totales arrendadas (horas o días según tarifa).
    const unidadesArrendadas = cotsPagadas.reduce(
      (s, c) => s + Number(c.unidades_solicitadas || 0),
      0,
    );

    const conversion =
      cotsMaq.length > 0 ? Math.round((cotsPagadas.length / cotsMaq.length) * 100) : 0;

    // Margen sobre ingresos (% utilidad real / ingresos neto).
    const margenPorcentaje =
      ingresosNeto > 0 ? Math.round((utilidadReal / ingresosNeto) * 100) : 0;

    return {
      maquinaria_id: m.id,
      nombre: m.nombre,
      tipo: m.tipo,
      estado: m.estado,
      tarifa_neta: m.tarifa_neta,
      unidad_tarifa: m.unidad_tarifa,
      // Ingresos
      ingresos_brutos: ingresos,
      ingresos_neto: ingresosNeto,
      reserva_mantencion_cobrada: reservaCobrada,
      utilidad_real_estimada: utilidadEstimada,
      // Costos
      costo_mantenciones: costoMantencion,
      total_mantenciones: mantenMaq.length,
      // Bottom line
      utilidad_neta: utilidadReal,
      margen_porcentaje: margenPorcentaje,
      // Operacional
      total_cotizaciones: cotsMaq.length,
      cotizaciones_aceptadas: cotsPagadas.length,
      cotizaciones_canceladas: cotsCanceladas.length,
      conversion_porcentaje: conversion,
      unidades_arrendadas: unidadesArrendadas,
    };
  });

  // 6. Ordenar por utilidad desc.
  reportes.sort((a, b) => b.utilidad_neta - a.utilidad_neta);

  // 7. Resumen global.
  const resumen = {
    ingresos_brutos: reportes.reduce((s, r) => s + r.ingresos_brutos, 0),
    ingresos_neto: reportes.reduce((s, r) => s + r.ingresos_neto, 0),
    costo_mantenciones: reportes.reduce((s, r) => s + r.costo_mantenciones, 0),
    utilidad_neta: reportes.reduce((s, r) => s + r.utilidad_neta, 0),
    total_cotizaciones: reportes.reduce((s, r) => s + r.total_cotizaciones, 0),
    total_aceptadas: reportes.reduce((s, r) => s + r.cotizaciones_aceptadas, 0),
  };

  return NextResponse.json({
    periodo: { desde: fechaDesde, hasta: fechaHasta },
    maquinas: reportes,
    resumen,
  });
}
