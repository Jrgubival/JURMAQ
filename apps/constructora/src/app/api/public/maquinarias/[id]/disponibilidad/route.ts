import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { getClientIp, rateLimit } from '@jurmaq/shared/rate-limit';

/**
 * GET /api/public/maquinarias/[id]/disponibilidad?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 *
 * Devuelve los rangos OCUPADOS (no disponibles) de una máquina en una ventana
 * de tiempo. El cliente arma el calendario gris/disponible en el front.
 *
 * Considera:
 *   - bloqueos_maquinaria (mantenciones)
 *   - cotizaciones_arriendo con estado IN ('aceptada','contrato_creado','finalizada')
 *   - contratos con estado IN ('firmado','vigente','en_entrega','en_devolucion')
 *
 * Auth: público. Rate-limit 60 req/min por IP (es un endpoint de browse).
 */

export const runtime = 'nodejs';
export const maxDuration = 10;

interface Bloque {
  desde: string;
  hasta: string;
  tipo: 'mantencion' | 'contrato' | 'cotizacion';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = getClientIp(request);
  const rl = rateLimit(`maq-dispo:${ip}`, { maxAttempts: 60, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }

  const { id: idStr } = await params;
  const maqId = parseInt(idStr, 10);
  if (Number.isNaN(maqId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const hoyCL = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const desde = searchParams.get('desde') || hoyCL;
  const hastaDefault = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const hasta = searchParams.get('hasta') || hastaDefault;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return NextResponse.json({ error: 'Fechas inválidas (YYYY-MM-DD)' }, { status: 400 });
  }

  // 1. Mantenciones.
  const { data: bloqueos } = await supabaseAdmin
    .from('bloqueos_maquinaria')
    .select('fecha_inicio, fecha_fin')
    .eq('maquinaria_id', maqId)
    .gte('fecha_fin', desde)
    .lte('fecha_inicio', hasta);

  // 2. Cotizaciones en estados de reserva firme.
  const { data: cots } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .select('fecha_servicio, unidades_solicitadas, unidad')
    .eq('maquinaria_id', maqId)
    .in('estado', ['aceptada', 'contrato_creado'])
    .gte('fecha_servicio', desde)
    .lte('fecha_servicio', hasta);

  // 3. Contratos firmados/vigentes.
  const { data: contratos } = await supabaseAdmin
    .from('contratos')
    .select('fecha_inicio, fecha_termino')
    .eq('maquinaria_id', maqId)
    .in('estado', ['firmado', 'vigente', 'en_entrega', 'en_devolucion'])
    .gte('fecha_termino', desde)
    .lte('fecha_inicio', hasta);

  const bloques: Bloque[] = [];
  for (const b of bloqueos ?? []) {
    bloques.push({
      desde: String(b.fecha_inicio),
      hasta: String(b.fecha_fin),
      tipo: 'mantencion',
    });
  }
  for (const c of cots ?? []) {
    // Estimación: si unidad='dia', días = unidades; si 'hora', asumimos mismo día.
    const inicio = new Date(String(c.fecha_servicio));
    const unidades = Number(c.unidades_solicitadas) || 1;
    const dias = c.unidad === 'dia' ? Math.ceil(unidades) : 1;
    const fin = new Date(inicio.getTime() + (dias - 1) * 24 * 60 * 60 * 1000);
    bloques.push({
      desde: inicio.toISOString().slice(0, 10),
      hasta: fin.toISOString().slice(0, 10),
      tipo: 'cotizacion',
    });
  }
  for (const k of contratos ?? []) {
    if (k.fecha_inicio && k.fecha_termino) {
      bloques.push({
        desde: String(k.fecha_inicio),
        hasta: String(k.fecha_termino),
        tipo: 'contrato',
      });
    }
  }

  // Primera fecha libre = primer día consecutivo no bloqueado a partir de hoy.
  // (cliente puede usarlo para mostrar "Disponible desde X")
  const primeraFechaLibre = encontrarPrimerLibre(bloques, desde);

  return NextResponse.json({
    maquinaria_id: maqId,
    desde,
    hasta,
    bloques: bloques.sort((a, b) => a.desde.localeCompare(b.desde)),
    primera_fecha_libre: primeraFechaLibre,
  });
}

function encontrarPrimerLibre(bloques: Bloque[], desde: string): string {
  const fechaActual = new Date(desde);
  let cursor = fechaActual.toISOString().slice(0, 10);
  // Avanzamos día a día (máx 90 días) hasta encontrar uno no bloqueado.
  for (let i = 0; i < 90; i++) {
    const ocupado = bloques.some((b) => cursor >= b.desde && cursor <= b.hasta);
    if (!ocupado) return cursor;
    fechaActual.setDate(fechaActual.getDate() + 1);
    cursor = fechaActual.toISOString().slice(0, 10);
  }
  return cursor;
}
