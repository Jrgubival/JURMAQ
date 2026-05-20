import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';

/**
 * GET /api/public/contratos/entrega/[token]
 *
 * Cliente accede vía link en email. Devuelve datos suficientes para mostrar
 * el monto a retener y el SDK Klap embebido en el portal.
 *
 * No requiere auth (token UUID validable por sí mismo).
 */

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  }

  const { data: contrato } = await supabaseAdmin
    .from('contratos')
    .select(
      'id, numero, estado, garantia_metodo, garantia_monto, arrendatario_nombre, arrendatario_razon_social, entrega_token_expira_at, maquinaria_id',
    )
    .eq('entrega_token', token)
    .maybeSingle();

  if (!contrato) {
    return NextResponse.json({ error: 'Token no encontrado' }, { status: 404 });
  }
  if (contrato.garantia_metodo !== 'klap_hold') {
    return NextResponse.json({ error: 'Este contrato no usa garantía Klap' }, { status: 409 });
  }
  if (contrato.entrega_token_expira_at && new Date(contrato.entrega_token_expira_at as string) < new Date()) {
    return NextResponse.json({ error: 'El link de autorización venció' }, { status: 410 });
  }
  if (!['en_entrega', 'firmado', 'vigente'].includes(contrato.estado)) {
    return NextResponse.json(
      { error: `El contrato está en estado '${contrato.estado}' y no acepta autorización de garantía.` },
      { status: 409 },
    );
  }

  // ¿Ya hay un hold activo? Entonces ya autorizó.
  const { data: holdActivo } = await supabaseAdmin
    .from('klap_holds')
    .select('id, estado, autorizado_at')
    .eq('contrato_id', contrato.id)
    .in('estado', ['active', 'renewed'])
    .maybeSingle();

  return NextResponse.json({
    contrato: {
      id: contrato.id,
      numero: contrato.numero,
      monto: Number(contrato.garantia_monto) || 0,
      nombre: contrato.arrendatario_nombre || contrato.arrendatario_razon_social,
      maquinaria_id: contrato.maquinaria_id,
    },
    ya_autorizado: !!holdActivo,
    hold_id: holdActivo?.id ?? null,
  });
}
