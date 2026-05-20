import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';

/**
 * GET /api/admin/garantias?contrato_id=N
 *
 * Devuelve el estado completo de la garantía de un contrato:
 *   - hold (Klap) si existe
 *   - card guardada del cliente (si hay hold)
 *   - garantia tradicional (cheque/depósito/etc) si existe
 *
 * GET /api/admin/garantias (sin filtro)
 * Devuelve panel global con renovaciones próximas + holds activos +
 * captures + cargos tardíos recientes.
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await requirePermission('contratos', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { searchParams } = new URL(request.url);
  const contratoIdParam = searchParams.get('contrato_id');

  if (contratoIdParam) {
    const contratoId = parseInt(contratoIdParam, 10);
    if (Number.isNaN(contratoId)) {
      return NextResponse.json({ error: 'contrato_id inválido' }, { status: 400 });
    }

    const { data: hold } = await supabaseAdmin
      .from('klap_holds')
      .select(
        'id, monto, estado, autorizado_at, expira_at, renovaciones_count, capturado_monto, klap_card_id',
      )
      .eq('contrato_id', contratoId)
      .order('autorizado_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let card = null;
    if (hold?.klap_card_id) {
      const { data } = await supabaseAdmin
        .from('klap_cards')
        .select('id, card_brand, card_last4, card_exp_month, card_exp_year, activa')
        .eq('id', hold.klap_card_id)
        .maybeSingle();
      card = data ?? null;
    }

    const { data: tradicional } = await supabaseAdmin
      .from('garantias_tradicionales')
      .select('metodo, monto, recibido_at, devuelto_at, notas')
      .eq('contrato_id', contratoId)
      .maybeSingle();

    return NextResponse.json({ hold, card, tradicional });
  }

  // Panel global.
  const ahoraIso = new Date().toISOString();
  const en7Dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [renovacionesProximas, renovacionesFallidas, capturesRecientes, cargosTardios] = await Promise.all([
    supabaseAdmin
      .from('klap_holds')
      .select('id, contrato_id, monto, autorizado_at, expira_at, renovaciones_count')
      .eq('estado', 'active')
      .lte('renovacion_proxima_at', en7Dias)
      .gte('renovacion_proxima_at', ahoraIso)
      .order('renovacion_proxima_at', { ascending: true })
      .limit(50),
    supabaseAdmin
      .from('klap_holds')
      .select('id, contrato_id, monto, autorizado_at, notas, renovaciones_count')
      .in('estado', ['renewal_failed', 'renewal_failed_terminal'])
      .order('autorizado_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('klap_captures')
      .select('id, contrato_id, monto, motivo, capturado_at')
      .order('capturado_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('klap_offsession_charges')
      .select('id, contrato_id, monto, motivo, estado, cobrado_at, decline_reason')
      .order('cobrado_at', { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({
    renovaciones_proximas: renovacionesProximas.data ?? [],
    renovaciones_fallidas: renovacionesFallidas.data ?? [],
    captures_recientes: capturesRecientes.data ?? [],
    cargos_tardios: cargosTardios.data ?? [],
    generated_at: ahoraIso,
  });
}
