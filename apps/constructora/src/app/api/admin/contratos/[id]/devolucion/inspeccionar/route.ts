import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { logContratoEvent } from '@/lib/contratos-audit';
import { klapCancel, klapCapture } from '@/lib/klap-client';

/**
 * POST /api/admin/contratos/[id]/devolucion/inspeccionar
 *
 * Punto central del flow de devolución. Admin decide:
 *   - { resultado: 'sin_danos' } → cancela el hold Klap, contrato → 'finalizado'
 *   - { resultado: 'con_danos', monto_dano, descripcion_dano, fotos? } → captura
 *     parcial del hold por el monto del daño, contrato → 'finalizado_con_cargo'.
 *     Si monto > hold disponible, se captura todo y queda flag para cargo
 *     tardío del excedente.
 *
 * Body:
 *   {
 *     resultado: 'sin_danos' | 'con_danos',
 *     monto_dano?: number,
 *     descripcion_dano?: string,
 *     fotos?: string[]   // array de storage_path de fotos ya subidas
 *   }
 */

interface Body {
  resultado?: 'sin_danos' | 'con_danos';
  monto_dano?: number;
  descripcion_dano?: string;
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
  const resultado = body.resultado;
  if (resultado !== 'sin_danos' && resultado !== 'con_danos') {
    return NextResponse.json({ error: 'resultado debe ser sin_danos o con_danos' }, { status: 400 });
  }

  const { data: contrato } = await supabaseAdmin
    .from('contratos')
    .select('id, estado, garantia_metodo, hold_klap_id')
    .eq('id', contratoId)
    .maybeSingle();
  if (!contrato) {
    return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
  }
  if (contrato.estado !== 'en_devolucion') {
    return NextResponse.json(
      { error: `Solo se inspecciona en estado en_devolucion, no '${contrato.estado}'` },
      { status: 409 },
    );
  }

