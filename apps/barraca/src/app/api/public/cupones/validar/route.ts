import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { getClientIp, rateLimit } from '@jurmaq/shared/rate-limit';

/**
 * POST /api/public/cupones/validar
 *
 * Body: { codigo, monto_compra, email }
 * Response: { ok: true, descuento, descripcion } | { ok: false, error }
 *
 * Valida sin "consumir" — solo chequea reglas.
 * El uso real se registra al momento de crear la cotización.
 */

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Origen no autorizado' }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rl = rateLimit(`cupon-validar:${ip}`, { maxAttempts: 20, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: 'Demasiadas validaciones' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const codigo = sanitizeString(body?.codigo)?.toUpperCase().trim() || '';
  const monto = Number(body?.monto_compra) || 0;
  const email = sanitizeString(body?.email)?.toLowerCase().trim() || '';

  if (!codigo || !/^[A-Z0-9_-]{3,30}$/.test(codigo)) {
    return NextResponse.json({ ok: false, error: 'Código inválido' }, { status: 400 });
  }
  if (monto <= 0) {
    return NextResponse.json({ ok: false, error: 'Monto debe ser mayor a cero' }, { status: 400 });
  }

  const { data: cupon } = await supabaseAdmin
    .from('barraca_cupones')
    .select('id, codigo, tipo, valor, descripcion, monto_minimo_compra, max_usos_total, max_usos_por_usuario, usos_actuales, valido_desde, valido_hasta, activo')
    .eq('codigo', codigo)
    .maybeSingle();

  if (!cupon || !cupon.activo) {
    return NextResponse.json({ ok: false, error: 'Cupón no encontrado o inactivo' }, { status: 404 });
  }

  // Vigencia.
  const now = new Date();
  if (cupon.valido_desde && new Date(String(cupon.valido_desde)) > now) {
    return NextResponse.json({ ok: false, error: 'Cupón aún no vigente' }, { status: 410 });
  }
  if (cupon.valido_hasta && new Date(String(cupon.valido_hasta)) < now) {
    return NextResponse.json({ ok: false, error: 'Cupón vencido' }, { status: 410 });
  }
  if (cupon.max_usos_total && Number(cupon.usos_actuales) >= Number(cupon.max_usos_total)) {
    return NextResponse.json({ ok: false, error: 'Cupón agotado' }, { status: 410 });
  }
  if (monto < Number(cupon.monto_minimo_compra)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Requiere compra mínima de $${Number(cupon.monto_minimo_compra).toLocaleString('es-CL')}`,
      },
      { status: 412 },
    );
  }

  // Validar max_usos_por_usuario.
  if (email && Number(cupon.max_usos_por_usuario) > 0) {
    const { count } = await supabaseAdmin
      .from('barraca_cupones_usos')
      .select('*', { count: 'exact', head: true })
      .eq('cupon_id', cupon.id)
      .ilike('email', email);
    if ((count ?? 0) >= Number(cupon.max_usos_por_usuario)) {
      return NextResponse.json(
        { ok: false, error: 'Ya usaste este cupón anteriormente' },
        { status: 409 },
      );
    }
  }

  // Calcular descuento.
  const descuento =
    cupon.tipo === 'porcentaje'
      ? Math.round((monto * Number(cupon.valor)) / 100)
      : Math.min(Number(cupon.valor), monto);

  return NextResponse.json({
    ok: true,
    cupon_id: cupon.id,
    codigo: cupon.codigo,
    descripcion: cupon.descripcion,
    descuento,
    monto_final: monto - descuento,
  });
}
