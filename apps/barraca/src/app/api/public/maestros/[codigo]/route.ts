import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';

/**
 * GET /api/public/maestros/[codigo]
 *
 * Página pública de perfil de maestro (e.g. https://barraca.jurmaq.cl/maestros/MAE-2026-001).
 * Solo expone: nombre + total de referidos. NO RUT, email ni datos bancarios.
 *
 * Usado para que el maestro comparta link a clientes:
 *   "Comprá en barraca.jurmaq.cl/maestros/MAE-2026-001 y se aplica auto."
 */

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { codigo: rawCodigo } = await params;
  const codigo = rawCodigo.toUpperCase().trim();

  if (!/^MAE-[0-9]{4}-[0-9]+$/.test(codigo)) {
    return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
  }

  const { data: maestro } = await supabaseAdmin
    .from('maestros')
    .select('id, codigo, nombre, activo, porcentaje_comision, created_at')
    .eq('codigo', codigo)
    .maybeSingle();

  if (!maestro || !maestro.activo) {
    return NextResponse.json({ error: 'Maestro no encontrado' }, { status: 404 });
  }

  // Stats agregadas, sin tocar montos individuales (privacidad).
  const { count: totalReferidos } = await supabaseAdmin
    .from('comisiones_maestro')
    .select('*', { count: 'exact', head: true })
    .eq('maestro_id', maestro.id)
    .in('estado', ['devengada', 'pagada']);

  return NextResponse.json({
    codigo: maestro.codigo,
    nombre: maestro.nombre,
    porcentaje_comision: Number(maestro.porcentaje_comision),
    miembro_desde: maestro.created_at,
    total_referidos: totalReferidos ?? 0,
  });
}
