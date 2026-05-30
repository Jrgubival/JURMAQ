import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { getClienteFromRequest } from '@/lib/cuenta-auth';

/**
 * POST /api/cuenta/cotizaciones/[id]/cancelar
 *
 * Cliente cancela una cotización propia. Reglas:
 *   - Solo si estado IN ('enviada', 'aceptada') — no se puede cancelar lo que
 *     ya pasó a contrato_creado / finalizada.
 *   - Solo si fecha_servicio > now + 24h (no cancelaciones de último minuto).
 *   - Solo si arrendatario_email = email del cliente logueado.
 *
 * Body: { motivo?: string }
 */

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  const cliente = await getClienteFromRequest(request);
  if (!cliente) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const cotId = parseInt(idStr, 10);
  if (Number.isNaN(cotId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const motivo = sanitizeString(body?.motivo) || 'Cancelada por el cliente';

  const { data: cot } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .select('id, estado, fecha_servicio, cliente_email')
    .eq('id', cotId)
    .maybeSingle();

  if (!cot) {
    return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
  }
  if ((cot.cliente_email as string | null)?.toLowerCase() !== cliente.email.toLowerCase()) {
    return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 });
  }
  if (!['enviada', 'aceptada'].includes(cot.estado)) {
    return NextResponse.json(
      { error: `No se puede cancelar una cotización en estado '${cot.estado}'` },
      { status: 409 },
    );
  }

  // Ventana mínima: fecha_servicio debe ser ≥ now + 24h.
  if (cot.fecha_servicio) {
    const limite = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const fechaSv = new Date(cot.fecha_servicio as string);
    if (fechaSv < limite) {
      return NextResponse.json(
        { error: 'No se puede cancelar con menos de 24h de anticipación. Contáctanos.' },
        { status: 409 },
      );
    }
  }

  // UPDATE condicional por estado: cierra la carrera (TOCTOU) entre la
  // verificación de arriba y este update. Si el admin avanzó el estado en el
  // intertanto, ninguna fila se actualiza y devolvemos 409.
  const { data: updRows, error: updErr } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .update({
      estado: 'cancelada',
      notas: motivo,
    })
    .eq('id', cotId)
    .in('estado', ['enviada', 'aceptada'])
    .select('id');

  if (updErr) {
    console.error('[cuenta-cancelar-fail]', updErr);
    return NextResponse.json({ error: 'No se pudo cancelar' }, { status: 500 });
  }
  if (!updRows || updRows.length === 0) {
    return NextResponse.json(
      { error: 'La cotización cambió de estado y ya no puede cancelarse. Recarga la página.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