  // Cargar el hold activo del contrato (si garantia_metodo='klap_hold').
  let holdActivo: { id: string; hold_actual_id: string; monto: number; klap_card_id: string } | null = null;
  if (contrato.garantia_metodo === 'klap_hold') {
    const { data } = await supabaseAdmin
      .from('klap_holds')
      .select('id, hold_actual_id, monto, klap_card_id')
      .eq('contrato_id', contratoId)
      .in('estado', ['active', 'renewed'])
      .order('autorizado_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    holdActivo = data
      ? {
          id: data.id as string,
          hold_actual_id: data.hold_actual_id as string,
          monto: Number(data.monto),
          klap_card_id: data.klap_card_id as string,
        }
      : null;
  }

  // Guardar fotos en contratos_fotos (si vinieron).
  if (Array.isArray(body.fotos) && body.fotos.length > 0) {
    const inserts = body.fotos.slice(0, 10).map((path) => ({
      contrato_id: contratoId,
      tipo: resultado === 'sin_danos' ? 'devolucion' : 'dano',
      storage_path: String(path),
      subido_by: session.user?.id ?? null,
    }));
    await supabaseAdmin.from('contratos_fotos').insert(inserts).then(() => undefined, () => undefined);
  }

  // ─── SIN DAÑOS ──────────────────────────────────────────────────────────
  if (resultado === 'sin_danos') {
    if (holdActivo) {
      const cancelRes = await klapCancel({
        consumer_transaction_id: crypto.randomUUID(),
        consumer_original_transaction_id: holdActivo.hold_actual_id,
        amount: { value: holdActivo.monto, currency_code: 'CLP' },
      });
      if (!cancelRes.ok) {
        // Loggeamos pero no bloqueamos — el admin sabrá que hay un hold pendiente.
        console.error('[devolucion-cancel-fail]', cancelRes.error);
      } else {
        await supabaseAdmin
          .from('klap_holds')
          .update({
            estado: 'cancelled',
            cancelado_at: new Date().toISOString(),
            cancelado_motivo: 'devolucion_sin_danos',
          })
          .eq('id', holdActivo.id);
        await supabaseAdmin.from('klap_eventos').insert({
          evento_tipo: 'deposit_released',
          contrato_id: contratoId,
          hold_id: holdActivo.id,
          klap_transaction_id: cancelRes.data?.trx_id ?? null,
          raw_response: cancelRes.raw ?? null,
          origen: 'admin',
          triggered_by: session.user?.id ?? null,
        });
      }
    }

    await supabaseAdmin
      .from('contratos')
      .update({
        estado: 'finalizado',
        fecha_devolucion_real: new Date().toISOString(),
      })
      .eq('id', contratoId);

    await logContratoEvent(request, contratoId, 'return_inspection_completed', { resultado: 'sin_danos' });
    await logContratoEvent(request, contratoId, 'deposit_released', { motivo: 'sin_danos', hold_id: holdActivo?.id ?? null });

    return NextResponse.json({ ok: true, estado: 'finalizado', hold_cancelado: !!holdActivo });
  }

  // ─── CON DAÑOS ──────────────────────────────────────────────────────────
  const montoDano = typeof body.monto_dano === 'number' && body.monto_dano > 0 ? Math.round(body.monto_dano) : 0;
  const desc = sanitizeString(body.descripcion_dano) || 'Daño registrado';
  if (montoDano <= 0) {
    return NextResponse.json({ error: 'monto_dano debe ser > 0' }, { status: 400 });
  }

  if (!holdActivo) {
    // Sin Klap hold: solo registramos el daño en el contrato y marcamos
    // finalizado_con_cargo. El admin gestiona el cobro fuera del sistema (cheque, etc).
    await supabaseAdmin
      .from('contratos')
      .update({
        estado: 'finalizado_con_cargo',
        fecha_devolucion_real: new Date().toISOString(),
      })
      .eq('id', contratoId);
    await logContratoEvent(request, contratoId, 'return_inspection_completed', {
      resultado: 'con_danos',
      monto_dano: montoDano,
      descripcion: desc,
      sin_klap: true,
    });
    return NextResponse.json({ ok: true, estado: 'finalizado_con_cargo', captured: 0, excedente: montoDano });
  }

  // Captura parcial — limitada al monto del hold.
  const montoCapturar = Math.min(montoDano, holdActivo.monto);
  const excedente = montoDano - montoCapturar;

  const captureRes = await klapCapture({
    consumer_transaction_id: crypto.randomUUID(),
    consumer_original_transaction_id: holdActivo.hold_actual_id,
    amount: { value: montoCapturar, currency_code: 'CLP' },
  });

  if (!captureRes.ok || !captureRes.data) {
    return NextResponse.json(
      { error: 'Captura Klap falló', detalle: captureRes.error },
      { status: 502 },
    );
  }

  // Persistir captura + actualizar hold.
  await supabaseAdmin.from('klap_captures').insert({
    hold_id: holdActivo.id,
    contrato_id: contratoId,
    monto: montoCapturar,
    klap_capture_id: captureRes.data.trx_id,
    klap_authorization_code: captureRes.data.external_authorization_code ?? null,
    motivo: desc,
    evidencia_fotos: Array.isArray(body.fotos) ? body.fotos : null,
    capturado_by: session.user?.id ?? null,
  });

  await supabaseAdmin
    .from('klap_holds')
    .update({
      estado: montoCapturar === holdActivo.monto ? 'captured' : 'partial_captured',
      capturado_monto: montoCapturar,
      capturado_at: new Date().toISOString(),
    })
    .eq('id', holdActivo.id);

  await supabaseAdmin.from('klap_eventos').insert({
    evento_tipo: 'deposit_captured',
    contrato_id: contratoId,
    hold_id: holdActivo.id,
    klap_transaction_id: captureRes.data.trx_id,
    raw_response: captureRes.raw ?? null,
    origen: 'admin',
    triggered_by: session.user?.id ?? null,
  });

  await supabaseAdmin
    .from('contratos')
    .update({
      estado: 'finalizado_con_cargo',
      fecha_devolucion_real: new Date().toISOString(),
    })
    .eq('id', contratoId);

  await logContratoEvent(request, contratoId, 'return_inspection_completed', {
    resultado: 'con_danos',
    monto_dano: montoDano,
    monto_capturado: montoCapturar,
    excedente,
  });
  await logContratoEvent(request, contratoId, 'deposit_captured', {
    monto: montoCapturar,
    klap_capture_id: captureRes.data.trx_id,
  });

  return NextResponse.json({
    ok: true,
    estado: 'finalizado_con_cargo',
    captured: montoCapturar,
    excedente,
    klap_capture_id: captureRes.data.trx_id,
    aviso_excedente: excedente > 0
      ? `Captura parcial completa. Quedan $${excedente} pendientes — usa "cargo tardío" para cobrar el excedente (dentro de 90 días).`
      : null,
  });
}
