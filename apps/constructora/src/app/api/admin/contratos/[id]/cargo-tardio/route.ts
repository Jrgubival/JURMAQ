import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { logContratoEvent } from '@/lib/contratos-audit';
import { klapOffsessionCharge } from '@/lib/klap-client';
import { sendCargoTardioEmail } from '@jurmaq/shared/mail/templates/cliente-cargo-tardio';

/**
 * POST /api/admin/contratos/[id]/cargo-tardio
 *
 * Cobro off-session con la tarjeta guardada del cliente. Aplica hasta 90
 * días post-fecha_devolucion_real. Usa /charges con
 * charge_type.initiator='merchant', type='card_on_file'.
 *
 * Body: { monto, motivo, fotos?: string[] }
 */

const VENTANA_DIAS_MAX = 90;

interface Body {
  monto?: number;
  motivo?: string;
  fotos?: string[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('contratos', 'update');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id } = await params;
  const contratoId = parseInt(id, 10);
  if (Number.isNaN(contratoId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const monto = typeof body.monto === 'number' && body.monto > 0 ? Math.round(body.monto) : 0;
  const motivo = sanitizeString(body.motivo);
  if (monto <= 0 || !motivo) {
    return NextResponse.json({ error: 'monto y motivo son requeridos' }, { status: 400 });
  }

  const { data: contrato } = await supabaseAdmin
    .from('contratos')
    .select('id, estado, fecha_devolucion_real, garantia_metodo')
    .eq('id', contratoId)
    .maybeSingle();
  if (!contrato) {
    return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
  }
  if (!['finalizado', 'finalizado_con_cargo'].includes(contrato.estado)) {
    return NextResponse.json(
      { error: `Cargo tardío solo aplica a contratos finalizados, no '${contrato.estado}'` },
      { status: 409 },
    );
  }
  if (contrato.garantia_metodo !== 'klap_hold') {
    return NextResponse.json(
      { error: 'El cargo tardío sólo aplica a contratos con garantía Klap (tarjeta guardada).' },
      { status: 409 },
    );
  }
  if (!contrato.fecha_devolucion_real) {
    return NextResponse.json(
      { error: 'El contrato no tiene fecha de devolución registrada.' },
      { status: 409 },
    );
  }

  const diasDesdeDev = (Date.now() - new Date(contrato.fecha_devolucion_real as string).getTime()) / (24 * 60 * 60 * 1000);
  if (diasDesdeDev > VENTANA_DIAS_MAX) {
    return NextResponse.json(
      { error: `La ventana de cargo tardío venció (máx ${VENTANA_DIAS_MAX} días post-devolución). Pasaron ${Math.round(diasDesdeDev)} días.` },
      { status: 410 },
    );
  }

  // Cargar la tarjeta guardada del cliente (usada en el hold).
  const { data: hold } = await supabaseAdmin
    .from('klap_holds')
    .select('hold_inicial_id, klap_card_id')
    .eq('contrato_id', contratoId)
    .order('autorizado_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!hold || !hold.klap_card_id) {
    return NextResponse.json(
      { error: 'No hay tarjeta guardada para este contrato.' },
      { status: 404 },
    );
  }

  const { data: card } = await supabaseAdmin
    .from('klap_cards')
    .select('id, network_token, token_requestor_id, card_brand, card_last4, card_exp_month, card_exp_year, activa')
    .eq('id', hold.klap_card_id)
    .maybeSingle();
  if (!card || !card.activa) {
    return NextResponse.json({ error: 'Tarjeta inactiva o no encontrada' }, { status: 404 });
  }

  await logContratoEvent(request, contratoId, 'late_charge_attempted', { monto, motivo });

  const result = await klapOffsessionCharge({
    consumer_transaction_id: crypto.randomUUID(),
    consumer_related_transaction_id: hold.hold_inicial_id as string,
    amount: { value: monto, currency_code: 'CLP' },
    network_token: {
      network_token: card.network_token as string,
      token_requestor_id: card.token_requestor_id as string,
      card_brand: card.card_brand as 'VISA' | 'MASTERCARD' | 'AMEX',
      card_last4: card.card_last4 as string,
      card_exp_month: card.card_exp_month as number,
      card_exp_year: card.card_exp_year as number,
    },
    charge_type: { initiator: 'merchant', type: 'card_on_file' },
  });

  if (!result.ok || !result.data) {
    await supabaseAdmin.from('klap_offsession_charges').insert({
      klap_card_id: card.id,
      contrato_id: contratoId,
      monto,
      klap_charge_id: result.data?.trx_id || crypto.randomUUID(),
      estado: 'declined',
      motivo,
      evidencia_fotos: Array.isArray(body.fotos) ? body.fotos : null,
      cobrado_by: session.user?.id ?? null,
      decline_reason: result.data?.decline_reason || result.error || 'unknown',
    });
    await logContratoEvent(request, contratoId, 'late_charge_declined', {
      monto,
      reason: result.error || result.data?.decline_reason || 'unknown',
    });
    return NextResponse.json(
      { error: 'Klap rechazó el cargo', detalle: result.error || result.data?.decline_reason },
      { status: 502 },
    );
  }

  await supabaseAdmin.from('klap_offsession_charges').insert({
    klap_card_id: card.id,
    contrato_id: contratoId,
    monto,
    klap_charge_id: result.data.trx_id,
    estado: 'approved',
    motivo,
    evidencia_fotos: Array.isArray(body.fotos) ? body.fotos : null,
    cobrado_by: session.user?.id ?? null,
  });
  await supabaseAdmin.from('klap_eventos').insert({
    evento_tipo: 'late_charge_approved',
    contrato_id: contratoId,
    klap_transaction_id: result.data.trx_id,
    raw_response: result.raw ?? null,
    origen: 'admin',
    triggered_by: session.user?.id ?? null,
  });
  await logContratoEvent(request, contratoId, 'late_charge_approved', {
    monto,
    klap_charge_id: result.data.trx_id,
  });

  // Email cliente "cargo tardío aplicado" (best-effort).
  {
    const { data: full } = await supabaseAdmin
      .from('contratos')
      .select('numero, arrendatario_email, arrendatario_nombre, arrendatario_razon_social')
      .eq('id', contratoId)
      .single();
    if (full?.arrendatario_email) {
      void sendCargoTardioEmail(full.arrendatario_email as string, {
        arrendatarioNombre: String(full.arrendatario_nombre || full.arrendatario_razon_social || ''),
        numeroContrato: String(full.numero || contratoId),
        monto,
        cargoMonto: monto,
        cardBrand: card.card_brand as string,
        cardLast4: card.card_last4 as string,
        motivo: motivo as string,
      }).catch((e) => console.warn('[cargo-tardio-mail-fail]', e));
    }
  }

  return NextResponse.json({
    ok: true,
    monto,
    klap_charge_id: result.data.trx_id,
  });
}
